/**
 * view.ts — the pure pan/zoom transform model (spec §3, L2 SVG math).
 *
 * The stage renders a page host at `translate3d(x,y,0) scale(z)` with
 * `transform-origin: 0 0`. This module owns the *math* of that transform:
 * where a bbox lands on screen (`frameBboxToView`) and where a point in SVG
 * user space lands in stage space (`bboxToScreen`), plus the tween interpolation
 * (`lerpView`, `easeInOutCubic`). It is DOM-free and framework-free so the hop
 * choreography can be unit-tested against known numbers without a browser — the
 * highest-value seam in the cross-page hop (a wrong scale factor lands the ayah
 * off-screen).
 *
 * Ported from the mock's `focus()`/`toScreen()` (docs/reference/linker-mock.html
 * lines 420–426, 513): `s = contentWidth / viewBoxWidth` maps SVG user units to
 * host CSS px; `z` multiplies on top; the target translate centers the bbox in
 * the stage. Because every mushaf page shares one square-ish viewBox and the host
 * preserves aspect ratio, `s` is uniform in x and y.
 */

import type { Rect } from "./highlighter.js";

/** The imperative transform written to the host: translate3d(x,y) scale(z). */
export interface View {
  x: number;
  y: number;
  z: number;
}

/**
 * The stage and the page inside it, in CSS px. Enough to answer "may the page
 * be here?", which is all `clampView` asks.
 *
 * `contentHeight` is not derivable from `contentWidth` here even though the
 * host preserves aspect ratio: the ratio lives in the SVG's viewBox, this
 * module is only given the viewBox *width*, and inventing the missing half from
 * a hard-coded 550 would be a constant that silently stops being true the first
 * time a second edition is vendored. The caller has the rendered box; it passes
 * both sides of it.
 */
export interface StageFit {
  /** Rendered content width of the host in CSS px at z=1 (the mock's `matW`). */
  contentWidth: number;
  /** Rendered content height of the host in CSS px at z=1. */
  contentHeight: number;
  /** Stage viewport width in CSS px. */
  stageWidth: number;
  /** Stage viewport height in CSS px. */
  stageHeight: number;
}

/** Geometry the framing math needs — all in CSS px except `viewBoxWidth`. */
export interface FrameContext extends StageFit {
  /** The page's viewBox width in SVG user units (345 for the Madani asset). */
  viewBoxWidth: number;
}

/** Default hop zoom — matches the mock's `focus(b, 1.55)`. */
export const DEFAULT_HOP_ZOOM = 1.55;

/**
 * Hold one axis inside the stage.
 *
 * Two regimes, and the split is the whole idea. When the scaled page is *larger*
 * than the stage the translate may roam, but only over the overhang — the page's
 * near edge never comes inside the stage's, so the stage is always full of page.
 * When it is *smaller* there is no roaming to do and the only honest answer is
 * the middle; the reader cannot pan a page that already fits, and letting them
 * would mean a page could be shoved half off the screen with nothing to drag it
 * back by.
 */
function holdAxis(available: number, scaled: number, value: number): number {
  // Not yet laid out (a host is `display: none` until it is the current page,
  // and a hidden element measures 0). Guessing "centred" from a zero box would
  // slam the page into the corner on the frame the measurement lands.
  if (!(scaled > 0) || !(available > 0)) return value;
  if (scaled <= available) return (available - scaled) / 2;
  return Math.min(0, Math.max(available - scaled, value));
}

/**
 * Hold a view inside the stage, so no gesture and no hop can put blank stage
 * where the mus'haf should be.
 *
 * This is what makes a hop to an ayah near the foot of the page land on the
 * *page* rather than on a band of empty paper: framing centres the ayah, and
 * centring an ayah that is 40 px from the bottom edge asks for the page to be
 * dragged half a screen past its own end. Framing proposes; this decides.
 */
export function clampView(v: View, fit: StageFit): View {
  return {
    z: v.z,
    x: holdAxis(fit.stageWidth, fit.contentWidth * v.z, v.x),
    y: holdAxis(fit.stageHeight, fit.contentHeight * v.z, v.y),
  };
}

/**
 * Compute the `View` that brings `bbox` (SVG user units) as close to the stage
 * centre as the page's own edges allow, at zoom `z`. This is the mock's
 * `focus()` — scale user→px by `s = contentWidth/vbW`, take the bbox center,
 * translate so that center sits at the stage center — followed by `clampView`,
 * which the mock had no equivalent of and which is the difference between a hop
 * that lands on scripture and one that lands on the margin.
 */
export function frameBboxToView(
  bbox: Rect,
  ctx: FrameContext,
  z: number = DEFAULT_HOP_ZOOM,
): View {
  const s = ctx.contentWidth / ctx.viewBoxWidth;
  const cx = (bbox.x + bbox.width / 2) * s;
  const cy = (bbox.y + bbox.height / 2) * s;
  return clampView(
    {
      z,
      x: ctx.stageWidth / 2 - z * cx,
      y: ctx.stageHeight / 2 - z * cy,
    },
    ctx,
  );
}

/**
 * Where a bbox (SVG user units) lands in stage-local px under a given view —
 * used to position the HopRail next to the selected ayah (mock `toScreen()`).
 */
export function bboxToScreen(
  bbox: Rect,
  view: View,
  ctx: Pick<FrameContext, "contentWidth" | "viewBoxWidth">,
): Rect {
  const s = (ctx.contentWidth / ctx.viewBoxWidth) * view.z;
  return {
    x: view.x + bbox.x * s,
    y: view.y + bbox.y * s,
    width: bbox.width * s,
    height: bbox.height * s,
  };
}

/** Clamp a zoom into the gesture bounds so a hop can't escape them. */
export function clampZoom(z: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, z));
}

/** Cubic ease-in-out on t∈[0,1] — the hop's motion curve. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear-interpolate every field of a View. */
export function lerpView(from: View, to: View, t: number): View {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

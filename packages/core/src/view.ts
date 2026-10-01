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
  /**
   * How much of the stage's foot something is standing over, in CSS px — a
   * note risen from the bottom of a phone. The page is framed and held in the
   * part still showing, so its last line can be brought up above the note.
   * Absent or 0 when nothing covers the stage.
   */
  coverBottom?: number;
}

/** Geometry the framing math needs — all in CSS px except `viewBoxWidth`. */
export interface FrameContext extends StageFit {
  /** The page's viewBox width in SVG user units (345 for the Madani asset). */
  viewBoxWidth: number;
  /**
   * Where the drawing sits inside the leaf, in unscaled CSS px: how far in from
   * the leaf's left and top edges it starts, and how wide it is drawn. The leaf
   * is more than the text — a border, the stacked fore-edge on its free side,
   * and the printed bands above and below with the surah, juz and page number —
   * so the text's corner is not the leaf's. Left out, the text is taken to fill
   * the leaf from its corner, which is what every caller assumed before the
   * bands were printed (and was a border and a fore-edge off even then).
   */
  text?: { x: number; y: number; width: number };
}

/** The drawing's offset and scale inside the leaf; see `FrameContext.text`. */
function textOf(ctx: Pick<FrameContext, "contentWidth" | "viewBoxWidth" | "text">): {
  x: number;
  y: number;
  s: number;
} {
  const t = ctx.text;
  return t
    ? { x: t.x, y: t.y, s: t.width / ctx.viewBoxWidth }
    : { x: 0, y: 0, s: ctx.contentWidth / ctx.viewBoxWidth };
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

/** The stage height a reader can still see: all of it, less any note over its foot. */
function shownHeight(fit: StageFit): number {
  return fit.stageHeight - Math.max(0, fit.coverBottom ?? 0);
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
    y: holdAxis(shownHeight(fit), fit.contentHeight * v.z, v.y),
  };
}

/**
 * Does the page fit the stage *across*, with no horizontal slack to roam over?
 *
 * This is the predicate the turn gesture is gated on (`page-turning.md` §4.1):
 * when it is true, a horizontal drag is a measured no-op — `holdAxis` returns
 * the centre for an axis that fits, so the transform does not move — and the
 * horizontal slot is free for something else to mean. When it is false the
 * reader is panning across an overflowing page and the slot is taken.
 *
 * **One axis, and it has to be one axis.** The predicate started life in §4.2 as
 * both — `contentWidth·z <= stageWidth && contentHeight·z <= stageHeight` —
 * because that section believed the leaf fit both axes at z = 1. It does not: a
 * 390 × 844 phone overflows *vertically* by 47.5 px at rest, so the two-axis
 * form is false at fit-zoom on the acceptance device and the turn would have
 * been dead on arrival, on exactly the phone it is for, falling through to a
 * `"pan"` that does nothing. The one-axis form is also simply the right
 * question: what the gesture needs to know is whether the *horizontal* slot is
 * free. A reader with a vertically-overflowing page has a live vertical pan and
 * a free horizontal flick, and both should work.
 *
 * The comparison is `<=`, matching `holdAxis`'s own `scaled <= available`
 * exactly, so the predicate and the clamp cannot disagree about the boundary
 * case — a page that is precisely stage-width is centred by one and reported as
 * fitting by the other.
 */
export function viewFitsAcross(v: View, fit: StageFit): boolean {
  // An unlaid-out host measures 0, and `holdAxis` refuses to treat that as
  // "fits" for the same reason: a zero box is a measurement that has not
  // happened yet, and answering "yes, it fits" would arm a turn against a page
  // nobody has seen.
  if (!(fit.contentWidth > 0) || !(fit.stageWidth > 0)) return false;
  return fit.contentWidth * v.z <= fit.stageWidth;
}

/**
 * Compute the `View` that brings `bbox` (SVG user units) as close to the stage
 * centre as the page's own edges allow, at zoom `z`. This is the mock's
 * `focus()` — scale user→px by `s = contentWidth/vbW`, take the bbox center,
 * translate so that center sits at the stage center — followed by `clampView`,
 * which the mock had no equivalent of and which is the difference between a hop
 * that lands on scripture and one that lands on the margin.
 *
 * `lead` is the box of the verse's first line. A verse wider than the stage at
 * `z` cannot be seen whole across, and centring it hid where it begins: a
 * verse that opens at the head of a line lost its first words off the right
 * edge. So such a verse is placed with the head of its first line just inside
 * the right edge — the mus'haf reads right to left — and the reader pans on
 * from there, the way a verse taller than the stage starts at its first line.
 */
export function frameBboxToView(
  bbox: Rect,
  ctx: FrameContext,
  z: number = DEFAULT_HOP_ZOOM,
  lead?: Rect,
): View {
  const t = textOf(ctx);
  const s = t.s;
  const cx = t.x + (bbox.x + bbox.width / 2) * s;
  const cy = t.y + (bbox.y + bbox.height / 2) * s;
  let x = ctx.stageWidth / 2 - z * cx;
  if (lead && bbox.width * s * z > ctx.stageWidth) {
    x = ctx.stageWidth - LEAD_INSET - z * (t.x + (lead.x + lead.width) * s);
  }
  return clampView({ z, x, y: shownHeight(ctx) / 2 - z * cy }, ctx);
}

/** How far inside the right edge a too-wide verse's first word is placed, in CSS px. */
const LEAD_INSET = 16;

/**
 * Where a bbox (SVG user units) lands in stage-local px under a given view —
 * used to position the HopRail next to the selected ayah (mock `toScreen()`).
 */
export function bboxToScreen(
  bbox: Rect,
  view: View,
  ctx: Pick<FrameContext, "contentWidth" | "viewBoxWidth" | "text">,
): Rect {
  const t = textOf(ctx);
  const s = t.s * view.z;
  return {
    x: view.x + t.x * view.z + bbox.x * s,
    y: view.y + t.y * view.z + bbox.y * s,
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

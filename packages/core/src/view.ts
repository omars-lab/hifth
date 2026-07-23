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

/** Geometry the framing math needs — all in CSS px except `viewBoxWidth`. */
export interface FrameContext {
  /** Rendered content width of the host in CSS px (the mock's `matW`). */
  contentWidth: number;
  /** Stage viewport width in CSS px (what we center within). */
  stageWidth: number;
  /** Stage viewport height in CSS px. */
  stageHeight: number;
  /** The page's viewBox width in SVG user units (345 for the Madani asset). */
  viewBoxWidth: number;
}

/** Default hop zoom — matches the mock's `focus(b, 1.55)`. */
export const DEFAULT_HOP_ZOOM = 1.55;

/**
 * Compute the `View` that centers `bbox` (SVG user units) in the stage at zoom
 * `z`. This is the mock's `focus()`: scale user→px by `s = contentWidth/vbW`,
 * take the bbox center, then translate so that center sits at the stage center.
 */
export function frameBboxToView(
  bbox: Rect,
  ctx: FrameContext,
  z: number = DEFAULT_HOP_ZOOM,
): View {
  const s = ctx.contentWidth / ctx.viewBoxWidth;
  const cx = (bbox.x + bbox.width / 2) * s;
  const cy = (bbox.y + bbox.height / 2) * s;
  return {
    z,
    x: ctx.stageWidth / 2 - z * cx,
    y: ctx.stageHeight / 2 - z * cy,
  };
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

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
  /**
   * How much of the stage's left and right side a card stands over, in CSS px —
   * a list docked beside one page on a wide screen. The page is centred, and
   * held, in the part still showing, so it moves clear of the card rather than
   * slide its line ends under it. Absent or 0 when nothing stands beside it.
   */
  coverLeft?: number;
  coverRight?: number;
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

/** Where the stage still shows across: from its left edge, how far in and how wide. */
function shownAcross(fit: StageFit): { from: number; width: number } {
  const left = Math.max(0, fit.coverLeft ?? 0);
  const right = Math.max(0, fit.coverRight ?? 0);
  return { from: left, width: fit.stageWidth - left - right };
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
  const across = shownAcross(fit);
  return {
    z: v.z,
    x: across.from + holdAxis(across.width, fit.contentWidth * v.z, v.x - across.from),
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
  // A list beside the page narrows what the clamp centres in, so it narrows
  // this too, or the two would disagree about a page that fits only without it.
  const across = shownAcross(fit).width;
  if (!(fit.contentWidth > 0) || !(across > 0)) return false;
  return fit.contentWidth * v.z <= across;
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
  const across = shownAcross(ctx);
  let x = across.from + across.width / 2 - z * cx;
  if (lead && bbox.width * s * z > across.width) {
    x = across.from + across.width - LEAD_INSET - z * (t.x + (lead.x + lead.width) * s);
  }
  return clampView({ z, x, y: shownHeight(ctx) / 2 - z * cy }, ctx);
}

/** How far inside the right edge a too-wide verse's first word is placed, in CSS px. */
const LEAD_INSET = 16;

/**
 * The zoom a hop lands at: the one asked for, lowered until the verse's lines
 * fit across the stage with a margin each side, but never below the whole page.
 * At the hop zoom a full line is wider than a phone, so a verse running whole
 * lines — Ayat al-Kursi — lost both ends of every middle line to the screen's
 * edges, the first-line rule only rescuing its opening words. A short verse
 * still lands at the full zoom. Only the hop: a reader who zoomed in themselves
 * keeps their zoom.
 */
export function hopZoomFor(bbox: Rect, ctx: FrameContext, z: number = DEFAULT_HOP_ZOOM): number {
  if (!(z > 1)) return z;
  const wide = bbox.width * textOf(ctx).s;
  const across = shownAcross(ctx).width;
  if (!(wide > 0) || !(across > 0)) return z;
  return Math.max(1, Math.min(z, (across - 2 * LEAD_INSET) / wide));
}

/**
 * The hop zoom on a page whose type is already drawn `larger` times the size
 * every other page uses: lowered by that much, so a hop lands at the same size
 * of type on every page, but never below the whole page. The first two pages
 * draw their text larger to fill their paper, and the hop's closer look went on
 * top of that: 2:1, one word, landed at more than twice other pages' type with
 * the opening lines off both edges (plan item 37).
 */
export function hopZoomOnLargeType(z: number, larger: number): number {
  if (!(larger > 1)) return z;
  return Math.max(1, z / larger);
}

/** The most a page is drawn smaller so a verse shows whole: a fifth. */
const NEAR_FIT = 0.8;

/**
 * The zoom at which a verse `height` px tall at zoom `z` just fills `room`, or
 * null to keep `z`. A verse that is only a little taller than the room above a
 * note is shown whole, the page drawn a little smaller: Ayat al-Kursi on an
 * upright iPad lost its last line, with the verse's number, under the note. One
 * that would need the page shrunk by more than a fifth, or below the whole page,
 * keeps its zoom and is read from its first line, as before.
 */
export function nearFitZoom(height: number, room: number, z: number): number | null {
  if (!(height > room) || !(room > 0)) return null;
  const fitted = (z * room) / height;
  if (fitted < z * NEAR_FIT || z <= 1) return null;
  return Math.max(1, fitted);
}

/**
 * The other way of showing the same verse whole: the px a note `cover` px tall
 * gives up so a verse `height` px tall fits in `room`, or null to leave the
 * note as it is. Kept as a reader's setting beside `nearFitZoom`. Within the
 * same fifth of the verse that rule allows, and never more than a fifth of the
 * note, so a phone's short note still shows its first lines.
 */
export function nearFitRoom(height: number, room: number, cover: number): number | null {
  if (!(height > room) || !(room > 0)) return null;
  const need = Math.ceil(height - room);
  if (room < height * NEAR_FIT || need > cover - cover * NEAR_FIT) return null;
  return need;
}

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

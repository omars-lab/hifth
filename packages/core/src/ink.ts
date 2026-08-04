/**
 * Marker geometry (spec §3) — turning an ayah polygon into something that looks
 * like it was laid down by a pen.
 *
 * The vendored hit layer is not a shape traced around words. Every ayah polygon
 * is a run of axis-aligned rectangles, one per line the ayah occupies, unioned
 * into a single `<path>`:
 *
 *     verse-45 → "M0 8.5h345v38H0Zm79.5 38H345v38.2H79.5Z"
 *
 * Filling that is why the highlight reads as a box rather than as ink. The
 * rectangles are the full line height with square corners, so a multi-line ayah
 * paints a continuous slab and the corners land where no pen would put them.
 *
 * A chisel-tip marker does something specific and simple: it lays a band of
 * roughly constant width along the middle of the line, softly capped at both
 * ends, and it does not reach the top and bottom of the line box — that is why
 * you can still see the ascenders and descenders of the lines above and below.
 * So: one swipe per rectangle, centred vertically, `BAND` of the line height,
 * round caps.
 *
 * This is deliberately a *parser with a fallback*, not an assumption. Three
 * pages are vendored today and all 22 of their polygons are rect runs, but Loop
 * 4b vendors 601 more from the same upstream, and a corpus is not a contract.
 * `swipesFromPath` returns null on anything it does not fully recognise, and the
 * highlighter then clones the source path exactly as it did before. A page whose
 * geometry is unusual gets the old boxy highlight, which is worse-looking and
 * still correct — the failure mode is never a missing highlight.
 *
 * ## The second caller (word-C)
 *
 * A word selection has no polygon to parse — the print's words are glyph paths
 * with no structure, so its geometry arrives as rectangles from a shard rather
 * than as a `d` from the DOM. That is a difference in *where the rectangles came
 * from*, not in what ink is, so the parsing half and the pen half are split:
 * {@link swipesFromRects} is the pen, and `swipesFromPath` is the parser in
 * front of it. `WordIndex.bandsFor` hands over one rectangle per line, which is
 * exactly the shape an ayah polygon already is — so the two selections are
 * inked by the same code and cannot drift into looking like two different pens.
 */

import type { Rect } from "./highlighter.js";

/** A single marker stroke: a horizontal band along the centre of one line. */
export interface Swipe {
  /** Start of the band's centreline (SVG user units). */
  x1: number;
  /** End of the band's centreline. Never less than `x1`. */
  x2: number;
  /** The centreline's y — the vertical middle of the line it covers. */
  y: number;
  /** Stroke width: how thick the band is. */
  width: number;
}

/**
 * Fraction of the line box the band covers. 0.72 leaves ~14% of the line clear
 * above and below, which is what keeps two stacked swipes reading as two passes
 * of a pen rather than one filled block — the single most box-like thing about
 * filling the rectangles was that adjacent lines touched.
 */
const BAND = 0.72;

/**
 * One rectangle, in the order the path grammar below produces them — the
 * highlighter's own {@link Rect}, so a parsed polygon and a shard's word band
 * are literally the same type by the time the pen sees them. Width and height
 * are always positive; the parser normalises.
 */
type InkRect = Rect;

/**
 * The one path grammar we accept: a rectangle written as a move, a horizontal
 * run, a vertical run, a closing horizontal, and `Z`. Both cases of every
 * command (absolute and relative) appear in the corpus — `M…h…v…H…Z` for the
 * first sub-path and `m…h…v…H…Z` for later ones — so both are handled rather
 * than guessed at.
 *
 * Anything else, including a genuine polygon, an arc, or a rect written
 * corner-by-corner with `L`, does not match and sends the whole path to the
 * fallback. Partial recognition is not on offer: half a highlight in marker and
 * half in box would look like a rendering bug.
 */
const RECT_RE =
  /^([Mm])(-?[\d.]+)[ ,](-?[\d.]+)([Hh])(-?[\d.]+)([Vv])(-?[\d.]+)([Hh])(-?[\d.]+)[Zz]$/;

/**
 * Parse a rect-run path into its rectangles, or null if any sub-path is not a
 * rectangle in the grammar above.
 *
 * Relative sub-paths (`m`) continue from the previous sub-path's start point,
 * which is where the pen is after `Z` closes the previous rectangle. Getting
 * that wrong would put the second line's swipe at an absolute coordinate that
 * happens to look plausible on some pages, so it is asserted by test rather
 * than left to inspection.
 */
function rectsFromPath(d: string): InkRect[] | null {
  const subs = d.trim().split(/(?=[Mm])/).filter(Boolean);
  if (subs.length === 0) return null;

  const rects: InkRect[] = [];
  let penX = 0;
  let penY = 0;

  for (const sub of subs) {
    const m = RECT_RE.exec(sub.trim());
    if (!m) return null;

    const [, moveCmd, mxRaw, myRaw, h1Cmd, h1Raw, vCmd, vRaw, h2Cmd, h2Raw] = m;
    const mx = Number(mxRaw);
    const my = Number(myRaw);
    const h1 = Number(h1Raw);
    const v = Number(vRaw);
    const h2 = Number(h2Raw);
    if (![mx, my, h1, v, h2].every(Number.isFinite)) return null;

    // The rectangle's origin — where the pen lands after the move.
    const x0 = moveCmd === "M" ? mx : penX + mx;
    const y0 = moveCmd === "M" ? my : penY + my;
    penX = x0;
    penY = y0;

    // The far corner, following the three runs. Each command's case decides
    // whether its number is a delta or a coordinate; `V`/`v` differ the same
    // way `H`/`h` do, and the corpus uses `v` where a height reads naturally.
    const x1 = h1Cmd === "H" ? h1 : x0 + h1;
    const y1 = vCmd === "V" ? v : y0 + v;
    // The closing run must return to the rectangle's left edge for this to be a
    // rectangle at all. If it does not, the shape is something else.
    const x2 = h2Cmd === "H" ? h2 : x1 + h2;
    if (Math.abs(x2 - x0) > 0.01) return null;

    const width = Math.abs(x1 - x0);
    const height = Math.abs(y1 - y0);
    if (width <= 0 || height <= 0) return null;
    rects.push({ x: Math.min(x0, x1), y: Math.min(y0, y1), width, height });
  }

  return rects;
}

/**
 * The marker strokes for an ayah polygon's `d`, or null if the path is not a
 * run of rectangles (see the fallback note in this file's header).
 *
 * The centreline is inset by half the band width at each end so the round caps
 * land exactly on the rectangle's edges instead of overshooting them. Overshoot
 * would be truer to a real pen, but these rectangles are split mid-line between
 * neighbouring ayahs: a cap that runs past the edge would put ink on the ayah
 * next door, and the whole point of this app is knowing which ayah you are on.
 *
 * A rectangle narrower than the band it would carry — a two-word tail at the
 * end of a line — collapses to a single point, which a round cap renders as a
 * dot of exactly the band's diameter. That is what a pen does when you tap it.
 */
export function swipesFromPath(d: string): Swipe[] | null {
  const rects = rectsFromPath(d);
  return rects ? swipesFromRects(rects) : null;
}

/**
 * The pen itself: one marker stroke per rectangle, wherever the rectangles came
 * from — a parsed ayah polygon, or a word run's per-line bands.
 *
 * Total, not partial: rectangles are already the shape this file understands, so
 * unlike `swipesFromPath` there is nothing here that can fail to be recognised.
 */
export function swipesFromRects(rects: readonly InkRect[]): Swipe[] {
  return rects.map(({ x, y, width: w, height: h }) => {
    const width = h * BAND;
    const half = width / 2;
    const x1 = x + half;
    const x2 = x + w - half;
    return x2 < x1
      ? { x1: x + w / 2, x2: x + w / 2, y: y + h / 2, width }
      : { x1, x2, y: y + h / 2, width };
  });
}

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
 * So: one swipe per *line*, centred vertically, `BAND` of the line height,
 * round caps.
 *
 * ## One line, not one rectangle
 *
 * "Per line" is not the same as "per rectangle", and an ayah that runs four or
 * more lines is where they part. When several of an ayah's lines are full-width
 * and sit directly on top of one another, the upstream optimiser is free to
 * write them as a *single* tall rectangle — 2:249's middle spans six lines as
 * one 218-unit-high box — and a few ayahs are nothing but one such box. Drawn
 * as one swipe that is a single fat band down the centre of a paragraph: the
 * "blob" a reader sees instead of a line each. So the pen is told the page's
 * line height and splits any rectangle taller than a line back into the lines
 * the optimiser fused, one swipe apiece. A caller that does not know the line
 * height (or a rectangle already one line tall) gets exactly one swipe, as
 * before — the split can only ever *add* the lines that were collapsed.
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
 * Fraction of the line box the band covers. It was 0.72; tried on a phone a
 * step at a time with the owner (2026-10-04), it settled at 0.72 × 1.1 × 1.1 ×
 * 1.05 ≈ 0.915. That still leaves ~8% of a line between two stacked swipes —
 * what keeps them reading as two passes of a pen rather than one filled block,
 * the single most box-like thing about filling the rectangles being that
 * adjacent lines touched.
 */
export const BAND = 0.72 * 1.1 * 1.1 * 1.05;

/**
 * How far above the line's middle the band sits, as a fraction of the line
 * box. Centred exactly, the ink read low on the words (owner, 2026-10-04);
 * stepped up to 15% and back, it settled at 10% of the line. With the thick
 * band its top reaches ~6% of a line above the line's own top, into the gap
 * under the line above; the gap between two stacked bands is unchanged by the
 * lift.
 */
export const LIFT = 0.1;

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
export function rectsFromPath(d: string): InkRect[] | null {
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
    // rectangle at all — but only *close* to it. The print rounds every
    // coordinate to a tenth, so a true rectangle's closing edge can miss its own
    // left edge by up to ~0.2 through rounding alone; measured across the whole
    // corpus, 110 ayah boxes miss by that much and none by more. A genuine
    // non-rectangle — a slanted quadrilateral written in this same grammar —
    // misses by whole units, not a fifth of one, so 0.3 admits the rounding and
    // still rejects the real thing. This was 0.01 once, which dropped all 110 of
    // those ayat to the box fallback; 10:44 was the first one anybody reported.
    const x2 = h2Cmd === "H" ? h2 : x1 + h2;
    if (Math.abs(x2 - x0) > 0.3) return null;

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
export function swipesFromPath(d: string, lineHeight?: number): Swipe[] | null {
  const rects = rectsOf(d);
  return rects ? swipesFromRects(rects, lineHeight) : null;
}

/** An ayah's line rectangles, read as a box run first and a drawn outline second. */
export function rectsOf(d: string): InkRect[] | null {
  return rectsFromPath(d) ?? rectsFromOutline(d);
}

/**
 * How far an edge may lean and still count as level or upright: 5% of its run.
 * The opening pages lean by a unit or so over an edge tens of units long (1.5
 * over 221.5, 0.4 over 27); a real diagonal leans by as much as it runs.
 */
const LEAN = 0.05;

/**
 * Edges that start within this many units of each other in height are one
 * edge drawn unevenly. A line is about 27 units tall on the opening pages, and
 * their level edges wander by up to ~2.6, so 3 joins the wander and never two
 * lines.
 */
const SNAP = 3;

/**
 * The second reader: an ayah drawn as one outline, the way the print's upstream
 * drew pages 1 and 2, cut into one rectangle per line it covers.
 *
 * It takes straight edges only (`M L H V Z`, either case), and every edge must
 * be level or upright to within {@link LEAN} — so a hand-drawn box that wobbles
 * is read, and a real slanted shape still returns null and keeps the clone
 * fallback. The outline's heights are grouped into its line boundaries, and
 * across each band between two boundaries the outline's own edges are crossed
 * at the band's middle, which gives that line's span however the edges lean.
 * Bands that cover the same span one after another are joined back, so a run of
 * full lines reaches the pen as one tall box, exactly like a box run's does, and
 * the line-height split takes it apart the same way.
 */
export function rectsFromOutline(d: string): InkRect[] | null {
  const tokens = d.match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)/g);
  if (!tokens || d.replace(/[MmLlHhVvZz\d.\-\s,]/g, "") !== "") return null;

  const rings: Array<Array<[number, number]>> = [];
  let ring: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cmd = "";
  const num = (i: number) => Number(tokens[i]);
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    else if (cmd === "M") cmd = "L"; // coordinates after a move are line-tos
    else if (cmd === "m") cmd = "l";
    if (cmd === "Z" || cmd === "z") {
      if (ring.length) rings.push(ring);
      ring = [];
      x = startX;
      y = startY;
      continue;
    }
    const needs = cmd === "H" || cmd === "h" || cmd === "V" || cmd === "v" ? 1 : 2;
    if (i + needs > tokens.length || !cmd) return null;
    const a = num(i);
    const b = needs === 2 ? num(i + 1) : 0;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    i += needs;
    switch (cmd) {
      case "M":
      case "m":
        if (ring.length) rings.push(ring);
        x = cmd === "M" ? a : x + a;
        y = cmd === "M" ? b : y + b;
        startX = x;
        startY = y;
        ring = [[x, y]];
        continue;
      case "L": x = a; y = b; break;
      case "l": x += a; y += b; break;
      case "H": x = a; break;
      case "h": x += a; break;
      case "V": y = a; break;
      case "v": y += a; break;
      default: return null;
    }
    ring.push([x, y]);
  }
  if (ring.length) rings.push(ring);

  const edges: Array<[number, number, number, number]> = [];
  for (const r of rings) {
    if (r.length < 3) return null;
    for (let k = 0; k < r.length; k++) {
      const [x1, y1] = r[k]!;
      const [x2, y2] = r[(k + 1) % r.length]!;
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      if (dx === 0 && dy === 0) continue;
      if (dy > LEAN * dx && dx > LEAN * dy) return null; // a real diagonal
      edges.push([x1, y1, x2, y2]);
    }
  }

  // The line boundaries: every corner's height, with an unevenly drawn edge's
  // heights grouped into one.
  const ys = rings.flat().map(([, py]) => py).sort((p, q) => p - q);
  const levels: number[] = [];
  let group: number[] = [];
  for (const py of ys) {
    if (group.length && py - group[0]! > SNAP) {
      levels.push(group.reduce((s, v) => s + v, 0) / group.length);
      group = [];
    }
    group.push(py);
  }
  if (group.length) levels.push(group.reduce((s, v) => s + v, 0) / group.length);

  const rects: InkRect[] = [];
  for (let k = 0; k + 1 < levels.length; k++) {
    const top = levels[k]!;
    const bottom = levels[k + 1]!;
    const mid = (top + bottom) / 2;
    const xs = edges
      .filter(([, y1, , y2]) => y1 <= mid !== y2 <= mid)
      .map(([x1, y1, x2, y2]) => x1 + ((mid - y1) / (y2 - y1)) * (x2 - x1))
      .sort((p, q) => p - q);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const left = xs[j]!;
      const width = xs[j + 1]! - left;
      if (width <= 0) continue;
      const above = rects.find(
        (r) =>
          Math.abs(r.y + r.height - top) < 1e-6 &&
          Math.abs(r.x - left) <= SNAP &&
          Math.abs(r.x + r.width - (left + width)) <= SNAP,
      );
      if (above) above.height = bottom - above.y;
      else rects.push({ x: left, y: top, width, height: bottom - top });
    }
  }
  return rects.length ? rects : null;
}

/** One marker stroke along one rectangle, lifted {@link LIFT} above its middle. */
function bandOf({ x, y, width: w, height: h }: InkRect): Swipe {
  const width = h * BAND;
  const half = width / 2;
  const x1 = x + half;
  const x2 = x + w - half;
  const mid = y + h / 2 - h * LIFT;
  return x2 < x1 ? { x1: x + w / 2, x2: x + w / 2, y: mid, width } : { x1, x2, y: mid, width };
}

/**
 * The pen itself: one marker stroke per line, wherever the rectangles came from
 * — a parsed ayah polygon, or a word run's per-line bands.
 *
 * `lineHeight` is what turns "per rectangle" into "per line" (see this file's
 * header): a rectangle the print fused out of several stacked full-width lines
 * is split back into `round(height / lineHeight)` bands of equal height, so a
 * six-line ayah reads as six passes of a pen and not one slab. Rounding, not
 * flooring, because a line's box is not exactly the modal height — 38 against a
 * 36 line is still one line, and only a rectangle past 1.5 lines rounds to two.
 * Omit `lineHeight` (or pass a rectangle already one line tall) and the result
 * is one swipe, unchanged — the split can only add the lines that were merged.
 *
 * Total, not partial: rectangles are already the shape this file understands, so
 * unlike `swipesFromPath` there is nothing here that can fail to be recognised.
 */
export function swipesFromRects(rects: readonly InkRect[], lineHeight?: number): Swipe[] {
  return rects.flatMap((rect) => {
    const lines =
      lineHeight && lineHeight > 0 ? Math.max(1, Math.round(rect.height / lineHeight)) : 1;
    if (lines === 1) return [bandOf(rect)];
    const h = rect.height / lines;
    return Array.from({ length: lines }, (_, i) =>
      bandOf({ x: rect.x, y: rect.y + i * h, width: rect.width, height: h }),
    );
  });
}

/**
 * The page's line height, read off its own geometry: the most common rectangle
 * height across every ayah polygon on the page. Nearly every rectangle is a
 * single line, so the mode is that line — the merged multi-line boxes and the
 * short end-of-ayah tails are both far outnumbered and cannot outvote it. Null
 * only if nothing parsed, in which case the pen falls back to one swipe each.
 *
 * Measured per page rather than assumed, because line height is a fact about a
 * print and this app is built to take a second print it has never seen.
 */
export function pageLineHeight(paths: Iterable<string>): number | null {
  const counts = new Map<number, number>();
  for (const d of paths) {
    const rects = rectsOf(d);
    if (!rects) continue;
    for (const r of rects) {
      const k = Math.round(r.height);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [h, n] of counts) {
    if (n > bestCount) {
      best = h;
      bestCount = n;
    }
  }
  return best;
}

/**
 * How far a band may run past the page's words at either end, in page units —
 * a little under a letter. A pen overshoots the first and last word slightly;
 * it does not carry on to the edge of the paper.
 */
export const OVERHANG = 2;

/** Where a page's block of words starts and ends across the line. */
export interface TextSpan {
  readonly left: number;
  readonly right: number;
}

/** A 2D matrix as the browser reports one (`getCTM`): x' = a·x + c·y + e. */
export interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/**
 * Where a page's words start and end, in the page's own units.
 *
 * The print draws every word on a page as one shape, inside a group that flips
 * and scales it, so its box is in units of its own. `words` and `page` are the
 * matrices the browser gives for that shape and for the page (each to the same
 * screen), and going up one and back down the other lands the box in the page's
 * units — the same ones the verse boxes and the bands are drawn in. Kept as
 * plain numbers so it can be checked without a browser.
 *
 * Undefined for a page not laid out yet (an empty box, or a page with no size),
 * which the caller takes as "measure again later".
 */
export function textSpanOf(
  box: { x: number; y: number; width: number; height: number },
  words: Matrix2D,
  page: Matrix2D,
): TextSpan | undefined {
  const det = page.a * page.d - page.b * page.c;
  if (!(box.width > 0) || !det) return undefined;
  // page⁻¹ · words, first row only: that row alone decides x.
  const ia = page.d / det;
  const ic = -page.c / det;
  const ie = (page.c * page.f - page.d * page.e) / det;
  const a = ia * words.a + ic * words.b;
  const c = ia * words.c + ic * words.d;
  const e = ia * words.e + ic * words.f + ie;
  const xs = [box.x, box.x + box.width].flatMap((x) =>
    [box.y, box.y + box.height].map((y) => a * x + c * y + e),
  );
  return { left: Math.min(...xs), right: Math.max(...xs) };
}

/**
 * Keep each band to the words on its line.
 *
 * The print's verse boxes run the page's full width, so a verse that fills a
 * line has a box reaching the paper's edge on both sides, well past its first
 * and last word, and the band used to fill it end to end (the owner,
 * 2026-09-30: it "shouldn't go to end of page"). Every full line is set edge to
 * edge across the page's block of words, so capping both ends at that block,
 * plus {@link OVERHANG}, stops the band just past the words. An end already
 * inside the block — where one verse gives way to the next mid-line — is left
 * where it is.
 *
 * A band capped below its own thickness becomes a dot centred on what is left,
 * the same rule `bandOf` follows for a two-word tail. Without a measured block
 * (`text` undefined) nothing changes.
 */
export function fitSwipesToText(swipes: readonly Swipe[], text: TextSpan | undefined): Swipe[] {
  if (!text) return [...swipes];
  const lo = text.left - OVERHANG;
  const hi = text.right + OVERHANG;
  return swipes.map((s) => {
    const half = s.width / 2;
    const left = Math.max(Math.min(s.x1, s.x2) - half, lo);
    const right = Math.min(Math.max(s.x1, s.x2) + half, hi);
    if (right <= left) return { ...s };
    const x1 = left + half;
    const x2 = right - half;
    if (x2 < x1) {
      const mid = (left + right) / 2;
      return { ...s, x1: mid, x2: mid };
    }
    return { ...s, x1, x2 };
  });
}

/**
 * Join the swipes of a passage line by line, so a passage is one pass of the
 * pen per line and not one per verse per line.
 *
 * Each band stops half a stroke inside its own rectangle (see `bandOf`), which
 * is right for one verse on its own — the round cap sits inside the line box —
 * and wrong the moment two verses share a line: where the first ends and the
 * second begins, the two caps leave a notch of paper around the verse number
 * (issue passage-ink-notch-at-verse-number, page 42, 2:254 to 2:256). So before
 * the pen goes down, swipes whose centrelines sit on the same line are merged
 * into one that runs from the leftmost start to the rightmost end, as thick as
 * the thicker of the two. "Same line" is a centreline within half a stroke of
 * the other's — lines are a stroke apart at least, so nothing across lines can
 * qualify. The result is sorted top to bottom, so the wipe still crosses the
 * passage one line after another whatever order the verses arrived in.
 */
export function joinSwipesByLine(swipes: readonly Swipe[]): Swipe[] {
  const sorted = [...swipes].sort((a, b) => a.y - b.y || a.x1 - b.x1);
  const out: Swipe[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(s.y - last.y) <= Math.min(s.width, last.width) / 2) {
      out[out.length - 1] = {
        x1: Math.min(last.x1, s.x1),
        x2: Math.max(last.x2, s.x2),
        y: last.y,
        width: Math.max(last.width, s.width),
      };
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

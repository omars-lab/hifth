/**
 * The word index — one page's word boxes, and the two questions the long-press
 * gesture asks of them.
 *
 * word-B put 91 451 rectangles on our frame, sharded per page at
 * `assets/words/<edition>/<N>.json`. This is the reader over one such shard. It
 * answers *which word is under this point* and *where is word N of ayah K*, and
 * nothing else: no fetching (L2 owns that), no DOM, no ink.
 *
 * ## Why this is not on `Resolver`
 *
 * `resolver.ts` deliberately holds no geometry — "the highlighter reads
 * `getBBox()` off the mounted node". That rule is about geometry that belongs to
 * the *live SVG*, and it still holds: an ayah's bbox is whatever the browser
 * says the polygon covers. A word box is the opposite kind of fact. There is no
 * element to measure — the print's words are glyph paths with no structure — so
 * the rectangle arrives from a shard, is the only record of where the word is,
 * and is loaded per page rather than per edition. Different lifetime, different
 * source, different file.
 *
 * ## The word index is the print's
 *
 * `from` is `data-word-index-in-ayah` verbatim, and the print counts pause marks
 * (ۖ ۚ ۗ …, plus ۩ and ۞) as words. So do we. The alternative — renumbering to
 * match QAC's segmentation — is what blocks word-granular *roots*, and it is not
 * this file's problem: a selection only has to name the same word twice, once
 * when it is made and once when a shared link restores it, and the print's own
 * numbering does that exactly.
 *
 * ## Pause marks are geometry, not targets
 *
 * A reader points at words. Nobody long-presses ۖ on purpose, and a selection
 * that lands on one reads as a miss even when the finger really was over it. So
 * every function here that *chooses* a word — `wordAt`, `hitTest`, `step` —
 * skips marks, and `boxesFor` does not: a range that runs across a mark paints
 * over it, because ink that breaks at every pause is worse than ink that does
 * not. The rule in one line: marks can be inside a selection, never an end of
 * one.
 */

import type { Rect } from "./highlighter.js";
import type { PageNumber } from "./types.js";

/** A word box as it is written on the wire: `[x, y, w, h]` in viewBox units. */
export type WireBox = readonly [number, number, number, number];

/** One ayah's words on one page, as the shard writes them. */
export interface WireAyahWords {
  /** The print's word index of `boxes[0]`; boxes run contiguously from there. */
  readonly from: number;
  readonly boxes: readonly WireBox[];
  /** Which of those indices are pause marks. Absent when none are. */
  readonly marks?: readonly number[];
}

/** A page's word shard. Keys are `"<surah>:<ayah>"` — bare, not canonical. */
export interface WordShard {
  readonly page: PageNumber;
  readonly words: Readonly<Record<string, WireAyahWords>>;
}

/** The inclusive word-index range an ayah occupies on this page. */
export interface WordSpanRange {
  readonly from: number;
  readonly to: number;
}

/**
 * How much two word boxes must overlap vertically, as a fraction of the shorter
 * one, to count as being on the same line of the print.
 *
 * **Measured, not chosen.** Across all 604 shipped shards, comparing each
 * consecutive pair of *lexical* boxes (pause marks excluded — see below):
 *
 * - same line, worst case: **0.506** (p53, 3:24, boxes 13→14)
 * - different lines, worst case: **0.091** (p157, 7:54, boxes 27→28)
 *
 * 0.25 sits between them with about a factor of two of margin on each side, so
 * the ink would have to move a long way before a line break went unnoticed.
 *
 * Pause marks are excluded from the comparison because they break it outright:
 * a mark floats *above* its line in a box ~7 units square, so it frequently
 * overlaps its own line's words by nothing at all. Including them made the two
 * populations overlap (worst same-line −1.77 against worst cross-line 1.00) —
 * i.e. no threshold existed. Which line a mark belongs to is settled instead by
 * {@link WordIndex.bandsFor}'s rule that a mark trails the word before it, which
 * is likewise a measurement: of the 502 marks that sit at a line boundary in the
 * shipped corpus, the preceding word is the vertically nearer one for **all
 * 502**.
 */
const LINE_OVERLAP = 0.25;

/** Whether two boxes share enough vertical extent to be on one line. */
function sameLine(a: Rect, b: Rect): boolean {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const shorter = Math.min(a.height, b.height);
  return shorter > 0 && (bottom - top) / shorter > LINE_OVERLAP;
}

/** Squared distance from a point to a rectangle; 0 inside it. */
function distanceSq(r: Rect, x: number, y: number): number {
  const dx = x < r.x ? r.x - x : x > r.x + r.width ? x - r.x - r.width : 0;
  const dy = y < r.y ? r.y - y : y > r.y + r.height ? y - r.y - r.height : 0;
  return dx * dx + dy * dy;
}

/** Whether a shard is well formed enough to index. Cheap; not a schema check. */
export function isWordShard(value: unknown): value is WordShard {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { page?: unknown; words?: unknown };
  return typeof v.page === "number" && typeof v.words === "object" && v.words !== null;
}

/**
 * One page's words, indexed. Construct once per loaded shard; every lookup is
 * O(1) except the two hit tests, which are linear in the boxes they search —
 * ~150 for an ayah, ~150 of them for a page. Immutable.
 */
export class WordIndex {
  readonly page: PageNumber;

  /** bare `"2:48"` → its boxes as rects, in reading order */
  private readonly rects = new Map<string, Rect[]>();
  /** bare `"2:48"` → the print's index of `rects[0]` */
  private readonly starts = new Map<string, number>();
  /** bare `"2:48"` → the print's indices that are pause marks */
  private readonly marks = new Map<string, Set<number>>();

  constructor(shard: WordShard) {
    this.page = shard.page;
    for (const [ref, entry] of Object.entries(shard.words)) {
      if (!entry || !Array.isArray(entry.boxes)) continue;
      this.rects.set(
        ref,
        entry.boxes.map(([x, y, width, height]) => ({ x, y, width, height })),
      );
      this.starts.set(ref, entry.from);
      this.marks.set(ref, new Set(entry.marks ?? []));
    }
  }

  /**
   * The bare `"<surah>:<ayah>"` refs this page carries, in shard order.
   *
   * Bare and not canonical because the shard is per-edition already — the
   * directory it came from names the edition, so repeating it 6 236 times on the
   * wire would be paying for a fact the path already states. Callers holding a
   * canonical key pass it straight in; `refOf` below does the trimming.
   */
  refs(): readonly string[] {
    return [...this.rects.keys()];
  }

  /** Accepts either `"2:48"` or `quran/<edition>/2:48#w3-7`, and trims to the former. */
  private refOf(key: string): string {
    const slash = key.lastIndexOf("/");
    const bare = slash === -1 ? key : key.slice(slash + 1);
    const hash = bare.indexOf("#");
    return hash === -1 ? bare : bare.slice(0, hash);
  }

  /** Whether this page carries any words for the ayah. */
  has(key: string): boolean {
    return this.rects.has(this.refOf(key));
  }

  /** The inclusive index range the ayah occupies here, or null if it is absent. */
  span(key: string): WordSpanRange | null {
    const ref = this.refOf(key);
    const rects = this.rects.get(ref);
    if (!rects || rects.length === 0) return null;
    const from = this.starts.get(ref) as number;
    return { from, to: from + rects.length - 1 };
  }

  /** Whether that index is a pause mark rather than a word. */
  isMark(key: string, index: number): boolean {
    return this.marks.get(this.refOf(key))?.has(index) ?? false;
  }

  /** The box of one word, or null if the ayah or the index is not on this page. */
  boxOf(key: string, index: number): Rect | null {
    const ref = this.refOf(key);
    const rects = this.rects.get(ref);
    if (!rects) return null;
    const at = index - (this.starts.get(ref) as number);
    return rects[at] ?? null;
  }

  /**
   * Every box from `from` to `to` inclusive — marks included, deliberately (see
   * the header). Clamped to what this page holds rather than refused, so a range
   * restored from a link that was made against a different pagination still
   * paints whatever part of itself is here.
   */
  boxesFor(key: string, from: number, to: number): Rect[] {
    const ref = this.refOf(key);
    const rects = this.rects.get(ref);
    if (!rects || to < from) return [];
    const start = this.starts.get(ref) as number;
    const lo = Math.max(0, from - start);
    const hi = Math.min(rects.length - 1, to - start);
    return lo > hi ? [] : rects.slice(lo, hi + 1);
  }

  /**
   * The same run as {@link boxesFor}, collapsed to **one rectangle per line** —
   * the shape the ink pen wants.
   *
   * Per-box swipes would be wrong twice over. Word boxes are tight around their
   * own glyphs, so their heights differ along a single line (17.5, 21.9, 29.7,
   * 17.3, 27.7 … on one line of 2:44 alone); a band per box would be a row of
   * rectangles of different thicknesses at different heights — a ransom note,
   * not a pen. And each band would carry its own round caps, so the ink would
   * bulge and pinch at every word gap instead of running.
   *
   * So a run of words on one line becomes one rectangle: the x-span of
   * everything in the run (marks included, so the ink crosses a pause unbroken)
   * and the y-span of its *words* (marks excluded, because a mark floats above
   * the line and would drag the centreline up off the text). The result is one
   * rectangle per line, which is exactly what an ayah polygon already parses to
   * — see `ink.ts`, which inks both with the same pen.
   */
  bandsFor(key: string, from: number, to: number): Rect[] {
    const ref = this.refOf(key);
    const rects = this.rects.get(ref);
    if (!rects || to < from) return [];
    const start = this.starts.get(ref) as number;
    const marks = this.marks.get(ref) as Set<number>;
    const lo = Math.max(0, from - start);
    const hi = Math.min(rects.length - 1, to - start);
    if (lo > hi) return [];

    const bands: Rect[] = [];
    // The open run: its x-span over every box, its y-span over words only.
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let open = false;
    // The last word of the open run — what the next word is compared against,
    // and (by being unset) the reason a leading mark joins the run that follows
    // rather than starting one of its own.
    let lastWord: Rect | null = null;

    for (let i = lo; i <= hi; i++) {
      const r = rects[i] as Rect;
      const isMark = marks.has(start + i);
      if (!isMark && lastWord && !sameLine(lastWord, r)) {
        bands.push({ x: left, y: top, width: right - left, height: bottom - top });
        open = false;
        lastWord = null;
      }
      if (!open) {
        left = r.x;
        right = r.x + r.width;
        top = r.y;
        bottom = r.y + r.height;
        open = true;
      } else {
        left = Math.min(left, r.x);
        right = Math.max(right, r.x + r.width);
      }
      if (!isMark) {
        // A word sets the band's vertical extent. The first word of a run that
        // opened on a mark replaces the mark's extent rather than unioning with
        // it, which is the same rule as "the y-span is the words'" applied to
        // the one case where the mark got there first.
        if (lastWord) {
          top = Math.min(top, r.y);
          bottom = Math.max(bottom, r.y + r.height);
        } else {
          top = r.y;
          bottom = r.y + r.height;
        }
        lastWord = r;
      }
    }
    if (open) bands.push({ x: left, y: top, width: right - left, height: bottom - top });
    return bands;
  }

  /**
   * The word of `key` nearest a point — the long-press answer.
   *
   * Nearest, not containing, and with no distance cap: the gesture only reaches
   * here once the ayah under the finger is already selected, so the polygon has
   * done the bounding and the question left is which of *this ayah's* words was
   * meant. The gaps between words are wide enough at reading zoom that a strict
   * containment test would drop presses a reader considers unambiguous.
   *
   * Null only if the ayah is absent here, or has nothing but marks on this page.
   */
  wordAt(key: string, x: number, y: number): number | null {
    const ref = this.refOf(key);
    const rects = this.rects.get(ref);
    if (!rects) return null;
    const start = this.starts.get(ref) as number;
    const marks = this.marks.get(ref) as Set<number>;
    let best: number | null = null;
    let bestD = Infinity;
    for (let i = 0; i < rects.length; i++) {
      if (marks.has(start + i)) continue;
      const d = distanceSq(rects[i] as Rect, x, y);
      if (d < bestD) {
        bestD = d;
        best = start + i;
        if (d === 0) break;
      }
    }
    return best;
  }

  /**
   * The word under a point anywhere on the page — containment only.
   *
   * Strict where `wordAt` is forgiving, and for the same reason read the other
   * way: with no ayah chosen there is nothing to bound the search, so "nearest"
   * would name a word on the far side of the page rather than admit the finger
   * was in the margin.
   */
  hitTest(x: number, y: number): { ref: string; index: number } | null {
    for (const [ref, rects] of this.rects) {
      const start = this.starts.get(ref) as number;
      const marks = this.marks.get(ref) as Set<number>;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i] as Rect;
        if (x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height) continue;
        if (marks.has(start + i)) continue;
        return { ref, index: start + i };
      }
    }
    return null;
  }

  /**
   * The next selectable word `delta` steps away, skipping marks — what an arrow
   * key does, and what a drag that has left the current box falls back to.
   * Clamps at the ends of the ayah *on this page*; null if there is nowhere to go.
   */
  step(key: string, index: number, delta: number): number | null {
    const range = this.span(key);
    if (!range || delta === 0) return null;
    const dir = delta > 0 ? 1 : -1;
    let at = index;
    for (let n = Math.abs(delta); n > 0; n--) {
      let next = at + dir;
      while (next >= range.from && next <= range.to && this.isMark(key, next)) next += dir;
      if (next < range.from || next > range.to) break;
      at = next;
    }
    return at === index ? null : at;
  }
}

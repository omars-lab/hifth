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

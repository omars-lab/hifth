/**
 * Which vowel marks two look-alike ayahs do NOT have in common — mark by mark.
 *
 * `verse-diff.ts` answers at the grain of words: the run the pair shares, and
 * the leftovers at either end. That is the right grain for "these two ayahs
 * part company here", and the wrong one for the mistake a hafiz actually makes,
 * which is reciting the *same word* with one *different vowel*. Measured over
 * the shipped corpus, 462 of the 2,544 comparable pairs have at least one word
 * inside the shared run whose marks differ (538 such words out of 14,148), and
 * among the words that differ, 1,078 differ by exactly one mark swapped for
 * another. A word wash cannot show any of that; it washes the whole word or
 * nothing.
 *
 * The per-mark rectangles the mark-placement decision (option H) put on every
 * page make it a lookup. Each mark ships with its word, its name and its own box,
 * so the comparison is:
 *
 *  1. **Pair the words of the shared run**, head to head, pause marks skipped —
 *     the print counts ۖ ۚ ۗ as words and the two sides do not pause in the
 *     same places. Only the shared run: it is matched on bare consonants, so a
 *     word the two ayahs spell alike and vowel differently is always *inside*
 *     it, and the words outside it are different words by construction. Pairing
 *     those positionally and tinting what differs (tried first, and looked at)
 *     tinted nine marks in ten across the ochre wash — 21,330 of 23,328 paired
 *     words — and stopped dead wherever the shorter ayah ran out, which reads as
 *     noise with an arbitrary edge. The word wash already says those words
 *     differ; the tint's job is the vowel on a word the wash calls the same.
 *
 *  2. **Compare each pair as a bag of names.** Order within a word is not
 *     meaningful — marks stack above and below one letter, and the shipped
 *     reading order of the same word differs between two pages — so
 *     `[kasra, shadda, fatha]` equals `[kasra, fatha, shadda]`. Same-named marks
 *     pair up in reading order; what is left over on either side is unmatched.
 *
 *  3. **Return the unmatched marks' boxes**, per side, for the view to tint.
 *
 * This module holds no text — a mark is (word, name, box) — and reaches no
 * network. Fetching the shards is the view's job, exactly as for words.
 */
import type { Rect } from "./highlighter.js";
import type { PageNumber } from "./types.js";
import type { WireBox, WordSpanRange } from "./words.js";

/**
 * A mark as the shard writes it. `w` is the print's word index within the ayah
 * (the same numbering the word boxes use), `n` its name, `r` its box in page
 * units, `s` where the box came from — `ink`, `reach`, `tilt` or `hand`.
 */
export interface WireMark {
  readonly w: number;
  readonly n: string;
  readonly r: WireBox;
  readonly s?: string;
}

/** A page's mark shard. Keys are `"<surah>:<ayah>"` — bare, like the word shard's. */
export interface MarkShard {
  readonly page: PageNumber;
  readonly marks: Readonly<Record<string, readonly WireMark[]>>;
}

/** Whether a shard is well formed enough to read. Cheap; not a schema check. */
export function isMarkShard(value: unknown): value is MarkShard {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { page?: unknown; marks?: unknown };
  return typeof v.page === "number" && typeof v.marks === "object" && v.marks !== null;
}

/** One side of a mark comparison: an ayah's marks and the word runs to pair by. */
export interface MarkSide {
  /** Every mark of the ayah on its page, in the shard's order. */
  readonly marks: readonly WireMark[];
  /** The print word indices this page holds of the ayah. */
  readonly present: WordSpanRange;
  /** Inclusive print word indices the two ayahs have in common. */
  readonly shared: readonly [number, number];
  /** Whether a print index is a pause mark rather than a word. */
  readonly isPause: (index: number) => boolean;
}

/** The unmatched marks on each side, as boxes ready to draw. */
export interface MarkDiff {
  readonly a: readonly Rect[];
  readonly b: readonly Rect[];
}

/** The word indices in `[lo, hi]` that this side holds and that are not pauses. */
function wordsIn(side: MarkSide, lo: number, hi: number): number[] {
  const out: number[] = [];
  const from = Math.max(lo, side.present.from);
  const to = Math.min(hi, side.present.to);
  for (let i = from; i <= to; i++) if (!side.isPause(i)) out.push(i);
  return out;
}

/** The marks of one side grouped by word, each group in the shard's order. */
function byWord(side: MarkSide): Map<number, WireMark[]> {
  const map = new Map<number, WireMark[]>();
  for (const m of side.marks) {
    const list = map.get(m.w);
    if (list) list.push(m);
    else map.set(m.w, [m]);
  }
  return map;
}

function rectOf(m: WireMark): Rect {
  const [x, y, width, height] = m.r;
  return { x, y, width, height };
}

/**
 * Which of one word's marks have no same-named partner in the other word — on
 * both words at once. Same-named marks pair up in reading order; each side's
 * leftovers are the answer.
 */
function unmatchedIn(
  a: readonly WireMark[],
  b: readonly WireMark[],
): { a: WireMark[]; b: WireMark[] } {
  const spare = new Map<string, WireMark[]>();
  for (const m of b) {
    const list = spare.get(m.n);
    if (list) list.push(m);
    else spare.set(m.n, [m]);
  }
  const ua: WireMark[] = [];
  for (const m of a) {
    const list = spare.get(m.n);
    if (list && list.length > 0) list.shift();
    else ua.push(m);
  }
  // Whatever b still has spare after a has taken its partners is unmatched on b.
  const left = new Set<WireMark>();
  for (const list of spare.values()) for (const m of list) left.add(m);
  return { a: ua, b: b.filter((m) => left.has(m)) };
}

/**
 * The marks on each side that the other side's paired word does not carry,
 * over the words the two ayahs share.
 *
 * Pairs the shared run's words as the header describes, then compares each
 * pair as a bag of mark names. Returns boxes, not marks, because the only thing
 * a caller does with the answer is draw it.
 */
export function unmatchedMarks(a: MarkSide, b: MarkSide): MarkDiff {
  const marksA = byWord(a);
  const marksB = byWord(b);
  const outA: Rect[] = [];
  const outB: Rect[] = [];

  const wordsA = wordsIn(a, a.shared[0], a.shared[1]);
  const wordsB = wordsIn(b, b.shared[0], b.shared[1]);
  // Head to head — unless a side's page begins partway through the run (the
  // ayah started on the leaf before), in which case its head is missing and
  // the two runs are paired from the end they both hold.
  const fromEnd = a.present.from > a.shared[0] || b.present.from > b.shared[0];
  const len = Math.min(wordsA.length, wordsB.length);
  for (let k = 0; k < len; k++) {
    const wa = fromEnd ? (wordsA[wordsA.length - 1 - k] as number) : (wordsA[k] as number);
    const wb = fromEnd ? (wordsB[wordsB.length - 1 - k] as number) : (wordsB[k] as number);
    const found = unmatchedIn(marksA.get(wa) ?? [], marksB.get(wb) ?? []);
    for (const m of found.a) outA.push(rectOf(m));
    for (const m of found.b) outB.push(rectOf(m));
  }

  return { a: outA, b: outB };
}

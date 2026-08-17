/**
 * Which words two look-alike ayahs share, and which ones they do not.
 *
 * WHAT THIS REPLACED, AND WHY. Until now the "why are these two confusable"
 * panel read from a hand-typed table of twelve ayahs' text, carried in this
 * package as source. Three things were wrong with that. It was running scripture
 * in a code repository, which is the shape takedown notices are routinely scoped
 * to. It was typed in a plainer spelling than the mus'haf the reader is looking
 * at, so the panel showed different letters from the page underneath it. And it
 * covered twelve ayahs out of six thousand.
 *
 * None of that was necessary, because the corpus already ships the answer. Every
 * look-alike edge carries the target's page and the matching word run on *both*
 * sides — `span` and `toSpan`, in the print's own word numbering, the same
 * numbering the word boxes use. So the shared stretch is a lookup, not a
 * judgement, and what diverges is simply what is left over at either end:
 *
 *     2:48 → 2:123   page 19   span [1,13]   toSpan [1,13]
 *     2:48   words 1..23 on page 7   → 1–13 shared, 14–23 differ
 *     2:123  words 1..22 on page 19  → 1–13 shared, 14–22 differ
 *
 * which is exactly what the typed table's per-token 0/1/2 classes encoded, for
 * 2,544 pairs rather than twelve. The panel draws the page's own ink through
 * those boxes, so the reader compares the printing rather than a transcription
 * of it.
 *
 * This module holds no text and reaches no network: it is arithmetic on word
 * indices. Fetching the pages and painting the ink is the view's job.
 */
import type { Edge } from "./adjacency.js";
import type { WordSpanRange } from "./words.js";

/** `"quran/hafs-kfqc/2:48#w3-7"` → `"2:48"`. */
function bareKey(key: string): string {
  const tail = key.slice(key.lastIndexOf("/") + 1);
  const hash = tail.indexOf("#");
  return hash === -1 ? tail : tail.slice(0, hash);
}

/** One side of the comparison: an ayah, the page it is printed on, and the run it shares. */
export interface DiffSide {
  /** Bare `"2:48"`, ready for {@link WordIndex}. */
  readonly key: string;
  /** The page whose word shard and artwork this side is drawn from. */
  readonly page: number;
  /** Inclusive print word indices the two ayahs have in common. */
  readonly shared: readonly [number, number];
}

/** The two sides of a look-alike comparison. */
export interface WordDiff {
  readonly from: DiffSide;
  readonly to: DiffSide;
}

/**
 * The comparison an edge describes, or `null` when it describes none.
 *
 * `null` is the common case and not a failure: `build-adjacency.mjs` emits a
 * span only where the shared run occurs in exactly one place on *both* sides,
 * because naming one of several occurrences would be a guess. 2,544 of 2,996
 * look-alike edges carry one; the rest make no claim about where they match, and
 * a caller shows its plain note instead — the same fallback the twelve-ayah
 * table left in place for every pair it did not cover.
 *
 * The source page is read off `dir.dPage`, which is the target's page minus the
 * source's, rather than passed in. The edge is self-describing that way, and the
 * arithmetic cannot drift out of step with the page the edge actually names.
 */
export function wordDiff(edge: Edge, fromKey: string): WordDiff | null {
  if (!edge.span || !edge.toSpan) return null;
  const from = edge.span.from;
  const to = edge.toSpan.from;
  if (from[1] < from[0] || to[1] < to[0]) return null;
  return {
    from: { key: bareKey(fromKey), page: edge.page - edge.dir.dPage, shared: from },
    to: { key: bareKey(edge.to), page: edge.page, shared: to },
  };
}

/**
 * The runs of an ayah that are *not* shared, given everything of it that is on
 * this page.
 *
 * Returned as ranges rather than as a set of indices because the caller paints
 * them with {@link WordIndex.bandsFor}, which collapses a run to one rectangle
 * per line of the print and wants the run whole.
 *
 * Both ends can be empty — two ayahs that differ only in their tail share
 * everything before it — and an ayah that continues onto the next page is
 * clamped to what this page holds, so the leftover named here is the leftover
 * the reader can actually see.
 */
export function divergentRuns(
  present: WordSpanRange,
  shared: readonly [number, number],
): Array<readonly [number, number]> {
  const runs: Array<readonly [number, number]> = [];
  if (shared[0] > present.from) runs.push([present.from, Math.min(shared[0] - 1, present.to)]);
  if (shared[1] < present.to) runs.push([Math.max(shared[1] + 1, present.from), present.to]);
  return runs;
}

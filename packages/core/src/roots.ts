/**
 * Root lens — the ⬡ family view (spec §9, PLAN §Loop 5).
 *
 * Same contract as `adjacency.ts`: pure, framework-free, never fetches. The
 * app's L3 loader hands this module already-parsed shards and it answers the
 * one question the lens asks — "which roots does this ayah carry, and where
 * else in the mushaf do they occur, nearest page first?".
 *
 * The data comes in two directions because the lens needs both:
 *   - `roots/<edition>/ayah/<surah>.json` — ayah → the roots on it, in word
 *     order, each carrying the id of the root shard holding its occurrences.
 *   - `roots/<edition>/root/<bucket>.json` — root → every ayah that carries
 *     it, as compact tuples `[abs, page, count, ...lemmaIds]`.
 *
 * The reverse index doubles as the page table: the current ayah is always a
 * member of its own roots' occurrence lists, so page distance is computed
 * without a resolver, a manifest, or an extra fetch.
 *
 * Granularity is the ayah (Loop 5's ayah-fallback). Word-level anchors need
 * the ligature corpus evaluated in Loop 4b — when that lands, the shard tuples
 * gain word indices and this API grows a `span`, nothing else changes.
 */

import { formatAyahKey, parseAyahKey } from "./keys.js";
import { fromAbsoluteAyah, juzOf } from "./quran-meta.js";
import type { EditionId } from "./types.js";

/* ------------------------------------------------------------------ */
/* Shard shapes (written by packages/etl/scripts/build-roots.mjs).     */
/* ------------------------------------------------------------------ */

/**
 * One ayah's occurrence of a root: `[abs, page, count, ...lemmaIds]` where
 * `abs` is the absolute ayah number (1..6236), `page` its mushaf page in this
 * edition, `count` how many words of that root the ayah carries, and the rest
 * are indices into the entry's `l` (lemma) table. Tuples, not objects — the
 * reverse index is the bulk of the payload and this halves it.
 */
export type RootOccurrence = readonly [
  abs: number,
  page: number,
  count: number,
  ...lemmas: number[],
];

/** One root's corpus-wide record in a root shard. */
export interface RootEntry {
  /** Distinct lemmas of this root, stable-sorted; occurrences index into it. */
  readonly l: readonly string[];
  /** Total *words* of this root in the corpus (≥ `a.length`). */
  readonly w: number;
  /** Every ayah carrying this root, ascending by absolute ayah number. */
  readonly a: readonly RootOccurrence[];
}

/** One root shard: root (Arabic, letters space-separated) → its record. */
export type RootIndexShard = Readonly<Record<string, RootEntry>>;

/** One root as it appears on an ayah (forward direction). */
export interface AyahRootRef {
  /** The root, e.g. `"ذ ك ر"` — same spelling as `Edge.root`. */
  readonly r: string;
  /** Which `root/<bucket>.json` holds this root's occurrences. */
  readonly b: number;
  /** How many words of this root this ayah carries. */
  readonly n: number;
}

/** One ayah-roots shard: ayah number (as string) → its roots, in word order. */
export type AyahRootsShard = Readonly<Record<string, readonly AyahRootRef[]>>;

/* ------------------------------------------------------------------ */
/* Lens output.                                                        */
/* ------------------------------------------------------------------ */

/** One other ayah carrying the family's root. */
export interface RootHop {
  /** Canonical target key, e.g. `"quran/hafs-kfqc/2:123"`. */
  readonly key: string;
  readonly surah: number;
  readonly ayah: number;
  readonly page: number;
  /** target.page − source.page (signed). */
  readonly dPage: number;
  /** target.surah − source.surah (signed). */
  readonly dSurah: number;
  readonly sameJuz: boolean;
  /** Words of this root on the target ayah. */
  readonly count: number;
  /** Lemmas of this root used on the target ayah (may be empty). */
  readonly lemmas: readonly string[];
}

/** A lemma sub-group of a family's hops (spec §9: "lemma sub-groups"). */
export interface LemmaGroup {
  readonly lemma: string;
  readonly hops: readonly RootHop[];
}

/** One root of the current ayah, with everywhere else it lands. */
export interface RootFamily {
  readonly root: string;
  /** Words of this root on the *current* ayah. */
  readonly here: number;
  /** Ayahs carrying this root corpus-wide, including the current one. */
  readonly ayahs: number;
  /** Words carrying this root corpus-wide. */
  readonly words: number;
  /** The other ayahs, nearest page first. Truncated by `limit`. */
  readonly hops: readonly RootHop[];
  /** True when `limit` cut `hops` short — the UI says "+N more". */
  readonly truncated: boolean;
  /** `hops` regrouped by lemma, most-used lemma first. Empty without lemmas. */
  readonly lemmas: readonly LemmaGroup[];
}

/** Options for {@link Roots.familiesForKey}. */
export interface RootLensOptions {
  /**
   * Max hops kept per family (nearest pages win). The lens is a navigation
   * instrument, not a concordance — a hafiz reading قول's 1,700 occurrences is
   * not a use case, so the default keeps the nearest 20 and flags the rest.
   */
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;

/* ------------------------------------------------------------------ */
/* Ordering (spec §9: page-distance sort).                             */
/* ------------------------------------------------------------------ */

/**
 * Nearest page first: by |dPage|, then in mushaf order so a tie between the
 * page before and the page after resolves the way a hafiz reads. Stable and
 * total — the same shard always yields the same list.
 */
export function orderByPageDistance(hops: readonly RootHop[]): RootHop[] {
  return [...hops].sort(
    (a, b) =>
      Math.abs(a.dPage) - Math.abs(b.dPage) ||
      a.surah - b.surah ||
      a.ayah - b.ayah,
  );
}

/**
 * Group hops by lemma, most-used lemma first (ties broken alphabetically so
 * the order is deterministic). A hop with several lemmas appears under each —
 * the groups are a lens on the same hops, not a partition.
 */
export function groupByLemma(hops: readonly RootHop[]): LemmaGroup[] {
  const byLemma = new Map<string, RootHop[]>();
  for (const hop of hops) {
    for (const lemma of hop.lemmas) {
      const list = byLemma.get(lemma);
      if (list) list.push(hop);
      else byLemma.set(lemma, [hop]);
    }
  }
  return [...byLemma]
    .map(([lemma, group]) => ({ lemma, hops: group }))
    .sort((a, b) => b.hops.length - a.hops.length || cmp(a.lemma, b.lemma));
}

/** Locale-independent string compare — sort order must not vary by device. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Roots — the loaded lens for one edition.                            */
/* ------------------------------------------------------------------ */

/**
 * Roots wraps the loaded shards for one edition. Shards arrive already parsed
 * and in two waves: the ayah shard for the selection's surah tells you which
 * root buckets you need (`bucketsForKey`), and once those land the families
 * are complete. Missing shards are never fatal — the lens simply has less to
 * say, exactly like `Adjacency` with a missing surah.
 */
export class Roots {
  readonly edition: EditionId;
  #ayahShards = new Map<number, AyahRootsShard>();
  #rootShards = new Map<number, RootIndexShard>();

  constructor(edition: EditionId) {
    this.edition = edition;
  }

  /** Register a surah's ayah→roots shard (parsed JSON). Idempotent. */
  addAyahShard(surah: number, shard: AyahRootsShard): void {
    this.#ayahShards.set(surah, shard);
  }

  /** Register a root→ayahs bucket (parsed JSON). Idempotent. */
  addRootShard(bucket: number, shard: RootIndexShard): void {
    this.#rootShards.set(bucket, shard);
  }

  hasAyahShard(surah: number): boolean {
    return this.#ayahShards.has(surah);
  }

  hasRootShard(bucket: number): boolean {
    return this.#rootShards.has(bucket);
  }

  /** The roots on an ayah, in word order (empty if the shard is not loaded). */
  rootsForKey(key: string): readonly AyahRootRef[] {
    const parsed = this.#parse(key);
    if (!parsed) return [];
    return this.#ayahShards.get(parsed.surah)?.[String(parsed.ayah)] ?? [];
  }

  /**
   * Root buckets the selection needs, ascending and deduped — the app fetches
   * these before the families can be built. Empty until the ayah shard lands.
   */
  bucketsForKey(key: string): number[] {
    return [...new Set(this.rootsForKey(key).map((r) => r.b))].sort(
      (a, b) => a - b,
    );
  }

  /**
   * The current ayah's root families, nearest page first.
   *
   * Families are ordered by their *closest* hop, then by rarity (a root on 4
   * ayahs is a navigation aid; one on 400 is noise), then alphabetically. A
   * root whose bucket has not loaded yet is skipped rather than shown empty —
   * it appears complete once the fetch lands.
   */
  familiesForKey(key: string, options: RootLensOptions = {}): RootFamily[] {
    const parsed = this.#parse(key);
    if (!parsed) return [];
    const limit = options.limit ?? DEFAULT_LIMIT;
    const refs = this.rootsForKey(key);
    if (refs.length === 0) return [];

    const families: RootFamily[] = [];
    const seen = new Set<string>();
    for (const ref of refs) {
      if (seen.has(ref.r)) continue; // a root can repeat across an ayah's words
      seen.add(ref.r);
      const entry = this.#rootShards.get(ref.b)?.[ref.r];
      if (!entry) continue; // bucket not loaded (or root absent) → not yet known
      families.push(family(this.edition, parsed, ref, entry, limit));
    }

    return families.sort(
      (a, b) =>
        nearest(a) - nearest(b) ||
        a.ayahs - b.ayahs ||
        cmp(a.root, b.root),
    );
  }

  #parse(key: string): { surah: number; ayah: number } | null {
    const parsed = parseAyahKey(key);
    if (!parsed || parsed.edition !== this.edition) return null;
    return { surah: parsed.surah, ayah: parsed.ayah };
  }
}

/** |dPage| of a family's closest hop; a hapax root sorts last. */
function nearest(f: RootFamily): number {
  return f.hops.length === 0 ? Number.POSITIVE_INFINITY : Math.abs(f.hops[0]!.dPage);
}

/** Build one family: every occurrence except the current ayah, ordered + capped. */
function family(
  edition: EditionId,
  source: { surah: number; ayah: number },
  ref: AyahRootRef,
  entry: RootEntry,
  limit: number,
): RootFamily {
  // The source ayah is always in its own root's list, so its page comes from
  // the reverse index — no resolver, no manifest, no second fetch.
  const sourcePage = pageOfSource(entry, source);
  const sourceJuz = juzOf(source.surah, source.ayah);

  const hops: RootHop[] = [];
  for (const occ of entry.a) {
    const { surah, ayah } = fromAbsoluteAyah(occ[0]);
    if (surah === source.surah && ayah === source.ayah) continue;
    hops.push({
      key: formatAyahKey(edition, surah, ayah),
      surah,
      ayah,
      page: occ[1],
      dPage: sourcePage === null ? 0 : occ[1] - sourcePage,
      dSurah: surah - source.surah,
      sameJuz: juzOf(surah, ayah) === sourceJuz,
      count: occ[2],
      lemmas: occ.slice(3).map((i) => entry.l[i] ?? "").filter(Boolean),
    });
  }

  const ordered = orderByPageDistance(hops);
  const kept = ordered.slice(0, limit);
  return {
    root: ref.r,
    here: ref.n,
    ayahs: entry.a.length,
    words: entry.w,
    hops: kept,
    truncated: ordered.length > kept.length,
    lemmas: groupByLemma(kept),
  };
}

/** The source ayah's page, read out of its own occurrence list. */
function pageOfSource(
  entry: RootEntry,
  source: { surah: number; ayah: number },
): number | null {
  for (const occ of entry.a) {
    const { surah, ayah } = fromAbsoluteAyah(occ[0]);
    if (surah === source.surah && ayah === source.ayah) return occ[1];
  }
  return null; // shard disagrees with the selection — treat every hop as near
}

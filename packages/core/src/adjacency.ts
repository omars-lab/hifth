/**
 * Adjacency — the knowledge-graph routing table that drives the hop rail (spec §5, §6, §9).
 *
 * This module is pure and framework-free: it takes an already-loaded adjacency
 * shard (static JSON, sharded by surah) plus the current selection, and returns
 * the rail chips and the ordered popover hop list. It never fetches — the app's
 * L3 loader hands it parsed shard data (Loop 2 ships one curated shard for surah
 * 2; Loop 4 replaces the *data source* with the full ETL output, not this API).
 *
 * The rail buckets every selection's edges by direction so the chips read the way
 * a hafiz thinks: ↻ same-surah look-alikes, ◀ earlier surahs, ▶ later surahs, and
 * ⬡ shared roots as their own family (spec §9: "Direction glyphs always visible
 * on chips with counts").
 */

import { formatAyahKey, parseAyahKey } from "./keys.js";
import type { EditionId } from "./types.js";

/* ------------------------------------------------------------------ */
/* Edge-type registry (spec §5) — data-driven, additive-only.          */
/* ------------------------------------------------------------------ */

export type EdgeTypeId =
  | "mutashabih"
  | "related-meaning"
  | "shared-root"
  // reserved (render nothing until a data drop flips status):
  | "hadith-citation"
  | "tafsir-ref"
  | "lexicon-entry";

export type EdgeStatus = "active" | "reserved";

export interface EdgeType {
  readonly id: EdgeTypeId;
  readonly label: string;
  /** Base glyph; `mutashabih` is rendered with a direction glyph instead (↻◀▶). */
  readonly icon: string;
  readonly status: EdgeStatus;
  /** Secondary edges (e.g. related-meaning) get lighter visual weight. */
  readonly visualWeight?: "secondary";
}

/** The registry, in rail order. Reserved types are present so activating one
 * later is a data drop + a status flip — zero UI changes (spec §5). */
export const EDGE_TYPES: readonly EdgeType[] = [
  { id: "mutashabih", label: "متشابهات", icon: "↻", status: "active" },
  {
    id: "related-meaning",
    label: "معنى قريب",
    icon: "≈",
    status: "active",
    visualWeight: "secondary",
  },
  { id: "shared-root", label: "جذر مشترك", icon: "⬡", status: "active" },
  { id: "hadith-citation", label: "ورد في حديث", icon: "⚭", status: "reserved" },
  { id: "tafsir-ref", label: "إحالة تفسير", icon: "✎", status: "reserved" },
  { id: "lexicon-entry", label: "مدخل معجم", icon: "📖", status: "reserved" },
];

const EDGE_TYPE_BY_ID = new Map(EDGE_TYPES.map((t) => [t.id, t]));

/** True for edge types that render in the rail (spec §5: reserved → nothing). */
export function isActiveEdgeType(id: EdgeTypeId): boolean {
  return EDGE_TYPE_BY_ID.get(id)?.status === "active";
}

/* ------------------------------------------------------------------ */
/* Adjacency shapes (spec §6).                                         */
/* ------------------------------------------------------------------ */

/** Precomputed direction from source ayah to target (spec §6). */
export interface EdgeDir {
  /** target.surah − source.surah. <0 earlier ◀, >0 later ▶, =0 same ↻. */
  readonly dSurah: number;
  /** target.page − source.page (signed). */
  readonly dPage: number;
  readonly sameJuz?: boolean;
}

/** A word range on an ayah, `[from, to]` inclusive word indices (spec §6). */
export interface WordSpan {
  readonly from: readonly [number, number];
}

/** One typed edge out of an ayah, as stored in a shard (spec §6). */
export interface Edge {
  readonly type: EdgeTypeId;
  /** Canonical target key, e.g. "quran/hafs-kfqc/2:123" (may carry #wN). */
  readonly to: string;
  /** Mushaf page of the target (denormalized for rail counts + prefetch). */
  readonly page: number;
  readonly dir: EdgeDir;
  readonly root?: string;
  readonly span?: WordSpan;
  readonly toSpan?: WordSpan;
  /** Identical wording — popover labels it "identical; context differs". */
  readonly twin?: boolean;
  /** Show the following ayah's opening in the popover (hifz disambiguator). */
  readonly ctx?: boolean;
  /** Human note for the popover. */
  readonly note?: string;
  readonly src?: string;
}

/** Per-ayah adjacency: active edges + a reserved-type bucket (spec §5, §6). */
export interface AyahAdjacency {
  readonly edges: readonly Edge[];
  /** Reserved-type edges, shipped from day one, rendered by nobody yet. */
  readonly ext: readonly Edge[];
}

/** One surah shard: ayah-number (as string) → its adjacency. */
export type AdjacencyShard = Readonly<Record<string, AyahAdjacency>>;

/* ------------------------------------------------------------------ */
/* Rail bucketing (spec §9).                                           */
/* ------------------------------------------------------------------ */

/** The four rail directions. `loop` = same surah, `root` = shared-root family. */
export type RailDirection = "loop" | "earlier" | "later" | "root";

/** Direction glyph for a chip (spec §9: `↻ 3` `◀ 1` `▶ 2` `⬡ 12`). */
export const RAIL_GLYPH: Readonly<Record<RailDirection, string>> = {
  loop: "↻",
  earlier: "◀",
  later: "▶",
  root: "⬡",
};

/** A rail chip: one direction bucket with its edges and count. */
export interface RailChip {
  readonly direction: RailDirection;
  readonly glyph: string;
  readonly count: number;
  readonly edges: readonly Edge[];
}

/** Bucket an ayah's active edges into rail chips, in reading order
 * (loop, earlier, later, root). Empty buckets are dropped; reserved-type
 * edges (`ext`) never appear. */
export function bucketEdges(adj: AyahAdjacency | undefined): RailChip[] {
  const buckets: Record<RailDirection, Edge[]> = {
    loop: [],
    earlier: [],
    later: [],
    root: [],
  };
  for (const edge of adj?.edges ?? []) {
    if (!isActiveEdgeType(edge.type)) continue;
    buckets[railDirection(edge)].push(edge);
  }
  const order: RailDirection[] = ["loop", "earlier", "later", "root"];
  return order
    .filter((d) => buckets[d].length > 0)
    .map((direction) => ({
      direction,
      glyph: RAIL_GLYPH[direction],
      count: buckets[direction].length,
      edges: buckets[direction],
    }));
}

/** Which rail bucket an edge falls in. shared-root is its own family; every
 * other active type buckets by surah direction. */
function railDirection(edge: Edge): RailDirection {
  if (edge.type === "shared-root") return "root";
  if (edge.dir.dSurah < 0) return "earlier";
  if (edge.dir.dSurah > 0) return "later";
  return "loop";
}

/* ------------------------------------------------------------------ */
/* Popover ordering (spec §6).                                         */
/* ------------------------------------------------------------------ */

/**
 * Order edges for the popover the way a hafiz wants them: nearest first —
 * same page → same juz → earlier surahs → later surahs — then by absolute
 * page distance as a tiebreak. Stable within a rank so shard order is kept.
 * (spec §6: "same page → same juz → earlier surahs → later surahs".)
 */
export function orderForHifz<T extends Edge>(edges: readonly T[]): T[] {
  return edges
    .map((edge, i) => ({ edge, i, rank: hifzRank(edge) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Math.abs(a.edge.dir.dPage) - Math.abs(b.edge.dir.dPage) ||
        a.i - b.i,
    )
    .map((x) => x.edge);
}

function hifzRank(edge: Edge): number {
  if (edge.dir.dPage === 0) return 0; // same page
  if (edge.dir.sameJuz) return 1; // same juz
  if (edge.dir.dSurah < 0) return 2; // earlier surahs
  return 3; // later surahs
}

/* ------------------------------------------------------------------ */
/* Merged range adjacency (spec §9 highlight menu).                    */
/* ------------------------------------------------------------------ */

/**
 * One edge of a merged range list: an ordinary edge plus the range members that
 * produced it. `sources` is what makes the merge honest — the menu can say "this
 * hop came from ٢:٤٧" (and the diff knows which ayah to compare against) instead
 * of pretending the whole highlighted passage links there.
 */
export interface MergedEdge extends Edge {
  /** Canonical keys of the highlighted ayahs that contributed this edge, in range order. */
  readonly sources: readonly string[];
  /**
   * The one range member whose edge survived the merge — the ayah this row's
   * note, twin, root and diff are *about*, and therefore the ayah a leap from
   * this row departs from. Usually `sources[0]`; it differs whenever a later
   * member carried richer metadata and won rule 2.
   */
  readonly from: string;
}

/** One member of a highlighted range and its (possibly missing) adjacency. */
export interface RangeSource {
  readonly key: string;
  readonly adj: AyahAdjacency | undefined;
}

/** Metadata fields that make one duplicate of an edge more useful than another. */
const RICHNESS_FIELDS = ["note", "twin", "root", "ctx"] as const;

/** How much a hafiz-facing edge tells you (spec §9's note/twin/root/ctx). */
function richness(edge: Edge): number {
  let n = 0;
  for (const f of RICHNESS_FIELDS) if (edge[f] != null && edge[f] !== false) n += 1;
  return n;
}

/** Target key without its word anchor (`…/2:122#w3` → `…/2:122`). */
function bareTarget(to: string): string {
  const hash = to.indexOf("#");
  return hash === -1 ? to : to.slice(0, hash);
}

/**
 * Merge a highlighted range's adjacency into one hop list (spec §9: "merged,
 * deduped edges of every highlighted ayah/word").
 *
 * Three rules, in order:
 * 1. **Dedupe by (target, type).** The same target reached by two different edge
 *    types stays two rows — a look-alike and a shared root are different reasons
 *    to leap — but the same pair seen from two ayahs of the range collapses.
 * 2. **Richer metadata wins a collision.** The surviving row is whichever
 *    duplicate carries more of note/twin/root/ctx (ties keep the first seen, so
 *    the result is stable in range order); every contributor is still recorded in
 *    `sources`. The winner is kept whole rather than field-merged: a `note` is
 *    written about *its* source ayah and would lie if grafted onto another's —
 *    which is also why `from` follows the winner rather than `sources[0]`. A row
 *    that reads as 2:48's note but leaps from 2:47 is that same lie, one step
 *    later.
 * 3. **Edges pointing inside the range are dropped.** Hopping to text the reader
 *    has already highlighted is not a hop; word anchors are ignored for this test
 *    (`2:122#w3` counts as `2:122`).
 *
 * Reserved-type edges never appear (spec §5), and the result is `orderForHifz`ed
 * so the nearest hop is first — same ordering the single-ayah popover uses.
 */
export function mergeRangeEdges(sources: readonly RangeSource[]): MergedEdge[] {
  const inside = new Set(sources.map((s) => bareTarget(s.key)));
  // (type, target) → the winning edge so far, whose member it came from, and
  // every contributor, insertion-ordered.
  const merged = new Map<string, { edge: Edge; from: string; sources: string[] }>();

  for (const { key, adj } of sources) {
    for (const edge of adj?.edges ?? []) {
      if (!isActiveEdgeType(edge.type)) continue;
      if (inside.has(bareTarget(edge.to))) continue;
      const id = `${edge.type}>${edge.to}`;
      const seen = merged.get(id);
      if (!seen) {
        merged.set(id, { edge, from: key, sources: [key] });
        continue;
      }
      if (!seen.sources.includes(key)) seen.sources.push(key);
      if (richness(edge) > richness(seen.edge)) {
        seen.edge = edge;
        seen.from = key;
      }
    }
  }

  const out: MergedEdge[] = [];
  for (const { edge, from, sources: contributors } of merged.values()) {
    out.push({ ...edge, from, sources: contributors });
  }
  return orderForHifz(out);
}

/* ------------------------------------------------------------------ */
/* Adjacency — the loaded routing table for one edition.               */
/* ------------------------------------------------------------------ */

/**
 * Adjacency wraps the loaded shards for one edition and answers the two
 * questions the rail asks: "what are this ayah's chips?" and "give me this
 * chip's hops, hifz-ordered". Shards are handed in already-parsed; a missing
 * shard or ayah simply yields no chips (never throws).
 */
export class Adjacency {
  readonly edition: EditionId;
  #shards = new Map<number, AdjacencyShard>();

  constructor(edition: EditionId) {
    this.edition = edition;
  }

  /** Register a surah's shard (parsed JSON). Idempotent per surah. */
  addShard(surah: number, shard: AdjacencyShard): void {
    this.#shards.set(surah, shard);
  }

  hasShard(surah: number): boolean {
    return this.#shards.has(surah);
  }

  /** Raw adjacency for an ayah key, or undefined if not covered. */
  forKey(key: string): AyahAdjacency | undefined {
    const parsed = parseAyahKey(key);
    if (!parsed || parsed.edition !== this.edition) return undefined;
    return this.#shards.get(parsed.surah)?.[String(parsed.ayah)];
  }

  /** Rail chips for an ayah key (empty if uncovered). */
  chipsForKey(key: string): RailChip[] {
    return bucketEdges(this.forKey(key));
  }

  /** All active edges for a key, hifz-ordered (empty if uncovered). */
  hopsForKey(key: string): Edge[] {
    const adj = this.forKey(key);
    if (!adj) return [];
    return orderForHifz(adj.edges.filter((e) => isActiveEdgeType(e.type)));
  }

  /**
   * The merged hop list for a highlighted range (spec §9) — every member's
   * active edges, deduped by (target, type) and hifz-ordered, each carrying the
   * range members it came from. Uncovered members simply contribute nothing.
   */
  hopsForRange(keys: readonly string[]): MergedEdge[] {
    return mergeRangeEdges(keys.map((key) => ({ key, adj: this.forKey(key) })));
  }
}

/* ------------------------------------------------------------------ */
/* Shard building (Loop 2 seed — retired from the ETL path in 4a).     */
/* ------------------------------------------------------------------ */

/** A curated edge in the mock's compact form (docs/reference/linker-mock.html). */
export interface CuratedEdge {
  readonly type: "mutashabih" | "related" | "root";
  /** Bare "surah:ayah" (mock form), e.g. "2:123". */
  readonly to: string;
  readonly page: number;
  readonly root?: string;
  readonly twin?: 0 | 1;
  readonly ctx?: 0 | 1;
  readonly note?: string;
  /** Word anchor on the target in mock form, e.g. "w3". */
  readonly w?: string;
}

/** Curated adjacency map: bare "surah:ayah" → its curated edges. */
export type CuratedAdjacency = Readonly<Record<string, readonly CuratedEdge[]>>;

/** Mock edge-type name → spec §5 registry id. */
const CURATED_TYPE: Readonly<Record<CuratedEdge["type"], EdgeTypeId>> = {
  mutashabih: "mutashabih",
  related: "related-meaning",
  root: "shared-root",
};

/**
 * Compile the mock's curated clusters into per-surah shards in spec §6 shape:
 * bare refs → canonical keys, `dir` computed from source/target surah+page.
 * `sourcePages` maps "surah:ayah" → page so dPage can be signed correctly; a
 * source whose page is unknown gets dPage 0 (treated as same-page, harmless for
 * the curated demo where every source page is known). Since Loop 4a the ETL
 * emits spec-shape shards directly (with real page/juz tables); this compiler
 * remains as the reference conversion for the curated fixture form (tests).
 */
export function buildShards(
  edition: EditionId,
  curated: CuratedAdjacency,
  sourcePages: Readonly<Record<string, number>>,
): Map<number, AdjacencyShard> {
  const shards = new Map<number, Record<string, AyahAdjacency>>();

  for (const [ref, edges] of Object.entries(curated)) {
    const { surah, ayah } = splitRef(ref);
    const srcPage = sourcePages[ref];
    const compiled: Edge[] = edges.map((e) => {
      const { surah: tSurah } = splitRef(e.to);
      const to = e.w
        ? `${formatAyahKey(edition, ...refParts(e.to))}#${e.w}`
        : formatAyahKey(edition, ...refParts(e.to));
      return {
        type: CURATED_TYPE[e.type],
        to,
        page: e.page,
        dir: {
          dSurah: tSurah - surah,
          dPage: srcPage == null ? 0 : e.page - srcPage,
          sameJuz: tSurah === surah, // refined by real juz table in Loop 4
        },
        ...(e.root ? { root: e.root } : {}),
        ...(e.twin ? { twin: true } : {}),
        ...(e.ctx ? { ctx: true } : {}),
        ...(e.note ? { note: e.note } : {}),
      };
    });

    const shard = shards.get(surah) ?? {};
    shard[String(ayah)] = { edges: compiled, ext: [] };
    shards.set(surah, shard);
  }

  return shards as Map<number, AdjacencyShard>;
}

function splitRef(ref: string): { surah: number; ayah: number } {
  const [s, a] = ref.split(":");
  return { surah: Number(s), ayah: Number(a) };
}

function refParts(ref: string): [number, number] {
  const { surah, ayah } = splitRef(ref);
  return [surah, ayah];
}

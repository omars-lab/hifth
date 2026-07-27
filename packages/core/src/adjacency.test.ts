import { describe, expect, it } from "vitest";
import {
  Adjacency,
  bucketEdges,
  buildShards,
  EDGE_TYPES,
  isActiveEdgeType,
  mergeRangeEdges,
  orderForHifz,
  RAIL_GLYPH,
  type AdjacencyShard,
  type AyahAdjacency,
  type CuratedAdjacency,
  type Edge,
} from "./adjacency.js";

const ED = "hafs-kfqc";

/** Build an edge with sensible defaults for the field under test. */
function edge(p: Partial<Edge> & Pick<Edge, "type" | "to" | "page">): Edge {
  return {
    dir: { dSurah: 0, dPage: 0 },
    ...p,
  } as Edge;
}

describe("edge-type registry (spec §5)", () => {
  it("marks the three active types active and the three reserved types reserved", () => {
    expect(isActiveEdgeType("mutashabih")).toBe(true);
    expect(isActiveEdgeType("related-meaning")).toBe(true);
    expect(isActiveEdgeType("shared-root")).toBe(true);
    expect(isActiveEdgeType("hadith-citation")).toBe(false);
    expect(isActiveEdgeType("tafsir-ref")).toBe(false);
    expect(isActiveEdgeType("lexicon-entry")).toBe(false);
  });

  it("keeps the registry additive-only in rail order (active before reserved is fine, ids stable)", () => {
    const ids = EDGE_TYPES.map((t) => t.id);
    expect(ids).toContain("mutashabih");
    // every reserved type still ships a row (so activation is a status flip only)
    expect(EDGE_TYPES.filter((t) => t.status === "reserved")).toHaveLength(3);
  });
});

describe("bucketEdges (spec §9 rail chips)", () => {
  it("buckets by direction with correct glyphs and counts, in reading order", () => {
    const adj: AyahAdjacency = {
      edges: [
        edge({ type: "mutashabih", to: `quran/${ED}/2:123`, page: 19, dir: { dSurah: 0, dPage: 10 } }),
        edge({ type: "mutashabih", to: `quran/${ED}/1:5`, page: 1, dir: { dSurah: -1, dPage: -6 } }),
        edge({ type: "mutashabih", to: `quran/${ED}/7:161`, page: 171, dir: { dSurah: 5, dPage: 152 } }),
        edge({ type: "mutashabih", to: `quran/${ED}/3:1`, page: 50, dir: { dSurah: 1, dPage: 31 } }),
        edge({ type: "shared-root", to: `quran/${ED}/2:40`, page: 7, root: "ذ ك ر", dir: { dSurah: 0, dPage: -12 } }),
      ],
      ext: [],
    };
    const chips = bucketEdges(adj);
    expect(chips.map((c) => c.direction)).toEqual(["loop", "earlier", "later", "root"]);
    expect(chips.map((c) => c.glyph)).toEqual(["↻", "◀", "▶", "⬡"]);
    // loop = 1 (same surah), earlier = 1, later = 2, root = 1
    expect(chips.map((c) => c.count)).toEqual([1, 1, 2, 1]);
    expect(RAIL_GLYPH.loop).toBe("↻");
  });

  it("drops empty buckets and excludes reserved-type edges", () => {
    const adj: AyahAdjacency = {
      edges: [
        edge({ type: "mutashabih", to: `quran/${ED}/2:50`, page: 8, dir: { dSurah: 0, dPage: 1 } }),
        // reserved type present on the edge list must not surface in the rail
        edge({ type: "hadith-citation", to: `hadith/x`, page: 0, dir: { dSurah: 0, dPage: 0 } }),
      ],
      ext: [],
    };
    const chips = bucketEdges(adj);
    expect(chips).toHaveLength(1);
    expect(chips[0].direction).toBe("loop");
    expect(chips[0].count).toBe(1);
  });

  it("returns no chips for an uncovered ayah", () => {
    expect(bucketEdges(undefined)).toEqual([]);
  });
});

describe("orderForHifz (spec §6: same page → same juz → earlier → later)", () => {
  it("ranks nearest-first and breaks ties by page distance", () => {
    const later = edge({ type: "mutashabih", to: `quran/${ED}/7:1`, page: 151, dir: { dSurah: 5, dPage: 100 } });
    const earlier = edge({ type: "mutashabih", to: `quran/${ED}/1:1`, page: 1, dir: { dSurah: -1, dPage: -6 } });
    const sameJuz = edge({ type: "mutashabih", to: `quran/${ED}/2:80`, page: 12, dir: { dSurah: 0, dPage: 5, sameJuz: true } });
    const samePage = edge({ type: "mutashabih", to: `quran/${ED}/2:41`, page: 7, dir: { dSurah: 0, dPage: 0 } });
    const ordered = orderForHifz([later, earlier, sameJuz, samePage]);
    expect(ordered).toEqual([samePage, sameJuz, earlier, later]);
  });

  it("is stable within a rank and does not mutate the input", () => {
    const a = edge({ type: "mutashabih", to: `quran/${ED}/2:50`, page: 9, dir: { dSurah: 0, dPage: 2, sameJuz: true } });
    const b = edge({ type: "mutashabih", to: `quran/${ED}/2:60`, page: 9, dir: { dSurah: 0, dPage: 2, sameJuz: true } });
    const input = [a, b];
    const ordered = orderForHifz(input);
    expect(ordered).toEqual([a, b]); // same rank + same |dPage| → shard order kept
    expect(input).toEqual([a, b]); // input untouched
  });
});

describe("buildShards + Adjacency (mock curated clusters → spec §6)", () => {
  // The real 2:48 ↔ 2:123 cluster from the mock (page 7 ↔ page 19).
  const curated: CuratedAdjacency = {
    "2:48": [
      { type: "mutashabih", to: "2:123", page: 19, note: "شفاعة ↔ عدل order swapped" },
      { type: "related", to: "82:19", page: 587, note: "same theme" },
    ],
    "2:47": [
      { type: "mutashabih", to: "2:122", page: 19, twin: 1, note: "identical twins" },
      { type: "root", to: "2:122", page: 19, root: "ذ ك ر", w: "w3" },
    ],
  };
  const sourcePages = { "2:48": 7, "2:47": 7 };

  it("compiles bare refs to canonical keys and computes dir", () => {
    const shards = buildShards(ED, curated, sourcePages);
    const surah2 = shards.get(2)!;
    const e48 = surah2["48"].edges[0];
    expect(e48.type).toBe("mutashabih");
    expect(e48.to).toBe(`quran/${ED}/2:123`);
    expect(e48.dir).toEqual({ dSurah: 0, dPage: 12, sameJuz: true }); // 19 − 7
    // "related" maps to the spec id "related-meaning"
    expect(surah2["48"].edges[1].type).toBe("related-meaning");
    expect(surah2["48"].edges[1].dir.dSurah).toBe(80); // 82 − 2
  });

  it("maps root type + word anchor + twin/ctx flags", () => {
    const shards = buildShards(ED, curated, sourcePages);
    const e47 = shards.get(2)!["47"].edges;
    expect(e47[0].twin).toBe(true);
    const rootEdge = e47[1];
    expect(rootEdge.type).toBe("shared-root");
    expect(rootEdge.to).toBe(`quran/${ED}/2:122#w3`);
    expect(rootEdge.root).toBe("ذ ك ر");
  });

  it("Adjacency answers chips + hops for a covered key and is empty for the rest", () => {
    const adj = new Adjacency(ED);
    for (const [surah, shard] of buildShards(ED, curated, sourcePages)) {
      adj.addShard(surah, shard as AdjacencyShard);
    }
    const chips = adj.chipsForKey(`quran/${ED}/2:48`);
    // 2:48 → one same-surah mutashabih (↻) + one later related-meaning (▶)
    expect(chips.map((c) => c.direction)).toEqual(["loop", "later"]);

    const hops = adj.hopsForKey(`quran/${ED}/2:48`);
    expect(hops).toHaveLength(2);
    expect(hops[0].to).toBe(`quran/${ED}/2:123`); // same-surah ranks above cross-surah

    expect(adj.chipsForKey(`quran/${ED}/9:1`)).toEqual([]);
    expect(adj.forKey(`quran/other-edition/2:48`)).toBeUndefined();
  });

  it("ships an empty ext bucket on every ayah (reserved edges, day one)", () => {
    const shards = buildShards(ED, curated, sourcePages);
    expect(shards.get(2)!["48"].ext).toEqual([]);
  });
});

describe("mergeRangeEdges (spec §9: merged, deduped edges of a highlighted range)", () => {
  const k = (ref: string) => `quran/${ED}/${ref}`;
  /** A range member with its edges (adjacency `ext` is never merged). */
  const src = (ref: string, edges: Edge[]) => ({
    key: k(ref),
    adj: { edges, ext: [] } as AyahAdjacency,
  });

  it("unions the members' edges and collapses duplicates by (target, type)", () => {
    const merged = mergeRangeEdges([
      src("2:46", [
        edge({ type: "mutashabih", to: k("2:121"), page: 19, dir: { dSurah: 0, dPage: 12, sameJuz: true } }),
      ]),
      src("2:47", [
        edge({ type: "mutashabih", to: k("2:121"), page: 19, dir: { dSurah: 0, dPage: 12, sameJuz: true }, ctx: true }),
        edge({ type: "mutashabih", to: k("2:123"), page: 19, dir: { dSurah: 0, dPage: 12, sameJuz: true } }),
      ]),
    ]);
    expect(merged.map((e) => e.to)).toEqual([k("2:121"), k("2:123")]);
    // both members contributed the 2:121 row, in range order
    expect(merged[0].sources).toEqual([k("2:46"), k("2:47")]);
    expect(merged[1].sources).toEqual([k("2:47")]);
  });

  it("keeps the same target twice when the edge types differ (look-alike vs shared root)", () => {
    const merged = mergeRangeEdges([
      src("2:47", [
        edge({ type: "mutashabih", to: k("2:40"), page: 7, dir: { dSurah: 0, dPage: 0 } }),
        edge({ type: "shared-root", to: k("2:40"), page: 7, root: "ذ ك ر", dir: { dSurah: 0, dPage: 0 } }),
      ]),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.type)).toEqual(["mutashabih", "shared-root"]);
  });

  it("lets the richer duplicate win (note/twin/root/ctx) while keeping every source", () => {
    const plain = edge({ type: "mutashabih", to: k("2:122"), page: 19, dir: { dSurah: 0, dPage: 12 } });
    const rich = edge({
      type: "mutashabih",
      to: k("2:122"),
      page: 19,
      dir: { dSurah: 0, dPage: 12 },
      twin: true,
      note: "Identical twins",
    });
    const merged = mergeRangeEdges([src("2:46", [plain]), src("2:47", [rich])]);
    expect(merged).toHaveLength(1);
    expect(merged[0].twin).toBe(true);
    expect(merged[0].note).toBe("Identical twins");
    expect(merged[0].sources).toEqual([k("2:46"), k("2:47")]);

    // …regardless of which member the rich one came from (ties keep the first).
    const flipped = mergeRangeEdges([src("2:46", [rich]), src("2:47", [plain])]);
    expect(flipped[0].note).toBe("Identical twins");
    expect(flipped[0].sources).toEqual([k("2:46"), k("2:47")]);
  });

  it("drops edges that point back inside the range (word anchors ignored)", () => {
    const merged = mergeRangeEdges([
      src("2:47", [
        edge({ type: "mutashabih", to: k("2:48"), page: 7, dir: { dSurah: 0, dPage: 0 } }),
        edge({ type: "shared-root", to: `${k("2:48")}#w3`, page: 7, root: "ذ ك ر", dir: { dSurah: 0, dPage: 0 } }),
        edge({ type: "mutashabih", to: k("2:123"), page: 19, dir: { dSurah: 0, dPage: 12 } }),
      ]),
      src("2:48", []),
    ]);
    expect(merged.map((e) => e.to)).toEqual([k("2:123")]);
  });

  it("excludes reserved-type edges and tolerates uncovered members", () => {
    const merged = mergeRangeEdges([
      { key: k("2:47"), adj: undefined },
      src("2:48", [
        edge({ type: "tafsir-ref", to: "tafsir/x", page: 0, dir: { dSurah: 0, dPage: 0 } }),
        edge({ type: "mutashabih", to: k("2:123"), page: 19, dir: { dSurah: 0, dPage: 12 } }),
      ]),
    ]);
    expect(merged.map((e) => e.to)).toEqual([k("2:123")]);
  });

  it("returns the merged list hifz-ordered (same ranking as the single-ayah popover)", () => {
    const far = edge({ type: "mutashabih", to: k("14:5"), page: 255, dir: { dSurah: 12, dPage: 248 } });
    const near = edge({ type: "mutashabih", to: k("2:121"), page: 19, dir: { dSurah: 0, dPage: 12, sameJuz: true } });
    const here = edge({ type: "mutashabih", to: k("2:40"), page: 7, dir: { dSurah: 0, dPage: 0 } });
    const merged = mergeRangeEdges([src("2:47", [far, near]), src("2:48", [here])]);
    expect(merged.map((e) => e.to)).toEqual([k("2:40"), k("2:121"), k("14:5")]);
  });

  it("Adjacency.hopsForRange merges across a range and is empty for uncovered ones", () => {
    // The mock's 2:47–2:48 highlight: the exact range the Loop 5 exit demos.
    const rangeCurated: CuratedAdjacency = {
      "2:47": [
        { type: "mutashabih", to: "2:122", page: 19, twin: 1, note: "identical twins" },
        { type: "root", to: "2:122", page: 19, root: "ذ ك ر", w: "w3" },
      ],
      "2:48": [
        { type: "mutashabih", to: "2:123", page: 19, note: "شفاعة ↔ عدل order swapped" },
        { type: "related", to: "82:19", page: 587, note: "same theme" },
      ],
    };
    const adj = new Adjacency(ED);
    for (const [surah, shard] of buildShards(ED, rangeCurated, { "2:47": 7, "2:48": 7 })) {
      adj.addShard(surah, shard as AdjacencyShard);
    }
    const hops = adj.hopsForRange([k("2:47"), k("2:48")]);
    // 2:47 → 2:122 (mutashabih) + 2:122#w3 (shared-root); 2:48 → 2:123 + 82:19
    expect(hops.map((h) => h.to)).toEqual([
      k("2:122"),
      `${k("2:122")}#w3`,
      k("2:123"),
      k("82:19"),
    ]);
    expect(hops.every((h) => h.sources.length === 1)).toBe(true);
    expect(hops[0].twin).toBe(true);

    expect(adj.hopsForRange([k("9:1"), k("9:2")])).toEqual([]);
    expect(adj.hopsForRange([])).toEqual([]);
  });
});

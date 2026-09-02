import { describe, expect, it } from "vitest";
import type { Edge } from "./adjacency.js";
import { divergentRuns, wordDiff } from "./verse-diff.js";

/** The 2:48 ↔ 2:123 edge as it ships, which is the pair the old table existed for. */
const EDGE: Edge = {
  type: "mutashabih",
  to: "quran/hafs-kfqc/2:123",
  page: 19,
  dir: { dSurah: 0, dPage: 12, sameJuz: true },
  span: { from: [1, 13] },
  toSpan: { from: [1, 13] },
};

describe("wordDiff", () => {
  it("reads both sides' shared run off the edge", () => {
    const d = wordDiff(EDGE, "quran/hafs-kfqc/2:48");
    expect(d).toEqual({
      from: { key: "2:48", page: 7, shared: [1, 13] },
      to: { key: "2:123", page: 19, shared: [1, 13] },
    });
  });

  it("derives the source page by undoing the edge's own page delta", () => {
    // 19 − 12 = 7, and 2:48 is printed on 7. The edge is self-describing, so
    // this cannot drift out of step with the page it names.
    expect(wordDiff(EDGE, "2:48")?.from.page).toBe(7);
    expect(wordDiff({ ...EDGE, page: 100, dir: { dSurah: 0, dPage: -5 } }, "2:48")?.from.page).toBe(
      105,
    );
  });

  it("strips an edition prefix and a word anchor from the source key", () => {
    expect(wordDiff(EDGE, "quran/hafs-kfqc/2:48#w3-7")?.from.key).toBe("2:48");
  });

  it("declines an edge that names no words on either side", () => {
    // The common case, not a failure: 452 of 2,996 look-alike edges match in
    // more than one place and so name none of them. The caller falls back.
    const { span: _span, ...noSpan } = EDGE;
    const { toSpan: _toSpan, ...noToSpan } = EDGE;
    expect(wordDiff(noSpan, "2:48")).toBeNull();
    expect(wordDiff(noToSpan, "2:48")).toBeNull();
  });

  it("declines an inverted range rather than painting it backwards", () => {
    expect(wordDiff({ ...EDGE, span: { from: [9, 4] } }, "2:48")).toBeNull();
  });
});

describe("divergentRuns", () => {
  it("names the tail when the two ayahs share their opening", () => {
    // 2:48 is 23 words on its page and shares its first 13 — so 14..23 differ.
    expect(divergentRuns({ from: 1, to: 23 }, [1, 13])).toEqual([[14, 23]]);
    expect(divergentRuns({ from: 1, to: 22 }, [1, 13])).toEqual([[14, 22]]);
  });

  it("names both ends when the shared run is in the middle", () => {
    expect(divergentRuns({ from: 1, to: 20 }, [5, 15])).toEqual([
      [1, 4],
      [16, 20],
    ]);
  });

  it("names nothing when the whole of what is here is shared", () => {
    expect(divergentRuns({ from: 1, to: 13 }, [1, 13])).toEqual([]);
  });

  it("clamps to what this page holds, for an ayah that runs onto the next", () => {
    // The shared run is recorded over the whole ayah; only 1..8 is printed here.
    expect(divergentRuns({ from: 1, to: 8 }, [1, 13])).toEqual([]);
    // And where the ayah *starts* on this page part-way through its numbering.
    expect(divergentRuns({ from: 9, to: 20 }, [1, 13])).toEqual([[14, 20]]);
  });
});

import { describe, expect, it } from "vitest";
import { isMarkShard, unmatchedMarks, type MarkSide, type WireMark } from "./mark-diff.js";

/**
 * Geometry chosen to read as arithmetic: word *w*'s *k*-th mark sits at
 * x = 100w + k, one unit square, so a returned box names its mark by its x
 * alone. Real boxes are a few units across and float above the line; nothing
 * here depends on that.
 */
function marks(spec: Record<number, readonly string[]>): WireMark[] {
  const out: WireMark[] = [];
  for (const [w, names] of Object.entries(spec)) {
    names.forEach((n, k) => out.push({ w: Number(w), n, r: [100 * Number(w) + k, 0, 1, 1], s: "ink" }));
  }
  return out;
}

const xs = (rects: readonly { x: number }[]) => rects.map((r) => r.x);

function side(
  spec: Record<number, readonly string[]>,
  present: [number, number],
  shared: [number, number],
  pauses: readonly number[] = [],
): MarkSide {
  const set = new Set(pauses);
  return {
    marks: marks(spec),
    present: { from: present[0], to: present[1] },
    shared,
    isPause: (i) => set.has(i),
  };
}

describe("unmatchedMarks — the marks two look-alike ayahs do not have in common", () => {
  it("finds the one vowel that differs on a shared word — the hafiz's trap", () => {
    // Word 4 is the same word on both sides; one prints it with a fatha, the
    // other with a damma (2:173 w4 against 5:3 w3, as shipped).
    const a = side({ 4: ["wasla", "sukun", "fatha"] }, [1, 6], [1, 6]);
    const b = side({ 4: ["wasla", "sukun", "damma"] }, [1, 6], [1, 6]);
    const d = unmatchedMarks(a, b);
    expect(xs(d.a)).toEqual([402]);
    expect(xs(d.b)).toEqual([402]);
  });

  it("ignores the order marks are listed in — they stack, so order is not a difference", () => {
    const a = side({ 2: ["kasra", "shadda", "fatha"] }, [1, 3], [1, 3]);
    const b = side({ 2: ["kasra", "fatha", "shadda"] }, [1, 3], [1, 3]);
    const d = unmatchedMarks(a, b);
    expect(d.a).toEqual([]);
    expect(d.b).toEqual([]);
  });

  it("pairs a repeated name up to the count the other side has, and tints the surplus", () => {
    // Two fathas against three: the third is unmatched, and it is the *last*
    // one in reading order that is left over.
    const a = side({ 1: ["fatha", "fatha"] }, [1, 1], [1, 1]);
    const b = side({ 1: ["fatha", "fatha", "fatha"] }, [1, 1], [1, 1]);
    const d = unmatchedMarks(a, b);
    expect(d.a).toEqual([]);
    expect(xs(d.b)).toEqual([102]);
  });

  it("skips pause marks when pairing, so a pause on one side does not shift every word after it", () => {
    // Side a: words 1 2 [pause 3] 4 5. Side b: words 1 2 3 4 — no pause. Word 4
    // on a is word 3 on b; word 5 on a is word 4 on b.
    const a = side({ 4: ["fatha"], 5: ["kasra"] }, [1, 5], [1, 5], [3]);
    const b = side({ 3: ["fatha"], 4: ["damma"] }, [1, 4], [1, 4]);
    const d = unmatchedMarks(a, b);
    expect(xs(d.a)).toEqual([500]);
    expect(xs(d.b)).toEqual([400]);
  });

  it("leaves the words outside the shared run alone — they are different words, and the wash says so", () => {
    // a: [1 2 3] shared 4-5 [6 7]     b: [1 2] shared 3-4 [5 6 7]
    // Every mark outside the run differs from whatever sits opposite it, and
    // none of it is tinted: only the run's words are the same word twice.
    const a = side(
      { 1: ["sukun"], 2: ["fatha"], 3: ["kasra"], 4: ["fatha"], 6: ["damma"], 7: ["fatha"] },
      [1, 7],
      [4, 5],
    );
    const b = side(
      { 1: ["fatha"], 2: ["kasra"], 3: ["damma"], 5: ["damma"], 6: ["kasra"], 7: ["sukun"] },
      [1, 7],
      [3, 4],
    );
    const d = unmatchedMarks(a, b);
    // a4 fatha ↔ b3 damma is the one pair inside the run that differs.
    expect(xs(d.a)).toEqual([400]);
    expect(xs(d.b)).toEqual([300]);
  });

  it("leaves a word with no partner alone, even inside the run", () => {
    // b's run is a word shorter than a's says it is; a's surplus word stays quiet.
    const a = side({ 2: ["fatha", "kasra"] }, [1, 2], [1, 2]);
    const b = side({}, [1, 1], [1, 1]);
    const d = unmatchedMarks(a, b);
    expect(d.a).toEqual([]);
    expect(d.b).toEqual([]);
  });

  it("pairs a shared run from its end when a page holds only the tail of the ayah", () => {
    // a's page holds only words 3-5 of an ayah whose shared run is 1-5 — it
    // began on the leaf before. Its 3 is b's 3, not b's 1: pair from the end.
    const a = side({ 3: ["fatha"], 5: ["kasra"] }, [3, 5], [1, 5]);
    const b = side({ 1: ["sukun"], 2: ["sukun"], 3: ["damma"], 4: [], 5: ["kasra"] }, [1, 5], [1, 5]);
    const d = unmatchedMarks(a, b);
    // Only word 3 differs among the words both hold; b's 1 and 2 have no partner.
    expect(xs(d.a)).toEqual([300]);
    expect(xs(d.b)).toEqual([300]);
  });

  it("returns boxes in page units, straight off the shard", () => {
    const a: MarkSide = {
      marks: [{ w: 1, n: "fatha", r: [316.3, 19.4, 5.6, 3.1], s: "ink" }],
      present: { from: 1, to: 1 },
      shared: [1, 1],
      isPause: () => false,
    };
    const b = side({ 1: ["kasra"] }, [1, 1], [1, 1]);
    expect(unmatchedMarks(a, b).a).toEqual([{ x: 316.3, y: 19.4, width: 5.6, height: 3.1 }]);
  });
});

describe("isMarkShard", () => {
  it("accepts the shipped shape and refuses the rest", () => {
    expect(isMarkShard({ page: 7, marks: { "2:38": [] } })).toBe(true);
    expect(isMarkShard({ page: 7 })).toBe(false);
    expect(isMarkShard({ marks: {} })).toBe(false);
    expect(isMarkShard(null)).toBe(false);
    expect(isMarkShard("<!doctype html>")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Rect } from "./highlighter.js";
import { WordIndex, isWordShard, type WordShard } from "./words.js";

/**
 * The real thing, lifted verbatim from
 * `apps/web/public/assets/words/hafs-kfqc/7.json` — two ayahs that between them
 * carry every case this file cares about. 2:44 opens on a pause mark (index 1)
 * and carries a second mid-ayah (index 12); 2:45 carries one at 6.
 *
 * Note the shape of a mark: `[148.8, 312.6, 7.4, 7.2]` against a neighbouring
 * word's `[80.6, 296.5, 66, 29]`. Seven units square on a 345 × 550 page, raised
 * above the line. That is the whole argument for "marks are not targets" in one
 * fixture — a finger cannot mean that box.
 */
const PAGE_7: WordShard = {
  page: 7,
  words: {
    "2:44": {
      from: 1,
      boxes: [
        [148.8, 312.6, 7.4, 7.2],
        [80.6, 296.5, 66, 29],
        [38.6, 299.2, 36.7, 25.2],
        [6.5, 297.7, 30.4, 30],
        [323.2, 342.4, 9.9, 17.5],
        [287, 339.6, 39.6, 21.9],
        [233.4, 332.8, 49.3, 29.7],
        [222, 342.9, 10.8, 17.3],
        [196.7, 331.2, 28.2, 27.7],
        [161.6, 335.2, 34.1, 25.9],
        [98.5, 335.3, 60.5, 25.5],
        [100.1, 333.1, 5.3, 6.6],
        [72.9, 331.2, 22.7, 26.1],
        [26.2, 335.1, 45, 26],
      ],
      marks: [1, 12],
    },
    "2:45": {
      from: 1,
      boxes: [
        [322.9, 376.2, 10.1, 19.2],
        [273.6, 369, 53.3, 29.1],
        [232.1, 369.3, 43, 30.5],
        [223.5, 374, 10.3, 19.3],
        [188.8, 369.5, 39.2, 25.6],
        [189.4, 366.7, 5.3, 6.6],
        [177.2, 376.5, 11.2, 18.9],
        [160.4, 369.5, 22.3, 25.1],
        [119.9, 368.3, 38.3, 29.1],
        [102.6, 365.4, 18.4, 32.2],
        [85, 372.3, 19.1, 24.8],
        [25.3, 369.4, 58.1, 26.7],
      ],
      marks: [6],
    },
  },
};

const idx = new WordIndex(PAGE_7);

/** The centre of a wire box, which is where a test means when it says "on". */
function centre(box: readonly [number, number, number, number]): [number, number] {
  return [box[0] + box[2] / 2, box[1] + box[3] / 2];
}

const MARK_2_44 = PAGE_7.words["2:44"].boxes[0];
const WORD_2_44_3 = PAGE_7.words["2:44"].boxes[2];
const MARK_2_44_12 = PAGE_7.words["2:44"].boxes[11];
const WORD_2_45_5 = PAGE_7.words["2:45"].boxes[4];
const MARK_2_45_6 = PAGE_7.words["2:45"].boxes[5];

describe("WordIndex", () => {
  it("indexes the page's ayahs in shard order", () => {
    expect(idx.page).toBe(7);
    expect(idx.refs()).toEqual(["2:44", "2:45"]);
    expect(idx.has("2:44")).toBe(true);
    expect(idx.has("2:99")).toBe(false);
  });

  it("takes a canonical key, a word key, or a bare ref", () => {
    expect(idx.has("quran/hafs-kfqc/2:44")).toBe(true);
    expect(idx.has("quran/hafs-kfqc/2:44#w3-7")).toBe(true);
    expect(idx.span("quran/hafs-kfqc/2:44#w3")).toEqual({ from: 1, to: 14 });
  });

  it("reports the print's index range, not a zero-based one", () => {
    expect(idx.span("2:44")).toEqual({ from: 1, to: 14 });
    expect(idx.span("2:45")).toEqual({ from: 1, to: 12 });
    expect(idx.span("2:99")).toBeNull();
  });

  it("resolves a word index to its box", () => {
    expect(idx.boxOf("2:44", 3)).toEqual({ x: 38.6, y: 299.2, width: 36.7, height: 25.2 });
    expect(idx.boxOf("2:44", 0)).toBeNull();
    expect(idx.boxOf("2:44", 15)).toBeNull();
    expect(idx.boxOf("2:99", 1)).toBeNull();
  });

  it("knows which indices are pause marks", () => {
    expect(idx.isMark("2:44", 1)).toBe(true);
    expect(idx.isMark("2:44", 12)).toBe(true);
    expect(idx.isMark("2:44", 2)).toBe(false);
    expect(idx.isMark("2:45", 6)).toBe(true);
  });
});

describe("wordAt — the long-press answer", () => {
  it("names the word a point falls inside", () => {
    expect(idx.wordAt("2:44", ...centre(WORD_2_44_3))).toBe(3);
  });

  it("names the nearest word for a point in the gap between two", () => {
    // The 1.7-unit gap between index 3 (x 38.6–75.3) and index 4 (x 6.5–36.9)
    // on the same line. 37.2 is inside neither and 0.3 from the nearer.
    expect(idx.wordAt("2:44", 37.2, 311)).toBe(4);
    expect(idx.wordAt("2:44", 38.2, 311)).toBe(3);
  });

  it("never names a pause mark, even dead on top of one", () => {
    const at = idx.wordAt("2:44", ...centre(MARK_2_44));
    expect(idx.isMark("2:44", at as number)).toBe(false);
    expect(at).toBe(2); // the word whose box ends 5.9 units to its left
  });

  it("is null only when the ayah is not on this page", () => {
    expect(idx.wordAt("2:99", 100, 100)).toBeNull();
  });
});

describe("hitTest — strict, because nothing has bounded the search", () => {
  it("names the word under the point", () => {
    expect(idx.hitTest(...centre(WORD_2_44_3))).toEqual({ ref: "2:44", index: 3 });
  });

  it("returns null in the margin rather than reaching for a far-off word", () => {
    expect(idx.hitTest(5, 5)).toBeNull();
  });

  it("returns null on a pause mark", () => {
    expect(idx.hitTest(...centre(MARK_2_44))).toBeNull();
  });
});

describe("boxesFor — marks paint, they just do not get selected", () => {
  it("returns the inclusive run, mark boxes and all", () => {
    const boxes = idx.boxesFor("2:44", 11, 13);
    expect(boxes).toHaveLength(3);
    // The middle one is the mark at 12 — the ink runs across it unbroken.
    expect(boxes[1]).toEqual({ x: 100.1, y: 333.1, width: 5.3, height: 6.6 });
  });

  it("returns one box for a single-word selection", () => {
    expect(idx.boxesFor("2:44", 3, 3)).toEqual([idx.boxOf("2:44", 3)]);
  });

  it("clamps to what this page holds instead of refusing", () => {
    expect(idx.boxesFor("2:44", -5, 2)).toHaveLength(2);
    expect(idx.boxesFor("2:44", 13, 900)).toHaveLength(2);
    expect(idx.boxesFor("2:44", 900, 901)).toEqual([]);
    expect(idx.boxesFor("2:44", 7, 3)).toEqual([]);
    expect(idx.boxesFor("2:99", 1, 3)).toEqual([]);
  });
});

/**
 * Bands come out of subtractions of wire coordinates, so `31.2` arrives as
 * `31.19999999999999`. That is float arithmetic doing its job on numbers headed
 * for SVG attributes, not a tolerance anyone had to choose — hence an exact
 * comparison to 6 decimal places rather than a measured slack.
 */
function expectBand(actual: Rect | undefined, expected: Rect): void {
  expect(actual).toBeDefined();
  for (const k of ["x", "y", "width", "height"] as const) {
    expect(actual?.[k]).toBeCloseTo(expected[k], 6);
  }
}

describe("bandsFor — one rectangle per line, which is what the pen wants", () => {
  it("collapses a run on one line into a single band", () => {
    // Indices 2–4 are the whole of 2:44's first line (index 1 is the leading
    // mark). x runs 6.5 → 146.6; the y-span is the three words', 296.5 → 327.7.
    const bands = idx.bandsFor("2:44", 2, 4);
    expect(bands).toHaveLength(1);
    expectBand(bands[0], { x: 6.5, y: 296.5, width: 140.1, height: 31.2 });
  });

  it("breaks at the line, and only at the line", () => {
    // 2–5 crosses from the end of line one into the start of line two.
    const bands = idx.bandsFor("2:44", 2, 5);
    expect(bands).toHaveLength(2);
    expectBand(bands[0], { x: 6.5, y: 296.5, width: 140.1, height: 31.2 });
    expectBand(bands[1], { x: 323.2, y: 342.4, width: 9.9, height: 17.5 });
  });

  it("runs the ink across a pause mark without breaking", () => {
    // Index 12 is a mark sitting between words 11 and 13. One band, not three.
    const bands = idx.bandsFor("2:44", 11, 13);
    expect(bands).toHaveLength(1);
    // …and the mark's own box is inside the x-span, because it is painted over.
    expect(bands[0]?.x).toBeLessThanOrEqual(MARK_2_44_12[0]);
  });

  it("does not let a mark drag the band up off the line", () => {
    // 2:45's mark at 6 sits at y 366.7, above *both* of its neighbours (369.5
    // and 376.5). A band whose y-span counted marks would start there and the
    // swipe's centreline would ride high of the text it is supposed to cross.
    expect(MARK_2_45_6[1]).toBeLessThan(WORD_2_45_5[1]);
    const bands = idx.bandsFor("2:45", 5, 7);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.y).toBeCloseTo(WORD_2_45_5[1], 6);
  });

  it("a run that opens on a mark takes its height from the first word", () => {
    // 2:44 index 1 is a leading mark. Starting there must give the same band as
    // starting at the word after it, only wider.
    const fromMark = idx.bandsFor("2:44", 1, 4);
    const fromWord = idx.bandsFor("2:44", 2, 4);
    expect(fromMark).toHaveLength(1);
    expect(fromMark[0]?.y).toBeCloseTo(fromWord[0]?.y as number, 6);
    expect(fromMark[0]?.height).toBeCloseTo(fromWord[0]?.height as number, 6);
    expect(fromMark[0]?.width).toBeGreaterThan(fromWord[0]?.width as number);
  });

  it("bands a whole ayah into exactly its lines", () => {
    // 2:44 wraps once; 2:45 is a single line of the print, which the fixture's
    // monotonically falling x confirms (322.9 down to 25.3, no jump back right).
    expect(idx.bandsFor("2:44", 1, 14)).toHaveLength(2);
    expect(idx.bandsFor("2:45", 1, 12)).toHaveLength(1);
  });

  it("is empty on the same inputs boxesFor is empty on", () => {
    expect(idx.bandsFor("2:44", 7, 3)).toEqual([]);
    expect(idx.bandsFor("2:44", 900, 901)).toEqual([]);
    expect(idx.bandsFor("2:99", 1, 3)).toEqual([]);
  });

  it("a lone mark still bands, from its own box", () => {
    // Not reachable through the gesture — `wordAt` never names a mark — but a
    // restored link can ask for anything, and returning nothing would be a
    // selection that exists in the key and not on the page.
    const bands = idx.bandsFor("2:44", 12, 12);
    expect(bands).toHaveLength(1);
    expectBand(bands[0], { x: 100.1, y: 333.1, width: 5.3, height: 6.6 });
  });
});

describe("step — the arrow key, and the drag that left its box", () => {
  it("skips over a pause mark in both directions", () => {
    expect(idx.step("2:44", 11, 1)).toBe(13);
    expect(idx.step("2:44", 13, -1)).toBe(11);
  });

  it("walks several words at once", () => {
    expect(idx.step("2:44", 2, 3)).toBe(5);
  });

  it("clamps at the ends of the ayah and reports nowhere-to-go as null", () => {
    expect(idx.step("2:44", 14, 1)).toBeNull();
    expect(idx.step("2:44", 13, 5)).toBe(14);
    expect(idx.step("2:44", 2, -1)).toBeNull(); // index 1 is a mark; there is nothing before it
    expect(idx.step("2:44", 3, 0)).toBeNull();
    expect(idx.step("2:99", 1, 1)).toBeNull();
  });
});

describe("isWordShard", () => {
  it("accepts a shard and rejects what a failed fetch returns", () => {
    expect(isWordShard(PAGE_7)).toBe(true);
    expect(isWordShard(null)).toBe(false);
    expect(isWordShard("<!doctype html>")).toBe(false);
    expect(isWordShard({ page: 7 })).toBe(false);
    expect(isWordShard({ words: {} })).toBe(false);
  });
});

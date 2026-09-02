import { describe, expect, it } from "vitest";
import {
  PLACEMENT_RULES,
  leaveAsIsRule,
  perPageRule,
  perLineTiltRule,
  marksOnlyRule,
  perLineBendRule,
  onOwnInkRule,
  placeBy,
  placeMark,
  placeWord,
  type PlaceableRect,
} from "./placement-rule.js";

/**
 * A stand-in for one rectangle off the vendored page: it ships at (100, 200) and
 * every grain of correction would nudge it left and up by a measured amount. The
 * numbers are made up but the *shape* is exactly what the page's data carries —
 * a `b` and an `o` with one `[dx, dy]` per grain. Option H's grain (`mark`) is set
 * equal to `tilt`, which is what a word rectangle really carries, since a word
 * cannot be placed from a single mark's ink.
 */
const rect = (over: Partial<PlaceableRect> = {}): PlaceableRect => ({
  b: [100, 200, 6, 3],
  o: {
    page: [-0.7, -0.9],
    line: [-0.6, -0.8],
    tilt: [-0.9, -0.5],
    curve: [-0.8, -0.4],
    mark: [-0.9, -0.5],
  },
  ...over,
});

describe("placeBy", () => {
  it("moves a rectangle by an offset, keeping its size", () => {
    expect(placeBy([100, 200, 6, 3], [-0.9, -0.5])).toEqual([99.1, 199.5, 6, 3]);
  });
  it("leaves the rectangle exactly where it is when there is no offset", () => {
    expect(placeBy([100, 200, 6, 3], undefined)).toEqual([100, 200, 6, 3]);
  });
});

describe("leaveAsIs (A)", () => {
  it("places a mark exactly where it ships — the app's behaviour today", () => {
    expect(placeMark(rect(), leaveAsIsRule.grain)).toEqual([100, 200, 6, 3]);
  });
  it("places a word exactly where it ships too", () => {
    expect(placeWord(rect(), leaveAsIsRule.grain, leaveAsIsRule.wordsStay)).toEqual([100, 200, 6, 3]);
  });
});

describe("perPage (B) / perLineTilt (F) / perLineBend (I)", () => {
  it("moves marks by the grain the rule names", () => {
    expect(placeMark(rect(), perPageRule.grain)).toEqual([99.3, 199.1, 6, 3]);
    expect(placeMark(rect(), perLineTiltRule.grain)).toEqual([99.1, 199.5, 6, 3]);
    expect(placeMark(rect(), perLineBendRule.grain)).toEqual([99.2, 199.6, 6, 3]);
  });
  it("moves words with their marks — words do not stay", () => {
    expect(placeWord(rect(), perLineTiltRule.grain, perLineTiltRule.wordsStay)).toEqual([99.1, 199.5, 6, 3]);
  });
});

describe("marksOnly (G)", () => {
  it("moves the mark by the same grain as F", () => {
    expect(placeMark(rect(), marksOnlyRule.grain)).toEqual(placeMark(rect(), perLineTiltRule.grain));
  });
  it("but leaves the word on its shipped fit — the whole difference from F", () => {
    expect(placeWord(rect(), marksOnlyRule.grain, marksOnlyRule.wordsStay)).toEqual([100, 200, 6, 3]);
  });
});

describe("onOwnInk (H)", () => {
  it("places a mark by its own-ink grain", () => {
    expect(placeMark(rect(), onOwnInkRule.grain)).toEqual([99.1, 199.5, 6, 3]);
  });
  it("falls a rectangle carrying no own-ink offset back to where it ships", () => {
    // A mark the search could not place from ink carries no `mark` offset; H must
    // leave it where it is rather than throw or move it by nothing-in-particular.
    const noInk = rect({ o: { tilt: [-0.9, -0.5] } });
    expect(placeMark(noInk, onOwnInkRule.grain)).toEqual([100, 200, 6, 3]);
  });
});

describe("the rule set", () => {
  it("carries all six in drawn order", () => {
    expect(PLACEMENT_RULES.map((r) => r.id)).toEqual(["A", "B", "F", "G", "I", "H"]);
  });
  it("each placement function is inline-safe — its source names no import/require", () => {
    // The page builder inlines placeBy, placeMark and placeWord together via
    // .toString(); each may touch only globals, its arguments, and the other two
    // (which are inlined alongside it). If any reached for `import`/`require`, the
    // dist source the builder reads would carry it and the inlined copy would throw
    // in the reader's browser.
    for (const fn of [placeBy, placeMark, placeWord]) {
      expect(fn.toString()).not.toMatch(/\bimport\b|\brequire\b/);
    }
  });
  it("A is behaviour-preserving: the shipped grain is identity for both marks and words", () => {
    // Option A is what the app does now. The module can graduate into how the app
    // places rectangles with no change on the day A is (were it to be) chosen.
    const r = rect();
    expect(placeMark(r, "shipped")).toEqual([...r.b]);
    expect(placeWord(r, "shipped", false)).toEqual([...r.b]);
  });
});

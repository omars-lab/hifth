import { describe, expect, it } from "vitest";
import { addCited, citedIn, foldRuns } from "./runs.mjs";

// Made-up cross-reference lists, in the shape the capture gives them: a range
// the note cites ("vv. 4–7") arrives as every verse in it, one after another.
const ref = (s, a, commentary = false) => ({ to: [s, a], commentary });

describe("foldRuns", () => {
  it("folds a run of verses the note cites as one range into one road", () => {
    const folded = foldRuns([ref(9, 4), ref(9, 5), ref(9, 6), ref(9, 7)]);
    expect(folded).toEqual([{ to: [9, 4], through: [9, 7], commentary: false }]);
  });

  it("keeps separate references separate, in the order the note gives them", () => {
    const folded = foldRuns([ref(9, 30), ref(9, 4), ref(9, 5), ref(12, 6), ref(40, 2), ref(40, 3)]);
    expect(folded.map((r) => [r.to, r.through])).toEqual([
      [[9, 30], undefined],
      [[9, 4], [9, 5]],
      [[12, 6], undefined],
      [[40, 2], [40, 3]],
    ]);
  });

  it("does not run on across a surah's end or backwards", () => {
    const folded = foldRuns([ref(9, 129), ref(10, 1), ref(10, 3), ref(10, 2)]);
    expect(folded.map((r) => r.through)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("says a range has commentary when any verse in it has", () => {
    const folded = foldRuns([ref(9, 4), ref(9, 5, true), ref(9, 6)]);
    expect(folded).toEqual([{ to: [9, 4], through: [9, 6], commentary: true }]);
  });

  it("leaves a long list of ranges short enough that every reference fits", () => {
    const range = (s, from, to) => Array.from({ length: to - from + 1 }, (_, i) => ref(s, from + i));
    const refs = [ref(9, 40), ...range(9, 3, 20), ...range(9, 70, 85), ref(31, 7), ref(44, 12), ...range(60, 2, 3)];
    expect(refs).toHaveLength(39);
    expect(foldRuns(refs).map((r) => r.to.join(":"))).toEqual(["9:40", "9:3", "9:70", "31:7", "44:12", "60:2"]);
  });
});

// Made-up notes: the shape of the commentary's citations, none of its words.
describe("citedIn", () => {
  it("lists every verse a note cites, the bare numbers after a first one included, in order", () => {
    const notes = ["As at 9:4, 7, and 12; cf. 31:7 and v. 5.", "See also 9:4 again."];
    expect(citedIn(notes, 44)).toEqual([[9, 4], [9, 7], [9, 12], [31, 7], [44, 5]]);
  });

  it("reads through the marks that set a run in italics", () => {
    expect(citedIn(["\uE000a word\uE001 (9:4, 6)"], 44)).toEqual([[9, 4], [9, 6]]);
  });
});

describe("addCited", () => {
  const road = (s, a, through) => (through ? { to: [s, a], through: [s, through], commentary: false } : { to: [s, a], commentary: false });

  it("adds a cited verse the book's list left out after the list, never before it", () => {
    const roads = [road(9, 4), road(31, 7)];
    expect(addCited(roads, [[9, 4], [9, 12], [31, 7]])).toEqual([road(9, 4), road(31, 7), road(9, 12)]);
  });

  it("drops a cited verse the list already holds, inside a run too", () => {
    expect(addCited([road(9, 4, 9)], [[9, 6], [9, 9]])).toEqual([road(9, 4, 9)]);
  });

  it("runs on a road when the cited verse comes straight after it, and folds the added ones", () => {
    expect(addCited([road(9, 4)], [[9, 5], [12, 3], [12, 4]])).toEqual([road(9, 4, 5), road(12, 3, 4)]);
  });

  it("does not run a road on backwards or across a surah's end", () => {
    expect(addCited([road(9, 4)], [[9, 3], [10, 1]])).toEqual([road(9, 4), road(9, 3), road(10, 1)]);
  });
});

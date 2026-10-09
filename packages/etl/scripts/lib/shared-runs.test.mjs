/**
 * The shared-run finder, on made-up word numbers: each number stands for one
 * word, so two equal numbers are the same word.
 */
import { describe, expect, it } from "vitest";
import { sharedRuns, sharedStretches } from "./shared-runs.mjs";

describe("sharedRuns", () => {
  it("finds the longest run and every place it occurs", () => {
    expect(sharedRuns([1, 2, 9, 1, 2], [1, 2, 7])).toEqual({
      len: 2,
      runs: [
        { a: 1, b: 1 },
        { a: 4, b: 1 },
      ],
    });
  });
});

describe("sharedStretches", () => {
  it("marks every word inside a run of two or more, on both sides", () => {
    // a: 1 2 9 1 2 5 6   b: 5 6 0 1 2
    // "1 2" twice on a, once on b; "5 6" once on each.
    expect(sharedStretches([1, 2, 9, 1, 2, 5, 6], [5, 6, 0, 1, 2])).toEqual({
      a: [1, 2, 4, 5, 6, 7],
      b: [1, 2, 4, 5],
    });
  });

  it("leaves out a word the two share only on its own", () => {
    expect(sharedStretches([1, 3, 2], [1, 4, 2])).toEqual({ a: [], b: [] });
  });

  it("reads the same either way round", () => {
    const a = [3, 4, 5, 9, 3, 4];
    const b = [8, 3, 4, 5, 3];
    const there = sharedStretches(a, b);
    const back = sharedStretches(b, a);
    expect(back).toEqual({ a: there.b, b: there.a });
  });
});

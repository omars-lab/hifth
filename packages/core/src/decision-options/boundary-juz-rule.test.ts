import { describe, expect, it } from "vitest";
import {
  BOUNDARY_JUZ_RULES,
  beginsHereRule,
  runningRule,
  bothRule,
  labelBeginsHere,
  labelRunning,
  labelBoth,
  type BoundaryContext,
} from "./boundary-juz-rule.js";

/** A real boundary page: juz 3 is running onto it, and juz 4 opens on it. */
const boundary: BoundaryContext = { beginsHere: 4, running: 3 };
/** An ordinary page: juz 3 running, nothing new opening. */
const inside: BoundaryContext = { beginsHere: null, running: 3 };
/** A clean opening: the page both starts and only carries juz 4. */
const clean: BoundaryContext = { beginsHere: 4, running: 4 };

describe("beginsHere (A) — today's readout", () => {
  it("names the juz that opens on a boundary page", () => {
    expect(labelBeginsHere(boundary)).toEqual({ text: "4", juz: [4] });
  });
  it("falls back to the running juz where nothing opens", () => {
    expect(labelBeginsHere(inside)).toEqual({ text: "3", juz: [3] });
  });
});

describe("running (B) — the earlier number", () => {
  it("names the juz already running, even where a new one opens", () => {
    expect(labelRunning(boundary)).toEqual({ text: "3", juz: [3] });
    expect(labelRunning(inside)).toEqual({ text: "3", juz: [3] });
  });
});

describe("both (C) — the hand-off", () => {
  it("shows the ending juz handing off to the opening one", () => {
    expect(labelBoth(boundary)).toEqual({ text: "3 → 4", juz: [3, 4] });
  });
  it("shows a single number on an ordinary page", () => {
    expect(labelBoth(inside)).toEqual({ text: "3", juz: [3] });
  });
  it("shows a single number on a clean opening (no ending juz to hand off)", () => {
    expect(labelBoth(clean)).toEqual({ text: "4", juz: [4] });
  });
});

describe("the set", () => {
  it("carries all three in drawn order", () => {
    expect(BOUNDARY_JUZ_RULES.map((r) => r.id)).toEqual(["A", "B", "C"]);
  });
  it("A and B genuinely disagree on a boundary page", () => {
    expect(beginsHereRule.labelFor(boundary).text).not.toBe(
      runningRule.labelFor(boundary).text,
    );
  });
  it("each labelFor is self-contained — names no module symbol", () => {
    for (const r of BOUNDARY_JUZ_RULES) {
      expect(r.labelFor.toString()).not.toMatch(/\bimport\b|\brequire\b/);
    }
  });
});

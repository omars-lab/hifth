import { describe, expect, it } from "vitest";
import {
  APPLE_SCRUB_BANDS,
  SCRUB_STRATEGIES,
  scrubAdvance,
  scrubRateFull,
  scrubRateSlowAway,
  stripPxPerPage,
} from "./scrub-rate.js";
import { pageTickStep } from "./detent-strategy.js";

describe("scrub speed by height above the bar", () => {
  it("full speed never slows", () => {
    for (const off of [0, 49, 50, 149, 400]) expect(scrubRateFull(off, APPLE_SCRUB_BANDS)).toBe(1);
  });

  it("slows in Apple's four steps as the finger rises", () => {
    const r = (off: number) => scrubRateSlowAway(off, APPLE_SCRUB_BANDS);
    expect(r(-20)).toBe(1);
    expect(r(0)).toBe(1);
    expect(r(49.9)).toBe(1);
    expect(r(50)).toBe(0.5);
    expect(r(100)).toBe(0.25);
    expect(r(150)).toBe(0.1);
    expect(r(600)).toBe(0.1);
  });
});

describe("one step of a drag", () => {
  it("moves the knob by the finger's step times the speed", () => {
    expect(scrubAdvance(100, 20, 1, 0, 0, 120)).toBe(120);
    expect(scrubAdvance(100, 20, 0.1, 160, 160, 300)).toBeCloseTo(102, 10);
  });

  it("brings the knob back under the finger when the finger returns to the bar", () => {
    // Slowed far from the finger, then straight down onto the bar: they meet.
    expect(scrubAdvance(150, 0, 1, 160, 0, 240)).toBe(240);
    // Halfway down closes half the gap.
    expect(scrubAdvance(150, 0, 0.5, 160, 80, 250)).toBeCloseTo(200, 10);
  });

  it("does not pull the knob while the finger rises or holds its height", () => {
    expect(scrubAdvance(150, 0, 0.5, 60, 90, 250)).toBe(150);
    expect(scrubAdvance(150, 0, 0.5, 60, 60, 250)).toBe(150);
  });
});

describe("the strip of page marks", () => {
  // The real phone bar: a 360px screen leaves a 232px track, less the 22px knob.
  const barPxPerPage = (232 - 22) / 603;

  it("shows every 5th page at full speed and single pages once slowed", () => {
    expect(pageTickStep(stripPxPerPage(barPxPerPage, 1, 5), 6)).toBe(5);
    expect(pageTickStep(stripPxPerPage(barPxPerPage, 0.5, 5), 6)).toBe(5);
    expect(pageTickStep(stripPxPerPage(barPxPerPage, 0.25, 5), 6)).toBe(1);
    expect(pageTickStep(stripPxPerPage(barPxPerPage, 0.1, 5), 6)).toBe(1);
  });
});

describe("the four options", () => {
  it("are A to D, each a distinct pairing of slowing and strip", () => {
    expect(SCRUB_STRATEGIES.map((s) => s.id)).toEqual(["A", "B", "C", "D"]);
    const pairs = new Set(SCRUB_STRATEGIES.map((s) => `${s.slows}/${s.tickStrip}`));
    expect(pairs.size).toBe(4);
    for (const s of SCRUB_STRATEGIES) {
      expect(s.rate(160, APPLE_SCRUB_BANDS)).toBe(s.slows ? 0.1 : 1);
    }
  });
});

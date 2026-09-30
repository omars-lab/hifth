import { describe, expect, it } from "vitest";
import { bandSeed, roughBandOutline, roughBandPath } from "./rough.js";
import type { Swipe } from "./ink.js";

/**
 * The rough band (highlight-texture, settled 2026-09-30): the pen's band drawn
 * as a filled shape whose edges drift a little, seeded from what it marks.
 */
const BAND: Swipe = { x1: 20, x2: 300, y: 100, width: 24 };
const h = BAND.width / 2;
const L = BAND.x1 - h;
const R = BAND.x2 + h;

describe("roughBandOutline", () => {
  it("draws the same hand for the same band, every time", () => {
    expect(roughBandPath(BAND, "p42:a")).toBe(roughBandPath(BAND, "p42:a"));
  });

  it("draws a different hand for a different band", () => {
    expect(roughBandPath(BAND, "p42:a")).not.toBe(roughBandPath(BAND, "p42:b"));
  });

  it("stays within the band's reach and about its height", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      for (const [x, y] of roughBandOutline(BAND, seed)) {
        expect(x).toBeGreaterThanOrEqual(L - 1e-6);
        expect(x).toBeLessThanOrEqual(R + 1e-6);
        // The drift, sag and tilt together never push an edge more than a
        // third of a half-band past the pen's own edge — so two lines of a
        // passage never run into one another.
        expect(Math.abs(y - BAND.y)).toBeLessThanOrEqual(h * 1.34);
      }
    }
  });

  // The owner's note on the first drawing: "too diagonal — straighten
  // vertically more, just slight slants". Both ends of the band are measured as
  // how far the top corner sits from the bottom corner, across the line.
  it("keeps both ends nearly upright: a slight slant, not a rhombus", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const pts = roughBandOutline(BAND, seed);
      const top = pts.filter(([, y]) => y < BAND.y);
      const bottom = pts.filter(([, y]) => y > BAND.y);
      const startSlant = Math.max(...top.map(([x]) => x)) - Math.max(...bottom.map(([x]) => x));
      const endSlant = Math.min(...bottom.map(([x]) => x)) - Math.min(...top.map(([x]) => x));
      expect(Math.abs(startSlant)).toBeLessThanOrEqual(h * 0.3);
      expect(Math.abs(endSlant)).toBeLessThanOrEqual(h * 0.3);
    }
  });

  it("drifts rather than jitters: neighbouring points on an edge stay close", () => {
    const pts = roughBandOutline(BAND, "a").filter(([, y]) => y < BAND.y - h * 0.5);
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i]![1] - pts[i - 1]![1])).toBeLessThan(h * 0.15);
    }
  });

  it("still draws a mark for a word narrower than the pen", () => {
    const dot: Swipe = { x1: 50, x2: 50, y: 100, width: 24 };
    const pts = roughBandOutline(dot, "a");
    expect(pts.length).toBeGreaterThanOrEqual(6);
    const xs = pts.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(h);
  });
});

describe("roughBandPath", () => {
  it("is one closed curve", () => {
    const d = roughBandPath(BAND, "a");
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/M/g)).toHaveLength(1);
  });
});

describe("bandSeed", () => {
  // A verse is the same verse on every visit, so its hand is seeded from where
  // it sits on the page — never from the order it happened to be drawn in.
  it("depends on the page and where the band sits, not on the order drawn", () => {
    expect(bandSeed(42, BAND)).toBe(bandSeed(42, { ...BAND }));
    expect(bandSeed(42, BAND)).not.toBe(bandSeed(43, BAND));
    expect(bandSeed(42, BAND)).not.toBe(bandSeed(42, { ...BAND, y: 140 }));
  });

  it("ignores rounding noise below a hundredth of a unit", () => {
    expect(bandSeed(42, BAND)).toBe(bandSeed(42, { ...BAND, x1: BAND.x1 + 0.001 }));
  });
});

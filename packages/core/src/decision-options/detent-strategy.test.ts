import { describe, expect, it } from "vitest";
import {
  DETENT_STRATEGIES,
  markOnlyDetent,
  pullNearbyDetent,
  tapButtonDetent,
  resolveMarkOnly,
  resolvePullNearby,
  resolveTapButton,
  markerEmphasis,
  type DetentContext,
} from "./detent-strategy.js";

/**
 * A tiny stand-in for the vendored page table: juz 2 opens on page 22 and juz 3
 * on page 42, the rest unvendored. Enough to exercise the pull without loading
 * the whole manifest.
 */
const ctx = (over: Partial<DetentContext> = {}): DetentContext => ({
  total: 604,
  radius: 3,
  juzStarts: [1, 22, 42, ...new Array(27).fill(null)],
  ...over,
});

describe("markOnly (A)", () => {
  it("lands exactly where the thumb is, catching no marker", () => {
    expect(resolveMarkOnly(30, ctx())).toEqual({ page: 30, pulled: false, juz: null });
    expect(resolveMarkOnly(22, ctx())).toEqual({ page: 22, pulled: false, juz: null });
  });
  it("never makes the markers tappable", () => {
    expect(markOnlyDetent.tappableMarkers).toBe(false);
  });
});

describe("pullNearby (B)", () => {
  it("pulls a release within the radius onto the marker", () => {
    expect(resolvePullNearby(24, ctx())).toEqual({ page: 22, pulled: true, juz: 2 });
    expect(resolvePullNearby(45, ctx())).toEqual({ page: 42, pulled: true, juz: 3 });
  });
  it("leaves a release outside the radius under the thumb", () => {
    expect(resolvePullNearby(30, ctx())).toEqual({ page: 30, pulled: false, juz: null });
  });
  it("respects the radius exactly — 3 pulls, 4 does not", () => {
    expect(resolvePullNearby(25, ctx()).pulled).toBe(true);
    expect(resolvePullNearby(26, ctx()).pulled).toBe(false);
  });
  it("breaks a tie toward the nearer marker", () => {
    // page 32 is 10 from juz 2 and 10 from juz 3, but neither is within radius 3
    expect(resolvePullNearby(32, ctx()).pulled).toBe(false);
    // widen the radius so both are in reach: the nearer (juz 3 at 42, dist 3) wins over juz 2 (dist 17)
    expect(resolvePullNearby(39, ctx({ radius: 5 }))).toEqual({ page: 42, pulled: true, juz: 3 });
  });
  it("skips unvendored juz without crashing", () => {
    expect(resolvePullNearby(300, ctx())).toEqual({ page: 300, pulled: false, juz: null });
  });
});

describe("tapButton (C)", () => {
  it("lands under the thumb, like A, but arms the markers", () => {
    expect(resolveTapButton(24, ctx())).toEqual({ page: 24, pulled: false, juz: null });
    expect(tapButtonDetent.tappableMarkers).toBe(true);
  });
});

describe("the set", () => {
  it("carries all three in drawn order", () => {
    expect(DETENT_STRATEGIES.map((s) => s.id)).toEqual(["A", "B", "C"]);
  });
  it("each resolve is self-contained — its source names no module symbol", () => {
    // The page builder inlines each resolve via .toString(); if a resolver ever
    // reached for a module-scope helper, the inlined copy would throw in the
    // browser. This is the guard: the source may touch only globals + its args.
    for (const s of DETENT_STRATEGIES) {
      const src = s.resolve.toString();
      expect(src).not.toMatch(/\bimport\b|\brequire\b/);
    }
  });
  it("A is behaviour-preserving against today's app: identity landing", () => {
    // Option A is what PageSlider does now — a release lands where asked; the
    // module can graduate into commit() with no behaviour change.
    for (let p = 1; p <= 604; p += 37) {
      expect(markOnlyDetent.resolve(p, ctx()).page).toBe(p);
    }
  });
});

describe("markerEmphasis (C's grow-on-approach)", () => {
  it("is 1 at or beyond the reach — a marker at rest keeps its plain size", () => {
    expect(markerEmphasis(28, 28, 2.4)).toBe(1);
    expect(markerEmphasis(40, 28, 2.4)).toBe(1);
  });
  it("reaches the full peak under the pointer", () => {
    expect(markerEmphasis(0, 28, 2.4)).toBeCloseTo(2.4, 10);
  });
  it("grows as the pointer nears, eased so far marks barely move", () => {
    const half = markerEmphasis(14, 28, 2.4); // t = .5, squared to .25
    expect(half).toBeCloseTo(1 + (2.4 - 1) * 0.25, 10);
    expect(markerEmphasis(7, 28, 2.4)).toBeGreaterThan(half); // closer is bigger
    expect(markerEmphasis(21, 28, 2.4)).toBeLessThan(half); // farther is smaller
  });
  it("never grows when reach is off or the distance is unknown — a drag is never eaten", () => {
    expect(markerEmphasis(0, 0, 2.4)).toBe(1);
    expect(markerEmphasis(Number.NaN, 28, 2.4)).toBe(1);
  });
  it("is inline-safe — its source names no import/require", () => {
    expect(markerEmphasis.toString()).not.toMatch(/\bimport\b|\brequire\b/);
  });
});

describe("only C's markers grow on approach", () => {
  it("A and B carry no emphasis; C carries a peak above 1", () => {
    expect(markOnlyDetent.emphasis).toBeNull();
    expect(pullNearbyDetent.emphasis).toBeNull();
    expect(tapButtonDetent.emphasis).not.toBeNull();
    expect(tapButtonDetent.emphasis?.peak).toBeGreaterThan(1);
    expect(tapButtonDetent.emphasis?.near).toBeGreaterThan(0);
  });
});

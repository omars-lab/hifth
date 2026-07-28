import { describe, expect, it } from "vitest";
import { swipesFromPath } from "./ink.js";

/**
 * The real thing, from apps/web/public/assets/pages/hafs-kfqc/7.svg — a
 * two-line ayah. Written out rather than loaded so the test states what the
 * corpus looks like instead of agreeing with whatever it becomes.
 */
const VERSE_45 = "M0 8.5h345v38H0Zm79.5 38H345v38.2H79.5Z";

describe("swipesFromPath", () => {
  it("lays one swipe per line, centred in the line box", () => {
    const swipes = swipesFromPath(VERSE_45);
    expect(swipes).toHaveLength(2);

    // Line 1: y 8.5 → 46.5, so the centreline is at 27.5 and the band is
    // 0.72 × 38 = 27.36 thick.
    expect(swipes![0].y).toBeCloseTo(27.5, 5);
    expect(swipes![0].width).toBeCloseTo(27.36, 5);

    // Line 2 is a RELATIVE sub-path (`m79.5 38`), continuing from the previous
    // sub-path's start at (0, 8.5) — so it begins at y 46.5, not y 38. Getting
    // this wrong shifts the second line's ink by 8.5 units, which looks like a
    // rendering nudge rather than a bug, hence an assertion.
    expect(swipes![1].y).toBeCloseTo(46.5 + 38.2 / 2, 5);
  });

  it("insets the caps so ink never crosses into the neighbouring ayah", () => {
    const [first] = swipesFromPath(VERSE_45)!;
    // The rect spans x 0 → 345. Round caps add half the band at each end, so
    // the centreline must stop half a band short of both edges.
    const half = first.width / 2;
    expect(first.x1).toBeCloseTo(half, 5);
    expect(first.x2).toBeCloseTo(345 - half, 5);
    expect(first.x2 - first.x1).toBeCloseTo(345 - first.width, 5);
  });

  it("collapses a rect narrower than its band to a centred dot", () => {
    // 10 wide, 38 tall: the band (27.36) is wider than the rect, so an inset
    // centreline would run backwards. A pen tapped once leaves a dot.
    const [dot] = swipesFromPath("M100 0h10v38H100Z")!;
    expect(dot.x1).toBeCloseTo(105, 5);
    expect(dot.x2).toBeCloseTo(105, 5);
    expect(dot.x2).toBeGreaterThanOrEqual(dot.x1);
  });

  it("handles absolute closing runs and reversed coordinate order", () => {
    const [s] = swipesFromPath("M10 20H60V50H10Z")!;
    expect(s.y).toBeCloseTo(35, 5);
    expect(s.width).toBeCloseTo(30 * 0.72, 5);
  });

  /**
   * The fallback contract. Each of these returns null so the highlighter clones
   * the source path instead — a boxy highlight, but never a missing one. Loop
   * 4b vendors 601 more pages from the same upstream, and this is what makes
   * that safe to do without re-auditing the geometry first.
   */
  it.each([
    ["a genuine polygon", "M0 0L10 5L20 0Z"],
    ["an arc", "M0 0A10 10 0 0 1 20 0Z"],
    ["a rect that does not close back to its left edge", "M0 0h100v38H40Z"],
    ["a zero-height run", "M0 0h100v0H0Z"],
    ["a curve", "M0 0C10 10 20 10 30 0Z"],
    ["empty", ""],
  ])("returns null for %s", (_label, d) => {
    expect(swipesFromPath(d)).toBeNull();
  });

  it("returns null if any sub-path is unrecognised, not just the first", () => {
    // Half marker and half box would read as a rendering bug, so recognition is
    // all-or-nothing per path.
    expect(swipesFromPath("M0 0h100v38H0ZM0 38L50 60L100 38Z")).toBeNull();
  });
});

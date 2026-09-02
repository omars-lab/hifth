import { describe, expect, it } from "vitest";
import { pageLineHeight, swipesFromPath, swipesFromRects } from "./ink.js";

/**
 * The real thing, from apps/web/public/assets/pages/hafs-kfqc/7.svg — a
 * two-line ayah. Written out rather than loaded so the test states what the
 * corpus looks like instead of agreeing with whatever it becomes.
 */
const VERSE_45 = "M0 8.5h345v38H0Zm79.5 38H345v38.2H79.5Z";

/**
 * The real 2:249, from page 41 (`verse-256`) — the ayah in the bug report. Its
 * middle six lines are all full width, so the print fuses them into one
 * 218.4-unit box between a one-line head and a one-line tail. Filled or drawn as
 * one swipe, that box is the "blob" a reader sees instead of six lines.
 */
const VERSE_2_249 = "M0 6.3h345v36H0Zm0 36h345v218.4H0Zm233.4 218.4H345v36H233.4Z";

/**
 * The real 10:44, from page 214 (`verse-1408`) — the ayah in the bug report
 * (#16). It is an ordinary two-line ayah, but its short second line closes a
 * tenth of a unit off its own left edge: it starts at x 259.7 and its closing
 * run lands at 345 − 85.4 = 259.6. That is pure coordinate rounding (the print
 * quantises to a tenth), yet a stricter tolerance than the rounding step read
 * it as "not a rectangle" and dropped the whole ayah to the box fallback. 110
 * ayat across the corpus miss their close by up to 0.2 for the same reason;
 * this was simply the first one reported.
 */
const VERSE_10_44 = "M0 45h345v35.8H0Zm259.7 35.8H345v35.8h-85.4Z";

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

  it("accepts a rectangle whose rounded closing edge misses by a tenth (10:44)", () => {
    // The print rounds coordinates to a tenth, so a true rectangle's closing run
    // can land a fraction off its own left edge. 10:44's tail starts at 259.7 and
    // closes at 259.6 — a 0.1 miss that is rounding, not a real corner. It must
    // still draw as a marker (two lines), not fall back to a box.
    const swipes = swipesFromPath(VERSE_10_44);
    expect(swipes).toHaveLength(2);
    // The tail line spans x 259.7 → 345, ~85 wide; the centreline sits entirely
    // in that right-hand span (both caps past 259.7), which is what "the last two
    // words of the line" looks like — proof the rect was read, not discarded.
    expect(swipes![1].x1).toBeGreaterThan(259.7);
    expect(swipes![1].x2 - swipes![1].x1).toBeGreaterThan(50);
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
    ["a rect that misses its close by more than a rounding step", "M0 0h100v38h-99.5Z"],
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

/**
 * The multi-line fix (#4, #12). A four-or-more-line ayah's middle lines are all
 * full width, so the print may fuse them into one tall box; drawn as one swipe
 * that box is a single fat band down the centre of a paragraph — the "blob".
 * Told the page's line height, the pen splits the box back into its lines.
 */
describe("splitting a fused multi-line rectangle", () => {
  const LINE = 36; // the modal line height of this print

  it("draws one swipe per line for 2:249, not one blob over the middle", () => {
    const swipes = swipesFromPath(VERSE_2_249, LINE)!;
    // One head line + six fused middle lines + one tail line.
    expect(swipes).toHaveLength(8);

    // The bug was a band as tall as the whole middle box; every band is now
    // about one line thick, so none is wider than a line and a half.
    for (const s of swipes) expect(s.width).toBeLessThan(LINE * 1.5);

    // The six middle bands are evenly stacked one line apart, filling the box
    // from y 42.3 to y 260.7 (218.4 / 6 = 36.4 each).
    const middle = swipes.slice(1, 7);
    const step = 218.4 / 6;
    middle.forEach((s, i) => {
      expect(s.y).toBeCloseTo(42.3 + (i + 0.5) * step, 5);
    });
  });

  it("splits an ayah that is nothing but one fused box (no partial line)", () => {
    // `verse-3629` on page 431 is a single two-line full-width box, so there is
    // no one-line rectangle in the ayah to infer a line height from — which is
    // why the height is a page fact passed in, not one read off the ayah.
    const swipes = swipesFromPath("M0 0h345v72H0Z", LINE)!;
    expect(swipes).toHaveLength(2);
    expect(swipes[0].y).toBeCloseTo(18, 5);
    expect(swipes[1].y).toBeCloseTo(54, 5);
  });

  it("leaves a normal short ayah untouched — 38 against a 36 line is one line", () => {
    // Rounding, not flooring: a line's box is a little taller than the modal
    // line, and that must not read as two lines.
    expect(swipesFromPath(VERSE_45, LINE)).toHaveLength(2);
  });

  it("without a line height, falls back to one swipe per rectangle (the blob)", () => {
    // The old behaviour, kept for callers that cannot supply the height: the
    // middle box stays one fat band. This is the state the fix improves on.
    const swipes = swipesFromPath(VERSE_2_249)!;
    expect(swipes).toHaveLength(3);
    expect(swipes[1].width).toBeGreaterThan(LINE * 4);
  });

  it("does not split a word run's per-line bands, which are already one line", () => {
    // The word selection arrives as one rectangle per line already, so telling
    // the pen the line height must not double them.
    const bands = [
      { x: 0, y: 0, width: 100, height: 36 },
      { x: 0, y: 36, width: 100, height: 36 },
    ];
    expect(swipesFromRects(bands, LINE)).toHaveLength(2);
  });
});

describe("pageLineHeight", () => {
  it("is the most common rectangle height on the page", () => {
    // Two ordinary one-line ayahs and 2:249's fused box: 36 wins outright, and
    // the 218-tall box cannot outvote it.
    const height = pageLineHeight([VERSE_45, "M0 0h345v36H0Z", VERSE_2_249]);
    expect(height).toBe(36);
  });

  it("is null when nothing parses, so the pen keeps its one-swipe fallback", () => {
    expect(pageLineHeight(["M0 0L10 5L20 0Z", ""])).toBeNull();
  });
});

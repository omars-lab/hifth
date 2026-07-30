import { describe, expect, it } from "vitest";
import { EDITIONS } from "./concordance.js";
import { nearestPage, pageFraction } from "./pages.js";

describe("nearestPage", () => {
  const vendored = [7, 9, 19];

  it("answers with the page itself when we have it", () => {
    expect(nearestPage(vendored, 9)).toBe(9);
  });

  it("answers with what it did, not with what was asked", () => {
    // The point of the function: a scrubber dropped on page 300 must not
    // silently pretend it landed there. 19 is the nearest thing we hold.
    expect(nearestPage(vendored, 300)).toBe(19);
    expect(nearestPage(vendored, 1)).toBe(7);
  });

  it("breaks a tie toward the earlier page, whatever order the inventory is in", () => {
    // Page 8 is one away from both 7 and 9. The rule matters less than its
    // being fixed — an unstable tie-break makes the same drag land in two
    // different places on two runs.
    expect(nearestPage(vendored, 8)).toBe(7);
    expect(nearestPage([19, 9, 7], 8)).toBe(7);
  });

  it("has no opinion when nothing is vendored", () => {
    // Not 1, not 0 — an empty build has no nearest page, and a caller that
    // navigates to a fabricated one lands on a blank stage.
    expect(nearestPage([], 7)).toBeNull();
  });
});

describe("pageFraction", () => {
  it("puts the first page at the start and the last at the end", () => {
    expect(pageFraction(1, 604)).toBe(0);
    expect(pageFraction(604, 604)).toBe(1);
  });

  it("clamps rather than running off either end", () => {
    expect(pageFraction(0, 604)).toBe(0);
    expect(pageFraction(9999, 604)).toBe(1);
  });

  it("does not divide by zero on a one-page book", () => {
    expect(pageFraction(1, 1)).toBe(0);
    expect(pageFraction(1, 0)).toBe(0);
  });
});

describe("edition page counts", () => {
  it("claims a length only for the print somebody counted", () => {
    // 604 is the Madani print's own number. The unvendored entries carry no
    // `pages` because a plausible guess here would be a slider that scrolls
    // past the end of a mus'haf — see the field's doc comment.
    const byId = new Map(EDITIONS.map((e) => [e.id, e]));
    expect(byId.get("hafs-kfqc")?.pages).toBe(604);
    for (const edition of EDITIONS) {
      if (edition.status === "unvendored") expect(edition.pages).toBeUndefined();
    }
  });
});

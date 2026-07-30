import { describe, expect, it } from "vitest";
import { EDITIONS } from "./concordance.js";
import { nearestPage, pageFraction, spreadOf } from "./pages.js";

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

describe("spreadOf", () => {
  const MADANI = 604;

  it("puts the lower page number on the right", () => {
    // The mus'haf reads right to left, so 6 faces 7 with 6 on the right — the
    // same direction ArrowLeft (+1 page) and the page bar's left-edge next
    // button already encode.
    expect(spreadOf(7, MADANI)).toEqual({ right: 6, left: 7 });
    expect(spreadOf(6, MADANI)).toEqual({ right: 6, left: 7 });
  });

  it("answers the same spread from either of its leaves", () => {
    // The property that matters: which page you ask from must not change which
    // book you are shown.
    for (let page = 2; page < MADANI; page += 1) {
      const here = spreadOf(page, MADANI);
      const facing = page % 2 === 0 ? page + 1 : page - 1;
      expect(spreadOf(facing, MADANI)).toEqual(here);
    }
  });

  it("leaves page 1 alone on the right", () => {
    // Page 1 is the first leaf after the cover; there is no page 0 to face it.
    expect(spreadOf(1, MADANI)).toEqual({ right: 1, left: null });
  });

  it("leaves the last page of an even-length book alone on the right", () => {
    // 604 is even, so it opens a spread whose left leaf would be 605.
    expect(spreadOf(604, MADANI)).toEqual({ right: 604, left: null });
    expect(spreadOf(603, MADANI)).toEqual({ right: 602, left: 603 });
  });

  it("refuses a page the book does not have", () => {
    // Not a plausible-looking spread: the caller is about to draw two panels,
    // and «page 0 facing page 1» is a picture of a book that does not exist.
    expect(spreadOf(0, MADANI)).toEqual({ right: null, left: null });
    expect(spreadOf(605, MADANI)).toEqual({ right: null, left: null });
    expect(spreadOf(Number.NaN, MADANI)).toEqual({ right: null, left: null });
  });

  it("never claims a leaf past the end of the book", () => {
    // The guarantee the spread component leans on: anything non-null here is a
    // page number the print actually has.
    for (let page = 1; page <= MADANI; page += 1) {
      const { right, left } = spreadOf(page, MADANI);
      for (const leaf of [right, left]) {
        if (leaf !== null) expect(leaf).toBeGreaterThanOrEqual(1);
        if (leaf !== null) expect(leaf).toBeLessThanOrEqual(MADANI);
      }
      // …and the page you asked about is always one of the two leaves.
      expect([right, left]).toContain(page);
    }
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

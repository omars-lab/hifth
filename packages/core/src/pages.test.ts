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
    // The mus'haf reads right to left, so 7 faces 8 with 7 on the right — the
    // same direction ArrowLeft (+1 page) and the page bar's left-edge next
    // button already encode.
    expect(spreadOf(7, MADANI)).toEqual({ right: 7, left: 8 });
    expect(spreadOf(8, MADANI)).toEqual({ right: 7, left: 8 });
  });

  it("opens each spread on the odd page", () => {
    // The parity, stated on its own because this function had it backwards for
    // six loops and every spread it drew paired the wrong two leaves.
    //
    // It is an observation, not a derivation: open a physical KFGQPC Madani
    // mushaf and Al-Fatiha — page 1 — is on the right, facing the first page of
    // Al-Baqarah on the left. The old phase paired (2,3), (4,5)…, inferred from
    // "every juz' begins on a right-hand page" plus juz' 2, 3, 4 beginning on
    // pages 22, 42, 62. The inference was recorded as though it had been seen.
    expect(spreadOf(1, MADANI)).toEqual({ right: 1, left: 2 });
    expect(spreadOf(2, MADANI)).toEqual({ right: 1, left: 2 });
    expect(spreadOf(21, MADANI)).toEqual({ right: 21, left: 22 });
  });

  it("answers the same spread from either of its leaves", () => {
    // The property that matters: which page you ask from must not change which
    // book you are shown.
    for (let page = 1; page <= MADANI; page += 1) {
      const here = spreadOf(page, MADANI);
      const facing = page % 2 === 0 ? page - 1 : page + 1;
      if (facing < 1 || facing > MADANI) continue;
      expect(spreadOf(facing, MADANI)).toEqual(here);
    }
  });

  it("orphans no leaf in an even-length book", () => {
    // The tell the old phase gave and nobody read: it left page 1 alone on the
    // right and page 604 alone on the left. A codex whose leaves each carry two
    // pages cannot orphan exactly one page at each end of an even-length book.
    // 604 pages is 302 complete openings, and every one of them has two leaves.
    for (let page = 1; page <= MADANI; page += 1) {
      const { right, left } = spreadOf(page, MADANI);
      expect(right).not.toBeNull();
      expect(left).not.toBeNull();
    }
    expect(spreadOf(603, MADANI)).toEqual({ right: 603, left: 604 });
    expect(spreadOf(604, MADANI)).toEqual({ right: 603, left: 604 });
  });

  it("leaves the last page of an odd-length print alone on the right", () => {
    // `total` is a parameter, so `left: null` is still reachable — just not by
    // the Madani print. An edition with 603 pages ends on a half-opening.
    expect(spreadOf(603, 603)).toEqual({ right: 603, left: null });
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

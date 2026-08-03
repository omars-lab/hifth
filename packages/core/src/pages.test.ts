import { describe, expect, it } from "vitest";
import { EDITIONS } from "./concordance.js";
import { foldBetween, leafSideOf, nearestPage, pageFraction, pageRuns, spreadOf } from "./pages.js";

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

describe("pageRuns", () => {
  it("has nothing to draw for an empty inventory", () => {
    // Not one zero-width run. A build with no pages has no stretch of pages,
    // and a caller that maps over this must render nothing at all.
    expect(pageRuns([])).toEqual([]);
  });

  it("makes one run of a stretch and one run of a lone page", () => {
    // The two shapes side by side, because they are the same shape: a run is
    // inclusive at both ends, so a single page is `{from: n, to: n}` and draws
    // the 2px mark the per-page ticks used to draw.
    expect(pageRuns([7, 8, 9])).toEqual([{ from: 7, to: 9 }]);
    expect(pageRuns([7])).toEqual([{ from: 7, to: 7 }]);
  });

  it("splits at every gap and nowhere else", () => {
    // This build's inventory before Loop 4b: three pages, none adjacent, so
    // three runs — the picture the per-page ticks drew, arrived at by counting
    // gaps rather than pages.
    expect(pageRuns([7, 9, 19])).toEqual([
      { from: 7, to: 7 },
      { from: 9, to: 9 },
      { from: 19, to: 19 },
    ]);
    // …and a corpus with two holes is three runs, whatever their lengths.
    expect(pageRuns([1, 2, 3, 10, 11, 604])).toEqual([
      { from: 1, to: 3 },
      { from: 10, to: 11 },
      { from: 604, to: 604 },
    ]);
  });

  it("does not care what order the manifest arrived in, or that it repeats", () => {
    // `available` is a manifest read off disk, and nothing upstream promises it
    // is sorted or deduplicated. 7,8,9 is one run however it is spelled.
    expect(pageRuns([9, 7, 8])).toEqual([{ from: 7, to: 9 }]);
    expect(pageRuns([9, 8, 8, 7, 9])).toEqual([{ from: 7, to: 9 }]);
  });

  it("draws a complete edition as one bar, not as 604 of them", () => {
    // The row this function exists for. Before Loop 4b the page bar rendered one
    // node per vendored page: three of them, three marks, a true picture. At 604
    // of 604 the same code drew 604 spans half a pixel apart and two pixels
    // wide, which overlap into a solid rail that says nothing — and React
    // reconciled every one of them on every value a dragged thumb passed over.
    // The node count has to follow the number of *gaps*, which is what the
    // reader is being shown; the length of the book they can already see.
    const whole = Array.from({ length: 604 }, (_, i) => i + 1);
    expect(pageRuns(whole)).toEqual([{ from: 1, to: 604 }]);
  });

  it("covers exactly the pages it was given, for any inventory", () => {
    // The property behind all of the above: expanding the runs must return the
    // inventory, deduplicated and sorted, and no page that is not vendored may
    // fall inside a run. A drawing that spans a page we do not hold is the same
    // lie the fold code refuses to tell (`foldBetween` → "hole").
    const inventories = [[], [7, 9, 19], [1, 2, 3, 10, 11, 604], [4, 4, 5], [604]];
    for (const inventory of inventories) {
      const held = new Set(inventory);
      const covered: number[] = [];
      for (const { from, to } of pageRuns(inventory)) {
        expect(to).toBeGreaterThanOrEqual(from);
        for (let page = from; page <= to; page += 1) {
          expect(held.has(page)).toBe(true);
          covered.push(page);
        }
      }
      expect(covered).toEqual([...held].sort((a, b) => a - b));
    }
  });

  it("never emits two runs that could have been one", () => {
    // Adjacency is the whole definition, so a run ending at n followed by a run
    // starting at n+1 is a bug that would still pass the coverage row above —
    // and would put a seam in the middle of a complete edition.
    const runs = pageRuns([1, 2, 3, 4, 5, 7, 8, 10]);
    for (let i = 1; i < runs.length; i += 1) {
      expect(runs[i]!.from).toBeGreaterThan(runs[i - 1]!.to + 1);
    }
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

describe("leafSideOf", () => {
  const MADANI = 604;

  it("puts the odd page on the right and the even page on the left", () => {
    // Written when pages 7, 9 and 19 were the whole build: all odd, so only the
    // right-hand form could be drawn (docs/design/page-transition.md §2.3), and
    // the even rows were here so the left-hand form was under test before it was
    // reachable. Loop 4b made it reachable and the bet paid — `leafSideOf` was
    // right, and the defect the even page found was one layer up, in the stage's
    // bound-edge inset (`e2e/page-turn.spec.ts`, the 7 → 8 turn). An unreachable
    // branch with no test is a branch that will be wrong when it becomes
    // reachable; these rows stay as the record of that being worth doing.
    expect(leafSideOf(7, MADANI)).toBe("right");
    expect(leafSideOf(9, MADANI)).toBe("right");
    expect(leafSideOf(19, MADANI)).toBe("right");
    expect(leafSideOf(8, MADANI)).toBe("left");
    expect(leafSideOf(1, MADANI)).toBe("right");
    expect(leafSideOf(604, MADANI)).toBe("left");
  });

  it("names the side the leaf is not bound on, for every page of the print", () => {
    // The invariant the stylesheet is allowed to lean on: exactly one of the two
    // leaves of an opening is the right one, and the other is the left one. If
    // `spreadOf`'s phase ever moves again, both halves of this move together and
    // the fore-edge follows — which is the whole reason this lives in core and
    // not in a `:nth-child` selector.
    for (let page = 1; page <= MADANI; page += 1) {
      const { right, left } = spreadOf(page, MADANI);
      const side = leafSideOf(page, MADANI);
      expect(side).toBe(page === right ? "right" : "left");
      if (side === "left") expect(page).toBe(left);
    }
  });

  it("refuses a page the book does not have", () => {
    // Same reasoning as `spreadOf`: the caller is about to draw an edge, and an
    // edge on a page that does not exist is furniture around nothing.
    expect(leafSideOf(0, MADANI)).toBeNull();
    expect(leafSideOf(605, MADANI)).toBeNull();
    expect(leafSideOf(Number.NaN, MADANI)).toBeNull();
  });
});

describe("foldBetween", () => {
  const MADANI = 604;
  /** This build's inventory, for the rows that are about it. */
  const VENDORED = [7, 9, 19];

  it("calls two pages of one opening a crease", () => {
    // 7 and 8 are the same leafless fact: one sheet of paper open in front of
    // you, one gutter down the middle. Nothing turned — the eye moved.
    expect(foldBetween(7, 8, MADANI)).toBe("crease");
    expect(foldBetween(8, 7, MADANI)).toBe("crease");
    expect(foldBetween(21, 22, MADANI)).toBe("crease");
  });

  it("calls consecutive pages in different openings a gap", () => {
    // 6 closes one opening and 7 opens the next, so getting from one to the
    // other turns exactly one leaf. Adjacent, but not facing.
    expect(foldBetween(6, 7, MADANI)).toBe("gap");
    expect(foldBetween(7, 6, MADANI)).toBe("gap");
  });

  it("needs no special case for page 1, and says so about page 2", () => {
    // The check on the phase, not a curiosity: Al-Fatiha faces the opening of
    // Al-Baqarah, so 1 | 2 is one opening. Under the pairing `spreadOf` used to
    // implement — page 1 alone on the right — this was a gap, and a reader
    // turning to page 2 was shown a leaf turning that does not turn.
    expect(foldBetween(1, 2, MADANI)).toBe("crease");
    expect(foldBetween(2, 3, MADANI)).toBe("gap");
  });

  it("refuses to call two pages neighbours because the build skipped what is between", () => {
    // The defect the whole design exists to prevent. Pages 7 and 9 are the ones
    // this build happens to hold next to each other; page 8 is in the print. A
    // fold drawn between them as a gap would assert they are consecutive
    // leaves, which is the shape of lie `PLAN.md` names — a gap the interface
    // papers over. The inventory is not an input here precisely so that it
    // cannot become one.
    expect(foldBetween(7, 9, MADANI)).toBe("hole");
    expect(foldBetween(9, 19, MADANI)).toBe("hole");
    for (let i = 1; i < VENDORED.length; i += 1) {
      expect(foldBetween(VENDORED[i - 1]!, VENDORED[i]!, MADANI)).toBe("hole");
    }
  });

  it("is not a turn at all when nothing moved or the page is off the book", () => {
    expect(foldBetween(7, 7, MADANI)).toBe("none");
    expect(foldBetween(604, 605, MADANI)).toBe("none");
    expect(foldBetween(0, 1, MADANI)).toBe("none");
    expect(foldBetween(7, Number.NaN, MADANI)).toBe("none");
    expect(foldBetween(7.5, 8, MADANI)).toBe("none");
  });

  it("says the same thing about a pair whichever way it is read", () => {
    // A fold is a thing between two pages, not a property of travelling one
    // way: turning back has to draw what turning forward drew, or the same
    // sheet of paper would be a crease going one way and a gap coming back.
    for (let from = 1; from <= 30; from += 1) {
      for (let to = 1; to <= 30; to += 1) {
        expect(foldBetween(from, to, MADANI)).toBe(foldBetween(to, from, MADANI));
      }
    }
  });

  it("agrees with spreadOf on every pair of the print, by construction", () => {
    // The cross-check `leafSideOf` gets: the predicate is only allowed to be a
    // reading of `spreadOf`, so a future body that re-derives parity itself
    // fails here even if all the rows above still pass.
    for (let from = 1; from <= MADANI; from += 1) {
      const to = from + 1;
      if (to > MADANI) break;
      const facing = spreadOf(from, MADANI).right === spreadOf(to, MADANI).right;
      expect(foldBetween(from, to, MADANI)).toBe(facing ? "crease" : "gap");
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

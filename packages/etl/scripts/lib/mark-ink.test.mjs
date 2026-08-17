import { describe, expect, it } from "vitest";
import { integral } from "./ink.mjs";
import { bestPlacement, ranOutOfRoom, refusedItsOwnInk, withSecondLook } from "./mark-ink.mjs";

const SIZE = 96;

/** A blank page with one filled block on it, and the summed table `scoreAt` needs. */
function pageWithABlockAt(x, y, w, h) {
  const obs = new Uint8Array(SIZE * SIZE);
  for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) obs[j * SIZE + i] = 1;
  return { obs, sat: integral(obs, SIZE, SIZE) };
}

/**
 * The same block as a template, claiming to sit at `(x, y)`.
 *
 * The rectangle is drawn wider than the block it holds, as a real one is: a mark's
 * box has margin around the mark. It has to, for the score to mean anything — a
 * rectangle exactly filled by its own ink has nothing varying inside it to correlate
 * against, and every placement of it scores the same.
 */
function templateAt(x, y, w, h, pad = 4) {
  const is = [];
  const js = [];
  for (let j = y; j < y + h; j += 1) {
    for (let i = x; i < x + w; i += 1) {
      is.push(i);
      js.push(j);
    }
  }
  return { is, js, box: [x - pad, y - pad, x + w + pad, y + h + pad] };
}

describe("the search stays inside the distance it was given", () => {
  // Two passes: a coarse lattice, then a refinement around whatever the coarse pass
  // liked. The refinement used to be allowed to step past the boundary, which
  // reported offsets the search had never checked around — and made a mark that ran
  // out of room indistinguishable from one that did not, since the only way to tell
  // is that its offset came back sitting exactly on the boundary.
  const RES = 4;
  const W = 6;
  for (const radius of [1, 2, 3, 8]) {
    it(`reports no further than ${radius} units when the ink is out of reach`, () => {
      const span = Math.round(radius * RES);
      // The ink sits two pixels further away than this search can reach, so it is
      // pulled against its own boundary the whole way and never gets there.
      const { obs, sat } = pageWithABlockAt(40 + span + 2, 40, W, W);
      const best = bestPlacement(templateAt(40, 40, W, W), obs, sat, SIZE, SIZE, RES, radius);
      expect(Math.abs(best.di)).toBeLessThanOrEqual(span);
      expect(Math.abs(best.dj)).toBeLessThanOrEqual(span);
    });
  }

  it("lands on the boundary exactly, so a caller can see it ran out of room", () => {
    const radius = 3;
    const span = Math.round(radius * RES);
    const { obs, sat } = pageWithABlockAt(40 + span + 2, 40, W, W);
    const best = bestPlacement(templateAt(40, 40, W, W), obs, sat, SIZE, SIZE, RES, radius);
    expect(Math.abs(best.di)).toBe(span);
    expect(ranOutOfRoom({ dx: best.di / RES, dy: best.dj / RES, iouBest: 1 }, radius)).toBe(true);
  });

  it("still finds ink that is within reach", () => {
    const radius = 3;
    const { obs, sat } = pageWithABlockAt(48, 40, W, W);
    const best = bestPlacement(templateAt(40, 40, W, W), obs, sat, SIZE, SIZE, RES, radius);
    expect(best.di).toBe(8);
    expect(best.dj).toBe(0);
  });
});

describe("did the search run out of room?", () => {
  const row = (dx, dy, extra = {}) => ({ page: 1, k: 0, dx, dy, iouBest: 0.9, ...extra });

  it("says yes when either axis is sitting on the boundary", () => {
    expect(ranOutOfRoom(row(3, 0), 3)).toBe(true);
    expect(ranOutOfRoom(row(0, -3), 3)).toBe(true);
    expect(ranOutOfRoom(row(-3, 3), 3)).toBe(true);
  });

  it("says no when the answer is inside it", () => {
    expect(ranOutOfRoom(row(2.75, 2.75), 3)).toBe(false);
    expect(ranOutOfRoom(row(0, 0), 3)).toBe(false);
  });

  it("tests each axis on its own, not the straight-line distance", () => {
    // The region searched is a square. A mark pinned against one wall while the
    // other axis is nearly as far out is still pinned; a circle would miss it, and
    // would also wrongly flag the corner, which is inside the square and reachable.
    expect(ranOutOfRoom(row(3, 2.9), 3)).toBe(true);
    expect(ranOutOfRoom(row(2.9, 2.9), 3)).toBe(false);
  });

  it("believes the row about how far it was allowed to look", () => {
    // A mark the ordinary look gave up on is looked at again further out, so rows in
    // one file can carry different reaches. An answer at exactly 3 from a search that
    // was allowed 8 is a real measurement, not a wall.
    expect(ranOutOfRoom(row(3, 0, { searchedAt: 8 }), 3)).toBe(false);
    expect(ranOutOfRoom(row(8, 0, { searchedAt: 8 }), 3)).toBe(true);
  });

  it("falls back to the run's own distance for rows written before that", () => {
    expect(ranOutOfRoom(row(3, 0), 3)).toBe(true);
  });

  it("refuses a mark that is out of room or matches badly, and only those", () => {
    expect(refusedItsOwnInk(row(0, 0, { iouBest: 0.9 }), 3)).toBe(false);
    expect(refusedItsOwnInk(row(0, 0, { iouBest: 0.4 }), 3)).toBe(true);
    expect(refusedItsOwnInk(row(3, 0, { iouBest: 0.9 }), 3)).toBe(true);
  });
});

describe("folding a wider second look back in", () => {
  const first = [
    { page: 1, k: 0, dx: 0, dy: 0, iouBest: 0.91 }, // placed, and left alone
    { page: 1, k: 1, dx: 3, dy: 0, iouBest: 0.88 }, // out of room
    { page: 1, k: 2, dx: 0.5, dy: 0.5, iouBest: 0.3 }, // matched badly
  ];
  const opts = { radius: 3, wide: 8, floor: 0.55 };

  it("takes the wider answer where the first look gave up and the wider one did not", () => {
    const wider = [{ page: 1, k: 1, dx: 4.5, dy: 0, iouBest: 0.94, searchedAt: 8 }];
    const { rows, took } = withSecondLook(first, wider, opts);
    expect(took).toBe(1);
    expect(rows[1]).toEqual(wider[0]);
  });

  it("leaves every mark the first look placed exactly as it was", () => {
    // The whole reason the fix is shaped this way. Searching everything wide keeps
    // almost every mark accepted but moves 4.11% of them by more than two units, onto
    // the neighbouring mark's ink — and nothing could adjudicate those. Firing only
    // where the old search failed makes that risk zero rather than small.
    const wider = [{ page: 1, k: 0, dx: 6, dy: 0, iouBest: 0.99, searchedAt: 8 }];
    const { rows, took } = withSecondLook(first, wider, opts);
    expect(took).toBe(0);
    expect(rows[0]).toBe(first[0]);
  });

  it("does not take a wider answer that also ran out of room", () => {
    const wider = [{ page: 1, k: 1, dx: 8, dy: 0, iouBest: 0.96, searchedAt: 8 }];
    expect(withSecondLook(first, wider, opts).took).toBe(0);
  });

  it("does not take a wider answer that still matches badly", () => {
    const wider = [{ page: 1, k: 2, dx: 5, dy: 1, iouBest: 0.5, searchedAt: 8 }];
    expect(withSecondLook(first, wider, opts).took).toBe(0);
  });

  it("does not take a wider answer that matches no better than the one it has", () => {
    const wider = [{ page: 1, k: 1, dx: 5, dy: 1, iouBest: 0.88, searchedAt: 8 }];
    expect(withSecondLook(first, wider, opts).took).toBe(0);
  });

  it("keeps the order and the count of the rows it was given", () => {
    const wider = [{ page: 1, k: 1, dx: 4.5, dy: 0, iouBest: 0.94, searchedAt: 8 }];
    const { rows } = withSecondLook(first, wider, opts);
    expect(rows).toHaveLength(first.length);
    expect(rows.map((r) => r.k)).toEqual([0, 1, 2]);
  });
});

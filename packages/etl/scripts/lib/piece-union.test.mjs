import { describe, expect, it } from "vitest";
import { readPageInk } from "./ink.mjs";
import { GUARD, guardPasses, pieceUnionCandidate, reachOrFall, windowOf } from "./piece-union.mjs";

const RES = 16;

/**
 * A page with filled rectangles at known places, read back through the same
 * `readPageInk` the build uses — so the test exercises the real raster-and-carry
 * path that turns outlines into pieces, not a hand-built stand-in for it.
 *
 * Each rect is one `<path>` with a solid fill, drawn big enough at this grain to
 * survive rasterisation. No group transform, so the numbers in the test are the
 * numbers on the page.
 */
function pageOf(rects) {
  const paths = rects
    .map(([x, y, w, h]) => `<path fill="#000" d="M${x} ${y}H${x + w}V${y + h}H${x}Z"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345 550">${paths}</svg>`;
  return readPageInk(svg, 1 / RES).shapes;
}

/** A per-mark row: its shipped box, and how far its own search was allowed to look. */
const row = (box, searchedAt = 3) => ({ box, searchedAt });

describe("the guard trusts a candidate only when its area stays near the shipped box", () => {
  it("passes a candidate the same size as the box", () => {
    expect(guardPasses(1)).toBe(true);
  });

  it("refuses one grown to or past the ceiling, and one at or under the floor", () => {
    expect(guardPasses(GUARD.grow)).toBe(false);
    expect(guardPasses(GUARD.grow + 0.01)).toBe(false);
    expect(guardPasses(GUARD.shrink)).toBe(false);
    expect(guardPasses(GUARD.shrink - 0.01)).toBe(false);
  });

  it("passes just inside either bound", () => {
    expect(guardPasses(GUARD.grow - 0.01)).toBe(true);
    expect(guardPasses(GUARD.shrink + 0.01)).toBe(true);
  });

  it("keeps the floor the reciprocal of the ceiling, so the band is symmetric in log-area", () => {
    expect(GUARD.shrink).toBeCloseTo(1 / GUARD.grow, 12);
  });
});

describe("a mark is drawn on its ink, reaching for the ink, or on the line's tilt", () => {
  it("draws a placed mark on its own found ink, never reaching", () => {
    // A mark the search did not refuse ignores any candidate it is handed.
    expect(reachOrFall(false, [1, 1, 1, 1], 1)).toBe("ink");
    expect(reachOrFall(false, null, null)).toBe("ink");
  });

  it("reaches for the ink when a refused mark has a candidate the guard trusts", () => {
    expect(reachOrFall(true, [1, 1, 2, 2], 1)).toBe("reach");
  });

  it("falls to the line's tilt when a refused mark has no piece to point to", () => {
    expect(reachOrFall(true, null, null)).toBe("tilt");
  });

  it("falls to the line's tilt when the guard throws the candidate out", () => {
    // A union grown or shrunk past the guard is not trusted, so the mark falls back.
    expect(reachOrFall(true, [1, 1, 9, 9], GUARD.grow + 1)).toBe("tilt");
    expect(reachOrFall(true, [1, 1, 1, 1], GUARD.shrink - 0.1)).toBe("tilt");
  });
});

describe("the search window is the shipped box padded by how far the mark could look", () => {
  it("pads wider marks by their own reach, and always more sideways than vertically", () => {
    const box = [100, 200, 8, 4];
    const near = windowOf(box, 3);
    const far = windowOf(box, 8);
    // A mark rescued to a wider radius sees a wider window.
    expect(far.vw).toBeGreaterThan(near.vw);
    expect(far.vh).toBeGreaterThan(near.vh);
    // The horizontal pad carries the box width on top of the reach, the vertical does not.
    expect(near.vw - box[2]).toBeGreaterThan(near.vh - box[3]);
  });
});

describe("the candidate is the union of the pieces whose middle sits in the shipped box", () => {
  it("unions two pieces inside the box into one rectangle spanning both", () => {
    // Two strokes of a doubled mark, side by side, both centred inside the box.
    const shapes = pageOf([
      [101, 201, 2, 2],
      [105, 201, 2, 2],
    ]);
    const { candidate, piecesUnioned } = pieceUnionCandidate(row([100, 200, 8, 4]), shapes, { res: RES });
    expect(piecesUnioned).toBe(2);
    // Spans from the left edge of the first stroke to the right edge of the second.
    expect(candidate[0]).toBeCloseTo(101, 1);
    expect(candidate[0] + candidate[2]).toBeCloseTo(107, 1);
  });

  it("ignores a piece whose middle falls outside the shipped box, even if the window saw it", () => {
    // One stroke inside the box; one well to the right, centre past the box edge.
    const shapes = pageOf([
      [101, 201, 2, 2],
      [116, 201, 2, 2],
    ]);
    const { candidate, piecesUnioned } = pieceUnionCandidate(row([100, 200, 8, 4]), shapes, { res: RES });
    expect(piecesUnioned).toBe(1);
    // The candidate is the inside stroke alone, not stretched out to the far one.
    expect(candidate[0] + candidate[2]).toBeLessThan(110);
  });

  it("keeps the shipped rectangle when no piece has its middle in the box", () => {
    const shapes = pageOf([[130, 260, 2, 2]]);
    const { candidate, ratio, piecesUnioned } = pieceUnionCandidate(row([100, 200, 8, 4]), shapes, { res: RES });
    expect(piecesUnioned).toBe(0);
    expect(candidate).toBeNull();
    expect(ratio).toBeNull();
  });

  it("reports the area ratio against the shipped box, so the guard can judge it", () => {
    // A single piece filling most of the box: candidate smaller than the box, ratio < 1.
    const shapes = pageOf([[102, 201, 4, 2]]);
    const box = [100, 200, 8, 4];
    const { candidate, ratio } = pieceUnionCandidate(row(box), shapes, { res: RES });
    const expected = (candidate[2] * candidate[3]) / (box[2] * box[3]);
    expect(ratio).toBeCloseTo(expected, 2);
    expect(ratio).toBeLessThan(1);
  });
});

import { describe, expect, it } from "vitest";
import { applyMatrix, cornerOf, landedCorner, peelShape, reachable, type Pt } from "./peel";

const L = 400;
const H = 600;
const close = (a: Pt, b: Pt): void => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};
const area = (poly: Pt[]): number =>
  Math.abs(poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return s + p.x * q.y - q.x * p.y;
  }, 0)) / 2;

describe("a lifted page corner", () => {
  it("takes the corner nearest the press on the grabbed leaf's outer edge", () => {
    expect(cornerOf("left", L, H, 50)).toEqual({ x: 0, y: 0 });
    expect(cornerOf("left", L, H, 500)).toEqual({ x: 0, y: H });
    expect(cornerOf("right", L, H, 50)).toEqual({ x: 2 * L, y: 0 });
  });

  it("puts the corner of the flap under the hand", () => {
    for (const side of ["left", "right"] as const) {
      const c = cornerOf(side, L, H, 10);
      const p = { x: side === "left" ? 150 : 2 * L - 150, y: 60 };
      const s = peelShape(side, L, H, c, p)!;
      // The back page's corner, lying flat over the spine, is carried to the hand.
      close(applyMatrix(s.matrix, { x: 2 * L - c.x, y: c.y }), p);
      expect(s.lift).toBeCloseTo(Math.hypot(150, 60), 6);
    }
  });

  it("leaves the fold line where it is: flap and page meet along it", () => {
    const c = cornerOf("left", L, H, 10);
    const p = { x: 200, y: 80 };
    const s = peelShape("left", L, H, c, p)!;
    const m = { x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 };
    // A second point on the fold: step along the line perpendicular to (p − c).
    const q = { x: m.x - 80 * 0.3, y: m.y + 200 * 0.3 };
    for (const f of [m, q]) close(applyMatrix(s.matrix, { x: 2 * L - f.x, y: f.y }), f);
  });

  it("shows nothing beneath until the corner moves, and grows as it does", () => {
    const c = cornerOf("left", L, H, 10);
    expect(peelShape("left", L, H, c, c)).toBeNull();
    const small = peelShape("left", L, H, c, { x: 60, y: 10 })!;
    const big = peelShape("left", L, H, c, { x: 300, y: 40 })!;
    expect(area(big.revealed)).toBeGreaterThan(area(small.revealed));
    // Never more than the grabbed leaf.
    for (const q of big.revealed) expect(q.x).toBeLessThanOrEqual(L + 1e-9);
  });

  it("carried to the far side, the whole next opening shows and the back page lies flat", () => {
    for (const side of ["left", "right"] as const) {
      const c = cornerOf(side, L, H, 10);
      const s = peelShape(side, L, H, c, landedCorner(c, L))!;
      expect(area(s.revealed)).toBeCloseTo(L * H, 3);
      const [a, b, cc, d, e, f] = s.matrix;
      for (const [got, want] of [[a, 1], [b, 0], [cc, 0], [d, 1], [e, 0], [f, 0]] as const) {
        expect(got).toBeCloseTo(want, 6);
      }
    }
  });

  it("keeps the corner within reach of the spine", () => {
    const c = cornerOf("left", L, H, 10);
    const far = reachable({ x: 2000, y: 0 }, c, L, H);
    close(far, { x: 2 * L, y: 0 });
    // A pull straight down cannot drag the corner past the leaf's width from the spine.
    const down = reachable({ x: 0, y: 900 }, c, L, H);
    expect(Math.hypot(down.x - L, down.y)).toBeLessThanOrEqual(L + 1e-9);
  });
});

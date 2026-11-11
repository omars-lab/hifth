import { describe, expect, it } from "vitest";
import { innerSpot, outerSpots, ringCentre, RING_INNER, RING_OUTER, RING_REACH } from "./pen-ring";

/**
 * Where the rings at the Apple Pencil's tip stand (docs/design/pencil-gestures.md,
 * ④): round the tip with room, whole in the window near an edge, and never with
 * a button under the tip.
 */
const VIEW = { w: 1180, h: 820 };
const HALF = 22;

/** Whether a tip lies under either ring's band of buttons. */
function underARing(tip: { x: number; y: number }, centre: { x: number; y: number }): boolean {
  const d = Math.hypot(tip.x - centre.x, tip.y - centre.y);
  return d > RING_INNER - HALF && d < RING_REACH;
}

describe("where the rings' middle goes", () => {
  it("is the tip itself where there is room all round", () => {
    expect(ringCentre({ x: 500, y: 400 }, VIEW)).toEqual({ x: 500, y: 400 });
  });

  it("slides a little to stay in the window, the tip still clear in the hole", () => {
    const tip = { x: 8 + RING_REACH - 10, y: 400 };
    const c = ringCentre(tip, VIEW);
    expect(c).toEqual({ x: 8 + RING_REACH, y: 400 });
    expect(underARing(tip, c)).toBe(false);
  });

  it.each([
    [{ x: 1120, y: 700 }],
    [{ x: 30, y: 30 }],
    [{ x: 590, y: 800 }],
    [{ x: 1170, y: 410 }],
    [{ x: 60, y: 760 }],
  ])("stands whole in the window beside a tip near an edge, no button under it: %o", (tip) => {
    const c = ringCentre(tip, VIEW);
    expect(c.x - RING_REACH).toBeGreaterThanOrEqual(8);
    expect(c.y - RING_REACH).toBeGreaterThanOrEqual(8);
    expect(c.x + RING_REACH).toBeLessThanOrEqual(VIEW.w - 8);
    expect(c.y + RING_REACH).toBeLessThanOrEqual(VIEW.h - 8);
    expect(underARing(tip, c)).toBe(false);
    // And no farther off than it has to be.
    expect(Math.hypot(tip.x - c.x, tip.y - c.y)).toBeLessThan(RING_REACH + 80);
  });

  it("still stands off the tip in a window barely bigger than the rings", () => {
    const small = { w: 340, h: 700 };
    const tip = { x: 170, y: 40 };
    expect(underARing(tip, ringCentre(tip, small))).toBe(false);
  });
});

describe("where the tools stand on their ring", () => {
  it("starts at the top and goes clockwise, each a ring's reach from the middle", () => {
    const first = innerSpot(0, 8);
    expect(first.x).toBeCloseTo(0);
    expect(first.y).toBeCloseTo(-RING_INNER);
    const quarter = innerSpot(2, 8);
    expect(quarter.x).toBeCloseTo(RING_INNER);
    expect(quarter.y).toBeCloseTo(0);
  });

  it("goes the other way round where the page reads right to left", () => {
    const quarter = innerSpot(2, 8, true);
    expect(quarter.x).toBeCloseTo(-RING_INNER);
    expect(quarter.y).toBeCloseTo(0);
  });

  it("leaves a finger's room between neighbours with eleven tools", () => {
    const a = innerSpot(0, 11);
    const b = innerSpot(1, 11);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(44);
  });
});

describe("where a tool's choices stand on the outer ring", () => {
  it("centres them on the tool they belong to", () => {
    const spots = outerSpots(0, [3]);
    expect(spots).toHaveLength(3);
    expect(spots[1]!.x).toBeCloseTo(RING_OUTER);
    expect(spots[1]!.y).toBeCloseTo(0);
    // Clockwise: the first is above the tool, the last below it.
    expect(spots[0]!.y).toBeLessThan(0);
    expect(spots[2]!.y).toBeGreaterThan(0);
  });

  it("mirrors them right to left", () => {
    const spots = outerSpots(Math.PI, [3], true);
    expect(spots[0]!.y).toBeLessThan(0);
    expect(spots[2]!.y).toBeGreaterThan(0);
  });

  it("parts two groups by a gap wider than between neighbours, none overlapping", () => {
    const spots = outerSpots(-Math.PI / 2, [4, 4]);
    expect(spots).toHaveLength(8);
    const gap = (i: number) => Math.hypot(spots[i]!.x - spots[i + 1]!.x, spots[i]!.y - spots[i + 1]!.y);
    expect(gap(0)).toBeGreaterThanOrEqual(44);
    expect(gap(3)).toBeGreaterThan(gap(0) + 10);
  });
});

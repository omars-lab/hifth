import { afterEach, describe, expect, it } from "vitest";
import {
  PEN_FLOAT_KEY,
  PEN_HOME_KEY,
  rememberPenFloat,
  rememberPenHome,
  savedPenFloat,
  savedPenHome,
  sideFits,
  snapToEdge,
} from "./pen-home";

describe("where the pens sit, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("is today's strip above the page when nobody chose, and keeps the choice made", () => {
    expect(savedPenHome()).toBe("strip");
    for (const home of ["float", "bottom", "side", "strip"] as const) {
      rememberPenHome(home);
      expect(localStorage.getItem(PEN_HOME_KEY)).toBe(home);
      expect(savedPenHome()).toBe(home);
    }
  });

  it("a value it does not know falls back to the strip", () => {
    localStorage.setItem(PEN_HOME_KEY, "nonsense");
    expect(savedPenHome()).toBe("strip");
  });
});

describe("where a dragged palette lands", () => {
  const screen = { width: 1000, height: 800 };

  it("goes to the edge nearest where it was let go", () => {
    expect(snapToEdge({ x: 500, y: 790 }, screen).edge).toBe("bottom");
    expect(snapToEdge({ x: 500, y: 10 }, screen).edge).toBe("top");
    expect(snapToEdge({ x: 15, y: 300 }, screen).edge).toBe("left");
    expect(snapToEdge({ x: 980, y: 500 }, screen).edge).toBe("right");
  });

  it("keeps how far along that edge it was, as a share of the edge", () => {
    expect(snapToEdge({ x: 250, y: 790 }, screen).along).toBeCloseTo(0.25);
    expect(snapToEdge({ x: 980, y: 200 }, screen).along).toBeCloseTo(0.25);
  });

  it("never runs off the end of an edge", () => {
    // Let go past the corner, outside the window: still on the bottom edge.
    expect(snapToEdge({ x: -40, y: 900 }, screen)).toEqual({ edge: "bottom", along: 0 });
    expect(snapToEdge({ x: 1200, y: 900 }, screen)).toEqual({ edge: "bottom", along: 1 });
  });

  it("starts at the middle of the bottom, and keeps where it was left", () => {
    localStorage.clear();
    expect(savedPenFloat()).toEqual({ edge: "bottom", along: 0.5 });
    rememberPenFloat({ edge: "left", along: 0.3 });
    expect(JSON.parse(localStorage.getItem(PEN_FLOAT_KEY)!)).toEqual({ edge: "left", along: 0.3 });
    expect(savedPenFloat()).toEqual({ edge: "left", along: 0.3 });
    localStorage.setItem(PEN_FLOAT_KEY, '{"edge":"under","along":7}');
    expect(savedPenFloat()).toEqual({ edge: "bottom", along: 0.5 });
    localStorage.clear();
  });
});

describe("whether the side has room for the pens", () => {
  it("fits in the margin beside an open book held sideways", () => {
    // An iPad held sideways: a 1180 wide stage, two pages of 333.
    expect(sideFits(1180, 666, 56)).toBe(true);
  });

  it("does not fit when the book fills the width, so the pens go to the bottom row", () => {
    expect(sideFits(1100, 990, 56)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { besideTip, pencilAction, pencilGesture, swapTool } from "./pencil";

/**
 * What the Apple Pencil's double-tap and squeeze do in Hifth (docs/PLAN.md, 96;
 * docs/design/pencil-gestures.md, ①, option B). The iPad app hears the gesture
 * and passes it on with the reader's own pencil setting; these pin how the
 * page reads that setting, so every one Apple offers has a stated answer.
 */
describe("what each of the reader's pencil settings does", () => {
  it.each([
    ["eraser", "previous"],
    ["previous", "previous"],
    ["palette", "palette"],
    ["colours", "pens"],
    ["ink", "pens"],
    ["ignore", "none"],
    ["shortcut", "none"],
    ["unknown", "none"],
    ["", "none"],
  ] as const)("%s → %s", (pref, action) => {
    expect(pencilAction(pref)).toBe(action);
  });
});

describe("what the page accepts from the app", () => {
  it("takes a double-tap or squeeze, with or without where the tip was", () => {
    expect(pencilGesture({ kind: "squeeze", pref: "palette", x: 300, y: 200 })).toEqual({ kind: "squeeze", pref: "palette", at: { x: 300, y: 200 } });
    expect(pencilGesture({ kind: "doubleTap", pref: "eraser" })).toEqual({ kind: "doubleTap", pref: "eraser", at: null });
  });

  it("drops a tip that is not two numbers, and keeps the gesture", () => {
    expect(pencilGesture({ kind: "doubleTap", pref: "eraser", x: 3 })?.at).toBeNull();
    expect(pencilGesture({ kind: "doubleTap", pref: "eraser", x: "3", y: 4 })?.at).toBeNull();
    expect(pencilGesture({ kind: "doubleTap", pref: "eraser", x: Number.NaN, y: 4 })?.at).toBeNull();
  });

  it("refuses anything else", () => {
    expect(pencilGesture(null)).toBeNull();
    expect(pencilGesture("squeeze")).toBeNull();
    expect(pencilGesture({ kind: "hover", pref: "palette" })).toBeNull();
    expect(pencilGesture({ kind: "squeeze" })).toBeNull();
  });
});

describe("a double-tap swaps the pen in hand", () => {
  it("from plain selecting, picks up the last tool used", () => {
    expect(swapTool("select", "mistake")).toBe("mistake");
  });

  it("with a tool in hand, puts it down", () => {
    expect(swapTool("highlight", "highlight")).toBe("select");
    expect(swapTool("mistake", "highlight")).toBe("select");
  });

  it("with no tool used yet, has nothing to swap to", () => {
    expect(swapTool("select", null)).toBeNull();
  });
});

describe("where the pens open beside the tip", () => {
  const view = { w: 1180, h: 820 };
  const size = { w: 400, h: 60 };
  const covers = (p: { left: number; top: number }, tip: { x: number; y: number }) =>
    tip.x >= p.left && tip.x <= p.left + size.w && tip.y >= p.top && tip.y <= p.top + size.h;
  const inside = (p: { left: number; top: number }, v = view) =>
    p.left >= 0 && p.top >= 0 && p.left + size.w <= v.w && p.top + size.h <= v.h;

  it("to the tip's right where there is room", () => {
    const p = besideTip({ x: 100, y: 300 }, size, view);
    expect(p.left).toBeGreaterThan(100);
    expect(covers(p, { x: 100, y: 300 })).toBe(false);
  });

  it("to its left near the right edge", () => {
    const p = besideTip({ x: 1100, y: 300 }, size, view);
    expect(p.left + size.w).toBeLessThan(1100);
    expect(inside(p)).toBe(true);
  });

  it("below or above it when neither side has room, never over it", () => {
    const narrow = { w: 600, h: 1000 };
    for (const tip of [{ x: 300, y: 200 }, { x: 300, y: 980 }]) {
      const p = besideTip(tip, size, narrow);
      expect(covers(p, tip)).toBe(false);
      expect(inside(p, narrow)).toBe(true);
    }
  });

  it("kept inside the window at its corners", () => {
    for (const tip of [{ x: 0, y: 0 }, { x: 1180, y: 820 }, { x: 0, y: 820 }]) expect(inside(besideTip(tip, size, view))).toBe(true);
  });
});

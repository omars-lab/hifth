// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FingerCount, spreadScale } from "./fingers.js";

type Kind = "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
const touch = (type: Kind, pointerId: number, clientX = 0, clientY = 0, pointerType = "touch") => ({
  type,
  pointerId,
  pointerType,
  clientX,
  clientY,
  target: null,
});

// On the open book each page is its own surface, so a pinch with one finger on
// each page reaches each page as a lone finger. Only something that sees the
// whole glass can tell those two lone fingers are one pinch.
describe("FingerCount", () => {
  it("one finger alone is not a crowd", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1));
    expect(glass.crowded).toBe(false);
    glass.see(touch("pointerup", 1));
    expect(glass.crowded).toBe(false);
  });

  it("a second finger makes the stroke a crowd until the next stroke starts", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1));
    glass.see(touch("pointerdown", 2));
    expect(glass.crowded).toBe(true);
    // Still a crowd while the fingers lift, in either order: the page that
    // hears its own finger lift last must still know it was half a pinch.
    glass.see(touch("pointerup", 2));
    expect(glass.crowded).toBe(true);
    glass.see(touch("pointerup", 1));
    expect(glass.crowded).toBe(true);
    glass.see(touch("pointerdown", 3));
    expect(glass.crowded).toBe(false);
  });

  it("a cancelled finger leaves the glass like a lifted one", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1));
    glass.see(touch("pointercancel", 1));
    expect(glass.down.size).toBe(0);
  });

  it("a mouse is not a finger", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1));
    glass.see(touch("pointerdown", 9, 0, 0, "mouse"));
    expect(glass.crowded).toBe(false);
    expect(glass.down.size).toBe(1);
  });

  it("a mouse press after a pinch starts a fresh stroke", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1));
    glass.see(touch("pointerdown", 2));
    glass.see(touch("pointerup", 1));
    glass.see(touch("pointerup", 2));
    glass.see(touch("pointerdown", 9, 0, 0, "mouse"));
    expect(glass.crowded).toBe(false);
  });

  it("follows each finger where it moves", () => {
    const glass = new FingerCount();
    glass.see(touch("pointerdown", 1, 10, 20));
    glass.see(touch("pointermove", 1, 30, 40));
    expect(glass.down.get(1)).toMatchObject({ x: 30, y: 40 });
  });

  it("listens on the window while anyone is watching, and stops after the last", () => {
    const glass = new FingerCount();
    const fire = (type: Kind, id: number) =>
      window.dispatchEvent(Object.assign(new Event(type), { pointerId: id, pointerType: "touch", clientX: 0, clientY: 0 }));
    const a = glass.watch(window);
    const b = glass.watch(window);
    fire("pointerdown", 1);
    fire("pointerdown", 2);
    expect(glass.crowded).toBe(true);
    a();
    fire("pointerdown", 3);
    expect(glass.down.size).toBe(3);
    b();
    fire("pointerdown", 4);
    expect(glass.down.size).toBe(3);
  });
});

describe("spreadScale", () => {
  it("is how much further apart two fingers are than where they began", () => {
    const start = [{ x: 100, y: 0 }, { x: 200, y: 0 }] as const;
    expect(spreadScale(start, [{ x: 50, y: 0 }, { x: 250, y: 0 }])).toBeCloseTo(2);
    expect(spreadScale(start, [{ x: 125, y: 0 }, { x: 175, y: 0 }])).toBeCloseTo(0.5);
  });

  it("is no change when the fingers began on the same spot", () => {
    expect(spreadScale([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 90, y: 0 }])).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { pinchFactor } from "./pinch-wheel";

const step = (deltaY: number, more: Partial<{ ctrlKey: boolean; metaKey: boolean; deltaMode: number }> = {}) =>
  pinchFactor({ ctrlKey: true, metaKey: false, deltaMode: 0, deltaY, ...more });

describe("telling a trackpad pinch from a ctrl+mouse wheel", () => {
  it("spreading the fingers magnifies, pinching them shrinks", () => {
    expect(step(-2.5)).toBeGreaterThan(1);
    expect(step(3)).toBeLessThan(1);
  });

  it("a mouse wheel notch with ctrl held does nothing", () => {
    expect(step(-100)).toBeNull(); // Chrome, Safari
    expect(step(-120)).toBeNull();
    expect(step(-3, { deltaMode: 1 })).toBeNull(); // Firefox counts in lines
  });

  it("a wheel with no ctrl, or with the command key, is not a pinch", () => {
    expect(step(-2, { ctrlKey: false })).toBeNull();
    expect(step(-2, { metaKey: true })).toBeNull();
    expect(step(0)).toBeNull();
  });

  it("one pinch out and the same pinch back lands where it started", () => {
    let z = 1;
    for (let i = 0; i < 20; i += 1) z *= step(-2)!;
    for (let i = 0; i < 20; i += 1) z *= step(2)!;
    expect(z).toBeCloseTo(1, 10);
  });
});

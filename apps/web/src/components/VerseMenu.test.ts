import { describe, expect, it } from "vitest";
import { placeMenu } from "./VerseMenu";

// The small menu of docs/design/verse-tap-and-hold.md option C must stand clear
// of the verse it is about: the note's own warning was that it could cover it.
describe("placeMenu", () => {
  const view = { width: 400, height: 800 };
  const menu = { width: 240, height: 50 };

  it("goes above the verse when there is room", () => {
    const at = placeMenu({ left: 50, right: 350, top: 300, bottom: 360 }, menu, view);
    expect(at.top + menu.height).toBeLessThanOrEqual(300);
  });

  it("goes below a verse at the top of the screen", () => {
    const at = placeMenu({ left: 50, right: 350, top: 20, bottom: 80 }, menu, view);
    expect(at.top).toBeGreaterThanOrEqual(80);
  });

  it("stays inside the window left to right", () => {
    const at = placeMenu({ left: 360, right: 395, top: 300, bottom: 320 }, menu, view);
    expect(at.left + menu.width).toBeLessThanOrEqual(view.width);
    expect(at.left).toBeGreaterThanOrEqual(0);
  });
});

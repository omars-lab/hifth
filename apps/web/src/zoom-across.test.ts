import { afterEach, describe, expect, it } from "vitest";
import { ZOOM_ACROSS_KEY, bookShift, growFromX, rememberZoomAcross, savedZoomAcross } from "./zoom-across";

describe("where across the page the zoom buttons grow it from", () => {
  afterEach(() => localStorage.clear());

  it("keeps the line starts in sight when nobody chose, and keeps the choice made", () => {
    expect(savedZoomAcross()).toBe("starts");
    rememberZoomAcross("fold");
    expect(localStorage.getItem(ZOOM_ACROSS_KEY)).toBe("fold");
    expect(savedZoomAcross()).toBe("fold");
  });

  it("a value it does not know falls back to the line starts", () => {
    localStorage.setItem(ZOOM_ACROSS_KEY, "nonsense");
    expect(savedZoomAcross()).toBe("starts");
  });

  it("a page on its own grows from its right edge, or set to the fold, its middle", () => {
    const box = { left: 100, right: 400 };
    expect(growFromX("starts", box)).toBe(400);
    expect(growFromX("fold", box)).toBe(250);
  });

  it("the open book slides only as far as the right-hand page runs past the screen", () => {
    expect(bookShift("starts", 1239, 1194)).toBe(45);
    // Still on the screen: no slide.
    expect(bookShift("starts", 918, 1194)).toBe(0);
    // Set to grow from the fold: the page runs past, as it always did.
    expect(bookShift("fold", 1239, 1194)).toBe(0);
  });
});

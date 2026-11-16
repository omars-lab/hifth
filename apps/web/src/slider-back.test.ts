import { afterEach, describe, expect, it } from "vitest";
import { SLIDER_BACK_KEY, placeAfterMove, rememberSliderBack, savedSliderBack } from "./slider-back";

describe("the Back button beside the slider, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("is off when nobody chose, and keeps the choice made", () => {
    expect(savedSliderBack()).toBe("off");
    rememberSliderBack("on");
    expect(localStorage.getItem(SLIDER_BACK_KEY)).toBe("on");
    expect(savedSliderBack()).toBe("on");
  });

  it("a value it does not know falls back to off", () => {
    localStorage.setItem(SLIDER_BACK_KEY, "nonsense");
    expect(savedSliderBack()).toBe("off");
  });
});

describe("which page Back returns to", () => {
  it("a jump remembers the page the reader left", () => {
    expect(placeAfterMove(null, 45, 300)).toBe(45);
  });

  it("a page turn is not a jump: one page, or the two of an open book", () => {
    expect(placeAfterMove(null, 45, 46)).toBe(null);
    expect(placeAfterMove(null, 45, 47)).toBe(null);
    expect(placeAfterMove(null, 45, 43)).toBe(null);
  });

  it("a second jump does not lose the first place", () => {
    expect(placeAfterMove(45, 300, 500)).toBe(45);
  });

  it("turning pages while away keeps the place", () => {
    expect(placeAfterMove(45, 300, 301)).toBe(45);
  });

  it("arriving back on the place, by Back, a jump or a turn, leaves nowhere to go back to", () => {
    expect(placeAfterMove(45, 300, 45)).toBe(null);
    expect(placeAfterMove(45, 46, 45)).toBe(null);
  });

  it("a move that goes nowhere changes nothing", () => {
    expect(placeAfterMove(45, 300, 300)).toBe(45);
    expect(placeAfterMove(null, 300, 300)).toBe(null);
  });
});

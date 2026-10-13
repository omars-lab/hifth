import { afterEach, describe, expect, it } from "vitest";
import { UPRIGHT_AGAIN_KEY, rememberUprightAgain, savedUprightAgain, uprightAgainZoom } from "./upright-again";

describe("the size a page comes back at when the iPad is upright again", () => {
  afterEach(() => localStorage.clear());

  it("brings back the opening size when nobody chose, and keeps the choice made", () => {
    expect(savedUprightAgain()).toBe("opening");
    rememberUprightAgain("whole");
    expect(localStorage.getItem(UPRIGHT_AGAIN_KEY)).toBe("whole");
    expect(savedUprightAgain()).toBe("whole");
  });

  it("a value it does not know falls back to the opening size", () => {
    localStorage.setItem(UPRIGHT_AGAIN_KEY, "nonsense");
    expect(savedUprightAgain()).toBe("opening");
  });

  it("asks for the size the page opened at, only from the whole page", () => {
    expect(uprightAgainZoom(1, 1.55, "opening")).toBe(1.55);
    // The reader zoomed in while it was on its side: theirs stands.
    expect(uprightAgainZoom(2, 1.55, "opening")).toBeNull();
    // It opened whole, or nobody knows how it opened: nothing to bring back.
    expect(uprightAgainZoom(1, 1, "opening")).toBeNull();
    expect(uprightAgainZoom(1, null, "opening")).toBeNull();
    // Set to stay whole.
    expect(uprightAgainZoom(1, 1.55, "whole")).toBeNull();
  });
});

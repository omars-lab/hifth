import { afterEach, describe, expect, it } from "vitest";
import { OPENING_TEXT_KEY, rememberOpeningText, savedOpeningText } from "./opening-text";

describe("how the two opening pages lay out their text, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("large text when nobody chose, and keeps the choice made", () => {
    expect(savedOpeningText()).toBe("large");
    rememberOpeningText("even");
    expect(localStorage.getItem(OPENING_TEXT_KEY)).toBe("even");
    expect(savedOpeningText()).toBe("even");
    rememberOpeningText("large");
    expect(savedOpeningText()).toBe("large");
  });

  it("a value it does not know falls back to large text", () => {
    localStorage.setItem(OPENING_TEXT_KEY, "nonsense");
    expect(savedOpeningText()).toBe("large");
  });
});

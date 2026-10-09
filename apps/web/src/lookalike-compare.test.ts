import { afterEach, describe, expect, it } from "vitest";
import {
  LOOKALIKE_COMPARE_KEY,
  rememberLookalikeCompare,
  savedLookalikeCompare,
} from "./lookalike-compare";

describe("how two look-alikes that share words in several places are compared, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("every shared stretch marked when nobody chose, and keeps the choice made", () => {
    expect(savedLookalikeCompare()).toBe("every");
    rememberLookalikeCompare("plain");
    expect(localStorage.getItem(LOOKALIKE_COMPARE_KEY)).toBe("plain");
    expect(savedLookalikeCompare()).toBe("plain");
    rememberLookalikeCompare("every");
    expect(savedLookalikeCompare()).toBe("every");
  });

  it("a value it does not know falls back to every shared stretch marked", () => {
    localStorage.setItem(LOOKALIKE_COMPARE_KEY, "nonsense");
    expect(savedLookalikeCompare()).toBe("every");
  });
});

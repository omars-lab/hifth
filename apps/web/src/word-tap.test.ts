import { afterEach, describe, expect, it, vi } from "vitest";
import { WORD_TAPS, WORD_TAP_KEY, rememberWordTap, savedWordTap } from "./word-tap";

describe("what a second tap on a lit verse does, as the reader set it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("puts the verse out when nobody chose, and keeps the choice made", () => {
    expect(savedWordTap()).toBe("off");
    rememberWordTap("word");
    expect(localStorage.getItem(WORD_TAP_KEY)).toBe("word");
    expect(savedWordTap()).toBe("word");
    rememberWordTap("off");
    expect(savedWordTap()).toBe("off");
  });

  it("a value it does not know falls back to putting the verse out", () => {
    localStorage.setItem(WORD_TAP_KEY, "nonsense");
    expect(savedWordTap()).toBe("off");
  });

  it("a device that cannot remember gets today's way, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedWordTap()).toBe("off");
    expect(() => rememberWordTap("word")).not.toThrow();
  });

  it("lists today's way first in settings", () => {
    expect(WORD_TAPS).toEqual(["off", "word"]);
  });
});

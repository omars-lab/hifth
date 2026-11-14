import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MISTAKE_ASK, MISTAKE_ASK_KEY, rememberMistakeAsk, savedMistakeAsk } from "./mistake-ask";

describe("how the Mistake pen's question is laid out, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("shows everything at once when nobody chose, and keeps the choice made", () => {
    expect(DEFAULT_MISTAKE_ASK).toBe("list");
    expect(savedMistakeAsk()).toBe("list");
    rememberMistakeAsk("steps");
    expect(localStorage.getItem(MISTAKE_ASK_KEY)).toBe("steps");
    expect(savedMistakeAsk()).toBe("steps");
    rememberMistakeAsk("tabs");
    expect(savedMistakeAsk()).toBe("tabs");
  });

  it("a value it does not know falls back to the default", () => {
    localStorage.setItem(MISTAKE_ASK_KEY, "nonsense");
    expect(savedMistakeAsk()).toBe("list");
  });
});

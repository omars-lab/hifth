import { afterEach, describe, expect, it } from "vitest";
import { MISTAKE_TAP_KEY, rememberMistakeTap, savedMistakeTap } from "./mistake-tap";

describe("what a tap with the Mistake pen does, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("asks what went wrong when nobody chose, and keeps the choice made", () => {
    expect(savedMistakeTap()).toBe("ask");
    rememberMistakeTap("quiet");
    expect(localStorage.getItem(MISTAKE_TAP_KEY)).toBe("quiet");
    expect(savedMistakeTap()).toBe("quiet");
    rememberMistakeTap("ask");
    expect(savedMistakeTap()).toBe("ask");
  });

  it("a value it does not know falls back to asking", () => {
    localStorage.setItem(MISTAKE_TAP_KEY, "nonsense");
    expect(savedMistakeTap()).toBe("ask");
  });
});

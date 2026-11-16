import { afterEach, describe, expect, it } from "vitest";
import { READING_BARS_KEY, barsMayHide, rememberReadingBars, savedReadingBars } from "./reading-bars";

describe("whether the bars hide while reading, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("they stay when nobody chose, and the choice made is kept", () => {
    expect(savedReadingBars()).toBe("stay");
    rememberReadingBars("hide");
    expect(localStorage.getItem(READING_BARS_KEY)).toBe("hide");
    expect(savedReadingBars()).toBe("hide");
  });

  it("a value it does not know falls back to staying", () => {
    localStorage.setItem(READING_BARS_KEY, "nonsense");
    expect(savedReadingBars()).toBe("stay");
  });
});

describe("when the bars may leave", () => {
  const reading = { way: "hide", tool: "select", open: false, full: false, inBar: false } as const;

  it("while only reading, with the setting on", () => {
    expect(barsMayHide(reading)).toBe(true);
    expect(barsMayHide({ ...reading, tool: "read" })).toBe(true);
  });

  it("never with the setting off", () => {
    expect(barsMayHide({ ...reading, way: "stay" })).toBe(false);
  });

  it("never while a pen is in hand", () => {
    for (const tool of ["highlight", "mistake", "note", "bookmark", "sign", "word", "crop", "jump"]) {
      expect(barsMayHide({ ...reading, tool }), tool).toBe(false);
    }
  });

  it("never while a panel is open, the reader is in a bar, or full screen is already on", () => {
    expect(barsMayHide({ ...reading, open: true })).toBe(false);
    expect(barsMayHide({ ...reading, inBar: true })).toBe(false);
    expect(barsMayHide({ ...reading, full: true })).toBe(false);
  });
});

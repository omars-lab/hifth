import { afterEach, describe, expect, it } from "vitest";
import {
  NOTE_LEAD_KEY,
  NOTE_SIDEWAYS_KEY,
  rememberNoteLead,
  rememberNoteSideways,
  savedNoteLead,
  savedNoteSideways,
} from "./phone-note";

describe("what a note on a phone leads with, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("two lines of the translation when nobody chose, and keeps the choice made", () => {
    expect(savedNoteLead()).toBe("clamp");
    rememberNoteLead("whole");
    expect(localStorage.getItem(NOTE_LEAD_KEY)).toBe("whole");
    expect(savedNoteLead()).toBe("whole");
    rememberNoteLead("tall");
    expect(savedNoteLead()).toBe("tall");
  });

  it("a value it does not know falls back to two lines", () => {
    localStorage.setItem(NOTE_LEAD_KEY, "nonsense");
    expect(savedNoteLead()).toBe("clamp");
  });
});

describe("where a note stands on a phone on its side, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("beside the page when nobody chose, and keeps the choice made", () => {
    expect(savedNoteSideways()).toBe("beside");
    rememberNoteSideways("foot");
    expect(localStorage.getItem(NOTE_SIDEWAYS_KEY)).toBe("foot");
    expect(savedNoteSideways()).toBe("foot");
  });

  it("a value it does not know falls back to beside the page", () => {
    localStorage.setItem(NOTE_SIDEWAYS_KEY, "nonsense");
    expect(savedNoteSideways()).toBe("beside");
  });
});

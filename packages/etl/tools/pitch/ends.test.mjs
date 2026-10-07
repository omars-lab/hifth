import { describe, expect, it } from "vitest";
import { endPrint, restoreLastStop } from "./ends.mjs";

// Made-up notes: the shape of the capture, none of its words.
const NOTE = "The caravan rested by the well, see 4:12c";

describe("restoreLastStop", () => {
  it("puts back the stop the page prints after a listed note's last words", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE), page: "chapter-9_p01" }];
    expect(restoreLastStop(["First paragraph.", NOTE], ends)).toEqual({
      blocks: ["First paragraph.", `${NOTE}.`],
      used: new Set([0]),
    });
  });

  it("puts back the page's own stop when it is not a full stop", () => {
    const ends = [{ verse: "9:9", print: endPrint("Did they rest"), stop: "?" }];
    expect(restoreLastStop(["Did they rest"], ends).blocks).toEqual(["Did they rest?"]);
  });

  it("finds the note under whichever verse holds it, so a shared note is mended under each", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE) }];
    expect(restoreLastStop([NOTE], ends).blocks).toEqual([`${NOTE}.`]);
  });

  it("leaves a note that is not listed, or that already ends in a stop", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE) }];
    expect(restoreLastStop(["The caravan rested by the", "well"], ends)).toEqual({
      blocks: ["The caravan rested by the", "well"],
      used: new Set(),
    });
    expect(restoreLastStop(["The caravan rested."], ends).used.size).toBe(0);
  });

  it("does not read a page's trailing space as part of the last words", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE) }];
    expect(restoreLastStop([`${NOTE} `], ends).blocks).toEqual([`${NOTE}.`]);
  });
});

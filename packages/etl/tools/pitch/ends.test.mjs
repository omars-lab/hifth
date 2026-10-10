import { describe, expect, it } from "vitest";
import { endPrint, endUnread, restoreCutTail, restoreLastStop } from "./ends.mjs";

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

  it("puts back the stop the page prints after a closing bracket", () => {
    const shut = "The caravan rested by the well (see 4:12c)";
    const ends = [{ verse: "9:9", print: endPrint(shut) }, { verse: "9:10", print: endPrint("rested [at noon]") }];
    expect(restoreLastStop([shut], ends).blocks).toEqual([`${shut}.`]);
    expect(restoreLastStop(["rested [at noon]"], ends).blocks).toEqual(["rested [at noon]."]);
  });

  it("leaves a bracket whose sentence already stopped inside it", () => {
    const inside = "(The caravan rested.)";
    expect(restoreLastStop([inside], [{ verse: "9:9", print: endPrint(inside) }]).used.size).toBe(0);
  });

  it("does not read a page's trailing space as part of the last words", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE) }];
    expect(restoreLastStop([`${NOTE} `], ends).blocks).toEqual([`${NOTE}.`]);
  });
});

describe("endUnread", () => {
  // An ending read off the page and found to print no stop is listed with an
  // empty stop, so the listing stops asking for it (four notes, 2026-10-10).
  it("asks for an open ending nobody has read, and not for one the page settled", () => {
    expect(endUnread(NOTE, [])).toBe(true);
    expect(endUnread(NOTE, [{ verse: "9:9", print: endPrint(NOTE), stop: "", page: "page_0009" }])).toBe(false);
    expect(endUnread(`${NOTE}.`, [])).toBe(false);
  });

  it("leaves a note the page prints with no stop just as it is", () => {
    const ends = [{ verse: "9:9", print: endPrint(NOTE), stop: "", page: "page_0009" }];
    expect(restoreLastStop([NOTE], ends)).toEqual({ blocks: [NOTE], used: new Set([0]) });
  });
});

describe("restoreCutTail", () => {
  const CUT = "The caravan rested by the well and";
  it("finishes a note the capture cut short with the rest read off the page", () => {
    const tails = [{ print: endPrint(CUT), tail: " gave thanks at noon.", page: "page_0001" }];
    expect(restoreCutTail(["First paragraph.", CUT], tails)).toEqual({
      blocks: ["First paragraph.", `${CUT} gave thanks at noon.`],
      used: new Set([0]),
    });
  });

  it("adds the tail exactly as read, so one that carries on a word or a reference takes no space", () => {
    const tails = [{ print: endPrint("see 4:12–1"), tail: "4; 5:3)." }];
    expect(restoreCutTail(["see 4:12–1"], tails).blocks).toEqual(["see 4:12–14; 5:3)."]);
  });

  it("leaves a note that is not listed", () => {
    const tails = [{ print: endPrint(CUT), tail: "gave thanks." }];
    expect(restoreCutTail(["Another note"], tails)).toEqual({ blocks: ["Another note"], used: new Set() });
  });
});

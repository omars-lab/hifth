import { describe, expect, it } from "vitest";
import { orphanPrint, rescueOrphans } from "./orphans.mjs";

// Made-up set-aside blocks: the shape of the capture, none of its words.
const LOST = "8:12–1 1–2 The caravan rested by the well, see 4:12c.";
const ORPHANS = [
  { block: "3", reason: "verse_dup:1", text: "1 The caravan" },
  { block: "6", reason: "unkeyed", text: LOST },
];

describe("rescueOrphans", () => {
  it("puts a listed set-aside note back under every verse its label covers, from the label on", () => {
    const list = [{ surah: 9, print: orphanPrint(LOST), from: 1, to: 2, page: "page_0001" }];
    const { notes, used } = rescueOrphans(9, ORPHANS, list);
    const note = "1–2 The caravan rested by the well, see 4:12c.";
    expect(notes.get(1)).toEqual([note]);
    expect(notes.get(2)).toEqual([note]);
    expect(notes.has(3)).toBe(false);
    expect(used).toEqual(new Set([0]));
  });

  it("finds a single verse's label too", () => {
    const one = "4:1 3 The well ran dry.";
    const list = [{ surah: 9, print: orphanPrint(one), from: 3, to: 3 }];
    expect(rescueOrphans(9, [{ block: "1", reason: "unkeyed", text: one }], list).notes.get(3)).toEqual([
      "3 The well ran dry.",
    ]);
  });

  it("leaves blocks that are not listed, and rows for other surahs", () => {
    const list = [{ surah: 10, print: orphanPrint(LOST), from: 1, to: 2 }];
    const { notes, used } = rescueOrphans(9, ORPHANS, list);
    expect(notes.size).toBe(0);
    expect(used.size).toBe(0);
  });

  it("refuses a listed block whose label is not in it, rather than guess where the note starts", () => {
    const list = [{ surah: 9, print: orphanPrint(LOST), from: 5, to: 6 }];
    expect(() => rescueOrphans(9, ORPHANS, list)).toThrow(/label/);
  });
});

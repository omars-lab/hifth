import { describe, expect, it } from "vitest";
import { letterSurah } from "./lettering.mjs";

// Made-up notes: the shape of the commentary, none of its words.
const verses = () => ({
  "9:1": { translation: "The rain came.", commentary: ['1 The well "of the townl ran dry, at 4:2-3.'] },
  "9:2": { translation: "It passed.", commentary: ["2 The traveller rested."] },
});

describe("letterSurah", () => {
  it("sets the book's quotes before the misreads, so a misread row is written as a reader sees the text", () => {
    const v = verses();
    const used = letterSurah(9, v, { misreads: [{ verse: "9:1", was: "“of the townl", is: "“of the town”" }], italics: [] });
    expect(v["9:1"].commentary[0]).toBe("1 The well “of the town” ran dry, at 4:2–3.");
    expect(used.misreads).toEqual(new Set([0]));
  });

  it("lays the slant on last, over the mended and curled text", () => {
    const v = verses();
    const used = letterSurah(9, v, {
      misreads: [{ verse: "9:1", was: "“of the townl", is: "“of the town”" }],
      italics: [{ verse: "9:1", at: "“of the _town_”" }],
    });
    expect(v["9:1"].commentary[0]).toBe("1 The well “of the town” ran dry, at 4:2–3.");
    expect(used.italics).toEqual(new Set([0]));
  });
});

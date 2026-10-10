import { describe, expect, it } from "vitest";
import { SLANT_END, SLANT_START, slantSurah } from "./italics.mjs";

// Made-up notes: the shape of the commentary, none of its words.
const S = SLANT_START;
const E = SLANT_END;
const verses = () => ({
  "9:1": { commentary: ["1 The word qarya means a town; the qarya here is by the sea.", "The traveller (cf. 4:2)."] },
  "9:2": { commentary: ["2–3 The well . . . ran dry, as in the hadith."] },
  "9:3": { commentary: ["2–3 The well . . . ran dry, as in the hadith."] },
});

describe("slantSurah", () => {
  it("slants the words a row marks, in the one place its context names", () => {
    const v = verses();
    const used = slantSurah(9, v, [{ verse: "9:1", at: "word _qarya_ means" }]);
    expect(v["9:1"].commentary[0]).toBe(`1 The word ${S}qarya${E} means a town; the qarya here is by the sea.`);
    expect(used).toEqual(new Set([0]));
  });

  it("slants every place a whole-word row finds, across the verse's notes", () => {
    const v = verses();
    slantSurah(9, v, [{ verse: "9:1", at: "_qarya_", every: true }]);
    expect(v["9:1"].commentary[0]).toBe(`1 The word ${S}qarya${E} means a town; the ${S}qarya${E} here is by the sea.`);
  });

  it("finds a row that runs on across a paragraph break the print puts back", () => {
    const v = verses();
    v["9:1"].commentary = ["1 The elder said, the well is deep.", "Some say it is dry."];
    slantSurah(9, v, [{ verse: "9:1", at: "said, _the well is deep_. Some" }]);
    expect(v["9:1"].commentary).toEqual([`1 The elder said, ${S}the well is deep${E}.`, "Some say it is dry."]);
    // A run that itself crosses the break is slanted on both sides of it.
    v["9:1"].commentary = ["1 The elder said, the well is deep.", "Some say it is dry."];
    slantSurah(9, v, [{ verse: "9:1", at: "said, _the well is deep. Some_ say" }]);
    expect(v["9:1"].commentary).toEqual([`1 The elder said, ${S}the well is deep.${E}`, `${S}Some${E} say it is dry.`]);
  });

  it("matches a space in the row against the capture's no-break spaces", () => {
    const v = verses();
    v["9:2"].commentary = ["2 The well .\u00a0.\u00a0. ran dry."];
    slantSurah(9, v, [{ verse: "9:2", at: "_The well . . . ran_ dry" }]);
    expect(v["9:2"].commentary[0]).toBe(`2 ${S}The well .\u00a0.\u00a0. ran${E} dry.`);
  });

  it("carries a slanted shared note to every verse it is filed under", () => {
    const v = verses();
    slantSurah(9, v, [{ verse: "9:2", at: "the _hadith_" }]);
    const slanted = `2–3 The well . . . ran dry, as in the ${S}hadith${E}.`;
    expect(v["9:2"].commentary[0]).toBe(slanted);
    expect(v["9:3"].commentary[0]).toBe(slanted);
  });

  it("lets a row's context end on a mark that a word follows", () => {
    const v = verses();
    slantSurah(9, v, [{ verse: "9:1", at: "_The traveller_ (" }]);
    expect(v["9:1"].commentary[1]).toBe(`${S}The traveller${E} (cf. 4:2).`);
  });

  it("does not slant a word inside a longer one, or in another case", () => {
    const v = verses();
    v["9:1"].commentary = ["1 The Qarya and the qaryas."];
    expect(() => slantSurah(9, v, [{ verse: "9:1", at: "_qarya_", every: true }])).toThrow(/finds nothing/);
  });

  it("refuses a row whose context is not in the verse's notes, or is there twice", () => {
    expect(() => slantSurah(9, verses(), [{ verse: "9:1", at: "the _river_" }])).toThrow(/finds nothing/);
    expect(() => slantSurah(9, verses(), [{ verse: "9:1", at: "_qarya_" }])).toThrow(/2 places/);
  });

  it("refuses a row with no slanted words in it", () => {
    expect(() => slantSurah(9, verses(), [{ verse: "9:1", at: "word qarya" }])).toThrow(/no slanted/);
  });

  it("leaves rows for other surahs alone", () => {
    const v = verses();
    expect(slantSurah(9, v, [{ verse: "10:1", at: "_qarya_" }])).toEqual(new Set());
    expect(v).toEqual(verses());
  });
});

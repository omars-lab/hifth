import { describe, expect, it } from "vitest";
import { mendSurah } from "./misreads.mjs";

// Made-up notes: the shape of the commentary, none of its words.
const verses = () => ({
  "9:1": { commentary: ["1 The well [of the townl ran dry, as at 4:2.", "The traveller (cf. 4:2)."] },
  "9:2": { commentary: ["2–3 The rain [came/ late."] },
  "9:3": { commentary: ["2–3 The rain [came/ late."] },
});

describe("mendSurah", () => {
  it("puts back the mark the page shows, in the one place the row names", () => {
    const v = verses();
    const used = mendSurah(9, v, [{ verse: "9:1", was: "[of the townl ran", is: "[of the town] ran" }]);
    expect(v["9:1"].commentary[0]).toBe("1 The well [of the town] ran dry, as at 4:2.");
    expect(used).toEqual(new Set([0]));
  });

  it("mends a shared note under every verse it is filed under", () => {
    const v = verses();
    mendSurah(9, v, [{ verse: "9:2", was: "[came/", is: "[came]" }]);
    expect(v["9:2"].commentary[0]).toBe("2–3 The rain [came] late.");
    expect(v["9:3"].commentary[0]).toBe("2–3 The rain [came] late.");
  });

  it("leaves the other surahs' rows for their own surah", () => {
    const v = verses();
    const used = mendSurah(9, v, [{ verse: "10:1", was: "x", is: "y" }]);
    expect(used).toEqual(new Set());
  });

  it("refuses a row that finds nothing, or finds two places", () => {
    expect(() => mendSurah(9, verses(), [{ verse: "9:1", was: "[of the city]", is: "x" }])).toThrow(/finds nothing/);
    expect(() => mendSurah(9, verses(), [{ verse: "9:1", was: "4:2", is: "4:3" }])).toThrow(/2 places/);
  });

  it("refuses a row that changes nothing", () => {
    expect(() => mendSurah(9, verses(), [{ verse: "9:1", was: "ran", is: "ran" }])).toThrow(/changes nothing/);
  });
});

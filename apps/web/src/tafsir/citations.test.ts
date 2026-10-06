import { describe, expect, it } from "vitest";
import { splitCitations } from "./citations";

const cited = (text: string) =>
  splitCitations(text).flatMap((part) => (typeof part === "string" ? [] : [part]));

describe("verse citations in the commentary prose", () => {
  it("finds a plain citation, a range, and a note-lettered one", () => {
    expect(cited("see 1:6c, and 5:15–16; cf. 2:255.")).toEqual([
      { text: "1:6c", surah: 1, ayah: 6 },
      { text: "5:15–16", surah: 5, ayah: 15 },
      { text: "2:255", surah: 2, ayah: 255 },
    ]);
  });

  it("keeps every word of the prose, in order, around the links", () => {
    const parts = splitCitations("See also 5:15–16: There has come");
    expect(parts.map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(
      "See also 5:15–16: There has come",
    );
  });

  it("leaves a number that is not a verse as text", () => {
    // No surah 0 or 115; al-Fātiḥah has no eighth verse.
    expect(cited("at 0:3, 115:2 and 1:8")).toEqual([]);
  });

  it("reads a bare number after a citation as another verse of the same surah", () => {
    expect(cited("see 2:42, 140, 146–47, and 159c; 3:71, 187; 6:91.")).toEqual([
      { text: "2:42", surah: 2, ayah: 42 },
      { text: "140", surah: 2, ayah: 140 },
      { text: "146–47", surah: 2, ayah: 146 },
      { text: "159c", surah: 2, ayah: 159 },
      { text: "3:71", surah: 3, ayah: 71 },
      { text: "187", surah: 3, ayah: 187 },
      { text: "6:91", surah: 6, ayah: 91 },
    ]);
  });

  it("does not take a number that is not part of the list", () => {
    // A count after the list, a number beyond the surah, and a list broken by prose.
    expect(cited("see 1:5, 40 days later")).toEqual([{ text: "1:5", surah: 1, ayah: 5 }]);
    expect(cited("see 1:5, 12")).toEqual([{ text: "1:5", surah: 1, ayah: 5 }]);
    expect(cited("see 2:42. In 140 years")).toEqual([{ text: "2:42", surah: 2, ayah: 42 }]);
  });

  it("keeps every word of a list, in order", () => {
    const text = "see 2:42, 140, and 146; then";
    expect(splitCitations(text).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
  });

  // The book names a verse of the surah it is in as "v. 5" or "vv. 9–26",
  // without the surah, so these need to know which surah the prose is about.
  describe("a verse of the same surah, named without it", () => {
    const here = (text: string, surah: number) =>
      splitCitations(text, surah).flatMap((part) => (typeof part === "string" ? [] : [part]));

    it("links v. and vv. to that verse of the surah the prose is in", () => {
      expect(here("as at v. 5, and the story (vv. 9–26) and v. 3b", 18)).toEqual([
        { text: "v. 5", surah: 18, ayah: 5 },
        { text: "vv. 9–26", surah: 18, ayah: 9 },
        { text: "v. 3b", surah: 18, ayah: 3 },
      ]);
    });

    it("carries a list on, as it does after a full citation", () => {
      expect(here("see vv. 9, 13, and 60–82; later", 18)).toEqual([
        { text: "vv. 9", surah: 18, ayah: 9 },
        { text: "13", surah: 18, ayah: 13 },
        { text: "60–82", surah: 18, ayah: 60 },
      ]);
    });

    it("leaves a number beyond the surah, and v. with no surah to go on, as text", () => {
      // Al-Fātiḥah has seven verses.
      expect(here("see v. 9", 1)).toEqual([]);
      expect(cited("see v. 9")).toEqual([]);
    });

    it("still reads a full citation as its own surah", () => {
      expect(here("v. 2, unlike 2:255", 18)).toEqual([
        { text: "v. 2", surah: 18, ayah: 2 },
        { text: "2:255", surah: 2, ayah: 255 },
      ]);
    });

    it("keeps every word, in order", () => {
      const text = "the tale (vv. 60–82) and v. 109, 110; then";
      expect(splitCitations(text, 18).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
    });
  });

  it("returns the text whole when nothing is cited", () => {
    expect(splitCitations("no verses here")).toEqual(["no verses here"]);
  });
});

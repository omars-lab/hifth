import { describe, expect, it } from "vitest";
import { otherBookCitations, splitCitations } from "./citations.js";

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

  it("carries a list on before a colon, a bracket, or 'of this surah'", () => {
    const head = { text: "2:10", surah: 2, ayah: 10 };
    const twenty = { text: "20", surah: 2, ayah: 20 };
    expect(cited("as 2:10, 20 of this surah")).toEqual([head, twenty]);
    expect(cited("as 2:10, 20: the same")).toEqual([head, twenty]);
    expect(cited("as 2:10, 20 (and later)")).toEqual([head, twenty]);
  });

  it("still leaves a number that starts the next thing as text", () => {
    const head = { text: "2:10", surah: 2, ayah: 10 };
    // A semicolon parts surahs, so a bare number after one may be a slip for
    // another surah: leave it, rather than link the wrong verse.
    expect(cited("see 2:10; 20; 30.")).toEqual([head]);
    // A book of another scripture, and a count.
    expect(cited("see 2:10; 1 Kings")).toEqual([head]);
    expect(cited("see 2:10, 40 days")).toEqual([head]);
    // A full citation written with a space after its colon.
    expect(cited("see 2:10, 23: 24")).toEqual([head]);
  });

  it("keeps every word of a list, in order", () => {
    const text = "see 2:42, 140, and 146; then";
    expect(splitCitations(text).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
  });

  // The book names a verse of the surah it is in as "v. 5" or "vv. 4–7",
  // without the surah, so these need to know which surah the prose is about.
  describe("a verse of the same surah, named without it", () => {
    const here = (text: string, surah: number) =>
      splitCitations(text, surah).flatMap((part) => (typeof part === "string" ? [] : [part]));

    it("links v. and vv. to that verse of the surah the prose is in", () => {
      expect(here("as at v. 6, and the story (vv. 4–7) and v. 2b", 44)).toEqual([
        { text: "v. 6", surah: 44, ayah: 6 },
        { text: "vv. 4–7", surah: 44, ayah: 4 },
        { text: "v. 2b", surah: 44, ayah: 2 },
      ]);
    });

    it("carries a list on, as it does after a full citation", () => {
      expect(here("see vv. 11, 14, and 30–35; later", 44)).toEqual([
        { text: "vv. 11", surah: 44, ayah: 11 },
        { text: "14", surah: 44, ayah: 14 },
        { text: "30–35", surah: 44, ayah: 30 },
      ]);
    });

    it("leaves a number beyond the surah, and v. with no surah to go on, as text", () => {
      // Al-Fātiḥah has seven verses.
      expect(here("see v. 9", 1)).toEqual([]);
      expect(cited("see v. 9")).toEqual([]);
    });

    it("reads v. before a full citation as that citation, not a verse of this surah", () => {
      // The book links only the chapter and verse; "v. 4" would open the wrong verse.
      expect(here("see v. 4:86 and vv. 12:30–31", 4)).toEqual([
        { text: "4:86", surah: 4, ayah: 86 },
        { text: "12:30–31", surah: 12, ayah: 30 },
      ]);
    });

    it("still reads a full citation as its own surah", () => {
      expect(here("v. 3, unlike 9:4", 44)).toEqual([
        { text: "v. 3", surah: 44, ayah: 3 },
        { text: "9:4", surah: 9, ayah: 4 },
      ]);
    });

    it("keeps every word, in order", () => {
      const text = "the tale (vv. 30–35) and v. 50, 51; then";
      expect(splitCitations(text, 44).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
    });
  });

  describe("a verse of another book", () => {
    it("leaves a Bible reference as text, with the ones its list goes on to name", () => {
      expect(cited("as in Genesis 2:7; 3:19, 21 and Luke 1:26–38, then 2:30")).toEqual([
        { text: "2:30", surah: 2, ayah: 30 },
      ]);
      expect(cited("cf. 1 Kings 19:8 and 2 Samuel 7:12")).toEqual([]);
    });

    it("still links a verse after a prophet's name when the book named for him has no such chapter", () => {
      // The book of Jonah has four chapters; Qur'an 37:139 tells his story.
      expect(cited("the tale of Jonah 37:139–48")).toEqual([{ text: "37:139–48", surah: 37, ayah: 139 }]);
    });

    it("leaves a volume and page after a dated work as text", () => {
      expect(cited("(Smith, Tales [1999], 2:45); see 2:45")).toEqual([{ text: "2:45", surah: 2, ayah: 45 }]);
    });

    it("names the chapters and verses it read as another book's, a range to its end", () => {
      expect(otherBookCitations("as in Genesis 2:7–9; 3:19 and Luke 1:26, then 2:30 and [1999], 4:16")).toEqual([
        [2, 7, 9],
        [3, 19, 19],
        [1, 26, 26],
        [4, 16, 16],
      ]);
      expect(otherBookCitations("the tale of Jonah 37:139–48")).toEqual([]);
    });

    it("keeps every word, in order", () => {
      const text = "Exodus 3:14; 4:2 and then 4:2";
      expect(splitCitations(text).map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe(text);
    });
  });

  it("returns the text whole when nothing is cited", () => {
    expect(splitCitations("no verses here")).toEqual(["no verses here"]);
  });
});

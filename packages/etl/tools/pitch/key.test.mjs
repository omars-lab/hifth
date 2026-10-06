import { describe, expect, it } from "vitest";
import { readKey } from "./key.mjs";

// A made-up key throughout: the book's own key is held, and stays out of the
// repository. Only its shape is the book's: initials, a name with dates, a work.
const ENTRY = { sig: "Xy", who: "Abū Zayd al-Ṭāliʿ (d. 400/1009)", work: "Kitāb al-amthāl" };

describe("the book's key to its commentators' initials", () => {
  it("is looked up by the initials, as the notes cite them", () => {
    expect(readKey({ key: [ENTRY, { sig: "Q", who: "Bakr (d. ca. 300/912)", work: "Tafsīr", also: "al-Kabīr" }] })).toEqual({
      Xy: { who: ENTRY.who, work: ENTRY.work },
      Q: { who: "Bakr (d. ca. 300/912)", work: "Tafsīr", also: "al-Kabīr" },
    });
  });

  it("keeps the accents a hand-typed copy may have typed as two characters", () => {
    const typed = { ...ENTRY, sig: "Ṭs" }; // T, then a combining dot below
    expect(Object.keys(readKey({ key: [typed] }))).toEqual(["Ṭs"]); // the one character Ṭ
  });

  it("refuses an entry that is not initials, a name with dates, and a work", () => {
    expect(() => readKey({ key: [{ ...ENTRY, sig: "see" }] })).toThrow(/initials/);
    expect(() => readKey({ key: [{ ...ENTRY, who: "Abū Zayd" }] })).toThrow(/dates/);
    expect(() => readKey({ key: [{ ...ENTRY, work: "" }] })).toThrow(/work/);
  });

  it("refuses the same initials twice, which would hide one of the two", () => {
    expect(() => readKey({ key: [ENTRY, { ...ENTRY, who: "Someone else (d. 1/1)" }] })).toThrow(/twice/);
  });
});

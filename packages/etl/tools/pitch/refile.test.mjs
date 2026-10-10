import { describe, expect, it } from "vitest";
import { seamPrint } from "./breaks.mjs";
import { orphanPrint } from "./orphans.mjs";
import { refileSurah } from "./refile.mjs";

// Made-up notes: the shape of the commentary, none of its words.
const notes = () => ({
  "7:3": { commentary: ["Own note of three.", "Its middle part."] },
  "7:4": { commentary: ["Own note of four."] },
  "7:9": { commentary: ["Tail one of three.", "Tail two of three.", "Own note of nine."] },
});

describe("refileSurah", () => {
  it("moves paragraphs filed under the wrong verse to the end of their own note", () => {
    const verses = notes();
    const used = refileSurah(7, verses, [
      { surah: 7, from: "7:9", to: "7:3", prints: [orphanPrint("Tail one of three."), orphanPrint("Tail two of three.")] },
    ]);
    expect([...used]).toEqual([0]);
    expect(verses["7:3"].commentary).toEqual(["Own note of three.", "Its middle part.", "Tail one of three.", "Tail two of three."]);
    expect(verses["7:9"].commentary).toEqual(["Own note of nine."]);
  });

  it("gives a shared note's later paragraphs to a verse that holds only its start, keeping them where they are", () => {
    const verses = notes();
    verses["7:4"].commentary = ["Own note of three."];
    refileSurah(7, verses, [{ surah: 7, from: "7:3", to: "7:4", prints: [orphanPrint("Its middle part.")], keep: true }]);
    expect(verses["7:4"].commentary).toEqual(["Own note of three.", "Its middle part."]);
    expect(verses["7:3"].commentary).toEqual(["Own note of three.", "Its middle part."]);
  });

  it("uses only the rows of its own surah, and none whose paragraphs are not all there in a run", () => {
    const verses = notes();
    const used = refileSurah(7, verses, [
      { surah: 8, from: "7:9", to: "7:3", prints: [orphanPrint("Tail one of three.")] },
      { surah: 7, from: "7:9", to: "7:3", prints: [orphanPrint("Tail one of three."), orphanPrint("Own note of nine.")].reverse() },
    ]);
    expect(used.size).toBe(0);
    expect(verses).toEqual(notes());
  });

  it("cuts a verse's own note off the end of a shared note it was run into, and files it under that verse alone", () => {
    const shared = "3–9 The shared note ends here. 3 Own note of three.";
    const verses = {
      "7:3": { commentary: [shared] },
      "7:4": { commentary: [shared, "Own note of four."] },
    };
    const used = refileSurah(7, verses, [{ surah: 7, from: "7:4", to: "7:3", split: seamPrint(shared, shared.indexOf(" Own")) }]);
    expect([...used]).toEqual([0]);
    expect(verses["7:3"].commentary).toEqual(["3–9 The shared note ends here.", "Own note of three."]);
    expect(verses["7:4"].commentary).toEqual(["3–9 The shared note ends here.", "Own note of four."]);
  });

  it("refuses to give a verse a paragraph it already holds", () => {
    const verses = notes();
    expect(() =>
      refileSurah(7, verses, [{ surah: 7, from: "7:3", to: "7:3", prints: [orphanPrint("Its middle part.")], keep: true }]),
    ).toThrow(/already holds/);
  });
});

import { describe, expect, it } from "vitest";
import { noteRange, settleTranslation } from "./translation.mjs";

// Made-up verses and notes: the shape of the capture, none of its words.
describe("settleTranslation", () => {
  it("keeps the captured translation when nobody has read the page again", () => {
    expect(settleTranslation("The lamp was lit.", undefined)).toEqual({ translation: "The lamp was lit.", note: "" });
  });

  it("puts the hand-read verse back where the capture took the note in its place", () => {
    expect(settleTranslation("Lamp renders a word for light. * * *", "The lamp was lit.")).toEqual({
      translation: "The lamp was lit.",
      note: "Lamp renders a word for light.",
    });
  });

  it("splits a verse that runs on into its note", () => {
    expect(settleTranslation("The lamp was lit. 4–6 These verses tell of the hall.", "The lamp was lit.")).toEqual({
      translation: "The lamp was lit.",
      note: "4–6 These verses tell of the hall.",
    });
  });

  it("finishes a verse the capture cut at the foot of a page", () => {
    expect(settleTranslation("The lamp was lit in the ha", "The lamp was lit in the hall.")).toEqual({
      translation: "The lamp was lit in the hall.",
      note: "",
    });
    expect(settleTranslation("The lamp was lit in the hall", "The lamp was lit in the hall.")).toEqual({
      translation: "The lamp was lit in the hall.",
      note: "",
    });
  });

  it("drops the space the cut left after a word", () => {
    expect(settleTranslation("The lamp was lit in the ", "The lamp was lit in the hall.").translation).toBe(
      "The lamp was lit in the hall.",
    );
  });

  it("keeps a captured verse that already matches", () => {
    expect(settleTranslation("The lamp was lit.", "The lamp was lit.")).toEqual({ translation: "The lamp was lit.", note: "" });
  });
});

describe("noteRange", () => {
  it("reads a range label in full", () => {
    expect(noteRange("4–6 These verses tell of the hall.")).toEqual([4, 6]);
    expect(noteRange("105-107 These verses")).toEqual([105, 107]);
  });

  it("reads a range the print shortens, as 105–7 for 105 to 107", () => {
    expect(noteRange("105–7 These verses")).toEqual([105, 107]);
    expect(noteRange("118–20 These verses")).toEqual([118, 120]);
    expect(noteRange("98–102 These verses")).toEqual([98, 102]);
  });

  it("finds no range on a single verse's note or a plain sentence", () => {
    expect(noteRange("4 This verse tells of the hall.")).toBeNull();
    expect(noteRange("Lamp renders a word for light.")).toBeNull();
    expect(noteRange("")).toBeNull();
  });
});

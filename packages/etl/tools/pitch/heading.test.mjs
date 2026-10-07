import { describe, expect, it } from "vitest";
import { dropVerseHeading } from "./heading.mjs";

// Made-up verses: the shape of the capture, none of its words.
const VERSES = { 4: "Lo, the lamp was lit in the hall,", 5: "and the door stood open", 6: "So walk in peace.", 7: "The bell.", 8: "What is the bell?", 10: "Rise!", 11: "and go!" };
const of = (n) => VERSES[n] ?? "";

describe("dropVerseHeading", () => {
  it("drops the verse printed above its own note, up to the note's label", () => {
    expect(dropVerseHeading("Lo, the lamp was lit in the hall, 4 The lamp here means", 4, of)).toBe("4 The lamp here means");
  });

  it("drops a heading that comes after the verse's own number", () => {
    expect(dropVerseHeading("4 Lo, the lamp was lit in the hall, 4 The lamp here means", 4, of)).toBe("4 The lamp here means");
  });

  it("drops the following verses the heading runs on into", () => {
    expect(dropVerseHeading("Lo, the lamp was lit in the hall, 5 and the door stood open 4–5 Both verses", 4, of)).toBe(
      "4–5 Both verses",
    );
  });

  it("drops a heading that ends a sentence and runs straight into the note", () => {
    expect(dropVerseHeading("So walk in peace. This verse closes", 6, of)).toBe("This verse closes");
  });

  it("drops a heading printed without the verse's closing full stop", () => {
    expect(dropVerseHeading("6 So walk in peace6 Walking here means", 6, of)).toBe("6 Walking here means");
  });

  it("drops a heading that joins its verses with a semicolon and a small letter", () => {
    expect(dropVerseHeading("The bell; 8 what is the bell?", 7, of)).toBe("");
  });

  it("drops a heading that swaps a verse's closing mark for a comma", () => {
    expect(dropVerseHeading("Rise, 11 and go, 10–11 Rising here means", 10, of)).toBe("10–11 Rising here means");
  });

  it("leaves a block whose heading breaks off part way", () => {
    const text = "Lo, the lamp was lit in the hall, 5 and the door stood ajar 4–5 Both verses";
    expect(dropVerseHeading(text, 4, of)).toBe(text);
  });

  it("drops a block that is only the heading", () => {
    expect(dropVerseHeading("So walk in peace.", 6, of)).toBe("");
  });

  it("leaves a note that quotes only part of its verse", () => {
    expect(dropVerseHeading("Lo, the lamp is a sign", 4, of)).toBe("Lo, the lamp is a sign");
  });

  it("leaves a note whose first words merely begin like the verse", () => {
    expect(dropVerseHeading("and the door stood opener of ways", 5, of)).toBe("and the door stood opener of ways");
    expect(dropVerseHeading("and the door stood open wide for all", 5, of)).toBe("and the door stood open wide for all");
  });

  it("leaves a note when the verse has no translation", () => {
    expect(dropVerseHeading("Anything at all", 9, of)).toBe("Anything at all");
  });
});

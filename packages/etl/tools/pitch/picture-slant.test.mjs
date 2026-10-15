import { describe, expect, it } from "vitest";
import { SLANT_END, SLANT_START } from "./italics.mjs";
import { slantFromPictures } from "./picture-slant.mjs";

// Made-up notes and made-up words read off a made-up picture: the shape of the
// book, none of its words. A word's lean is in degrees; 10 is the print's slant,
// 0 upright, -99 too little ink to say.
const S = SLANT_START;
const E = SLANT_END;
const read = (text, leans = {}, { line = 1, pic = "chapter-9_p01.png" } = {}) =>
  text.split(" ").map((t, i) => ({ text: t, slant: leans[i] ?? 0, line: leans.lines?.[i] ?? line, pic }));
const one = (note, words, read = new Set()) => {
  const v = { "9:1": { commentary: [note] } };
  slantFromPictures(v, words, read);
  return v["9:1"].commentary[0];
};

describe("slantFromPictures", () => {
  it("slants the words that lean in the picture, as one run", () => {
    const words = read("1 the elder said the well is deep and dry", { 4: 11, 5: 10, 6: 12, 7: 10 });
    expect(one("1 The elder said, the well is deep and dry.", words)).toBe(`1 The elder said, ${S}the well is deep${E} and dry.`);
  });

  it("keeps the punctuation at a run's edge outside it", () => {
    const words = read("1 a word called the hollow, then more", { 4: 10, 5: 11 });
    expect(one("1 A word called (the hollow), then more.", words)).toBe(`1 A word called (${S}the hollow${E}), then more.`);
  });

  it("takes in a question mark, an exclamation, a closing quote or bracket the run ends on, as the book does", () => {
    const words = read("1 a book called who is near? then more", { 4: 10, 5: 10, 6: 11 });
    expect(one("1 A book called Who Is Near? then more.", words)).toBe(`1 A book called ${S}Who Is Near?${E} then more.`);
    const quoted = read("1 he said deep well and left", { 3: 10, 4: 11 });
    expect(one("1 He said “deep well!” and left.", quoted)).toBe(`1 He said “${S}deep well!”${E} and left.`);
  });

  it("carries a short word between two leaning ones on the same line", () => {
    const words = read("2 they read stone of fire here today", { 3: 10, 4: 2, 5: 11 });
    expect(one("2 They read stone of fire here today.", words)).toBe(`2 They read ${S}stone of fire${E} here today.`);
    // Not across a line: the print could end a run there.
    const broken = read("2 they read stone of fire here today", { 3: 10, 4: 2, 5: 11, lines: { 5: 2, 6: 2, 7: 2 } });
    expect(one("2 They read stone of fire here today.", broken)).toBe(`2 They read ${S}stone${E} of ${S}fire${E} here today.`);
  });

  it("carries a word leaning a little between slanted words on one line", () => {
    // A word the ink makes look nearly upright (4 degrees) inside a slanted
    // quotation: the run goes on through it, as the print does.
    const words = read("2 it says and indeed gave stones to them", { 3: 8, 4: 9, 5: 4, 6: 10, 7: 9 });
    expect(one("2 It says, And indeed gave stones to them.", words)).toBe(`2 It says, ${S}And indeed gave stones to${E} them.`);
    // Two such words in a row end the run.
    const pair = read("2 it says and indeed thus gave stones to them", { 3: 8, 4: 9, 5: 4, 6: 4, 7: 10, 8: 9 });
    expect(one("2 It says, And indeed thus gave stones to them.", pair)).toBe(`2 It says, ${S}And indeed${E} thus gave ${S}stones to${E} them.`);
    // An upright word between two slanted ones stays upright: that is two runs.
    const two = read("2 it says stone then fire here", { 3: 10, 4: 0, 5: 11 });
    expect(one("2 It says stone, then fire here.", two)).toBe(`2 It says ${S}stone${E}, then ${S}fire${E} here.`);
  });

  it("leaves a word upright when the picture cannot say: too little ink, or too far over", () => {
    const words = read("3 the reed bent low in wind", { 2: -99, 3: 40 });
    expect(one("3 The reed bent low in wind.", words)).toBe("3 The reed bent low in wind.");
  });

  it("finds the note's words wherever they stand among the picture's other words", () => {
    // The picture also holds the verse in upright type, and another note.
    const words = [
      ...read("the verse says the well is deep indeed"),
      ...read("4 a note of other things entirely here"),
      ...read("5 the reader said the well is deep and went on", { 4: 10, 5: 10, 6: 10, 7: 11 }),
    ];
    expect(one("5 The reader said the well is deep and went on.", words)).toBe(`5 The reader said ${S}the well is deep${E} and went on.`);
  });

  it("leaves alone a note it finds no words for, and a note read by hand", () => {
    const words = read("6 the stone is cold here now", { 2: 10 });
    expect(one("6 A note with nothing alike in it.", words)).toBe("6 A note with nothing alike in it.");
    const hand = "6 The stone is cold here now.";
    expect(one(hand, words, new Set([hand]))).toBe(hand);
  });

  it("reads a word the picture shows with or without its marks alike", () => {
    const words = read("7 the word qarya means a town", { 3: 10 });
    expect(one("7 The word qaryā means a town.", words)).toBe(`7 The word ${S}qaryā${E} means a town.`);
  });

  it("slants a note filed under two verses the same way under both", () => {
    const shared = "8–9 The elder said the well is deep and dry.";
    const v = { "9:8": { commentary: [shared] }, "9:9": { commentary: [shared] } };
    slantFromPictures(v, read("8–9 the elder said the well is deep and dry", { 4: 10, 5: 10 }), new Set());
    expect(v["9:8"].commentary[0]).toBe(`8–9 The elder said ${S}the well${E} is deep and dry.`);
    expect(v["9:9"].commentary[0]).toBe(v["9:8"].commentary[0]);
  });
});

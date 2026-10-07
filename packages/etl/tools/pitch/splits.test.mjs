import { describe, expect, it } from "vitest";
import { joinSplits, wordsOf } from "./splits.mjs";
import { seamPrint } from "./breaks.mjs";

// Made-up words throughout: no held text in the repository.
const WORDS = wordsOf(["The caravan crossed the riverbed at dawn, and the merchants were thankful."]);
const seamOf = (a, b) => seamPrint(`${a} ${b}`, a.length);

describe("a paragraph a page or column break cut part way through a sentence", () => {
  it("runs on into the next paragraph when that one carries on in lowercase", () => {
    expect(joinSplits("9:9", ["They rested by the", "well until the heat passed."], WORDS).blocks).toEqual([
      "They rested by the well until the heat passed.",
    ]);
  });

  it("carries on into a bracket the same way", () => {
    expect(joinSplits("9:9", ["They fed the animals", "(camels and goats) at dusk."], WORDS).blocks).toEqual([
      "They fed the animals (camels and goats) at dusk.",
    ]);
  });

  it("closes a word the break cut in two when the book spells the whole word elsewhere", () => {
    expect(joinSplits("9:9", ["The mer", "chants were glad."], WORDS).blocks).toEqual(["The merchants were glad."]);
    expect(joinSplits("9:9", ["They crossed the river", "bed slowly."], WORDS).blocks).toEqual([
      "They crossed the riverbed slowly.",
    ]);
  });

  it("keeps the space when both halves are words in their own right", () => {
    const words = wordsOf(["the river and the bed and the riverbed"]);
    expect(joinSplits("9:9", ["They slept by the river", "bed and all."], words).blocks).toEqual([
      "They slept by the river bed and all.",
    ]);
  });

  it("does not count the halves a break left at a paragraph's edge as words", () => {
    const words = wordsOf(["They spoke of dif", "ferent things in different places."]);
    expect(joinSplits("9:9", ["Each spoke of dif", "ferent roads."], words).blocks).toEqual(["Each spoke of different roads."]);
  });

  it("leaves a paragraph that ends on its stop, or a new one that opens a sentence", () => {
    const blocks = ["They rested.", "then left", "At dawn they went on."];
    expect(joinSplits("9:9", blocks, WORDS).blocks).toEqual(blocks);
  });

  it("joins where the hand-read list says so, putting back a letter the break lost", () => {
    const [a, b] = ["The caravan reached the", "Oasis by noon."];
    const [c, d] = ["They gave tha", "kful prayers."];
    const marks = [
      { verse: "9:9", print: seamOf(a, b) },
      { verse: "9:9", print: seamOf(c, d), fill: "n", space: false },
    ];
    const { blocks, used } = joinSplits("9:9", [a, b, c, d], WORDS, marks);
    expect(blocks).toEqual(["The caravan reached the Oasis by noon.", "They gave thankful prayers."]);
    expect(used).toEqual(new Set([0, 1]));
  });

  it("drops the page-foot leftovers the list counts off either side of the join", () => {
    const [a, b] = ["They gave thanks for the water, which  an 12 3:4", "kept them alive."];
    const [c, d] = ["They rested by the (se", "9:1 9:12) well."];
    const marks = [
      { verse: "9:9", print: seamOf(a, b), cut: 11 },
      { verse: "9:9", print: seamOf(c, d), fill: "e", skip: 4 },
    ];
    expect(joinSplits("9:9", [a, b, c, d], WORDS, marks).blocks).toEqual([
      "They gave thanks for the water, which kept them alive.",
      "They rested by the (see 9:12) well.",
    ]);
  });

  it("keeps two paragraphs apart where the list says the print does, putting back the stop", () => {
    const [a, b] = ["They rested by the well; see 9:9c", "Nobody stayed."];
    const { blocks } = joinSplits("9:9", [a, b], WORDS, [{ verse: "9:9", print: seamOf(a, b), fill: ".", apart: true }]);
    expect(blocks).toEqual(["They rested by the well; see 9:9c.", "Nobody stayed."]);
  });

  it("joins a run of three pieces into one", () => {
    expect(joinSplits("9:9", ["They rode", "on through", "the night."], WORDS).blocks).toEqual(["They rode on through the night."]);
  });
});

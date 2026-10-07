import { describe, expect, it } from "vitest";
import { finishNote } from "./finish.mjs";
import { wordsOf } from "./splits.mjs";

// Made-up words throughout: no held text in the repository.
const WORDS = wordsOf(["The caravan crossed the riverbed at dawn, and the merchants were thankful."]);
const lists = { marks: [], joins: [], words: WORDS };

describe("a verse's note, finished", () => {
  it("drops a stray piece of the previous verse's note before rejoining split sentences", () => {
    const previous = ["The well was dry, so they went on to the next village by the hills."];
    const blocks = [
      "The caravan was told only to",
      "village by the hills.",
      "The caravan was told only to rest by the water and give thanks.",
    ];
    expect(finishNote("9:9", blocks, previous, lists).blocks).toEqual([
      "The caravan was told only to rest by the water and give thanks.",
    ]);
  });

  it("still rejoins a sentence split across a column", () => {
    expect(finishNote("9:9", ["They rested by the", "well until noon."], [], lists).blocks).toEqual([
      "They rested by the well until noon.",
    ]);
  });
});

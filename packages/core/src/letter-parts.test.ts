import { describe, expect, it } from "vitest";
import { isLetterShard, lettersOfWord, type LetterShard } from "./letter-parts.js";

const box = { x: 100, y: 50, width: 30, height: 20 };
const shard: LetterShard = {
  page: 7,
  // Two lines: one upright 12 units in; one that starts 6 units in, steps down
  // 4 units and 1 unit left, then runs straight down.
  words: { "2:38": { "3": [120, [60, 40, -10]] } },
};

describe("letters of a word", () => {
  it("gives one outline per letter, right to left, between the lines", () => {
    const letters = lettersOfWord(shard, "2:38", 3, box);
    expect(letters).toHaveLength(3);
    // The first letter runs from the copy's right edge to the upright line.
    expect(letters[0]).toEqual([
      [132.5, 47.5],
      [132.5, 72.5],
      [112, 72.5],
      [112, 47.5],
    ]);
    // The middle letter's left side is the stepped line, walked back up.
    expect(letters[1]).toEqual([
      [112, 47.5],
      [112, 72.5],
      [105, 72.5],
      [105, 51.5],
      [106, 47.5],
    ]);
    // The last reaches the copy's left edge.
    expect(letters[2]![letters[2]!.length - 1]).toEqual([97.5, 47.5]);
  });

  it("has nothing for a word the data leaves out", () => {
    expect(lettersOfWord(shard, "2:38", 4, box)).toEqual([]);
    expect(lettersOfWord(shard, "2:39", 3, box)).toEqual([]);
  });

  it("knows its own shape", () => {
    expect(isLetterShard(shard)).toBe(true);
    expect(isLetterShard({ page: 7, marks: {} })).toBe(false);
  });
});

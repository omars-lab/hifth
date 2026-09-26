import { describe, expect, it } from "vitest";
import type { MarkShard } from "./mark-diff.js";
import { nearestSignOnPage, signsOfWord } from "./sign-reach.js";

const shard: MarkShard = {
  page: 7,
  marks: {
    "2:37": [{ w: 1, n: "fatha", r: [100, 20, 6, 3] }],
    "2:38": [
      { w: 1, n: "fatha", r: [300, 10, 6, 3] },
      { w: 1, n: "kasra", r: [320, 30, 6, 3] },
      { w: 2, n: "sukun", r: [250, 10, 4, 4] },
    ],
  },
};

describe("nearestSignOnPage", () => {
  it("takes the sign whose middle is nearest, across verses, with its place in its verse", () => {
    expect(nearestSignOnPage(shard, 322, 30, 20)).toMatchObject({ ayah: "2:38", index: 1, word: 1, name: "kasra" });
    expect(nearestSignOnPage(shard, 104, 22, 20)).toMatchObject({ ayah: "2:37", index: 0 });
  });

  it("takes nothing when every sign is out of reach", () => {
    expect(nearestSignOnPage(shard, 200, 200, 10)).toBeNull();
  });
});

describe("signsOfWord", () => {
  it("lists a word's signs right to left, keeping their places in the verse", () => {
    expect(signsOfWord(shard, "2:38", 1).map((s) => s.index)).toEqual([1, 0]);
    expect(signsOfWord(shard, "2:38", 2).map((s) => s.name)).toEqual(["sukun"]);
    expect(signsOfWord(shard, "9:9", 1)).toEqual([]);
  });
});

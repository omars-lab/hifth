import { describe, it, expect } from "vitest";
import {
  Roots,
  groupByLemma,
  orderByPageDistance,
  type AyahRootsShard,
  type RootHop,
  type RootIndexShard,
} from "./roots.js";

const EDITION = "hafs-kfqc";
const key = (s: number, a: number) => `quran/${EDITION}/${s}:${a}`;

/*
 * Fixture (hand-verified against the vendored pages): the root ذ ك ر on
 * 2:40 (p7), 2:47 (p7), 2:122 (p19), 2:152 (p23) and 14:5 (p255); the root
 * ن ع م only on 2:40 and 2:47; and ه د ي as a hapax on 2:47 alone. Absolute
 * ayah numbers: 2:40 = 47, 2:47 = 54, 2:122 = 129, 2:152 = 159, 14:5 = 1755.
 */
const ROOT_SHARD: RootIndexShard = {
  "ذ ك ر": {
    l: ["ذَكَرَ", "ذِكْر"],
    w: 6,
    a: [
      [47, 7, 1, 0],
      [54, 7, 1, 0],
      [129, 19, 2, 0, 1],
      [159, 23, 1, 1],
      [1755, 255, 1, 0],
    ],
  },
  "ن ع م": {
    l: ["نِعْمَة"],
    w: 2,
    a: [
      [47, 7, 1, 0],
      [54, 7, 1, 0],
    ],
  },
  "ه د ي": { l: [], w: 1, a: [[54, 7, 1]] },
};

/*
 * `w` is the print word index a root sits at, in the same numbering `#wN` keys
 * and the word boxes use. ه د ي carries two indices for one segment — the
 * |w| > n case the print produces when it writes a corpus word as two pieces
 * (5,265 of the 44,401 shipped pairs). Ayah 72 is one of the four the alignment
 * excepts, so none of its roots may carry `w` at all.
 */
const AYAH_SHARD: AyahRootsShard = {
  "40": [
    { r: "ذ ك ر", b: 0, n: 1, w: [2] },
    { r: "ن ع م", b: 0, n: 1, w: [3] },
  ],
  "47": [
    { r: "ن ع م", b: 0, n: 1, w: [3] },
    { r: "ذ ك ر", b: 0, n: 1, w: [2] },
    { r: "ه د ي", b: 0, n: 1, w: [7, 8] },
    // The same root twice on one ayah. `build-roots.mjs` dedupes before it
    // writes, so this shape does not ship; it is here because the lens dedupes
    // too, and the second ref's words must survive that.
    { r: "ذ ك ر", b: 0, n: 1, w: [9] },
  ],
  "72": [
    { r: "ذ ك ر", b: 0, n: 1 },
    { r: "ن ع م", b: 0, n: 1 },
  ],
};

function lens(): Roots {
  const roots = new Roots(EDITION);
  roots.addAyahShard(2, AYAH_SHARD);
  roots.addRootShard(0, ROOT_SHARD);
  return roots;
}

/** The named family of an ayah's lens output (order is asserted separately). */
function familyOf(root: string, ayah: number, limit?: number) {
  const families = lens().familiesForKey(key(2, ayah), limit ? { limit } : {});
  return families.find((f) => f.root === root)!;
}

describe("Roots — shard bookkeeping", () => {
  it("reports which shards are loaded", () => {
    const roots = lens();
    expect(roots.hasAyahShard(2)).toBe(true);
    expect(roots.hasAyahShard(14)).toBe(false);
    expect(roots.hasRootShard(0)).toBe(true);
    expect(roots.hasRootShard(1)).toBe(false);
  });

  it("lists the buckets a selection needs, deduped and ascending", () => {
    const roots = new Roots(EDITION);
    roots.addAyahShard(2, {
      "1": [
        { r: "ب", b: 3, n: 1 },
        { r: "ا", b: 1, n: 1 },
        { r: "ج", b: 3, n: 1 },
      ],
    });
    expect(roots.bucketsForKey(key(2, 1))).toEqual([1, 3]);
  });

  it("stays quiet on an unloaded shard, a foreign edition and a bad key", () => {
    const roots = lens();
    expect(roots.rootsForKey(key(14, 5))).toEqual([]);
    expect(roots.familiesForKey(key(14, 5))).toEqual([]);
    expect(roots.familiesForKey("quran/other-edition/2:47")).toEqual([]);
    expect(roots.familiesForKey("not-a-key")).toEqual([]);
  });

  it("omits a family whose root bucket has not landed yet", () => {
    const roots = new Roots(EDITION);
    roots.addAyahShard(2, AYAH_SHARD);
    expect(roots.familiesForKey(key(2, 40))).toEqual([]);
    roots.addRootShard(0, ROOT_SHARD);
    expect(roots.familiesForKey(key(2, 40))).toHaveLength(2);
  });
});

describe("Roots — families", () => {
  it("drops the current ayah and keeps every other occurrence", () => {
    const zkr = familyOf("ذ ك ر", 40);
    expect(zkr.ayahs).toBe(5); // corpus-wide, current ayah included
    expect(zkr.words).toBe(6);
    expect(zkr.here).toBe(1);
    expect(zkr.hops.map((h) => h.key)).toEqual([
      key(2, 47),
      key(2, 122),
      key(2, 152),
      key(14, 5),
    ]);
  });

  it("computes the source page from the reverse index — no resolver needed", () => {
    const byKey = new Map(familyOf("ذ ك ر", 40).hops.map((h) => [h.key, h]));
    expect(byKey.get(key(2, 47))!.dPage).toBe(0); // both on page 7
    expect(byKey.get(key(2, 122))!.dPage).toBe(12); // 19 − 7
    expect(byKey.get(key(14, 5))!.dPage).toBe(248); // 255 − 7
  });

  it("carries dir metadata for each hop", () => {
    const zkr = familyOf("ذ ك ر", 40);
    const far = zkr.hops.find((h) => h.key === key(14, 5))!;
    expect(far.dSurah).toBe(12);
    expect(far.sameJuz).toBe(false);
    expect(far.count).toBe(1);
    expect(far.lemmas).toEqual(["ذَكَرَ"]);
    const near = zkr.hops.find((h) => h.key === key(2, 47))!;
    expect(near.dSurah).toBe(0);
    expect(near.sameJuz).toBe(true); // 2:40 and 2:47 are both in juz 1
  });

  it("orders families nearest page first, then by rarity", () => {
    // On 2:47: ن ع م's only other ayah is on the same page (Δ0) and ذ ك ر's
    // nearest is also Δ0, so rarity breaks the tie; ه د ي is a hapax → last.
    const families = lens().familiesForKey(key(2, 47));
    expect(families.map((f) => f.root)).toEqual(["ن ع م", "ذ ك ر", "ه د ي"]);
    expect(families[2]!.hops).toEqual([]);
  });

  it("counts a repeated root once per ayah", () => {
    const families = lens().familiesForKey(key(2, 47));
    expect(families.filter((f) => f.root === "ذ ك ر")).toHaveLength(1);
  });

  it("caps hops at the limit and flags the truncation", () => {
    const capped = familyOf("ذ ك ر", 40, 2);
    expect(capped.hops).toHaveLength(2);
    expect(capped.truncated).toBe(true);
    expect(capped.hops.map((h) => h.key)).toEqual([key(2, 47), key(2, 122)]);
    expect(familyOf("ذ ك ر", 40).truncated).toBe(false);
  });

  it("sub-groups the kept hops by lemma, most-used first", () => {
    expect(familyOf("ذ ك ر", 40).lemmas.map((g) => [g.lemma, g.hops.length])).toEqual([
      ["ذَكَرَ", 3], // 2:47, 2:122, 14:5
      ["ذِكْر", 2], // 2:122 (both lemmas), 2:152
    ]);
    // A root with no lemma data still produces a family, just no sub-groups.
    expect(familyOf("ه د ي", 47).lemmas).toEqual([]);
  });
});

describe("Roots — a run of words (word-D)", () => {
  const run = (ayah: number, w: string) => `${key(2, ayah)}#${w}`;

  it("carries each root's print word indices onto its family", () => {
    expect(familyOf("ذ ك ر", 40).at).toEqual([2]);
    // One rooted segment, two places on the page — `at` follows the print.
    const hdy = familyOf("ه د ي", 47);
    expect(hdy.here).toBe(1);
    expect(hdy.at).toEqual([7, 8]);
  });

  it("says nothing about where, on an ayah the alignment excepts", () => {
    for (const family of lens().familiesForKey(key(2, 72))) {
      // Absent, not empty: an empty list would claim the root is nowhere.
      expect(family).not.toHaveProperty("at");
    }
  });

  it("names the roots a run of words carries, in mus'haf order and deduped", () => {
    const roots = lens();
    expect(roots.rootsForWords(run(47, "w3"))).toEqual(["ن ع م"]);
    expect(roots.rootsForWords(run(47, "w2-3"))).toEqual(["ن ع م", "ذ ك ر"]);
    // Either half of a two-piece word finds it.
    expect(roots.rootsForWords(run(47, "w7"))).toEqual(["ه د ي"]);
    expect(roots.rootsForWords(run(47, "w8"))).toEqual(["ه د ي"]);
    // The lens dedupes the two ذ ك ر refs; the second one's words still count.
    expect(roots.rootsForWords(run(47, "w9"))).toEqual(["ذ ك ر"]);
    expect(roots.rootsForWords(run(47, "w2-9"))).toEqual(["ن ع م", "ذ ك ر", "ه د ي"]);
    // A word no root sits on is an answer, not a failure to answer.
    expect(roots.rootsForWords(run(47, "w5"))).toEqual([]);
  });

  it("refuses a key that is not a word run", () => {
    const roots = lens();
    for (const bad of [key(2, 47), `quran/other-edition/2:47#w3`, "not-a-key"]) {
      expect(roots.rootsForWords(bad)).toEqual([]);
      expect(roots.familiesForWords(bad)).toEqual([]);
    }
  });

  it("narrows the families to the selected words, and nothing else about them", () => {
    const roots = lens();
    expect(roots.familiesForWords(run(47, "w7")).map((f) => f.root)).toEqual(["ه د ي"]);
    expect(roots.familiesForWords(run(40, "w2-3")).map((f) => f.root)).toEqual([
      "ن ع م",
      "ذ ك ر",
    ]);
    // Narrowing the source does not narrow where the family lands: ذ ك ر's hops
    // out of 2:40 are the same four whether the whole ayah or one word asked.
    const whole = familyOf("ذ ك ر", 40);
    const word = roots.familiesForWords(run(40, "w2"))[0]!;
    expect(word.hops).toEqual(whole.hops);
    expect(word.ayahs).toBe(whole.ayahs);
  });

  it("passes the limit through, so a run truncates like an ayah", () => {
    const capped = lens().familiesForWords(run(40, "w2"), { limit: 2 })[0]!;
    expect(capped.hops).toHaveLength(2);
    expect(capped.truncated).toBe(true);
  });

  it("over-answers on an excepted ayah rather than answering nothing", () => {
    // No root here carries `w`, so the run cannot be honoured. Showing a hafiz
    // an empty lens would claim these words have no family, which is false.
    const roots = lens();
    expect(roots.rootsForWords(run(72, "w1"))).toEqual(["ذ ك ر", "ن ع م"]);
    expect(roots.familiesForWords(run(72, "w1")).map((f) => f.root)).toEqual(
      roots.familiesForKey(key(2, 72)).map((f) => f.root),
    );
  });
});

describe("orderByPageDistance", () => {
  const hop = (surah: number, ayah: number, dPage: number): RootHop => ({
    key: key(surah, ayah),
    surah,
    ayah,
    page: 7 + dPage,
    dPage,
    dSurah: 0,
    sameJuz: true,
    count: 1,
    lemmas: [],
  });

  it("sorts by absolute page distance, then mushaf order", () => {
    const sorted = orderByPageDistance([
      hop(3, 1, 40),
      hop(2, 9, -1),
      hop(2, 5, 1),
      hop(2, 20, 0),
    ]);
    expect(sorted.map((h) => h.dPage)).toEqual([0, 1, -1, 40]);
  });

  it("does not mutate its input", () => {
    const input = [hop(2, 5, 9), hop(2, 6, 1)];
    orderByPageDistance(input);
    expect(input.map((h) => h.dPage)).toEqual([9, 1]);
  });
});

describe("groupByLemma", () => {
  const hop = (ayah: number, lemmas: string[]): RootHop => ({
    key: key(2, ayah),
    surah: 2,
    ayah,
    page: 7,
    dPage: 0,
    dSurah: 0,
    sameJuz: true,
    count: 1,
    lemmas,
  });

  it("lists a hop under every lemma it uses", () => {
    const groups = groupByLemma([hop(1, ["أ", "ب"]), hop(2, ["ب"])]);
    expect(groups.map((g) => g.lemma)).toEqual(["ب", "أ"]);
    expect(groups[0]!.hops).toHaveLength(2);
  });

  it("breaks equal-size groups alphabetically, not by locale", () => {
    const groups = groupByLemma([hop(1, ["ب"]), hop(2, ["أ"])]);
    expect(groups.map((g) => g.lemma)).toEqual(["أ", "ب"]);
  });
});

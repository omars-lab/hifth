import { describe, expect, it } from "vitest";
import { JUZ_COUNT, juzOfPage, juzPageIndex, juzSpan, planPack } from "./packs.js";
import {
  JUZ_STARTS,
  TOTAL_AYAHS,
  fromAbsoluteAyah as fromAbsolute,
  juzOf,
  toAbsoluteAyah,
} from "./quran-meta.js";
import type { PageMeta, PolygonMeta } from "./types.js";

const EDITION = "hafs-kfqc";

/** One page carrying the given `surah:ayah` pairs, in the order written. */
function page(n: number, ...keys: readonly string[]): PageMeta {
  const polygons: PolygonMeta[] = keys.map((k) => {
    const [surah, ayah] = k.split(":").map(Number);
    return {
      elementId: `verse-${surah * 1000 + ayah}`,
      number: surah * 1000 + ayah,
      surah,
      ayah,
      key: `quran/${EDITION}/${surah}:${ayah}`,
    };
  });
  return { edition: EDITION, page: n, viewBox: "0 0 345 550", polygons };
}

describe("juzSpan", () => {
  it("opens each juz at its own start", () => {
    for (let juz = 1; juz <= JUZ_COUNT; juz++) {
      const [surah, ayah] = JUZ_STARTS[juz - 1];
      expect(juzSpan(juz)?.[0]).toBe(toAbsoluteAyah(surah, ayah));
    }
  });

  it("closes each juz one ayah before the next opens", () => {
    for (let juz = 1; juz < JUZ_COUNT; juz++) {
      expect(juzSpan(juz)?.[1]).toBe(juzSpan(juz + 1)![0] - 1);
    }
  });

  it("ends the last juz at the last ayah of the book, not at a next entry", () => {
    // The off-by-a-whole-juz this guards: JUZ_STARTS[30] is undefined, and
    // arithmetic that reaches for it lands on the one juz most memorisers hold.
    expect(juzSpan(30)?.[1]).toBe(TOTAL_AYAHS);
  });

  it("covers the book exactly once, with no gap and no overlap", () => {
    let covered = 0;
    for (let juz = 1; juz <= JUZ_COUNT; juz++) {
      const [first, last] = juzSpan(juz)!;
      covered += last - first + 1;
    }
    expect(covered).toBe(TOTAL_AYAHS);
  });

  it("has no opinion outside 1..30", () => {
    expect(juzSpan(0)).toBeNull();
    expect(juzSpan(31)).toBeNull();
    expect(juzSpan(1.5)).toBeNull();
  });

  it("agrees with juzOf, which is the same table read the other way", () => {
    // Two readings of one table is the cheapest available check that this
    // module and quran-meta describe the same divisions. Both ends of every
    // span, because a fencepost error shows at exactly one of them.
    for (let juz = 1; juz <= JUZ_COUNT; juz++) {
      const [first, last] = juzSpan(juz)!;
      const open = fromAbsolute(first);
      const close = fromAbsolute(last);
      expect(juzOf(open.surah, open.ayah)).toBe(juz);
      expect(juzOf(close.surah, close.ayah)).toBe(juz);
    }
  });
});

describe("planPack", () => {
  it("lists the pages that carry the juz, ascending, whatever order the manifest is in", () => {
    // All three leaves sit inside juz 1, which ends at 2:141.
    const pages = [page(3, "2:120"), page(1, "1:1", "2:1"), page(2, "2:100")];
    const plan = planPack(1, pages)!;
    expect(plan.pages).toEqual([1, 2, 3]);
  });

  it("takes the whole leaf at a boundary, not the half inside the juz", () => {
    // Juz 2 opens at 2:142, mid-page. The leaf carrying 2:141 and 2:142 belongs
    // to both packs — pin either and the reader sees both halves.
    const boundary = page(22, "2:141", "2:142");
    const pages = [page(21, "2:130"), boundary, page(23, "2:150")];
    expect(planPack(1, pages)!.pages).toContain(22);
    expect(planPack(2, pages)!.pages).toContain(22);
  });

  it("takes every surah on a pinned page, not only the ones inside the juz", () => {
    // The failure this closes: pin juz 30, tap an ayah of surah 77 sitting at
    // the top of the first leaf, and get no hops — silently, offline, reading
    // as "there are no mutashabihat here" rather than "a shard is missing".
    const pages = [page(581, "77:50", "78:1", "78:2")];
    const plan = planPack(30, pages)!;
    expect(plan.pages).toEqual([581]);
    expect(plan.surahs).toEqual([77, 78]);
  });

  it("leaves out a page that carries none of the juz", () => {
    const pages = [page(1, "1:1"), page(300, "18:1")];
    expect(planPack(1, pages)!.pages).toEqual([1]);
  });

  it("counts the ayahs of the juz that this build has no paper for", () => {
    // Juz 30 is 78:1..114:6 — 564 ayahs. A build holding one leaf of it is
    // pinnable, and must say what is not in the pack rather than imply it is
    // whole. Silence about a hole reads as an assurance.
    const plan = planPack(30, [page(582, "78:1", "78:2")])!;
    const [first, last] = juzSpan(30)!;
    expect(plan.absentAyahs).toBe(last - first + 1 - 2);
  });

  it("is zero-absent on a build that holds the juz whole", () => {
    const [first, last] = juzSpan(30)!;
    const keys: string[] = [];
    for (let abs = first; abs <= last; abs++) {
      const { surah, ayah } = fromAbsolute(abs);
      keys.push(`${surah}:${ayah}`);
    }
    const plan = planPack(30, [page(582, ...keys)])!;
    expect(plan.absentAyahs).toBe(0);
  });

  it("distinguishes no such juz from a juz with nothing in it", () => {
    expect(planPack(0, [page(1, "1:1")])).toBeNull();
    expect(planPack(31, [page(1, "1:1")])).toBeNull();
  });

  it("plans an empty pack for a build that holds none of the juz", () => {
    const plan = planPack(30, [page(1, "1:1")])!;
    expect(plan.pages).toEqual([]);
    expect(plan.surahs).toEqual([]);
    expect(plan.absentAyahs).toBeGreaterThan(0);
  });
});

describe("juzOfPage", () => {
  it("names the earlier juz on a leaf that straddles a boundary", () => {
    // The offer on this leaf is "pin juz 1" — the one being read, not the one
    // about to be reached.
    expect(juzOfPage(22, [page(22, "2:141", "2:142")])).toBe(1);
  });

  it("names the only juz on an ordinary leaf", () => {
    expect(juzOfPage(300, [page(300, "18:1", "18:2")])).toBe(juzOf(18, 1));
  });

  it("has no opinion about a page this build does not hold", () => {
    expect(juzOfPage(999, [page(1, "1:1")])).toBeNull();
  });
});

describe("juzPageIndex", () => {
  it("is one entry per juz, whatever the build holds", () => {
    expect(juzPageIndex([page(1, "1:1")])).toHaveLength(JUZ_COUNT);
  });

  it("opens a juz on the leaf where it begins, not where the one before it ends", () => {
    // Page 22 straddles: 2:141 closes juz 1 and 2:142 opens juz 2. `juzOfPage`
    // calls that leaf juz 1's; this calls it juz 2's start. Both are true of the
    // same sheet, which is what a boundary is.
    const index = juzPageIndex([page(21, "2:100"), page(22, "2:141", "2:142")]);
    expect(index[0]).toBe(21);
    expect(index[1]).toBe(22);
  });

  it("takes the lowest page, not the first one the manifest happens to list", () => {
    const descending = [page(23, "2:150"), page(22, "2:142")];
    expect(juzPageIndex(descending)[1]).toBe(22);
  });

  it("leaves a juz this build does not carry as null rather than the next one along", () => {
    // A partial edition that holds juz 2 and not juz 3 must not send a reader
    // asking for juz 3 to juz 4's opening and call it an arrival.
    const index = juzPageIndex([page(22, "2:142")]);
    expect(index[1]).toBe(22);
    expect(index[2]).toBeNull();
    expect(index[0]).toBeNull();
  });
});


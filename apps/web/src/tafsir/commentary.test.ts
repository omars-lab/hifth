import { describe, expect, it } from "vitest";
import { Resolver, type AssetManifest, type TafsirEntry, type TafsirSource } from "@hifth/core";
import { commentaryEdges, entryForAyah, indexEntries, introNote, isIntroOnly, noteFor } from "./commentary";

/** A tiny edition: 2:38 on page 7, 2:53 on page 9; 2:255 is not vendored. */
const manifest: AssetManifest = {
  edition: "hafs-kfqc",
  editionLabel: "Hafs (test)",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "v38", number: 2038, surah: 2, ayah: 38, key: "quran/hafs-kfqc/2:38" },
      ],
    },
    {
      edition: "hafs-kfqc",
      page: 9,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "v53", number: 2053, surah: 2, ayah: 53, key: "quran/hafs-kfqc/2:53" },
      ],
    },
  ],
};

const entry = (key: string, refs: string[] = []): TafsirEntry => ({ key, refs });

describe("indexEntries", () => {
  it("buckets entries by surah:ayah", () => {
    const idx = indexEntries([
      entry("tafsir/study-quran/2:38"),
      entry("tafsir/study-quran/2:53"),
    ]);
    expect(idx.get("2:38")?.key).toBe("tafsir/study-quran/2:38");
    expect(idx.get("2:53")?.key).toBe("tafsir/study-quran/2:53");
    expect(idx.size).toBe(2);
  });

  it("drops entries whose key is not a tafsir key", () => {
    const idx = indexEntries([
      entry("quran/hafs-kfqc/2:38"), // wrong namespace
      entry("tafsir//2:1"), // empty name
      entry("tafsir/study-quran/2:38"),
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get("2:38")?.key).toBe("tafsir/study-quran/2:38");
  });
});

describe("entryForAyah", () => {
  it("finds an entry by a canonical ayah key", () => {
    const idx = indexEntries([entry("tafsir/study-quran/2:38")]);
    expect(entryForAyah(idx, "quran/hafs-kfqc/2:38")?.key).toBe("tafsir/study-quran/2:38");
    expect(entryForAyah(idx, "quran/hafs-kfqc/2:39")).toBeUndefined();
    expect(entryForAyah(idx, "not-a-key")).toBeUndefined();
  });
});

describe("commentaryEdges", () => {
  const resolver = new Resolver(manifest);

  it("builds a tafsir-ref edge per ref with resolved page and direction", () => {
    const e = entry("tafsir/study-quran/2:38", ["quran/hafs-kfqc/2:53"]);
    const [edge, ...rest] = commentaryEdges(e, "quran/hafs-kfqc/2:38", resolver);
    expect(rest).toHaveLength(0);
    expect(edge?.type).toBe("tafsir-ref");
    expect(edge?.to).toBe("quran/hafs-kfqc/2:53");
    expect(edge?.page).toBe(9);
    expect(edge?.dir.dSurah).toBe(0); // 2 → 2
    expect(edge?.dir.dPage).toBe(2); // page 9 − page 7
  });

  it("returns the edge with page 0 for an unvendored target (canHop disables it)", () => {
    const e = entry("tafsir/study-quran/2:38", ["quran/hafs-kfqc/2:255"]);
    const [edge] = commentaryEdges(e, "quran/hafs-kfqc/2:38", resolver);
    expect(edge?.to).toBe("quran/hafs-kfqc/2:255");
    expect(edge?.page).toBe(0);
    expect(edge?.dir.dPage).toBe(0); // target page unknown → no distance claim
  });

  it("de-dupes repeated refs, keeping the first", () => {
    const e = entry("tafsir/study-quran/2:38", [
      "quran/hafs-kfqc/2:53",
      "quran/hafs-kfqc/2:53",
    ]);
    expect(commentaryEdges(e, "quran/hafs-kfqc/2:38", resolver)).toHaveLength(1);
  });

  it("returns [] for no entry and for an unparseable fromKey", () => {
    expect(commentaryEdges(undefined, "quran/hafs-kfqc/2:38", resolver)).toEqual([]);
    const e = entry("tafsir/study-quran/2:38", ["quran/hafs-kfqc/2:53"]);
    expect(commentaryEdges(e, "not-a-key", resolver)).toEqual([]);
  });
});

describe("tafsir · noteFor (what the one commentary drawer reads)", () => {
  const source: TafsirSource = { id: "a-book", label: "A Book", license: "Its terms", edition: "hafs-kfqc" };
  const full: TafsirEntry = {
    key: "tafsir/a-book/2:38",
    translation: "the verse in English",
    commentary: [{ text: "first" }, { text: "second", channel: "ocr" }],
    refs: [],
  };

  it("carries the source, so the drawer names whose words these are", () => {
    const note = noteFor(full, source, "quran/hafs-kfqc/2:38");
    expect(note?.source).toBe(source);
    expect(note?.ayahKey).toBe("quran/hafs-kfqc/2:38");
    expect(note?.translation).toBe("the verse in English");
    expect(note?.paragraphs).toEqual(["first", "second"]);
    expect(note?.intro).toBeNull();
  });

  it("leads with a surah's introduction only when one is handed in", () => {
    const intro = { title: "The Cow", paragraphs: ["about the surah"] };
    expect(noteFor(full, source, "quran/hafs-kfqc/2:38", intro)?.intro).toEqual(intro);
  });

  it("a surah's introduction makes a note of its own, with no verse's words in it", () => {
    const intro = { title: "The Cow", paragraphs: ["about the surah"] };
    const note = introNote(source, "quran/hafs-kfqc/2:1", intro);
    expect(note).toEqual({ source, ayahKey: "quran/hafs-kfqc/2:1", paragraphs: [], intro, introOnly: true });
    expect(isIntroOnly(note)).toBe(true);
    expect(isIntroOnly(noteFor(full, source, "quran/hafs-kfqc/2:1", intro)!)).toBe(false);
  });

  it("a source that sends only a translation, or only commentary, still makes a note", () => {
    expect(noteFor({ key: full.key, translation: "t", refs: [] }, source, "quran/hafs-kfqc/2:38")?.paragraphs).toEqual([]);
    expect(noteFor({ key: full.key, commentary: [{ text: "c" }], refs: [] }, source, "quran/hafs-kfqc/2:38")?.translation).toBeUndefined();
  });

  it("nothing to draw without an entry, or with an entry that says nothing", () => {
    expect(noteFor(undefined, source, "quran/hafs-kfqc/2:38")).toBeNull();
    expect(noteFor({ key: full.key, commentary: [{ text: "  " }], refs: [] }, source, "quran/hafs-kfqc/2:38")).toBeNull();
  });
});

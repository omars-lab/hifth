import { describe, expect, it } from "vitest";
import type { AdjacencyShard, Edge } from "@hifth/core";
import {
  introFor,
  makePitchProvider,
  mergeShard,
  pitchEntries,
  STUDY_QURAN,
  withBookRefs,
  type PitchSurah,
} from "./pitch";

// A made-up surah: the shape of the private file, none of its words.
const surah: PitchSurah = {
  surah: 2,
  title: "Title",
  intro: ["first paragraph", "second paragraph"],
  verses: {
    "2:1": { ref: "2:1", key: "quran/hafs-kfqc/2:1", translation: "t1", commentary: ["c1"] },
    "2:255": { ref: "2:255", key: "quran/hafs-kfqc/2:255", translation: "t2", commentary: ["c2", "c3"] },
  },
  shard: {},
};

describe("pitch · the book's notes as one more commentary source", () => {
  it("each verse becomes one entry under the book's own name", () => {
    const entries = pitchEntries(surah);
    expect(entries.map((e) => e.key).sort()).toEqual(["tafsir/study-quran/2:1", "tafsir/study-quran/2:255"]);
    const e = entries.find((x) => x.key.endsWith("2:255"))!;
    expect(e.translation).toBe("t2");
    expect(e.commentary?.map((b) => b.text)).toEqual(["c2", "c3"]);
  });

  it("the source answers for every surah and hands back that surah's entries", async () => {
    const provider = makePitchProvider(async (n) => (n === 2 ? surah : null));
    expect(provider.source).toBe(STUDY_QURAN);
    expect(provider.has(1) && provider.has(114)).toBe(true);
    expect(provider.has(0) || provider.has(115)).toBe(false);
    expect(await provider.load(2)).toHaveLength(2);
  });

  it("a surah with no file is a quiet empty answer, never an error", async () => {
    const provider = makePitchProvider(async () => null);
    expect(await provider.load(3)).toEqual([]);
  });
});

describe("pitch · introFor", () => {
  it("no verse's note leads with the surah's context unasked, not even the opening verse's", () => {
    // Owner, 2026-10-04: the introduction belongs beside the surah's name, behind
    // its own ⓘ badge, not stacked on top of verse 1's note.
    expect(introFor(surah, "quran/hafs-kfqc/2:1")).toBeNull();
    expect(introFor(surah, "quran/hafs-kfqc/2:255")).toBeNull();
  });

  it("a link that asks for the context gets it on any verse (?open=context)", () => {
    expect(introFor(surah, "quran/hafs-kfqc/2:255", true)?.paragraphs).toEqual(surah.intro);
  });

  it("nothing without a surah, a selection, or a surah that has an introduction", () => {
    expect(introFor(null, "quran/hafs-kfqc/2:1", true)).toBeNull();
    expect(introFor(surah, null, true)).toBeNull();
    expect(introFor({ ...surah, intro: [] }, "quran/hafs-kfqc/2:1", true)).toBeNull();
  });
});

// Made-up edges: verse numbers only, none of the book's words.
const k = (ref: string) => `quran/hafs-kfqc/${ref}`;
const edge = (to: string, extra: Partial<Edge> = {}): Edge => ({
  type: "mutashabih",
  to: k(to),
  page: 1,
  dir: { dSurah: 0, dPage: 0 },
  ...extra,
});
const bookRef = (to: string): Edge =>
  edge(to, { type: "related-meaning", src: "study-quran-xref", note: "a line" });

describe("pitch · the book's cross-references stay in the note", () => {
  const base: AdjacencyShard = {
    "48": { edges: [edge("2:122"), edge("82:19", { type: "related-meaning", note: "ours" })], ext: [] },
  };
  const pitch: AdjacencyShard = {
    "48": { edges: [bookRef("2:255"), bookRef("82:19")], ext: [] },
    "1": { edges: [edge("10:10", { type: "related-meaning", src: "study-quran-meaning" })], ext: [] },
  };

  it("the similar-verse buttons get none of the book's cross-references", () => {
    // A cross-reference is linked by meaning, not wording; under a button that
    // says "looks like" it sends a hafiz hunting for a trap that is not there.
    const merged = mergeShard(base, pitch);
    expect(merged["48"]!.edges.map((e) => e.to)).toEqual([k("2:122"), k("82:19")]);
  });

  it("the demo's own hand-picked roads still join them", () => {
    expect(mergeShard(base, pitch)["1"]!.edges.map((e) => e.to)).toEqual([k("10:10")]);
  });

  it("the note lists each related verse once, keeping the app's own line over the book's", () => {
    const merged = mergeShard(base, pitch);
    const roads = withBookRefs(merged["48"]!.edges, pitch["48"]);
    expect(roads.map((e) => e.to)).toEqual([k("2:122"), k("82:19"), k("2:255")]);
    expect(roads.find((e) => e.to === k("82:19"))!.note).toBe("ours");
  });

  it("a verse the book does not cross-reference keeps just its own roads", () => {
    expect(withBookRefs([edge("2:122")], undefined).map((e) => e.to)).toEqual([k("2:122")]);
  });
});

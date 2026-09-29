import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getTafsirProvider,
  listTafsirProviders,
  unregisterTafsirProvider,
} from "@hifth/core";
import {
  adaptEntry,
  importTafsirBundle,
  parseBundleFiles,
  removeTafsirBundle,
  restoreTafsirProviders,
  type ParsedBundle,
} from "./sideload.js";

/*
 * The side-load is the app's half of the tafsir seam: it reads the on-disk
 * bundle shape (an object translation, lemma-grouped commentary, `{key}` refs)
 * and must hand core the flat `TafsirEntry` the panel renders. So the tests
 * spend their effort on the *adaptation* — a translation that is an object vs a
 * bare string, a block that kept its channel, refs flattened to keys — and on
 * the two things a reader actually depends on surviving: a re-import replacing
 * the old edition cleanly, and the provider coming back after a reload.
 *
 * IndexedDB is the real spec (fake-indexeddb). The core registry is module
 * state, so each test clears it first.
 */

const SOURCE_ID = "study-quran";

/** The shape `export_tafseer.py` writes, trimmed to what the adapter reads. */
function bundle(): ParsedBundle {
  return {
    manifest: {
      source: SOURCE_ID,
      license: "private",
      edition: "hafs-kfqc",
      title: "The Study Quran",
      surahs: { "1": { file: "001.json" }, "2": { file: "002.json" } },
    },
    surahs: new Map([
      [
        1,
        {
          surah: 1,
          entries: [
            {
              key: "quran/hafs-kfqc/1:1",
              translation: { text: "In the Name of God…", page: 3, png: "p3.png", sha: "abc" },
              commentary: [
                { lemma: [1, 1], blocks: [{ text: "The Basmalah…", channel: "ax" }] },
                { lemma: [1, 1], blocks: [{ text: "recovered head", channel: "ocr" }] },
              ],
              refs: [{ key: "quran/hafs-kfqc/27:30", commentary: false }],
            },
          ],
        },
      ],
      [
        2,
        {
          surah: 2,
          entries: [
            {
              key: "quran/hafs-kfqc/2:30",
              translation: "And when thy Lord said…",
              commentary: [{ lemma: [30, 30], blocks: [{ text: "khalīfah, vicegerent…", channel: "ocr" }] }],
              refs: ["quran/hafs-kfqc/7:69"],
            },
          ],
        },
      ],
    ]),
  };
}

const source = { id: SOURCE_ID, label: "The Study Quran", license: "private", edition: "hafs-kfqc" };

beforeEach(async () => {
  unregisterTafsirProvider();
  await removeTafsirBundle(SOURCE_ID);
});

describe("adaptEntry", () => {
  it("keys through the grammar and flattens the disk shape", () => {
    const entry = adaptEntry(
      {
        key: "quran/hafs-kfqc/2:30",
        translation: { text: "…said…" },
        commentary: [{ lemma: [30, 30], blocks: [{ text: "one", channel: "ocr" }, { text: "two", channel: "ax" }] }],
        refs: [{ key: "quran/hafs-kfqc/7:69" }, "quran/hafs-kfqc/38:26"],
      },
      source,
    );
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe("tafsir/study-quran/2:30");
    expect(entry?.translation).toBe("…said…");
    expect(entry?.commentary).toEqual([
      { text: "one", channel: "ocr", lemma: [30, 30] },
      { text: "two", channel: "ax", lemma: [30, 30] },
    ]);
    expect(entry?.refs).toEqual(["quran/hafs-kfqc/7:69", "quran/hafs-kfqc/38:26"]);
  });

  it("takes a bare-string translation and omits an empty one", () => {
    const withString = adaptEntry({ key: "quran/hafs-kfqc/1:1", translation: "hi", refs: [] }, source);
    expect(withString?.translation).toBe("hi");
    const withoutText = adaptEntry({ key: "quran/hafs-kfqc/1:1", translation: { text: "" }, refs: [] }, source);
    expect(withoutText && "translation" in withoutText).toBe(false);
  });

  it("drops an entry whose disk key is not a parseable ayah key", () => {
    expect(adaptEntry({ key: "not-a-key", refs: [] }, source)).toBeNull();
  });
});

describe("importTafsirBundle", () => {
  it("stores, registers a provider, and reports what it did", async () => {
    const result = await importTafsirBundle(bundle());
    expect(result.ok).toBe(true);
    expect(result.sourceId).toBe(SOURCE_ID);
    expect(result.surahs).toEqual([1, 2]);
    expect(result.entries).toBe(2);

    const provider = getTafsirProvider(SOURCE_ID);
    expect(provider).toBeDefined();
    expect(provider?.has(1)).toBe(true);
    expect(provider?.has(3)).toBe(false);

    const s2 = await provider!.load(2);
    expect(s2).toHaveLength(1);
    expect(s2[0]?.key).toBe("tafsir/study-quran/2:30");
    expect(s2[0]?.commentary?.[0]?.channel).toBe("ocr");
    expect(await provider!.load(3)).toEqual([]);
  });

  it("rejects a manifest whose source id carries a slash", async () => {
    const b = bundle();
    const bad: ParsedBundle = { ...b, manifest: { ...b.manifest, source: "a/b" } };
    const result = await importTafsirBundle(bad);
    expect(result.ok).toBe(false);
    expect(getTafsirProvider("a/b")).toBeUndefined();
  });

  it("replaces a prior edition cleanly, leaving no orphaned surah", async () => {
    await importTafsirBundle(bundle());
    // A corrected re-import that dropped surah 2.
    const smaller = bundle();
    const oneSurah: ParsedBundle = {
      manifest: { ...smaller.manifest, surahs: { "1": { file: "001.json" } } },
      surahs: new Map([[1, smaller.surahs.get(1)!]]),
    };
    const result = await importTafsirBundle(oneSurah);
    expect(result.surahs).toEqual([1]);
    const provider = getTafsirProvider(SOURCE_ID);
    expect(provider?.has(2)).toBe(false);
    expect(await provider!.load(2)).toEqual([]);
  });
});

describe("restoreTafsirProviders", () => {
  it("re-registers the provider from the store after a reload", async () => {
    await importTafsirBundle(bundle());
    unregisterTafsirProvider(); // simulate a fresh page: registry empty, store intact
    expect(listTafsirProviders()).toEqual([]);

    const restored = await restoreTafsirProviders();
    expect(restored).toEqual([SOURCE_ID]);
    const provider = getTafsirProvider(SOURCE_ID);
    expect(provider?.has(1)).toBe(true);
    expect((await provider!.load(1))[0]?.key).toBe("tafsir/study-quran/1:1");
  });

  it("removeTafsirBundle unregisters and clears the store", async () => {
    await importTafsirBundle(bundle());
    await removeTafsirBundle(SOURCE_ID);
    expect(getTafsirProvider(SOURCE_ID)).toBeUndefined();
    // Nothing left to restore.
    expect(await restoreTafsirProviders()).toEqual([]);
  });
});

describe("parseBundleFiles", () => {
  it("reads manifest.json and the surah files it names, ignoring strays", () => {
    const files = [
      { name: "tafseer-bundle/manifest.json", text: JSON.stringify(bundle().manifest) },
      { name: "tafseer-bundle/001.json", text: JSON.stringify(bundle().surahs.get(1)) },
      { name: "tafseer-bundle/002.json", text: JSON.stringify(bundle().surahs.get(2)) },
      { name: "tafseer-bundle/coverage.md", text: "# not json" },
    ];
    const parsed = parseBundleFiles(files);
    expect(parsed).not.toBeNull();
    expect([...parsed!.surahs.keys()].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("returns null when the manifest is missing", () => {
    expect(parseBundleFiles([{ name: "001.json", text: "{}" }])).toBeNull();
  });
});

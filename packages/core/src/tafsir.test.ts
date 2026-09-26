import { describe, it, expect, beforeEach } from "vitest";
import {
  getTafsirProvider,
  listTafsirProviders,
  registerTafsirProvider,
  tafsirKeyFor,
  unregisterTafsirProvider,
  type TafsirEntry,
  type TafsirProvider,
  type TafsirSource,
} from "./tafsir.js";

const source: TafsirSource = {
  id: "study-quran",
  label: "The Study Quran",
  license: "private",
  edition: "hafs-kfqc",
};

function fakeProvider(only: number, entries: TafsirEntry[]): TafsirProvider {
  return {
    source,
    has: (surah) => surah === only,
    load: async (surah) => (surah === only ? entries : []),
  };
}

describe("tafsir registry", () => {
  beforeEach(() => unregisterTafsirProvider());

  it("registers, finds, and lists a provider", () => {
    const p = fakeProvider(2, []);
    registerTafsirProvider(p);
    expect(getTafsirProvider("study-quran")).toBe(p);
    expect(listTafsirProviders()).toEqual([p]);
  });

  it("replaces a provider registered under the same id", () => {
    const a = fakeProvider(2, []);
    const b = fakeProvider(3, []);
    registerTafsirProvider(a);
    registerTafsirProvider(b);
    expect(getTafsirProvider("study-quran")).toBe(b);
    expect(listTafsirProviders()).toHaveLength(1);
  });

  it("unregisters one and all", () => {
    registerTafsirProvider(fakeProvider(2, []));
    unregisterTafsirProvider("study-quran");
    expect(getTafsirProvider("study-quran")).toBeUndefined();
    registerTafsirProvider(fakeProvider(2, []));
    unregisterTafsirProvider();
    expect(listTafsirProviders()).toEqual([]);
  });

  it("has() gates load(), and an absent surah loads empty not throwing", async () => {
    const entry: TafsirEntry = {
      key: tafsirKeyFor(source, 2, 30),
      commentary: [{ text: "Vicegerent renders khalīfah…", channel: "ocr", lemma: [30, 30] }],
      refs: ["quran/hafs-kfqc/7:69"],
    };
    const p = fakeProvider(2, [entry]);
    expect(p.has(2)).toBe(true);
    expect(p.has(3)).toBe(false);
    expect(await p.load(2)).toEqual([entry]);
    expect(await p.load(3)).toEqual([]);
  });

  it("keys entries through the grammar", () => {
    expect(tafsirKeyFor(source, 2, 30)).toBe("tafsir/study-quran/2:30");
  });
});

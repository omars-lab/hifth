import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verseAudioUrl } from "./audio.js";
import {
  KEEP_CACHE,
  checkKept,
  forgetSurah,
  isKeptUrl,
  keepSurah,
  keptCopy,
  keptSurahs,
} from "./recitation-keep.js";

/*
 * A surah's recitation kept on the reader's own device (docs/PLAN.md, item
 * 101). The bytes sit in Cache Storage, a double here written to the three
 * things the module uses: put, match, delete. The claim sits in local storage,
 * which jsdom gives for real. The tests spend their effort on what goes wrong:
 * a file that will not come, a reader who stops halfway, a sweep that takes the
 * bytes and leaves the claim.
 */

class FakeCache {
  readonly entries = new Map<string, Response>();
  async put(url: string, res: Response): Promise<void> {
    this.entries.set(url, res);
  }
  async match(url: string): Promise<Response | undefined> {
    return this.entries.get(url)?.clone();
  }
  async delete(url: string): Promise<boolean> {
    return this.entries.delete(url);
  }
}

const stores = new Map<string, FakeCache>();
function keepCache(): FakeCache {
  let c = stores.get(KEEP_CACHE);
  if (!c) {
    c = new FakeCache();
    stores.set(KEEP_CACHE, c);
  }
  return c;
}

/** Al-Fatihah's seven verse files, in order. */
const FATIHAH = Array.from({ length: 7 }, (_, i) => verseAudioUrl(`quran/hafs-kfqc/1:${i + 1}`)!);

/** A made-up body, so sizes are numbers a line could show. */
const BODY = "x".repeat(1000);

let fetched: ReturnType<typeof vi.fn>;
beforeEach(() => {
  stores.clear();
  localStorage.clear();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      if (name !== KEEP_CACHE) throw new Error(`unexpected cache ${name}`);
      return keepCache();
    },
  });
  fetched = vi.fn(async (_url: string, _init?: RequestInit) => new Response(BODY, { status: 200 }));
  vi.stubGlobal("fetch", fetched);
});
afterEach(() => vi.unstubAllGlobals());

describe("keeping a surah's recitation on the device", () => {
  it("saves every verse's file and claims the surah, with its size", async () => {
    const kept = await keepSurah(1);
    expect(kept).toMatchObject({ surah: 1, total: 7, bytes: 7000 });
    expect([...keepCache().entries.keys()].sort()).toEqual([...FATIHAH].sort());
    expect(keptSurahs().map((k) => k.surah)).toEqual([1]);
  });

  it("asks the recording server with a plain request, no header of our own", async () => {
    // A header of our own on another site's file makes the browser ask that
    // site first, and this one does not allow it: nothing would be saved.
    await keepSurah(1);
    for (const call of fetched.mock.calls) expect(call[1]?.headers).toBeUndefined();
  });

  it("says how far it has got after every file", async () => {
    const seen: number[] = [];
    await keepSurah(1, { onProgress: (p) => seen.push(p.done) });
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("knows a kept verse's file without waiting, and hands back its copy", async () => {
    expect(isKeptUrl(FATIHAH[2]!)).toBe(false);
    await keepSurah(1);
    expect(isKeptUrl(FATIHAH[2]!)).toBe(true);
    expect(isKeptUrl(verseAudioUrl("quran/hafs-kfqc/2:1")!)).toBe(false);
    const copy = await keptCopy(FATIHAH[2]!);
    expect(copy?.size).toBe(1000);
  });

  it("a file that will not come leaves the surah claimed but short, and says so", async () => {
    fetched.mockImplementation(async (url: string) =>
      url === FATIHAH[3] ? new Response("", { status: 404 }) : new Response(BODY, { status: 200 }),
    );
    const kept = await keepSurah(1);
    expect(kept?.total).toBe(7);
    expect(await checkKept(kept!)).toMatchObject({ health: "torn", present: 6, total: 7 });
  });

  it("an empty answer is not a file", async () => {
    fetched.mockImplementation(async () => new Response("", { status: 200 }));
    const kept = await keepSurah(1);
    expect(await checkKept(kept!)).toMatchObject({ health: "gone", present: 0 });
  });

  it("keeping it again fetches only what is missing", async () => {
    fetched.mockImplementation(async (url: string) =>
      url === FATIHAH[3] ? new Response("", { status: 404 }) : new Response(BODY, { status: 200 }),
    );
    await keepSurah(1);
    fetched.mockClear();
    fetched.mockImplementation(async () => new Response(BODY, { status: 200 }));
    const kept = await keepSurah(1);
    expect(fetched.mock.calls.map((c) => c[0])).toEqual([FATIHAH[3]]);
    expect(await checkKept(kept!)).toMatchObject({ health: "whole", present: 7 });
    expect(kept?.bytes).toBe(7000);
  });

  it("stopped halfway, claims nothing and lets go of what it saved", async () => {
    const stop = new AbortController();
    const kept = await keepSurah(1, {
      signal: stop.signal,
      onProgress: (p) => {
        if (p.done === 2) stop.abort();
      },
    });
    expect(kept).toBeNull();
    expect(keptSurahs()).toEqual([]);
    expect(keepCache().entries.size).toBe(0);
  });

  it("notices when the device has cleared the files and kept the claim", async () => {
    const kept = await keepSurah(1);
    keepCache().entries.clear();
    expect(await checkKept(kept!)).toMatchObject({ health: "gone", present: 0, total: 7 });
    expect(await keptCopy(FATIHAH[0]!)).toBeUndefined();
  });

  it("removing a surah lets go of its files and its claim", async () => {
    await keepSurah(1);
    await keepSurah(114);
    await forgetSurah(1);
    expect(keptSurahs().map((k) => k.surah)).toEqual([114]);
    expect([...keepCache().entries.keys()].some((u) => FATIHAH.includes(u))).toBe(false);
    expect(isKeptUrl(FATIHAH[0]!)).toBe(false);
  });

  it("lists what is kept in the book's order", async () => {
    await keepSurah(114);
    await keepSurah(1);
    expect(keptSurahs().map((k) => k.surah)).toEqual([1, 114]);
  });

  it("with no place to keep files, keeps nothing and does not throw", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await keepSurah(1)).toBeNull();
    expect(keptSurahs()).toEqual([]);
    expect(await keptCopy(FATIHAH[0]!)).toBeUndefined();
  });

  it("a claim it cannot read is no claim", () => {
    localStorage.setItem("hifth.recitation.kept.v1", "{not json");
    expect(keptSurahs()).toEqual([]);
    expect(isKeptUrl(FATIHAH[0]!)).toBe(false);
  });
});

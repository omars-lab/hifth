import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTafsirProvider, listTafsirProviders, unregisterTafsirProvider } from "@hifth/core";
import {
  LIVE_TAFSIR_ID,
  liveTafsirConfigFromEnv,
  makeLiveTafsirProvider,
  registerLiveTafsirProvider,
  stripHtml,
  type LiveTafsirConfig,
} from "./quran-foundation";

const CONFIG: LiveTafsirConfig = {
  base: "https://api.example.test/api/v4",
  tafsirId: "169",
  label: "Tafsir al-Muyassar",
  license: "CC BY 4.0",
};

/** A fake `fetch` that returns one canned reply, recording the calls. */
function fakeFetch(reply: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => reply,
  })) as unknown as typeof fetch;
}

/** The service's per-chapter reply shape. */
function chapterReply(items: { verse_key: string; text: string }[]): unknown {
  return { tafsirs: items };
}

beforeEach(() => {
  for (const p of listTafsirProviders()) unregisterTafsirProvider(p.source.id);
});

describe("stripHtml", () => {
  it("flattens tags and decodes entities to plain text", () => {
    expect(stripHtml("<p>The <b>Mercy</b> &amp; the <i>Blessing</i></p>")).toBe(
      "The Mercy & the Blessing",
    );
    expect(stripHtml("a&nbsp;&nbsp;b\n\nc")).toBe("a b c");
  });

  it("decodes named and numeric entities beyond the common few", () => {
    // The live render showed a literal `&mdash;` — the panel gets real text.
    expect(stripHtml("His mercy &mdash; al-Rahman &#8212; al-Rahim&hellip;")).toBe(
      "His mercy — al-Rahman — al-Rahim…",
    );
  });
});

describe("liveTafsirConfigFromEnv", () => {
  it("returns null when base or id is missing", () => {
    expect(liveTafsirConfigFromEnv({} as ImportMetaEnv)).toBeNull();
    expect(
      liveTafsirConfigFromEnv({ VITE_TAFSIR_QF_BASE: "x" } as ImportMetaEnv),
    ).toBeNull();
    expect(
      liveTafsirConfigFromEnv({ VITE_TAFSIR_QF_ID: "1" } as ImportMetaEnv),
    ).toBeNull();
  });

  it("reads config and strips a trailing slash from the base", () => {
    const config = liveTafsirConfigFromEnv({
      VITE_TAFSIR_QF_BASE: "https://api.example.test/api/v4/",
      VITE_TAFSIR_QF_ID: "169",
      VITE_TAFSIR_QF_LABEL: "al-Muyassar",
    } as ImportMetaEnv);
    expect(config).toEqual({
      base: "https://api.example.test/api/v4",
      tafsirId: "169",
      label: "al-Muyassar",
    });
  });
});

describe("makeLiveTafsirProvider", () => {
  it("answers has() for every surah in range only", () => {
    const p = makeLiveTafsirProvider(CONFIG, fakeFetch(chapterReply([])));
    expect(p.has(1)).toBe(true);
    expect(p.has(114)).toBe(true);
    expect(p.has(0)).toBe(false);
    expect(p.has(115)).toBe(false);
    expect(p.has(1.5)).toBe(false);
    expect(p.source.id).toBe(LIVE_TAFSIR_ID);
    expect(p.source.label).toBe("Tafsir al-Muyassar");
  });

  it("maps a reply to entries: stripped text, live channel, grammar keys, no refs", async () => {
    const fetchImpl = fakeFetch(
      chapterReply([
        { verse_key: "1:1", text: "<p>In the Name of <b>God</b>.</p>" },
        { verse_key: "1:2", text: "Praise be to God." },
      ]),
    );
    const p = makeLiveTafsirProvider(CONFIG, fetchImpl);
    const entries = await p.load(1);
    expect(entries).toEqual([
      {
        key: "tafsir/quran-foundation/1:1",
        refs: [],
        commentary: [{ text: "In the Name of God.", channel: "live" }],
      },
      {
        key: "tafsir/quran-foundation/1:2",
        refs: [],
        commentary: [{ text: "Praise be to God.", channel: "live" }],
      },
    ]);
    // URL carries the tafsir id and the chapter number.
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(url).toBe("https://api.example.test/api/v4/quran/tafsirs/169?chapter_number=1");
  });

  it("drops items for another surah and empty text", async () => {
    const p = makeLiveTafsirProvider(
      CONFIG,
      fakeFetch(
        chapterReply([
          { verse_key: "2:1", text: "wrong surah" },
          { verse_key: "1:1", text: "   " },
          { verse_key: "1:2", text: "kept" },
        ]),
      ),
    );
    const entries = await p.load(1);
    expect(entries.map((e) => e.key)).toEqual(["tafsir/quran-foundation/1:2"]);
  });

  it("returns [] on a non-ok response and never throws", async () => {
    const p = makeLiveTafsirProvider(CONFIG, fakeFetch({}, false));
    await expect(p.load(1)).resolves.toEqual([]);
  });

  it("returns [] when fetch rejects", async () => {
    const boom = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const p = makeLiveTafsirProvider(CONFIG, boom);
    await expect(p.load(1)).resolves.toEqual([]);
  });

  it("returns [] for an out-of-range surah without fetching", async () => {
    const fetchImpl = fakeFetch(chapterReply([]));
    const p = makeLiveTafsirProvider(CONFIG, fetchImpl);
    await expect(p.load(200)).resolves.toEqual([]);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("caches a surah so a second load does not refetch", async () => {
    const fetchImpl = fakeFetch(chapterReply([{ verse_key: "1:1", text: "note" }]));
    const p = makeLiveTafsirProvider(CONFIG, fetchImpl);
    await p.load(1);
    await p.load(1);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("sends a bearer token when one is configured", async () => {
    const fetchImpl = fakeFetch(chapterReply([]));
    const p = makeLiveTafsirProvider({ ...CONFIG, token: "secret-token" }, fetchImpl);
    await p.load(1);
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(init.headers.Authorization).toBe("Bearer secret-token");
  });
});

describe("registerLiveTafsirProvider", () => {
  it("registers the provider when the build is configured", () => {
    const id = registerLiveTafsirProvider(
      {
        VITE_TAFSIR_QF_BASE: "https://api.example.test/api/v4",
        VITE_TAFSIR_QF_ID: "169",
      } as ImportMetaEnv,
      fakeFetch(chapterReply([])),
    );
    expect(id).toBe(LIVE_TAFSIR_ID);
    expect(getTafsirProvider(LIVE_TAFSIR_ID)?.has(2)).toBe(true);
  });

  it("registers nothing when unconfigured", () => {
    const id = registerLiveTafsirProvider({} as ImportMetaEnv, fakeFetch(chapterReply([])));
    expect(id).toBeNull();
    expect(getTafsirProvider(LIVE_TAFSIR_ID)).toBeUndefined();
  });
});

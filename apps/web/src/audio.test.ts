import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/preact";
import { useVerseAudio, verseAudioUrl, versesBetween } from "./audio";

// `verseAudioUrl` is the whole reason there is no API round-trip at play time:
// the file's address is a pure function of the ayah key. These pin the padding
// (surah and ayah each to three digits) and the one case that has no file — a
// key that points at a word or a range, not a whole ayah.
describe("verseAudioUrl", () => {
  it("pads surah and ayah to three digits each", () => {
    expect(verseAudioUrl("quran/hafs-kfqc/1:1")).toBe(
      "https://verses.quran.com/Minshawi/Murattal/mp3/001001.mp3",
    );
    expect(verseAudioUrl("quran/hafs-kfqc/2:255")).toBe(
      "https://verses.quran.com/Minshawi/Murattal/mp3/002255.mp3",
    );
    expect(verseAudioUrl("quran/hafs-kfqc/114:6")).toBe(
      "https://verses.quran.com/Minshawi/Murattal/mp3/114006.mp3",
    );
  });

  it("does not depend on the edition — the recitation is one for every skin", () => {
    expect(verseAudioUrl("quran/qpc-v4/36:1")).toBe(
      "https://verses.quran.com/Minshawi/Murattal/mp3/036001.mp3",
    );
  });

  it("returns null for a key that is not a bare ayah", () => {
    expect(verseAudioUrl("quran/hafs-kfqc/2:48#w3")).toBeNull();
    expect(verseAudioUrl("quran/hafs-kfqc/2:48#w3-7")).toBeNull();
    expect(verseAudioUrl("root/ktb")).toBeNull();
    expect(verseAudioUrl("")).toBeNull();
  });
});

// "Play to" (docs/design/verse-tap-and-hold.md): from the held verse to the one
// tapped next, in reading order whichever was tapped first, across a surah's end.
describe("versesBetween", () => {
  it("lists the verses from one to the other, both ends kept", () => {
    expect(versesBetween("quran/hafs-kfqc/2:39", "quran/hafs-kfqc/2:41")).toEqual([
      "quran/hafs-kfqc/2:39",
      "quran/hafs-kfqc/2:40",
      "quran/hafs-kfqc/2:41",
    ]);
  });

  it("reads in order when the stop comes before the start", () => {
    expect(versesBetween("quran/hafs-kfqc/2:41", "quran/hafs-kfqc/2:40")).toEqual([
      "quran/hafs-kfqc/2:40",
      "quran/hafs-kfqc/2:41",
    ]);
  });

  it("crosses into the next surah", () => {
    expect(versesBetween("quran/hafs-kfqc/1:7", "quran/hafs-kfqc/2:1")).toEqual([
      "quran/hafs-kfqc/1:7",
      "quran/hafs-kfqc/2:1",
    ]);
  });

  it("gives nothing for a key that is not a whole verse", () => {
    expect(versesBetween("quran/hafs-kfqc/2:39#w2", "quran/hafs-kfqc/2:41")).toEqual([]);
  });
});

/**
 * A stand-in for the browser's player: it never fetches, and a test says when
 * each verse finishes by firing `ended` itself.
 */
/** Verse n of the first surah, as the app names it. */
const v = (n: number) => `quran/hafs-kfqc/1:${n}`;

class FakePlayer extends EventTarget {
  static last: FakePlayer | null = null;
  src = "";
  currentTime = 0;
  preload = "";
  paused = true;
  error = null;
  constructor() {
    super();
    FakePlayer.last = this;
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
  removeAttribute(): void {
    this.src = "";
  }
  finish(): void {
    this.dispatchEvent(new Event("ended"));
  }
}

// The page lights the verse a run ended on only when the run got there by
// itself (docs/PLAN.md, item 60), so the hook must say so then and only then.
describe("useVerseAudio's word that a run has ended", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakePlayer.last = null;
  });

  it("names the last verse and the run once the run plays out", () => {
    vi.stubGlobal("Audio", FakePlayer);
    const ended = vi.fn();
    const { result } = renderHook(() => useVerseAudio(undefined, ended));
    act(() => result.current.playRun([v(1), v(2)]));
    act(() => FakePlayer.last!.finish());
    expect(ended).not.toHaveBeenCalled();
    act(() => FakePlayer.last!.finish());
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(v(2), 1);
    expect(result.current.runKey).toBeNull();
  });

  it("counts a second run as the second", () => {
    vi.stubGlobal("Audio", FakePlayer);
    const ended = vi.fn();
    const { result } = renderHook(() => useVerseAudio(undefined, ended));
    act(() => result.current.playRun([v(1)]));
    act(() => FakePlayer.last!.finish());
    act(() => result.current.playRun([v(3)]));
    act(() => FakePlayer.last!.finish());
    expect(ended).toHaveBeenLastCalledWith(v(3), 2);
  });

  it("says nothing for a run that was stopped or cut short by another verse", () => {
    vi.stubGlobal("Audio", FakePlayer);
    const ended = vi.fn();
    const { result } = renderHook(() => useVerseAudio(undefined, ended));
    act(() => result.current.playRun([v(1), v(2)]));
    act(() => result.current.stop());
    act(() => result.current.playRun([v(1), v(2)]));
    act(() => result.current.toggle(v(5)));
    act(() => FakePlayer.last!.finish());
    expect(ended).not.toHaveBeenCalled();
  });

  it("says nothing when one verse played on its own ends", () => {
    vi.stubGlobal("Audio", FakePlayer);
    const ended = vi.fn();
    const { result } = renderHook(() => useVerseAudio(undefined, ended));
    act(() => result.current.toggle(v(1)));
    act(() => FakePlayer.last!.finish());
    expect(ended).not.toHaveBeenCalled();
  });
});

/*
 * The silence between two verses of a run is the next verse's file coming over
 * the network after the last one ends: about a second on a poor connection
 * (docs/PLAN.md, item 63). So while one verse of a run sounds, the next one's
 * file is asked for. Kept in hand, it plays from the copy with no wait; asked
 * for only early, it plays from the network once more, and the browser may
 * answer from what it kept. Both ways are a setting; off asks for nothing.
 */
describe("useVerseAudio's next verse, made ready while a run plays", () => {
  const url = (n: number) => verseAudioUrl(v(n))!;
  const urls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  let made: string[] = [];
  let letGo: string[] = [];

  function answer(bytes: string) {
    const fetched = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([bytes])) } as Response),
    );
    vi.stubGlobal("fetch", fetched);
    vi.stubGlobal("Audio", FakePlayer);
    made = [];
    letGo = [];
    urls.createObjectURL = () => {
      const copy = `blob:held/${made.length + 1}`;
      made.push(copy);
      return copy;
    };
    urls.revokeObjectURL = (copy: string) => letGo.push(copy);
    return fetched;
  }
  const sounds = () => act(() => {
      FakePlayer.last!.dispatchEvent(new Event("playing"));
    });
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  afterEach(() => {
    // Unmounted first: the hook lets go of a copy still in hand as it goes.
    cleanup();
    vi.unstubAllGlobals();
    delete urls.createObjectURL;
    delete urls.revokeObjectURL;
    FakePlayer.last = null;
  });

  it("asks for the next verse's file while the first one sounds", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3)]));
    expect(fetched).not.toHaveBeenCalled();
    sounds();
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched.mock.calls[0]?.[0]).toBe(url(2));
    await settle();
  });

  it("plays the next verse from the copy in hand once it has come", async () => {
    answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2)]));
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/1");
  });

  it("lets the copy go once the verse after it starts, and on stop", async () => {
    answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3)]));
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/2");
    expect(letGo).toEqual(["blob:held/1"]);
    act(() => result.current.stop());
    expect(letGo).toEqual(["blob:held/1", "blob:held/2"]);
  });

  // A file streamed from the network starts once a little of it is in; a copy
  // needs all of it, so on a slow line waiting for one is the longer wait
  // (docs/issues/first-verse-wait-for-copy.md).
  it("plays from the network when the copy has not come yet, and drops its request", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2)]));
    sounds();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe(url(2));
    expect(fetched.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await settle();
    expect(made).toEqual([]);
  });

  it("does not keep an empty answer", async () => {
    answer("");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2)]));
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe(url(2));
  });

  it("asking early only, plays the next verse from the network", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "ask"));
    act(() => result.current.playRun([v(1), v(2)]));
    sounds();
    expect(fetched.mock.calls[0]?.[0]).toBe(url(2));
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe(url(2));
    expect(made).toEqual([]);
  });

  it("asks for nothing when the setting is off, or for a verse played on its own", async () => {
    const fetched = answer("sound");
    const off = renderHook(() => useVerseAudio(undefined, undefined, "off"));
    act(() => off.result.current.playRun([v(1), v(2)]));
    sounds();
    const alone = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => alone.result.current.toggle(v(1)));
    sounds();
    await settle();
    expect(fetched).not.toHaveBeenCalled();
  });
  /*
   * One verse ahead is not always enough: a short verse before a long one ends
   * before the long one's file is in (docs/PLAN.md, item 64). So once one file
   * has come, the next is asked for, a few verses ahead, one after another so
   * they do not share a slow line.
   */
  const asked = (fetched: ReturnType<typeof answer>) => fetched.mock.calls.map((c) => c[0]);

  it("asks for the verse after the next once the next one's file is in", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3), v(4)]));
    sounds();
    expect(asked(fetched)).toEqual([url(2)]);
    await settle();
    expect(asked(fetched)).toEqual([url(2), url(3), url(4)]);
  });

  it("asks no further than three verses ahead", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([1, 2, 3, 4, 5, 6, 7, 8].map(v)));
    sounds();
    await settle();
    await settle();
    expect(asked(fetched)).toEqual([url(2), url(3), url(4)]);
    act(() => FakePlayer.last!.finish());
    sounds();
    await settle();
    expect(asked(fetched)).toEqual([url(2), url(3), url(4), url(5)]);
  });

  it("keeps the copies for the verses still to come when the next one starts", async () => {
    answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3)]));
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(letGo).toEqual([]);
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/2");
    expect(letGo).toEqual(["blob:held/1"]);
  });

  it("lets a later verse's file keep coming when the next verse starts", async () => {
    vi.stubGlobal("Audio", FakePlayer);
    made = [];
    urls.createObjectURL = () => `blob:held/${made.push("x")}`;
    urls.revokeObjectURL = () => {};
    const waiting: { url: string; signal: AbortSignal | null | undefined; come: () => void }[] = [];
    vi.stubGlobal("fetch", (u: string, init?: RequestInit) =>
      new Promise<Response>((done) => {
        const come = () => done({ ok: true, blob: () => Promise.resolve(new Blob(["sound"])) } as Response);
        waiting.push({ url: u, signal: init?.signal, come });
      }),
    );
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3)]));
    sounds();
    waiting[0]!.come();
    await settle();
    expect(waiting.map((w) => w.url)).toEqual([url(2), url(3)]);
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(waiting[1]!.signal?.aborted).toBe(false);
    waiting[1]!.come();
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/2");
  });

  it("asking early only, does not ask twice for a verse already asked for", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "ask"));
    act(() => result.current.playRun([1, 2, 3, 4, 5].map(v)));
    sounds();
    await settle();
    act(() => FakePlayer.last!.finish());
    sounds();
    await settle();
    expect(asked(fetched)).toEqual([url(2), url(3), url(4), url(5)]);
  });

  // A presenter stops part way and picks a new range that starts on a verse
  // already fetched: the copies still wanted are kept, not fetched again.
  it("a new run from a verse already fetched plays it from its copy and keeps the rest", async () => {
    const fetched = answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2), v(3)]));
    sounds();
    await settle();
    expect(made).toEqual(["blob:held/1", "blob:held/2"]);
    act(() => result.current.playRun([v(2), v(3), v(4)]));
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(letGo).toEqual([]);
    sounds();
    await settle();
    expect(asked(fetched)).toEqual([url(2), url(3), url(4)]);
  });

  it("lets go of every copy in hand on stop", async () => {
    answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([1, 2, 3, 4].map(v)));
    sounds();
    await settle();
    expect(made).toEqual(["blob:held/1", "blob:held/2", "blob:held/3"]);
    act(() => result.current.stop());
    expect([...letGo].sort()).toEqual(made);
  });
});

/*
 * The first verse of a recitation waits for its whole file after Play is
 * pressed: about a second and a half on a poor connection (docs/PLAN.md, item
 * 65). So the verse whose Play is in reach is asked for as soon as the menu or
 * panel that offers it opens, and the press finds it in hand.
 */
describe("useVerseAudio's verse made ready before Play is pressed", () => {
  const url = (n: number) => verseAudioUrl(v(n))!;
  const urls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  let made: string[] = [];
  let letGo: string[] = [];
  const waiting: { url: string; come: () => void; fail: () => void }[] = [];

  function line() {
    vi.stubGlobal("Audio", FakePlayer);
    made = [];
    letGo = [];
    waiting.length = 0;
    urls.createObjectURL = () => {
      const copy = `blob:held/${made.length + 1}`;
      made.push(copy);
      return copy;
    };
    urls.revokeObjectURL = (copy: string) => letGo.push(copy);
    const fetched = vi.fn((u: string, _init?: RequestInit) =>
      new Promise<Response>((done, refuse) => {
        waiting.push({
          url: u,
          come: () => done({ ok: true, blob: () => Promise.resolve(new Blob(["sound"])) } as Response),
          fail: () => refuse(new Error("no line")),
        });
      }),
    );
    vi.stubGlobal("fetch", fetched);
    return fetched;
  }
  const asked = (fetched: ReturnType<typeof line>) => fetched.mock.calls.map((c) => c[0]);
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete urls.createObjectURL;
    delete urls.revokeObjectURL;
    FakePlayer.last = null;
  });

  it("asks for the verse as soon as its Play is in reach, and plays it from the copy", async () => {
    const fetched = line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    expect(asked(fetched)).toEqual([url(5)]);
    waiting[0]!.come();
    await settle();
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(asked(fetched)).toEqual([url(5)]);
  });

  it("a press while the file is on its way lets the request go and plays from the network", async () => {
    const fetched = line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe(url(5));
    expect(fetched.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    waiting[0]!.come();
    await settle();
    expect(FakePlayer.last!.src).toBe(url(5));
    expect(made).toEqual([]);
  });

  it("starts a run from the copy of its first verse", async () => {
    line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    waiting[0]!.come();
    await settle();
    act(() => result.current.playRun([v(5), v(6)]));
    expect(FakePlayer.last!.src).toBe("blob:held/1");
  });

  it("asking early only, plays from the network once the request has come", async () => {
    line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "ask"));
    act(() => result.current.prepare(v(5)));
    waiting[0]!.come();
    await settle();
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe(url(5));
    expect(made).toEqual([]);
  });

  it("a request that fails at once neither throws nor stops the press playing from the network", async () => {
    line();
    vi.stubGlobal("fetch", () => {
      throw new Error("no fetch here");
    });
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    expect(() => act(() => result.current.prepare(v(5)))).not.toThrow();
    await settle();
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe(url(5));
  });

  it("asks for nothing when the setting is off", async () => {
    const fetched = line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "off"));
    act(() => result.current.prepare(v(5)));
    act(() => result.current.toggle(v(5)));
    expect(fetched).not.toHaveBeenCalled();
    expect(FakePlayer.last!.src).toBe(url(5));
  });

  it("asks nothing for the verse already playing, nor while a run plays", async () => {
    const fetched = line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.toggle(v(1)));
    act(() => result.current.prepare(v(1)));
    expect(fetched).not.toHaveBeenCalled();
    act(() => result.current.playRun([v(2), v(3)]));
    act(() => result.current.prepare(v(9)));
    expect(asked(fetched)).not.toContain(url(9));
  });

  it("lets the last verse's copy go when another verse's Play comes in reach", async () => {
    const fetched = line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    waiting[0]!.come();
    await settle();
    act(() => result.current.prepare(v(6)));
    expect(letGo).toEqual(["blob:held/1"]);
    expect(asked(fetched)).toEqual([url(5), url(6)]);
  });

  it("drops a request still on its way when another verse's Play comes in reach", async () => {
    line();
    const signals: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal("fetch", (_u: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return new Promise<Response>(() => {});
    });
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    act(() => result.current.prepare(v(6)));
    expect(signals.map((s) => s?.aborted)).toEqual([true, false]);
  });

  it("plays from the network when the request failed", async () => {
    line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    waiting[0]!.fail();
    await settle();
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe(url(5));
  });

  it("lets the copy go on stop", async () => {
    line();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.prepare(v(5)));
    waiting[0]!.come();
    await settle();
    act(() => result.current.stop());
    expect(letGo).toEqual(["blob:held/1"]);
  });
});

// A surah the reader kept on the device (docs/PLAN.md, item 101) plays from its
// copy whatever the setting for asking early says, and with no connection at
// all: the copy is the reason the reader kept it.
describe("useVerseAudio's verse kept on the device", () => {
  const url = (n: number) => verseAudioUrl(v(n))!;
  const urls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  let made: string[] = [];

  /** The first surah kept; any other not. */
  function kept() {
    const copied: string[] = [];
    return {
      copied,
      source: {
        has: (u: string) => u.includes("/001"),
        copy: (u: string) => {
          copied.push(u);
          return Promise.resolve(new Blob(["sound"]));
        },
      },
    };
  }
  function line() {
    vi.stubGlobal("Audio", FakePlayer);
    made = [];
    urls.createObjectURL = () => {
      const copy = `blob:held/${made.length + 1}`;
      made.push(copy);
      return copy;
    };
    urls.revokeObjectURL = () => {};
    const fetched = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetched);
    return fetched;
  }
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete urls.createObjectURL;
    delete urls.revokeObjectURL;
    FakePlayer.last = null;
  });

  it("makes a kept verse ready from its copy with the setting off, and asks the network nothing", async () => {
    const fetched = line();
    const k = kept();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "off", k.source));
    act(() => result.current.prepare(v(5)));
    await settle();
    act(() => result.current.toggle(v(5)));
    expect(k.copied).toEqual([url(5)]);
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(fetched).not.toHaveBeenCalled();
  });

  it("a run with the setting off still makes its next kept verse ready", async () => {
    line();
    const k = kept();
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "off", k.source));
    act(() => result.current.playRun([v(1), v(2)]));
    act(() => { FakePlayer.last!.dispatchEvent(new Event("playing")); });
    await settle();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe("blob:held/1");
  });

  it("a kept verse that will not load from the network plays from its copy, with no word of failure", async () => {
    line();
    const k = kept();
    const failed: string[] = [];
    const { result } = renderHook(() => useVerseAudio((key) => failed.push(key), undefined, "off", k.source));
    // Pressed before its copy was ready: it starts from the network, which is down.
    act(() => result.current.toggle(v(5)));
    expect(FakePlayer.last!.src).toBe(url(5));
    act(() => { FakePlayer.last!.dispatchEvent(new Event("error")); });
    await settle();
    expect(FakePlayer.last!.src).toBe("blob:held/1");
    expect(failed).toEqual([]);
    // The copy failing too is a real failure, and says so.
    act(() => { FakePlayer.last!.dispatchEvent(new Event("error")); });
    expect(failed).toEqual([v(5)]);
  });

  it("a verse not kept, with the setting off, plays from the network as before", async () => {
    const fetched = line();
    const k = kept();
    const failed: string[] = [];
    const { result } = renderHook(() => useVerseAudio((key) => failed.push(key), undefined, "off", k.source));
    act(() => result.current.prepare("quran/hafs-kfqc/2:5"));
    act(() => result.current.toggle("quran/hafs-kfqc/2:5"));
    expect(k.copied).toEqual([]);
    expect(fetched).not.toHaveBeenCalled();
    act(() => { FakePlayer.last!.dispatchEvent(new Event("error")); });
    expect(failed).toEqual(["quran/hafs-kfqc/2:5"]);
  });
});

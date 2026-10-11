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

  it("plays from the network when the copy has not come yet", async () => {
    answer("sound");
    const { result } = renderHook(() => useVerseAudio(undefined, undefined, "hold"));
    act(() => result.current.playRun([v(1), v(2)]));
    sounds();
    act(() => FakePlayer.last!.finish());
    expect(FakePlayer.last!.src).toBe(url(2));
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
});

import { describe, expect, it } from "vitest";
import { verseAudioUrl, versesBetween } from "./audio";

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

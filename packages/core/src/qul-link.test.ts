import { describe, it, expect } from "vitest";
import { TOTAL_AYAHS } from "./quran-meta.js";
import { QUL_VERSE_BASE, qulVerseUrl, qulVerseUrlFromKey } from "./qul-link.js";

describe("QUL per-verse deep-link", () => {
  it("addresses a verse by its absolute ordinal, not surah:ayah", () => {
    // The two anchors the mapping is documented by: the first ayah overall, and
    // the first ayah of Al-Baqara, which sits after Al-Fatiha's seven.
    expect(qulVerseUrl(1, 1)).toBe(`${QUL_VERSE_BASE}/1`);
    expect(qulVerseUrl(2, 1)).toBe(`${QUL_VERSE_BASE}/8`);
  });

  it("reaches the last ayah of the mushaf", () => {
    // 114:6 is the 6236th ayah — the ordinal spans the whole book.
    expect(qulVerseUrl(114, 6)).toBe(`${QUL_VERSE_BASE}/${TOTAL_AYAHS}`);
  });

  it("carries only the ordinal — no verse text in the URL", () => {
    const url = qulVerseUrl(2, 255);
    expect(url).toMatch(/^https:\/\/qul\.tarteel\.ai\/cms\/verses\/\d+$/);
  });

  it("throws on an out-of-range address rather than minting a dead link", () => {
    expect(() => qulVerseUrl(2, 999)).toThrow(RangeError);
    expect(() => qulVerseUrl(0, 1)).toThrow(RangeError);
  });

  describe("from a canonical ayah key", () => {
    it("parses an edition-prefixed key", () => {
      expect(qulVerseUrlFromKey("quran/hafs/2:1")).toBe(`${QUL_VERSE_BASE}/8`);
    });

    it("ignores a word anchor — the library pages a verse, not a word", () => {
      expect(qulVerseUrlFromKey("quran/hafs/2:1#w3")).toBe(`${QUL_VERSE_BASE}/8`);
      expect(qulVerseUrlFromKey("quran/hafs/2:1#w3-7")).toBe(`${QUL_VERSE_BASE}/8`);
    });

    it("returns null for an unparseable or unaddressable key", () => {
      expect(qulVerseUrlFromKey("not a key")).toBeNull();
      expect(qulVerseUrlFromKey("quran/hafs/2:999")).toBeNull();
    });
  });
});

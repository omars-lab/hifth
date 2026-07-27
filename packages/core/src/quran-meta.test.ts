import { describe, it, expect } from "vitest";
import {
  AYAH_COUNTS,
  TOTAL_AYAHS,
  JUZ_STARTS,
  ayahCount,
  toAbsoluteAyah,
  fromAbsoluteAyah,
  juzOf,
} from "./quran-meta.js";

describe("quran structural metadata (Hafs/Kufan counting)", () => {
  it("has 114 surahs summing to 6236 ayahs", () => {
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(TOTAL_AYAHS);
  });

  it("knows well-known counts", () => {
    expect(ayahCount(1)).toBe(7); // Al-Fatiha
    expect(ayahCount(2)).toBe(286); // Al-Baqarah
    expect(ayahCount(114)).toBe(6); // An-Nas
  });

  it("converts landmark ayahs to absolute numbers", () => {
    expect(toAbsoluteAyah(1, 1)).toBe(1);
    expect(toAbsoluteAyah(1, 7)).toBe(7);
    expect(toAbsoluteAyah(2, 1)).toBe(8);
    // The dataset's own example: Fatiha entries point at 2:255 territory —
    // 2:255 (Ayat al-Kursi) = 7 + 255 = 262.
    expect(toAbsoluteAyah(2, 255)).toBe(262);
    expect(toAbsoluteAyah(114, 6)).toBe(TOTAL_AYAHS);
  });

  it("round-trips every absolute ayah 1..6236", () => {
    for (let abs = 1; abs <= TOTAL_AYAHS; abs++) {
      const { surah, ayah } = fromAbsoluteAyah(abs);
      expect(toAbsoluteAyah(surah, ayah)).toBe(abs);
      expect(ayah).toBeGreaterThanOrEqual(1);
      expect(ayah).toBeLessThanOrEqual(ayahCount(surah));
    }
  });

  it("round-trips every surah boundary", () => {
    for (let s = 1; s <= 114; s++) {
      expect(fromAbsoluteAyah(toAbsoluteAyah(s, 1))).toEqual({ surah: s, ayah: 1 });
      const last = ayahCount(s);
      expect(fromAbsoluteAyah(toAbsoluteAyah(s, last))).toEqual({ surah: s, ayah: last });
    }
  });

  it("locates juz boundaries", () => {
    expect(JUZ_STARTS).toHaveLength(30);
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1); // last ayah before juz 2
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(2, 253)).toBe(3);
    expect(juzOf(77, 50)).toBe(29); // last ayah before juz 30
    expect(juzOf(78, 1)).toBe(30);
    expect(juzOf(114, 6)).toBe(30);
  });

  it("juz assignment is monotonic over all ayahs", () => {
    let prev = 1;
    for (let abs = 1; abs <= TOTAL_AYAHS; abs++) {
      const { surah, ayah } = fromAbsoluteAyah(abs);
      const j = juzOf(surah, ayah);
      expect(j).toBeGreaterThanOrEqual(prev);
      expect(j - prev).toBeLessThanOrEqual(1);
      prev = j;
    }
    expect(prev).toBe(30);
  });

  it("rejects out-of-range inputs", () => {
    expect(() => ayahCount(0)).toThrow(RangeError);
    expect(() => ayahCount(115)).toThrow(RangeError);
    expect(() => toAbsoluteAyah(1, 8)).toThrow(RangeError);
    expect(() => toAbsoluteAyah(2, 287)).toThrow(RangeError);
    expect(() => fromAbsoluteAyah(0)).toThrow(RangeError);
    expect(() => fromAbsoluteAyah(6237)).toThrow(RangeError);
    expect(() => fromAbsoluteAyah(1.5)).toThrow(RangeError);
  });
});

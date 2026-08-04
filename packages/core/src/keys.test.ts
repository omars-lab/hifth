import { describe, it, expect } from "vitest";
import {
  ayahKeyOf,
  decodeAyahNumber,
  formatAyahKey,
  formatWordKey,
  parseAyahKey,
  parseWordKey,
} from "./keys.js";

describe("ayah keys", () => {
  it("formats the canonical ayah key", () => {
    expect(formatAyahKey("hafs-kfqc", 2, 48)).toBe("quran/hafs-kfqc/2:48");
  });

  it("round-trips format → parse", () => {
    const key = formatAyahKey("hafs-kfqc", 2, 123);
    const parsed = parseAyahKey(key);
    expect(parsed).toEqual({ kind: "ayah", edition: "hafs-kfqc", surah: 2, ayah: 123 });
  });

  it("returns null for non-ayah keys", () => {
    expect(parseAyahKey("root/ktb")).toBeNull();
    expect(parseAyahKey("garbage")).toBeNull();
  });

  it("rejects out-of-range surah/ayah", () => {
    expect(() => formatAyahKey("hafs-kfqc", 0, 1)).toThrow();
    expect(() => formatAyahKey("hafs-kfqc", 115, 1)).toThrow();
    expect(() => formatAyahKey("hafs-kfqc", 2, 0)).toThrow();
  });

  it("decodes the source number attribute", () => {
    expect(decodeAyahNumber(2048)).toEqual({ surah: 2, ayah: 48 });
    expect(decodeAyahNumber(2123)).toEqual({ surah: 2, ayah: 123 });
    expect(decodeAyahNumber(114006)).toEqual({ surah: 114, ayah: 6 });
  });
});

describe("word keys", () => {
  it("writes a single word without a range", () => {
    expect(formatWordKey("hafs-kfqc", 2, 48, 3)).toBe("quran/hafs-kfqc/2:48#w3");
    expect(formatWordKey("hafs-kfqc", 2, 48, 3, 3)).toBe("quran/hafs-kfqc/2:48#w3");
  });

  it("writes a run as #wFROM-TO", () => {
    expect(formatWordKey("hafs-kfqc", 2, 48, 3, 7)).toBe("quran/hafs-kfqc/2:48#w3-7");
  });

  it("round-trips both forms", () => {
    const one = { kind: "word", edition: "hafs-kfqc", surah: 2, ayah: 48, from: 3, to: 3 };
    expect(parseWordKey("quran/hafs-kfqc/2:48#w3")).toEqual(one);
    expect(parseWordKey("quran/hafs-kfqc/2:48#w3-3")).toEqual(one);
    expect(parseWordKey(formatWordKey("hafs-kfqc", 114, 6, 1, 9))).toEqual({
      kind: "word",
      edition: "hafs-kfqc",
      surah: 114,
      ayah: 6,
      from: 1,
      to: 9,
    });
  });

  it("refuses a descending range rather than sorting it", () => {
    // A drag whose anchor and cursor were never ordered is a bug in the caller,
    // and swapping here would be the thing that hides it.
    expect(() => formatWordKey("hafs-kfqc", 2, 48, 7, 3)).toThrow(RangeError);
    expect(parseWordKey("quran/hafs-kfqc/2:48#w7-3")).toBeNull();
  });

  it("rejects a zeroth word — the print numbers from one", () => {
    expect(() => formatWordKey("hafs-kfqc", 2, 48, 0)).toThrow(RangeError);
    expect(parseWordKey("quran/hafs-kfqc/2:48#w0")).toBeNull();
  });

  it("keeps the two parsers from claiming each other's keys", () => {
    expect(parseWordKey("quran/hafs-kfqc/2:48")).toBeNull();
    expect(parseAyahKey("quran/hafs-kfqc/2:48#w3")).toBeNull();
    expect(parseWordKey("root/ktb")).toBeNull();
  });

  it("ayahKeyOf is the guard the ayah-shaped machinery stands behind", () => {
    expect(ayahKeyOf("quran/hafs-kfqc/2:48#w3-7")).toBe("quran/hafs-kfqc/2:48");
    expect(ayahKeyOf("quran/hafs-kfqc/2:48")).toBe("quran/hafs-kfqc/2:48");
    expect(ayahKeyOf("root/ktb")).toBeNull();
    expect(ayahKeyOf("")).toBeNull();
  });
});

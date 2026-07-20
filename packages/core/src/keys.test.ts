import { describe, it, expect } from "vitest";
import { formatAyahKey, parseAyahKey, decodeAyahNumber } from "./keys.js";

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

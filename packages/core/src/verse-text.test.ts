import { describe, expect, it } from "vitest";
import { diffPair, VERSE_TEXT, verseTokens } from "./verse-text.js";

describe("verse-text · fixture", () => {
  it("carries the 12 mock ayahs", () => {
    expect(Object.keys(VERSE_TEXT)).toHaveLength(12);
    for (const k of ["2:40", "2:48", "2:123", "82:19"]) {
      expect(VERSE_TEXT[k]).toBeDefined();
    }
  });

  it("2:48 vs 2:123 carries the شفاعة/عدل swap as class-1/2 tokens", () => {
    // The signature diff: 2:48 marks شَفَاعَةٌ divergent, 2:123 marks عَدْلٌ.
    const t48 = VERSE_TEXT["2:48"]!;
    const t123 = VERSE_TEXT["2:123"]!;
    expect(t48.some((tok) => tok.text.includes("شَفَاعَةٌ") && tok.cls !== 0)).toBe(true);
    expect(t123.some((tok) => tok.text.includes("عَدْلٌ") && tok.cls !== 0)).toBe(true);
  });
});

describe("verse-text · lookup", () => {
  it("verseTokens accepts bare and canonical keys", () => {
    expect(verseTokens("2:48")).toBe(VERSE_TEXT["2:48"]);
    expect(verseTokens("quran/hafs-kfqc/2:48")).toBe(VERSE_TEXT["2:48"]);
    expect(verseTokens("quran/hafs-kfqc/9:99")).toBeNull();
  });
});

describe("verse-text · diffPair", () => {
  it("pairs two vendored ayahs into from/to sides", () => {
    const d = diffPair("quran/hafs-kfqc/2:48", "quran/hafs-kfqc/2:123");
    expect(d).not.toBeNull();
    expect(d!.from.tokens).toBe(VERSE_TEXT["2:48"]);
    expect(d!.to.tokens).toBe(VERSE_TEXT["2:123"]);
  });

  it("returns null when either ayah has no vendored text", () => {
    expect(diffPair("2:48", "9:99")).toBeNull();
    expect(diffPair("9:99", "2:48")).toBeNull();
  });
});

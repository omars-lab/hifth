import { describe, expect, it } from "vitest";
import { compactManifest, expandManifest, isCompactManifest } from "./manifest.js";
import type { CompactManifest } from "./manifest.js";
import { Resolver } from "./resolver.js";
import { TOTAL_AYAHS, toAbsoluteAyah } from "./quran-meta.js";
import type { AssetManifest } from "./types.js";

/**
 * A manifest in the shape the ETL actually emits: one polygon per ayah, ids
 * derived from the absolute ayah number. Page 1 carries the square viewBox the
 * KFGQPC print uses for its two opening pages, so the override path is covered.
 */
function full(): AssetManifest {
  const poly = (surah: number, ayah: number) => ({
    elementId: `verse-${toAbsoluteAyah(surah, ayah)}`,
    number: surah * 1000 + ayah,
    surah,
    ayah,
    key: `quran/hafs-kfqc/${surah}:${ayah}`,
  });
  return {
    edition: "hafs-kfqc",
    editionLabel: "Hafs (test)",
    pages: [
      { edition: "hafs-kfqc", page: 1, viewBox: "0 0 235 235", polygons: [poly(1, 1), poly(1, 2)] },
      { edition: "hafs-kfqc", page: 7, viewBox: "0 0 345 550", polygons: [poly(2, 38), poly(2, 39)] },
      { edition: "hafs-kfqc", page: 9, viewBox: "0 0 345 550", polygons: [poly(2, 58)] },
    ],
  };
}

describe("compactManifest / expandManifest", () => {
  it("round-trips a manifest through the wire form", () => {
    expect(expandManifest(compactManifest(full()))).toEqual(full());
  });

  it("picks the majority viewBox and overrides only the pages that differ", () => {
    const compact = compactManifest(full());
    expect(compact.viewBox).toBe("0 0 345 550");
    expect(compact.viewBoxOverrides).toEqual({ "1": "0 0 235 235" });
  });

  it("carries one page number per ayah and zero for ayahs it does not hold", () => {
    const compact = compactManifest(full());
    expect(compact.ayahPages).toHaveLength(TOTAL_AYAHS);
    expect(compact.ayahPages[toAbsoluteAyah(2, 38) - 1]).toBe(7);
    expect(compact.ayahPages[toAbsoluteAyah(2, 58) - 1]).toBe(9);
    // 2:100 is not on any vendored page in this fixture.
    expect(compact.ayahPages[toAbsoluteAyah(2, 100) - 1]).toBe(0);
  });

  it("resolves through a Resolver built from the expanded form", () => {
    const resolver = new Resolver(expandManifest(compactManifest(full())));
    expect(resolver.resolve("quran/hafs-kfqc/2:38")).toMatchObject({ page: 7 });
    expect(resolver.keyForElement(`verse-${toAbsoluteAyah(2, 38)}`)).toBe("quran/hafs-kfqc/2:38");
    expect(resolver.keysOnPage(9)).toEqual(["quran/hafs-kfqc/2:58"]);
    expect(resolver.hasPage(2)).toBe(false);
  });

  it("orders pages ascending and polygons ascending within a page", () => {
    const compact = compactManifest(full());
    const shuffled: CompactManifest = { ...compact };
    const expanded = expandManifest(shuffled);
    expect(expanded.pages.map((p) => p.page)).toEqual([1, 7, 9]);
    expect(expanded.pages[1]!.polygons.map((p) => p.number)).toEqual([2038, 2039]);
  });

  /*
   * The two shapes the compact form cannot carry. Both are properties of the
   * corpus rather than of our code, so `compactManifest` refuses instead of
   * dropping data — and extract-pages.mjs runs the same checks against the
   * committed SVGs on every CI run.
   */
  it("refuses an ayah that appears on two pages", () => {
    const m = full();
    const dup = structuredClone(m) as AssetManifest;
    (dup.pages[2]!.polygons as unknown[]).push(m.pages[1]!.polygons[0]!);
    expect(() => compactManifest(dup)).toThrow(/appears on pages 7 and 9/);
  });

  it("refuses a polygon whose id is not its own verse-<n>", () => {
    const odd = structuredClone(full()) as AssetManifest;
    (odd.pages[1]!.polygons[0] as { elementId: string }).elementId = "path-4772";
    expect(() => compactManifest(odd)).toThrow(/expected "verse-45"/);
  });

  it("tells the two wire shapes apart", () => {
    expect(isCompactManifest(compactManifest(full()))).toBe(true);
    expect(isCompactManifest(full())).toBe(false);
  });
});

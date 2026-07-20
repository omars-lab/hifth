import { describe, expect, it } from "vitest";
import { Resolver } from "./resolver.js";
import type { AssetManifest } from "./types.js";

/** A small hand-built manifest: two pages, one multi-polygon ayah. */
const manifest: AssetManifest = {
  edition: "hafs-kfqc",
  editionLabel: "Hafs (test)",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-45", number: 2038, surah: 2, ayah: 38, key: "quran/hafs-kfqc/2:38" },
        { elementId: "verse-46", number: 2039, surah: 2, ayah: 39, key: "quran/hafs-kfqc/2:39" },
        // 2:40 wraps two polygons (across a line break) — one location, two ids.
        { elementId: "verse-47a", number: 2040, surah: 2, ayah: 40, key: "quran/hafs-kfqc/2:40" },
        { elementId: "verse-47b", number: 2040, surah: 2, ayah: 40, key: "quran/hafs-kfqc/2:40" },
      ],
    },
    {
      edition: "hafs-kfqc",
      page: 9,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-60", number: 2053, surah: 2, ayah: 53, key: "quran/hafs-kfqc/2:53" },
      ],
    },
  ],
};

describe("Resolver", () => {
  const r = new Resolver(manifest);

  it("resolves a key to its page and element id", () => {
    const loc = r.resolve("quran/hafs-kfqc/2:38");
    expect(loc).not.toBeNull();
    expect(loc?.page).toBe(7);
    expect(loc?.surah).toBe(2);
    expect(loc?.ayah).toBe(38);
    expect(loc?.elementIds).toEqual(["verse-45"]);
  });

  it("collapses a multi-polygon ayah into one location with all element ids", () => {
    const loc = r.resolve("quran/hafs-kfqc/2:40");
    expect(loc?.elementIds).toEqual(["verse-47a", "verse-47b"]);
    expect(loc?.page).toBe(7);
  });

  it("returns null for an ayah not in the vendored corpus", () => {
    expect(r.resolve("quran/hafs-kfqc/2:255")).toBeNull();
    expect(r.resolve("quran/hafs-kfqc/114:1")).toBeNull();
  });

  it("reverse-maps a polygon element id back to its ayah key", () => {
    expect(r.keyForElement("verse-46")).toBe("quran/hafs-kfqc/2:39");
    expect(r.keyForElement("verse-47b")).toBe("quran/hafs-kfqc/2:40");
    expect(r.keyForElement("nope")).toBeNull();
  });

  it("lists keys on a page in document order, deduped", () => {
    expect(r.keysOnPage(7)).toEqual([
      "quran/hafs-kfqc/2:38",
      "quran/hafs-kfqc/2:39",
      "quran/hafs-kfqc/2:40",
    ]);
    expect(r.keysOnPage(999)).toEqual([]);
  });

  it("reports page presence and the full key set", () => {
    expect(r.hasPage(7)).toBe(true);
    expect(r.hasPage(19)).toBe(false);
    expect(r.allKeys()).toContain("quran/hafs-kfqc/2:53");
    expect(r.allKeys()).toHaveLength(4);
  });

  it("round-trips every polygon: resolve(key).elementIds contains keyForElement's source", () => {
    for (const page of manifest.pages) {
      for (const poly of page.polygons) {
        expect(r.keyForElement(poly.elementId)).toBe(poly.key);
        expect(r.resolve(poly.key)?.elementIds).toContain(poly.elementId);
      }
    }
  });
});

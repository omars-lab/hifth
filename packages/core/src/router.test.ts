import { describe, expect, it } from "vitest";
import {
  keyToRef,
  parseHash,
  refToKey,
  serializeState,
  type AppState,
} from "./router.js";
import type { EditionId } from "./types.js";

const ED = "hafs-kfqc" as EditionId;

describe("router · spec §7 grammar", () => {
  it("select + navigate: #/<edition>/<surah>:<ayah>", () => {
    const s = parseHash("#/hafs-kfqc/2:48");
    expect(s).toEqual({ edition: ED, select: { surah: 2, ayah: 48 } });
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:48");
  });

  it("word-span pulse: ?w=3-7", () => {
    const s = parseHash("#/hafs-kfqc/2:255?w=3-7");
    expect(s?.word).toEqual([3, 7]);
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:255?w=3-7");
  });

  it("single-word span collapses to ?w=N", () => {
    expect(serializeState({ edition: ED, select: { surah: 2, ayah: 1 }, word: [5, 5] })).toBe(
      "#/hafs-kfqc/2:1?w=5",
    );
    expect(parseHash("#/hafs-kfqc/2:1?w=5")?.word).toEqual([5, 5]);
  });

  it("highlighted ayah range: 2:47-2:48 (the spec's literal form) round-trips", () => {
    const s = parseHash("#/hafs-kfqc/2:47-2:48");
    expect(s?.select).toEqual({ surah: 2, ayah: 47, toAyah: 48 });
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:47-2:48");
  });

  it("still parses the compact range tail (2:47-48) and normalizes it", () => {
    const s = parseHash("#/hafs-kfqc/2:47-48");
    expect(s?.select).toEqual({ surah: 2, ayah: 47, toAyah: 48 });
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:47-2:48");
  });

  it("rejects a range whose endpoints are in different surahs", () => {
    expect(parseHash("#/hafs-kfqc/2:47-3:48")).toBeNull();
  });

  it("with skin: ?w=3-7&skin=tajweed", () => {
    const s = parseHash("#/hafs-kfqc/2:255?w=3-7&skin=tajweed");
    expect(s?.skin).toBe("tajweed");
    expect(s?.word).toEqual([3, 7]);
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:255?w=3-7&skin=tajweed");
  });

  it("hop context (breadcrumb): ?via=2:48", () => {
    const s = parseHash("#/hafs-kfqc/2:123?via=2:48");
    expect(s?.via).toEqual({ surah: 2, ayah: 48 });
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:123?via=2:48");
  });

  it("full hop chain: ?trail=2:40,2:47,2:122", () => {
    const s = parseHash("#/hafs-kfqc/2:123?trail=2:40,2:47,2:122");
    expect(s?.trail).toEqual([
      { surah: 2, ayah: 40 },
      { surah: 2, ayah: 47 },
      { surah: 2, ayah: 122 },
    ]);
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:123?trail=2:40,2:47,2:122");
  });

  it("bare page: #/<edition>/p7 (no selection)", () => {
    const s = parseHash("#/hafs-kfqc/p7");
    expect(s).toEqual({ edition: ED, select: null, page: 7 });
    expect(serializeState(s!)).toBe("#/hafs-kfqc/p7");
  });
});

describe("router · tolerance & rejection", () => {
  it("tolerates a missing leading #", () => {
    expect(parseHash("/hafs-kfqc/2:48")?.select).toEqual({ surah: 2, ayah: 48 });
  });

  it("treats empty / bare-# hash as no deep link", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#")).toBeNull();
    expect(parseHash("#/")).toBeNull();
  });

  it("ignores unknown query keys", () => {
    const s = parseHash("#/hafs-kfqc/2:48?foo=bar&via=2:47");
    expect(s?.via).toEqual({ surah: 2, ayah: 47 });
  });

  it("rejects a malformed known param (corrupt link → null, not half-restored)", () => {
    expect(parseHash("#/hafs-kfqc/2:48?w=abc")).toBeNull();
    expect(parseHash("#/hafs-kfqc/2:48?via=nope")).toBeNull();
    expect(parseHash("#/hafs-kfqc/2:48?skin=neon")).toBeNull();
    expect(parseHash("#/hafs-kfqc/2:48?trail=2:40,bad")).toBeNull();
  });

  it("rejects out-of-range refs and inverted ranges/spans", () => {
    expect(parseHash("#/hafs-kfqc/0:1")).toBeNull(); // surah < 1
    expect(parseHash("#/hafs-kfqc/115:1")).toBeNull(); // surah > 114
    expect(parseHash("#/hafs-kfqc/2:0")).toBeNull(); // ayah < 1
    expect(parseHash("#/hafs-kfqc/2:48-47")).toBeNull(); // toAyah < ayah
    expect(parseHash("#/hafs-kfqc/2:5?w=7-3")).toBeNull(); // span from > to
  });

  it("rejects structurally broken paths", () => {
    expect(parseHash("#/hafs-kfqc")).toBeNull(); // no target
    expect(parseHash("#//2:48")).toBeNull(); // empty edition
    expect(parseHash("#/hafs-kfqc/")).toBeNull(); // empty target
  });
});

describe("router · key helpers", () => {
  it("refToKey builds the canonical spec-§1 key", () => {
    expect(refToKey(ED, { surah: 2, ayah: 48 })).toBe("quran/hafs-kfqc/2:48");
  });

  it("keyToRef is the inverse for a plain ayah key", () => {
    expect(keyToRef("quran/hafs-kfqc/2:123")).toEqual({ surah: 2, ayah: 123 });
    expect(keyToRef("not-a-key")).toBeNull();
  });
});

describe("router · round-trip (generative sweep)", () => {
  // Hand-rolled property test (no new dep): every combination of the §7 axes must
  // survive parse(serialize(s)) === s. If any variant serializes to a string that
  // does not re-parse identically, this fails with the offending state.
  it("parse(serialize(state)) deep-equals state for all axis combinations", () => {
    const selects: AppState["select"][] = [
      { surah: 2, ayah: 48 },
      { surah: 114, ayah: 6 },
      { surah: 2, ayah: 47, toAyah: 48 },
      { surah: 3, ayah: 1, toAyah: 1 }, // degenerate range (from === to)
    ];
    const words: (readonly [number, number] | undefined)[] = [undefined, [3, 7], [5, 5]];
    const skins: (AppState["skin"])[] = [undefined, "tajweed"];
    const vias: (AppState["via"])[] = [undefined, { surah: 2, ayah: 40 }];
    const trails: (AppState["trail"])[] = [
      undefined,
      [{ surah: 2, ayah: 40 }],
      [
        { surah: 2, ayah: 40 },
        { surah: 2, ayah: 47 },
      ],
    ];

    let count = 0;
    for (const select of selects)
      for (const word of words)
        for (const skin of skins)
          for (const via of vias)
            for (const trail of trails) {
              const state: AppState = {
                edition: ED,
                select,
                ...(word ? { word } : {}),
                ...(skin ? { skin } : {}),
                ...(via ? { via } : {}),
                ...(trail ? { trail } : {}),
              };
              const round = parseHash(serializeState(state));
              expect(round, serializeState(state)).toEqual(state);
              count++;
            }
    expect(count).toBe(selects.length * words.length * skins.length * vias.length * trails.length);
  });

  it("bare-page states round-trip across a range of page numbers", () => {
    for (const page of [1, 7, 19, 604]) {
      const state: AppState = { edition: ED, select: null, page };
      expect(parseHash(serializeState(state))).toEqual(state);
    }
  });
});

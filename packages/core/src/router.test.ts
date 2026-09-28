import { describe, expect, it } from "vitest";
import {
  keyToRef,
  OPEN_PANELS,
  LINK_TOOLS,
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

  it("the field: ?field=tan", () => {
    const s = parseHash("#/hafs-kfqc/p7?field=tan");
    expect(s?.field).toBe("tan");
    expect(serializeState(s!)).toBe("#/hafs-kfqc/p7?field=tan");
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

  it("does NOT reject an unreadable field= — the link still names the ayah", () => {
    // The one key that falls back instead of refusing. A chat client that mangles
    // a background colour must not cost the reader the scripture; core's field.ts
    // and docs/query-params.md both state which side of that line every key is on.
    for (const bad of ["neon", "", "TAN", "tan;drop"]) {
      const s = parseHash(`#/hafs-kfqc/2:48?field=${bad}`);
      expect(s, bad).not.toBeNull();
      expect(s!.select, bad).toEqual({ surah: 2, ayah: 48 });
      expect(s!.field, bad).toBeUndefined();
    }
  });

  it("a bad field= does not take the rest of the query with it", () => {
    const s = parseHash("#/hafs-kfqc/2:48?field=neon&w=3-7&via=2:47");
    expect(s?.word).toEqual([3, 7]);
    expect(s?.via).toEqual({ surah: 2, ayah: 47 });
    expect(s?.field).toBeUndefined();
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

describe("router · a panel open on arrival (?open=)", () => {
  // Owner, 2026-09-28: links "to enter app in certain mode, on certain page", and
  // tests and the checks guide should use them instead of clicking their way in.
  it("reads and writes each panel", () => {
    for (const p of OPEN_PANELS) {
      const s = parseHash(`#/hafs-kfqc/p1?open=${p}`);
      expect(s?.open, p).toBe(p);
      expect(serializeState(s!)).toBe(`#/hafs-kfqc/p1?open=${p}`);
    }
  });

  it("an unknown panel still opens the page — the link is not refused for it", () => {
    const s = parseHash("#/hafs-kfqc/2:48?open=nope&w=3-7");
    expect(s?.select).toEqual({ surah: 2, ayah: 48 });
    expect(s?.word).toEqual([3, 7]);
    expect(s?.open).toBeUndefined();
  });

  it("comes after every other key, so older links keep their one spelling", () => {
    const s = parseHash("#/hafs-kfqc/2:48?open=record&w=3-7&field=tan");
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:48?w=3-7&field=tan&open=record");
  });
});

describe("router · a tool in hand on arrival (?tool=)", () => {
  // Named by the word on the tool's button, as `open` is: a reader who sees
  // "Harakat" and "Mistake" on the bar can write the link without our names.
  it("reads and writes each tool", () => {
    for (const t of LINK_TOOLS) {
      const s = parseHash(`#/hafs-kfqc/p1?tool=${t}`);
      expect(s?.tool, t).toBe(t);
      expect(serializeState(s!)).toBe(`#/hafs-kfqc/p1?tool=${t}`);
    }
  });

  it("the words on the buttons, not the code's names for them", () => {
    expect([...LINK_TOOLS]).toEqual([
      "read", "select", "highlight", "bookmark", "note", "harakat", "word", "mistake", "crop",
    ]);
    expect(parseHash("#/hafs-kfqc/p1?tool=sign")?.tool).toBeUndefined();
  });

  it("an unknown tool still opens the verse", () => {
    const s = parseHash("#/hafs-kfqc/2:48?tool=pen&w=3-7");
    expect(s?.select).toEqual({ surah: 2, ayah: 48 });
    expect(s?.word).toEqual([3, 7]);
    expect(s?.tool).toBeUndefined();
  });

  it("sits between the view's keys and the panel", () => {
    const s = parseHash("#/hafs-kfqc/2:48?open=record&tool=note&field=tan");
    expect(serializeState(s!)).toBe("#/hafs-kfqc/2:48?field=tan&tool=note&open=record");
  });
});

describe("router · one page or two on arrival (?view=)", () => {
  it("reads and writes both layouts", () => {
    for (const v of ["one", "two"] as const) {
      const s = parseHash(`#/hafs-kfqc/2:47?view=${v}`);
      expect(s?.view, v).toBe(v);
      expect(serializeState(s!)).toBe(`#/hafs-kfqc/2:47?view=${v}`);
    }
  });

  it("an unknown layout still opens the verse", () => {
    const s = parseHash("#/hafs-kfqc/2:47?view=three");
    expect(s?.select).toEqual({ surah: 2, ayah: 47 });
    expect(s?.view).toBeUndefined();
  });

  it("sits before the tool and the panel", () => {
    const s = parseHash("#/hafs-kfqc/p7?open=jump&tool=note&view=one");
    expect(serializeState(s!)).toBe("#/hafs-kfqc/p7?view=one&tool=note&open=jump");
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
    const fields: (AppState["field"])[] = [undefined, "tan", "dark"];
    const vias: (AppState["via"])[] = [undefined, { surah: 2, ayah: 40 }];
    const trails: (AppState["trail"])[] = [
      undefined,
      [{ surah: 2, ayah: 40 }],
      [
        { surah: 2, ayah: 40 },
        { surah: 2, ayah: 47 },
      ],
    ];

    const opens: (AppState["open"])[] = [undefined, "shelf"];
    const tools: (AppState["tool"])[] = [undefined, "harakat"];
    const views: (AppState["view"])[] = [undefined, "one"];

    let count = 0;
    for (const view of views)
    for (const tool of tools)
    for (const open of opens)
    for (const select of selects)
      for (const word of words)
        for (const skin of skins)
          for (const field of fields)
            for (const via of vias)
              for (const trail of trails) {
                const state: AppState = {
                  edition: ED,
                  select,
                  ...(word ? { word } : {}),
                  ...(skin ? { skin } : {}),
                  ...(field ? { field } : {}),
                  ...(via ? { via } : {}),
                  ...(trail ? { trail } : {}),
                  ...(view ? { view } : {}),
                  ...(tool ? { tool } : {}),
                  ...(open ? { open } : {}),
                };
                const round = parseHash(serializeState(state));
                expect(round, serializeState(state)).toEqual(state);
                count++;
              }
    expect(count).toBe(
      views.length * tools.length * opens.length * selects.length * words.length * skins.length * fields.length * vias.length * trails.length,
    );
  });

  it("bare-page states round-trip across a range of page numbers", () => {
    for (const page of [1, 7, 19, 604]) {
      const state: AppState = { edition: ED, select: null, page };
      expect(parseHash(serializeState(state))).toEqual(state);
    }
  });
});

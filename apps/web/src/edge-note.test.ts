import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { edgeNote } from "./edge-note";

// A hand-written note on a look-alike pair was English with the pair's Arabic
// words in it, and showed as it was in the Arabic app; its two-way arrow drew
// as a blue emoji tile on an iPad (walking the Arabic iPad app, 2026-10-09:
// look-alike rows ③). Made-up notes here; the real ones are checked below.

describe("edgeNote", () => {
  const both = { note: "Alpha ↔ beta swapped", noteAr: "ألف ↔ باء" };

  it("shows the Arabic note in the Arabic app, marked as Arabic", () => {
    expect(edgeNote(both, "ar")).toEqual({ text: "ألف ↔︎ باء", lang: "ar", dir: "rtl" });
  });

  it("shows the English note in the English app, marked as English", () => {
    expect(edgeNote(both, "en")).toEqual({ text: "Alpha ↔︎ beta swapped", lang: "en", dir: "ltr" });
  });

  it("falls back to the English note, still marked as English, when no Arabic one was written", () => {
    expect(edgeNote({ note: "Alpha" }, "ar")).toEqual({ text: "Alpha", lang: "en", dir: "ltr" });
  });

  it("says nothing for a pair with no note", () => {
    expect(edgeNote({}, "ar")).toBeNull();
  });

  it("asks for the plain-text arrow every time, even when it is already asked for", () => {
    expect(edgeNote({ note: "a ↔︎ b ↔ c" }, "en")?.text).toBe("a ↔︎ b ↔︎ c");
  });
});

describe("the notes the app ships", () => {
  const dir = resolve(process.cwd(), "public/assets/adj/hafs-kfqc");
  const notes: { note: string; noteAr?: string }[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const shard = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as Record<
      string,
      { edges?: { note?: string; noteAr?: string }[] }
    >;
    for (const ayah of Object.values(shard)) {
      for (const e of ayah.edges ?? []) if (e.note) notes.push({ note: e.note, ...(e.noteAr ? { noteAr: e.noteAr } : {}) });
    }
  }

  it("has notes to check", () => {
    expect(notes.length).toBeGreaterThan(0);
  });

  it("gives every note an Arabic version with no English left in it", () => {
    const missing = notes.filter((n) => !n.noteAr || /[A-Za-z]/.test(n.noteAr));
    expect(missing.length, "notes with no Arabic version, or English left in it").toBe(0);
  });
});

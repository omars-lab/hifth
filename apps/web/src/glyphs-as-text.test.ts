import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Walking the Arabic iPad app, 2026-10-09: the arrow on every "go to this
// verse" button, in a note's related verses and in the look-alike list, drew
// as a blue emoji tile where the browser drew a plain arrow. These marks have
// an emoji form as well as a text one, and Apple's fonts pick the emoji unless
// the mark is followed by the text-form selector, U+FE0E. The two-way arrow in
// the look-alike notes was fixed alone (edge-note.ts); this holds every mark
// the app draws to it, so a new button cannot bring the tile back.

// Marks with an emoji form that the app could draw (Unicode's emoji list, the
// ones whose default is text). A mark in a comment is not drawn and is skipped.
const EMOJI_CAPABLE = new Set(
  [
    0x00a9, 0x00ae, 0x203c, 0x2049, 0x2122, 0x2139, ...range(0x2194, 0x2199), 0x21a9, 0x21aa, 0x2328, 0x23cf,
    0x23ed, 0x23ee, 0x23ef, 0x23f1, 0x23f2, 0x23f8, 0x23f9, 0x23fa, 0x24c2, 0x25aa, 0x25ab, 0x25b6, 0x25c0,
    0x25fb, 0x25fc, 0x2600, 0x2601, 0x260e, 0x2611, 0x261d, 0x263a, 0x2660, 0x2663, 0x2665, 0x2666, 0x267b,
    0x26a0, 0x2702, 0x270c, 0x270d, 0x270f, 0x2712, 0x2714, 0x2716, 0x2733, 0x2734, 0x2744, 0x2747, 0x2763,
    0x2764, 0x27a1, 0x2934, 0x2935, 0x2b05, 0x2b06, 0x2b07, 0x3030, 0x303d,
  ].map((c) => String.fromCodePoint(c)),
);
const TEXT_FORM = /^(︎|\\uFE0E|\\ufe0e)/;

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Source with its comments blanked out, keeping every other offset. */
function withoutComments(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[\s;{}(),])\/\/[^\n]*/g, blank);
}

/** Every drawn emoji-capable mark not asked for as text: "file:line U+XXXX". */
function bareMarks(source: string, file: string): string[] {
  const code = withoutComments(source);
  const out: string[] = [];
  for (let i = 0; i < code.length; i++) {
    if (!EMOJI_CAPABLE.has(code[i]!)) continue;
    if (TEXT_FORM.test(code.slice(i + 1, i + 7))) continue;
    const line = code.slice(0, i).split("\n").length;
    out.push(`${file}:${line} U+${code.codePointAt(i)!.toString(16).toUpperCase().padStart(4, "0")}`);
  }
  return out;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    if (!/\.(tsx?|json)$/.test(e.name) || /\.(test|spec)\.tsx?$/.test(e.name) || e.name.includes(".gen.")) return [];
    return [path];
  });
}

describe("marks with an emoji form are drawn as text", () => {
  it("finds a bare mark and passes one asked for as text, in either spelling", () => {
    expect(bareMarks('<span>↪</span>', "a.tsx")).toEqual(["a.tsx:1 U+21AA"]);
    expect(bareMarks('<span>↪︎</span>', "a.tsx")).toEqual([]);
    expect(bareMarks('const hop = "↪\\uFE0E";', "a.ts")).toEqual([]);
  });

  it("skips a mark that is only in a comment, and not a web address before it", () => {
    expect(bareMarks("// the ▶ button\n/* a ↗ link */ const x = 1;", "a.ts")).toEqual([]);
    expect(bareMarks('const u = "https://x.test"; const g = "▶";', "a.ts")).toEqual(["a.ts:1 U+25B6"]);
  });

  it("holds every mark the app draws to its text form", () => {
    const root = resolve(__dirname);
    const bare = sources(root).flatMap((p) => bareMarks(readFileSync(p, "utf8"), relative(root, p)));
    expect(bare).toEqual([]);
  });
});

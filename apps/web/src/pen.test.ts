import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PEN_KEY, PENS, rememberPen, savedPen } from "./pen";

/*
 * The highlighter's pens: four pastels, green first (the owner, 2026-09-30:
 * "pastel green and blue, and yellow, and pink, should be defaults ...
 * selectable from the toolbar for the highlighter").
 */

const tokens = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

/** A token's value as written in the stylesheet's first block. */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(tokens);
  if (!m) throw new Error(`${name} is not in tokens.css`);
  return m[1]!.trim();
}
/** Follows `var(--x)` to the colour it names. */
function colour(name: string): number[] {
  let v = token(name);
  for (let m = /^var\((--[\w-]+)\)$/.exec(v); m; m = /^var\((--[\w-]+)\)$/.exec(v)) v = token(m[1]!);
  expect(v, `${name} is a plain opaque colour`).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
const ratio = (x: number[], y: number[]) =>
  (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
/** Inks laid over a colour under multiply, as the page draws them. */
const under = (base: number[], ...inks: number[][]) =>
  inks.reduce((acc, ink) => acc.map((b, i) => b * ink[i]!), base);

describe("the highlighter's pens", () => {
  beforeEach(() => localStorage.clear());

  it("are green, blue, yellow and pink, in that order", () => {
    expect(PENS).toEqual(["green", "blue", "yellow", "pink"]);
  });

  it("start on green, and remember the one picked", () => {
    expect(savedPen()).toBe("green");
    rememberPen("pink");
    expect(localStorage.getItem(PEN_KEY)).toBe("pink");
    expect(savedPen()).toBe("pink");
  });

  it("ignore a remembered value that is not a pen", () => {
    localStorage.setItem(PEN_KEY, "purple");
    expect(savedPen()).toBe("green");
  });

  it("paint a passage in pastel green and a run of words in pastel blue by default", () => {
    expect(token("--ink-range")).toBe("var(--pen-green)");
    expect(token("--ink-run")).toBe("var(--pen-blue)");
    expect(token("--pen-green").toLowerCase()).toBe("#9bd9b5");
    expect(token("--pen-blue").toLowerCase()).toBe("#bacbf3");
  });

  // The reading floor: wherever a pen crosses the amber verse, the letters
  // under both inks still stand 4.5 to 1 off the paper under both inks.
  for (const pen of ["green", "blue", "yellow", "pink"]) {
    it(`keep the letters readable where the ${pen} pen crosses the amber verse`, () => {
      const amber = colour("--ink-sel");
      const ink = colour(`--pen-${pen}`);
      const letters = under(colour("--ink"), amber, ink);
      const paper = under(colour("--paper"), amber, ink);
      expect(ratio(letters, paper)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

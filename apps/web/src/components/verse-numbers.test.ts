import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WordIndex, type WordShard } from "@hifth/core";
import { describe, expect, it } from "vitest";
import { drawVerseNumbers, printedNumbersOf, verseNumberDisc } from "./verse-numbers";

describe("verse numbers · the disc a verse's number fills", () => {
  // A made-up verse over two lines; on its last line the words start at x=90,
  // and its outline stops at x=60, so the number fills 60 to 90.
  const lines = [
    { x: 10, y: 120, width: 320, height: 30 },
    { x: 60, y: 155, width: 270, height: 30 },
  ];
  const words = [
    { x: 200, y: 122, width: 60, height: 26 },
    { x: 90, y: 157, width: 80, height: 26 },
    { x: 180, y: 157, width: 60, height: 26 },
  ];

  it("sits in the middle of the gap on the last line, as wide as the gap", () => {
    expect(verseNumberDisc(lines, words)).toEqual({ cx: 75, cy: 170, r: 15 });
  });

  it("does not depend on the order the lines come in", () => {
    expect(verseNumberDisc([...lines].reverse(), words)).toEqual(verseNumberDisc(lines, words));
  });

  it("is never taller than its line", () => {
    const wide = [{ x: 0, y: 155, width: 330, height: 30 }];
    expect(verseNumberDisc(wide, [{ x: 50, y: 157, width: 80, height: 26 }])?.r).toBe(15);
  });

  it("nothing when the verse runs on to the next page and its number is not here", () => {
    expect(verseNumberDisc([{ x: 2, y: 155, width: 328, height: 30 }], [{ x: 4, y: 157, width: 80, height: 26 }])).toBeNull();
    expect(verseNumberDisc([], words)).toBeNull();
  });
});

describe("verse numbers · on the real pages", () => {
  // The committed page drawing and word boxes, put on screen the way the app
  // does it: the drawing's markup as the host's inner HTML.
  const page = (n: number) => {
    const host = document.createElement("div");
    host.innerHTML = readFileSync(resolve(process.cwd(), `public/assets/pages/hafs-kfqc/${n}.svg`), "utf8");
    const shard = JSON.parse(
      readFileSync(resolve(process.cwd(), `public/assets/words/hafs-kfqc/${n}.json`), "utf8"),
    ) as WordShard;
    const svg = host.querySelector("svg")!;
    drawVerseNumbers(svg, "hafs-kfqc", new WordIndex(shard), null, (key) => key);
    const disc = (key: string) => {
      const mark = svg.querySelector(`[data-verse-number][data-verse-key="${key}"]`);
      const at = /translate\(([\d.]+) ([\d.]+)\)/.exec(mark?.getAttribute("transform") ?? "");
      return at && { cx: Number(at[1]), cy: Number(at[2]) };
    };
    return { svg, disc };
  };

  it("reads each number's centre off the drawing", () => {
    const { svg } = page(7);
    expect(printedNumbersOf(svg).get("2:41")).toEqual({ x: 183.4, y: 246.5 });
  });

  it("gives 2:41 on page 7 its button, on its number", () => {
    // A tall word on the line above reached into its last line, and it had none.
    const at = page(7).disc("quran/hafs-kfqc/2:41");
    expect(at?.cx).toBeCloseTo(183.4, 1);
  });

  it("gives 3:1 its button where the outlines split its number down the middle", () => {
    const at = page(50).disc("quran/hafs-kfqc/3:1");
    expect(at?.cx).toBeCloseTo(306.6, 1);
    expect(at?.cy).toBeGreaterThan(86.5);
    expect(at?.cy).toBeLessThan(118.3);
  });
});

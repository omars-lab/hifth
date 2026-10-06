import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rectsOf } from "./ink.js";
import { WordIndex, printedVerseNumbers, verseNumberSpot, type WordShard } from "./words.js";

// Every verse whose number is printed on a page gets a place for it: the note
// dot, and in the pitch build the button over it. Read off the committed pages
// themselves, so a page shaped in a way the rule never imagined is found here
// and not by a reader. Guessing the place from the gap after the last word
// gave 208 verses none (page 7's 2:41 among them) and put 982 more over two
// units off; the page drawing marks every number's centre, and these hold the
// app to it.
const assets = new URL("../../../apps/web/public/assets/", import.meta.url);
const shard = (page: number): WordShard =>
  JSON.parse(readFileSync(new URL(`words/hafs-kfqc/${page}.json`, assets), "utf8")) as WordShard;
const drawing = (page: number) => {
  const svg = readFileSync(new URL(`pages/hafs-kfqc/${page}.svg`, assets), "utf8");
  return {
    outlines: [...svg.matchAll(/<path\b[^>]*class="ayahPolygon"[^>]*>/g)].map(([tag]) => ({
      key: `${/\bsurah="(\d+)"/.exec(tag)?.[1]}:${/\bayah="(\d+)"/.exec(tag)?.[1]}`,
      d: /\bd="([^"]*)"/.exec(tag)?.[1] ?? "",
    })),
    numbers: [...svg.matchAll(/ayah:x="([\d.]+)" ayah:y="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
  };
};

describe("every verse number on every page has a place", () => {
  it("puts each verse that ends on its page on its own printed number", () => {
    const wrong: string[] = [];
    let placed = 0;
    let next = shard(1);
    for (let page = 1; page <= 604; page++) {
      const here = next;
      next = page < 604 ? shard(page + 1) : { page: 605, words: {} };
      const words = new WordIndex(here);
      const { outlines, numbers } = drawing(page);
      const printed = printedVerseNumbers(outlines.map((o) => o.key), numbers);
      for (const { key, d } of outlines) {
        const runsOn = key in next.words; // its number is on the next page
        const at = printed.get(key);
        if (runsOn !== !at) {
          wrong.push(`${page}:${key} ${at ? "has a number but runs on" : "has no number"}`);
          continue;
        }
        if (!at) continue;
        const lines = rectsOf(d) ?? [];
        const span = words.span(key);
        // The number sits on the verse's last line, after its last word.
        const last = lines.reduce((a, b) => (b.y > a.y ? b : a), lines[0]!);
        if (at.y < last.y || at.y > last.y + last.height) wrong.push(`${page}:${key} number not on its last line`);
        if (!span || !verseNumberSpot(lines, words.boxesFor(key, span.from, span.to), "upper", at)) {
          wrong.push(`${page}:${key} no place for the dot`);
          continue;
        }
        placed++;
      }
    }
    expect(wrong).toEqual([]);
    expect(placed).toBe(6236);
  });
});

/**
 * How well the slant read off the page pictures stands in for a reader: every
 * note read by hand has its slanted runs taken off, the pictures' slant (and
 * then the transliteration marks) laid on again, and each run the reader marked
 * is scored against what came back. Prints counts only, never a note's words.
 *
 *   node packages/etl/tools/pitch/picture-slant-score.mjs
 *
 * Needs the pitch notes built (extract.mjs) and the pictures read (page-words.mjs).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SLANT_END, SLANT_START, slantMarkedTerms } from "./italics.mjs";
import { picturesOf, slantFromPictures } from "./picture-slant.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const main = dirname(resolve(repo, execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).trim()));
const book = [resolve(repo, "../books/books/study-quran"), resolve(main, "../books/books/study-quran")].find((d) => existsSync(join(d, "tafseer-bundle")));
if (!book) throw new Error("no captured book beside this checkout");
const built = join(repo, "apps/web/public/assets/private/study-quran");
const rows = JSON.parse(readFileSync(join(book, "raw/note-fixes.hand.json"), "utf8")).italics;

/** A note's text with its runs taken off, and where the runs were. */
function unslant(note) {
  const runs = [];
  let plain = "";
  for (const ch of note) {
    if (ch === SLANT_START) runs.push([plain.length, -1]);
    else if (ch === SLANT_END) runs.at(-1)[1] = plain.length;
    else plain += ch;
  }
  return { plain, runs };
}

const tally = { pictures: {}, "pictures then marks": {} };
const edges = { pictures: {}, "pictures then marks": {} };
/** How one edge of a run differs: the text between where the book puts it and where it came back. */
function edge(text, a, b) {
  if (a === b) return "same";
  const between = text.slice(Math.min(a, b), Math.max(a, b));
  const n = (between.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  if (!n) return "by punctuation";
  return `${n > 2 ? "3+" : n} word(s) ${a < b ? "in" : "out"}`;
}
const wordTally = { pictures: {}, "pictures then marks": {} };
let notes = 0;
let unread = 0;
for (const surah of [...new Set(rows.map((r) => Number(r.verse.split(":")[0])))].sort((a, b) => a - b)) {
  const shard = join(built, `${surah}.json`);
  const src = join(book, "tafseer-bundle", `${String(surah).padStart(3, "0")}.json`);
  if (!existsSync(shard) || !existsSync(src)) continue;
  const verses = JSON.parse(readFileSync(shard, "utf8")).verses;
  const read = [...new Set(rows.filter((r) => Number(r.verse.split(":")[0]) === surah).flatMap((r) => verses[r.verse]?.commentary ?? []))];
  const pictureWords = picturesOf(JSON.parse(readFileSync(src, "utf8"))).flatMap((png) => {
    const path = join(book, ".work/slant", png.replace(/\.png$/, ".json"));
    if (!existsSync(path)) return unread++, [];
    return JSON.parse(readFileSync(path, "utf8")).map((w) => ({ ...w, pic: png }));
  });
  const truth = read.map(unslant);
  notes += truth.length;
  const v = { all: { commentary: truth.map((t) => t.plain) } };
  slantFromPictures(v, pictureWords, new Set());
  const afterPictures = v.all.commentary.map((n) => unslant(n).runs);
  slantMarkedTerms(v, new Set());
  const afterMarks = v.all.commentary.map((n) => unslant(n).runs);
  for (const [name, got] of [["pictures", afterPictures], ["pictures then marks", afterMarks]]) {
    const t = tally[name];
    const w = wordTally[name];
    truth.forEach(({ plain, runs }, n) => {
      const mine = got[n];
      for (const run of runs) {
        const over = mine.filter(([s, e]) => s < run[1] && e > run[0]);
        const kind = !over.length
          ? "missed"
          : over.length > 1
            ? "split"
            : over[0][0] === run[0] && over[0][1] === run[1]
              ? "whole"
              : "edges differ";
        t[kind] = (t[kind] ?? 0) + 1;
        if (kind === "edges differ") {
          const key = `start ${edge(plain, run[0], over[0][0])}, end ${edge(plain, over[0][1], run[1])}`;
          edges[name][key] = (edges[name][key] ?? 0) + 1;
        }
      }
      for (const run of mine) if (!runs.some(([s, e]) => s < run[1] && e > run[0])) t["slanted where the book is upright"] = (t["slanted where the book is upright"] ?? 0) + 1;
      // Word by word: each word is slanted in the book or not, and here or not.
      for (const m of plain.matchAll(/[\p{L}\p{N}]+/gu)) {
        const inside = (spans) => spans.some(([s, e]) => m.index >= s && m.index < e);
        const key = `${inside(runs) ? "book slants" : "book upright"}, ${inside(mine) ? "slanted here" : "upright here"}`;
        w[key] = (w[key] ?? 0) + 1;
      }
    });
  }
}
const runs = rows.length ? Object.values(tally.pictures).reduce((a, b) => a + b, 0) - (tally.pictures["slanted where the book is upright"] ?? 0) : 0;
console.log(`notes read by hand: ${notes}, their slanted runs: ${runs}, pictures not yet read: ${unread}`);
for (const name of Object.keys(tally)) {
  console.log(`${name}: runs ${JSON.stringify(tally[name])}`);
  console.log(`${name}: words ${JSON.stringify(wordTally[name])}`);
  console.log(`${name}: edges that differ ${JSON.stringify(Object.entries(edges[name]).sort((x, y) => y[1] - x[1]))}`);
}

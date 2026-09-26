#!/usr/bin/env node
/**
 * Where each letter of each word may be divided from the next, per page.
 *
 * The data behind letters in the word tool (docs/decisions/letter-parts.md,
 * A: cut the print at the joins). lib/letter-cuts.mjs finds the cuts in the
 * print's own ink; this writes what a reader needs to see one letter of a word
 * on its own — the dividing lines between neighbouring letters — and nothing
 * else. `probe-letter-cuts.mjs` draws the same lines for the eye.
 *
 *     { "page": 7, "words": { "2:38": { "1": [121, [71, 140, 0, 15, -11], …] } } }
 *
 * Keyed like the word shard: verse, then this print's word index. A word's
 * value is its dividing lines, right to left (see `encodeLines` for how a line
 * is written). A word with n letters has n−1 lines; a word the cut could not
 * be trusted on is absent, and the word tool shows its signs and the whole word
 * as before. **No spelling ships**: the corpus spells each word at build time
 * so the cut knows how many letters to find, and only the lines leave.
 *
 *   node packages/etl/scripts/build-letters.mjs                 every page
 *   node packages/etl/scripts/build-letters.mjs --pages 1-50    some pages
 *   node packages/etl/scripts/build-letters.mjs --jobs 8        how many at once
 *
 * About 10 s a page, so the whole print is run a page per process, several at
 * once. Reads only committed files (the page drawings, word and sign shards,
 * the word alignment and the vendored corpus), so it gives the same bytes
 * wherever it runs.
 */
import { fork } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cutPage, dividers, encodeLines } from "./lib/letter-cuts.mjs";
import { EDITION, WORDS_DIR } from "./lib/segmentation.mjs";

const RES = 12;
const OUT = join(WORDS_DIR, "..", "letters", EDITION);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

/** Cut one page and write its shard; returns the counts for the summary line. */
function buildPage(page) {
  const words = JSON.parse(readFileSync(join(WORDS_DIR, EDITION, `${page}.json`), "utf8")).words;
  const { results } = cutPage(page, { res: RES });
  const out = {};
  const count = { words: results.length, cut: 0, uncut: 0 };
  for (const r of results) {
    if (r.status !== "cut") { count.uncut += 1; continue; }
    const { lines, overlap } = dividers(r, RES);
    // A line that had to cross a letter's ink would show part of one letter
    // with the next: leave the word whole.
    if (overlap) { count.uncut += 1; continue; }
    const entry = words[r.key];
    const box = entry.boxes[r.print - entry.from];
    (out[r.key] ??= {})[r.print] = encodeLines(lines, box);
    count.cut += 1;
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${page}.json`), `${JSON.stringify({ page, words: out })}\n`);
  return count;
}

if (process.argv.includes("--one")) {
  // A worker: one page, its counts sent back.
  const page = Number(arg("--one"));
  process.send?.({ page, ...buildPage(page) });
} else {
  const [a, b] = (arg("--pages", "1-604")).split("-").map(Number);
  const pages = Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
  const jobs = Number(arg("--jobs", String(Math.max(1, cpus().length - 1))));
  const self = fileURLToPath(import.meta.url);
  const total = { words: 0, cut: 0, uncut: 0 };
  let next = 0;
  const run = () =>
    new Promise((resolve, reject) => {
      const step = () => {
        if (next >= pages.length) return resolve();
        const page = pages[next++];
        const child = fork(self, ["--one", String(page)], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
        child.on("message", (m) => {
          for (const k of Object.keys(total)) total[k] += m[k];
          console.log(`ev=page page=${m.page} words=${m.words} cut=${m.cut} uncut=${m.uncut}`);
        });
        child.on("exit", (code) => (code === 0 ? step() : reject(new Error(`page ${page} failed (${code})`))));
      };
      step();
    });
  await Promise.all(Array.from({ length: Math.min(jobs, pages.length) }, run));
  console.log(`build-letters — ${pages.length} pages, ${total.cut} of ${total.words} words cut (${((100 * total.cut) / total.words).toFixed(1)}%), ${total.uncut} left whole → ${OUT}`);
}

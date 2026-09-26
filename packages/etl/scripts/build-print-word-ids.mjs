#!/usr/bin/env node
/**
 * Writes `data/pages/print-word-ids.json` — the print's words as numbers, with
 * each lone "and" glued on (see `lib/print-words.mjs` for why).
 *
 * Reads the MushafDatabase ligature pages from the local cache only, so it runs
 * where the cache is (`pnpm probe:ligature-print` or `build-words.mjs` fills
 * it) and never downloads. CI does not run it; it runs the build that reads the
 * checked-in output. Rerun it only when the pinned upstream moves.
 *
 *   node scripts/build-print-word-ids.mjs
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { readTheirs, WAQF } from "./lib/mushaf-frame.mjs";
import { skeleton } from "./lib/segmentation.mjs";
import { glueAnd, PRINT_WORD_IDS } from "./lib/print-words.mjs";

const PAGES = 604;
const AND = skeleton("و");

// Pause marks are printed as words; they are not part of any phrase.
const isMark = (text) => text.length > 0 && [...text].every((c) => WAQF.has(c) || c === " ");

const perAyah = new Map();
const digest = createHash("sha256");
for (let page = 1; page <= PAGES; page += 1) {
  const { body, sha256 } = await candidatePage(page, { offline: true });
  digest.update(sha256);
  for (const w of readTheirs(body.toString("utf8")).words) {
    if (isMark(w.hafs)) continue;
    const key = `${w.surah}:${w.aya}`;
    if (!perAyah.has(key)) perAyah.set(key, []);
    perAyah.get(key).push({ idx: w.idx, skel: skeleton(w.hafs) });
  }
}

// Numbers are handed out in reading order, so a rerun on the same pages writes
// the same file byte for byte.
const ids = new Map();
const ayahs = {};
let words = 0;
let glued = 0;
const keys = [...perAyah.keys()].sort((x, y) => {
  const [a, b] = x.split(":").map(Number);
  const [c, d] = y.split(":").map(Number);
  return a - c || b - d;
});
for (const key of keys) {
  const verse = perAyah.get(key).sort((x, y) => x.idx - y.idx);
  const flat = [];
  for (const w of glueAnd(verse, AND)) {
    if (!ids.has(w.skel)) ids.set(w.skel, ids.size + 1);
    flat.push(w.first, w.last, ids.get(w.skel));
    words += 1;
    if (w.first !== w.last) glued += 1;
  }
  ayahs[key] = flat;
}

const out = {
  $comment:
    "The print's words as numbers, one [first, last, id] triple per word, each lone 'and' glued onto the next word. Same id = same letters. No text. Written by packages/etl/scripts/build-print-word-ids.mjs from the MushafDatabase ligature pages; read by build-adjacency.mjs. Decision adjacency-span-source = D.",
  source: {
    repo: pin.candidate.repo,
    commit: pin.candidate.commit,
    path: pin.candidate.path,
    pagesSha256: digest.digest("hex"),
  },
  counts: { verses: keys.length, words, glued, distinct: ids.size },
  ayahs,
};

// One verse per line, so a diff after an upstream move reads verse by verse.
const { ayahs: _, ...head } = out;
const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(ayahs[k])}`);
writeFileSync(
  PRINT_WORD_IDS,
  `${JSON.stringify(head, null, 1).slice(0, -2)},\n "ayahs": {\n${lines.join(",\n")}\n }\n}\n`,
);
console.log(
  `build-print-word-ids — ${keys.length} verses, ${words} words (${glued} with "and" glued), ${ids.size} distinct`,
);

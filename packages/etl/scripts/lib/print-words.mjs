/**
 * The print's own words, as numbers — what the look-alike runs are found in.
 *
 * Decision `adjacency-span-source` = D (2026-09-26): find the shared run of two
 * look-alike verses in the words the page itself prints, with each lone "and"
 * glued back onto the word after it. The print writes that "and" apart in 9,533
 * places and the corpus never does; glued, the two agree on every run the
 * corpus found, and the run lands straight on the print's own word numbers.
 *
 * The words come from the MushafDatabase ligature pages (`candidate-pages.mjs`),
 * which are ~350 MB and live only in a local cache. So `build-print-word-ids.mjs`
 * reads them once and checks in `data/pages/print-word-ids.json`: per verse, one
 * `[first, last, id]` triple per word, where two words get the same `id` exactly
 * when they are written with the same letters. That is all a shared run needs,
 * and it carries no text — only print positions and arbitrary numbers.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PRINT_WORD_IDS = join(HERE, "..", "..", "data", "pages", "print-word-ids.json");

/**
 * Glue each lone "and" onto the word after it. `words` is one verse in reading
 * order, `[{ idx, skel }]`; `and` is the skeleton of the lone "and". Returns
 * `[{ first, last, skel }]`, where a glued pair spans both print positions.
 * An "and" that ends the verse has nothing to join and stays as it is.
 */
export function glueAnd(words, and) {
  const out = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const next = words[i + 1];
    if (w.skel === and && next) {
      out.push({ first: w.idx, last: next.idx, skel: w.skel + next.skel });
      i += 1;
    } else out.push({ first: w.idx, last: w.idx, skel: w.skel });
  }
  return out;
}

let cache = null;

/** `"surah:ayah"` → `[{ first, last, id }]`, read from the checked-in file. */
export function openPrintWords() {
  if (cache) return cache;
  const file = JSON.parse(readFileSync(PRINT_WORD_IDS, "utf8"));
  cache = new Map();
  for (const [key, flat] of Object.entries(file.ayahs)) {
    const words = [];
    for (let i = 0; i < flat.length; i += 3) {
      words.push({ first: flat[i], last: flat[i + 1], id: flat[i + 2] });
    }
    cache.set(key, words);
  }
  return cache;
}

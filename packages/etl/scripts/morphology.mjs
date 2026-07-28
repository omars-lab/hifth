#!/usr/bin/env node
/**
 * Ayah text, reduced to what a comparison can honestly ask about.
 *
 * Extracted from `scripts/gate-edges.mjs` when `sample-edges.mjs` needed the
 * same numbers. Same move, and the same reason, as `colophon-record.mjs` and
 * `code-pointers.mjs`: two readers of one format drift, and the drift is silent
 * until the day one of them is wrong. Here the drift would be worse than
 * silent — it would be *contradictory*. A reader auditing a sampled edge would
 * see one similarity score printed beside the pair while CI enforced a floor
 * computed a different way, and the first time the two disagreed the reader
 * would be the one assumed wrong.
 *
 * There is no Quran text in this repo and there will not be. What is vendored
 * is the Quranic Arabic Corpus *morphology*: one row per segment, carrying the
 * segment's Buckwalter form and its features. Concatenating a word's segments
 * reconstructs that word — which is enough to ask "do these two ayahs share
 * phrasing" and not enough to be a mushaf. The roots live in the shipped
 * `assets/roots/**` shards rather than here, because `build-roots.mjs` already
 * parses `ROOT:` and a second parser of it is the exact drift this file exists
 * to prevent.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
export const MORPHOLOGY_PATH = join(
  HERE,
  "..",
  "data",
  "roots",
  "quranic-corpus-morphology-0.4.txt",
);

/** Every ayah in the mushaf. A reader that finds fewer has an incomplete source. */
export const TOTAL_AYAHS = 6236;

// Buckwalter marks that carry no consonant: short vowels, tanwin, shadda,
// sukun, the Quranic pause and small-letter annotations, and tatweel. Dropping
// them makes the comparison robust to the recitation marks a shared phrase is
// allowed to differ in.
const DIACRITICS = new Set([..."FNKaui~o^#`:@\"[;,.!-+%]_"]);

/** Orthographic variants a hafiz reads as the same letter. */
const FOLD = { ">": "A", "<": "A", "{": "A", "|": "A", "`": "A", Y: "y", p: "t", "&": "w", "}": "y" };

/** `(s:a:w:seg)\tFORM\t…` — the only lines with a location are segment rows. */
const LOCATION = /^\((\d+):(\d+):(\d+):\d+\)\t([^\t]*)\t/;

/** Strip the marks, fold the variants. Exported for tests, not for callers. */
export function normalise(form) {
  let out = "";
  for (const ch of form) {
    if (DIACRITICS.has(ch)) continue;
    out += FOLD[ch] ?? ch;
  }
  return out;
}

/** Built once per process — the file is ~7 MB and both callers want all of it. */
let cache = null;

/**
 * `"surah:ayah"` → the ayah's words, in order, as consonant skeletons.
 *
 * Segments are concatenated per word, so a word split across a prefix, a stem
 * and a suffix comes back whole.
 */
export function wordsByAyah() {
  if (cache) return cache;

  const byAyah = new Map();
  let atKey = null;
  let atWord = -1;
  let buffer = "";
  const flush = () => {
    if (atKey === null) return;
    const skeleton = normalise(buffer);
    if (skeleton) byAyah.get(atKey).push(skeleton);
  };

  for (const line of readFileSync(MORPHOLOGY_PATH, "utf8").split("\n")) {
    const at = LOCATION.exec(line);
    if (!at) continue;
    const key = `${Number(at[1])}:${Number(at[2])}`;
    const word = Number(at[3]);
    if (key !== atKey || word !== atWord) {
      flush();
      if (!byAyah.has(key)) byAyah.set(key, []);
      atKey = key;
      atWord = word;
      buffer = "";
    }
    buffer += at[4];
  }
  flush();

  cache = byAyah;
  return byAyah;
}

/**
 * Longest run of words present, in order and adjacent, in both ayahs.
 *
 * Contiguous matters: mutashabihat are shared *phrasing*, and two ayahs both
 * containing "الله" and "من" separately are not similar — two ayahs sharing
 * four words in a row are.
 *
 * Classic LCS-of-substrings over two short sequences — ayahs are tens of words,
 * so the quadratic table costs nothing and is far clearer than the alternatives.
 */
export function longestSharedRun(a, b) {
  if (!a?.length || !b?.length) return 0;
  let best = 0;
  let prev = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

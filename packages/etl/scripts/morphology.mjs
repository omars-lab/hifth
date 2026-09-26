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
 * Nothing vendored for this file, and nothing shipped from it, is Quran text.
 *
 * That rule was stated for years as *"there is no Quran text in this repo and
 * there will not be"*, and the unscoped half of it was false: twelve verses had
 * been typed into a source file and shipped in the bundle, and a pipeline test
 * held a four-word phrase. Nothing was checking — `gate:notext` sounds as though
 * it would and does not; it forbids `<text>` elements in page artwork, for a
 * rendering reason. `gate:scripture` is the check the sentence was standing in
 * for, and it fails on any run of three consecutive fully-vowelled words
 * anywhere in the tree.
 *
 * What is vendored is the Quranic Arabic Corpus *morphology*: one row per segment, carrying the
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

/**
 * The corpus's own copyright block, verbatim, for reproduction beside anything
 * derived from it.
 *
 * The corpus's third term of use is that the copyright notice "shall be
 * reproduced appropriately in all works derived from or containing substantial
 * portion of this file". Two shipped asset trees are now such a work — the root
 * shards, and the adjacency shards once they started carrying spans — so both
 * have to reproduce it, and the only way two copies of a quotation stay the same
 * quotation is if neither of them is a copy. It is read out of the file itself
 * on every build, from the opening line to the last rule, so the notice cannot
 * drift from the source it is quoting even by a space.
 *
 * The bound is 40 lines and the block is found by its last horizontal rule
 * rather than by a line count, because a re-pin that adds a line to the header
 * should extend the notice, not truncate it. A file whose rule is not where a
 * header keeps it is not the file this parser was written against, and throwing
 * is the honest response: a silently short notice is the failure this exists to
 * prevent.
 */
export function copyrightBlock() {
  const head = readFileSync(MORPHOLOGY_PATH, "utf8").split("\n").slice(0, 40);
  const rule = head.findLastIndex((l) => l.startsWith("#===="));
  if (rule < 4) throw new Error("copyright block not found at the head of the morphology file");
  return head.slice(0, rule + 1).join("\n");
}

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

// The run-finder lives in its own file so a builder that needs only the run
// (build-adjacency.mjs, over the print's words) does not import this reader and
// with it the corpus. Re-exported so every existing caller keeps working.
export { sharedRuns, longestSharedRun } from "./lib/shared-runs.mjs";

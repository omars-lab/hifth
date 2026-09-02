#!/usr/bin/env node
/**
 * CI gate: no source file may hold a running passage of scripture.
 *
 * WHY THIS EXISTS. Twenty-two times across twenty files this repo asserts some
 * version of "there is no Quran text here" — including in three shipped
 * NOTICE.txt files. When it was finally measured, the unscoped form of that
 * claim was false in two places, and one of them shipped: 48 fully-vowelled
 * token strings in `packages/core/src/verse-text.ts`, every one byte-present in
 * the web bundle, sitting there since Loop 3 as "demo data Loop 4 will replace".
 *
 * Nothing caught it, and the reason is worth stating where somebody will read
 * it: `gate:notext` sounds like it would. It does not. That gate forbids `<text>`
 * elements inside page SVGs because such an element under `content-visibility:
 * auto` can fail to paint in Safari. It is a rendering requirement wearing a
 * name that reads like a scripture check, and for two loops it was mistaken for
 * one. Hence this file rather than a widening of that one.
 *
 * WHY IT MATTERS MORE THAN TIDINESS. Takedown notices over scripture are
 * routinely path-scoped *into* code repositories — at a data directory, and in
 * at least one case at a test-fixtures directory. The blast radius tracks the
 * directory holding the text, not what the project is for. A test fixture is
 * therefore not a safe place to keep a passage, which is exactly the assumption
 * the second site here was resting on.
 *
 * WHAT IT MEASURES, AND WHY THAT AND NOT "IS THERE ARABIC". About a hundred
 * tracked source files carry Arabic and nearly all of them should: the Arabic
 * locale is our own translation, surah names are names, and the pipeline keeps
 * single vowelled words as specimens because tajweed and encoding edge cases are
 * *about* particular orthography. Flagging Arabic would flag all of it and be
 * switched off inside a week.
 *
 * What separates scripture from the rest is not the script and not even the
 * vowelling — it is how much vowelled text runs *consecutively*. One vowelled
 * word is a specimen; a phrase is a passage a recipient can recover. Measured
 * across the whole tree, longest run of consecutive fully-vowelled words:
 *
 *     packages/core/src/verse-text.ts                   11
 *     packages/etl/scripts/lib/tajweed-fold.test.mjs     5
 *     ... everything else                             1 or 2
 *
 * Nothing sits at 3 or 4. The threshold below is not a taste call — it is placed
 * in a gap that the tree itself provides, and if that gap ever closes the number
 * needs re-deriving rather than nudging.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/* ------------------------------------------------------------------ */
/* The two rules                                                       */
/* ------------------------------------------------------------------ */

/**
 * A run of this many consecutive fully-vowelled words fails, and no list can
 * excuse it. Three, because the tree's own measurement leaves 3 and 4 empty.
 */
const PHRASE = 3;

/**
 * A word counts as fully vowelled when at least this share of its letters carry
 * a mark. Vowelled scripture sits at 0.85–1.0; Arabic prose that uses the
 * occasional shadda for disambiguation sits at 0.43 and below on the same
 * measure, so the midpoint separates them with room on both sides.
 */
const VOWELLED = 0.5;

/**
 * A file holding this many vowelled words is a *collection* — somebody
 * assembled it — and has to say so in SPECIMENS below. Below it, a vowelled
 * word is incidental: a domain term in a UI string, one label in a test.
 */
const COLLECTION = 5;

/**
 * The specimen collections, each with the reason it is one. This list cannot
 * excuse a phrase — PHRASE is checked first and independently. It exists so the
 * lone vowelled words scattered through the pipeline read as reviewed rather
 * than as nobody having looked.
 */
const SPECIMENS = {
  "packages/etl/scripts/lib/tajweed-fold.mjs":
    "per-word tajweed edge cases; the fold is about particular orthography and cannot be tested without it",
  "packages/etl/scripts/lib/tajweed-fold.test.mjs": "the cases above, asserted",
  "packages/etl/scripts/probe-tajweed-words.mjs":
    "the same edge cases, reached from the print's own per-word text",
  "packages/etl/scripts/probe-diacritics.mjs": "one word per diacritic shape the print uses",
  "packages/etl/scripts/lib/mark-join.mjs": "per-word join cases; a join is a fact about one word",
  "packages/etl/scripts/lib/mark-join.test.mjs": "the cases above, asserted",
  "packages/etl/scripts/lib/segmentation.mjs":
    "the named print-to-corpus alignment exceptions, each one word",
  "apps/web/src/messages/ar.gen.ts": "our own Arabic interface strings, generated from our own catalog",
  "apps/web/src/components/RootLens.test.tsx": "one root, vowelled, as a lens fixture",
  "packages/core/src/roots.test.ts": "the same root",
};

/* ------------------------------------------------------------------ */
/* Character classes, written as escapes on purpose                    */
/* ------------------------------------------------------------------ */

// This file is one of the ones the gate reads. Arabic literals here would be
// self-referential noise at best and a false positive at worst, so every range
// below is an escape.
const ARABIC = "\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
// Letters only: tatweel (U+0640) is a connector that carries marks without being
// one, and counting it as a letter would dilute the ratio on exactly the words
// that use it.
const LETTER = new RegExp("[\\u0621-\\u064A\\u0671-\\u06D3]", "g");
// Harakat, superscript alef, the hamza/madda companions, and the small high
// marks the Uthmani print uses.
const MARK = new RegExp("[\\u064B-\\u0652\\u0670\\u0653-\\u0655\\u06D6-\\u06ED]", "g");
const HAS_ARABIC = new RegExp("[" + ARABIC + "]");
const WORD = new RegExp("[" + ARABIC + "]+", "g");
// Anything that is neither Arabic nor whitespace ends a run — see scan().
const BREAK = new RegExp("[^\\s" + ARABIC + "]+");

/** Whether a token is fully vowelled in the sense defined above. */
function isVowelled(word) {
  const letters = (word.match(LETTER) || []).length;
  if (letters < 2) return false;
  return (word.match(MARK) || []).length / letters >= VOWELLED;
}

/**
 * The longest run of consecutive vowelled words, and how many there are in all.
 *
 * Runs break on anything that is not Arabic or whitespace — a quote, a comma in
 * the source, a `+`. That is deliberate: two adjacent string literals are two
 * fragments, and gluing them would let the gate be defeated by pressing Enter.
 * It also means the count is a floor, never an overstatement.
 */
function scan(text) {
  let longest = 0;
  let total = 0;
  let sample = "";
  for (const line of text.split("\n")) {
    for (const chunk of line.split(BREAK)) {
      if (!HAS_ARABIC.test(chunk)) continue;
      let run = 0;
      for (const word of chunk.match(WORD) || []) {
        if (!isVowelled(word)) {
          run = 0;
          continue;
        }
        total++;
        run++;
        if (run > longest) {
          longest = run;
          sample = chunk.trim().slice(0, 60);
        }
      }
    }
  }
  return { longest, total, sample };
}

/* ------------------------------------------------------------------ */
/* Which files                                                         */
/* ------------------------------------------------------------------ */

// Same enumeration as gate-text-sources.mjs, for the reason recorded there: a
// gate that lists only tracked files has a different scope on the machine that
// writes the code than on the machine that gates it, and the difference is
// invisible from the machine that gates it. `make ci` is the mirror people run
// before staging, and that is the run this gate most needs to be part of.
const SOURCE_RE = /^(packages|apps|scripts)\/.*\.(ts|tsx|mjs|js|jsx)$/;
const EXCLUDE_RE = /^(packages\/etl\/data|.*\/(dist|coverage|playwright-report|test-results))\//;

const files = [
  ...new Set(
    execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n"),
  ),
].filter((f) => SOURCE_RE.test(f) && !EXCLUDE_RE.test(f));

if (files.length === 0) {
  console.error("gate:scripture — no source files matched; the filter is stale");
  process.exit(1);
}

const passages = [];
const unlisted = [];
const listed = new Set();

for (const rel of files) {
  const abs = join(ROOT, rel);
  // `git ls-files` reads the index, so a file deleted in the working tree but
  // not yet staged is listed and no longer on disk. Same reasoning as
  // gate-text-sources.mjs: a gate that crashes names the wrong problem.
  if (!existsSync(abs)) continue;
  const { longest, total, sample } = scan(readFileSync(abs, "utf8"));
  if (total === 0) continue;
  if (longest >= PHRASE) passages.push({ rel, longest, total, sample });
  else if (total >= COLLECTION && !(rel in SPECIMENS)) unlisted.push({ rel, total });
  if (rel in SPECIMENS) listed.add(rel);
}

// A list that names files which no longer hold specimens is a list nobody has
// read. Same insistence the other registers make.
const stale = Object.keys(SPECIMENS).filter((rel) => !listed.has(rel));

const problems = [];

if (passages.length > 0) {
  problems.push("running scripture in source — a passage a recipient can recover:");
  for (const p of passages) {
    problems.push(`   ${p.rel} — ${p.longest} consecutive vowelled words (${p.total} in all)`);
    problems.push(`      ${p.sample}`);
  }
  problems.push(
    "   This is not excusable by SPECIMENS. Draw what the reader needs from the page artwork\n" +
      "   and the word shards, which ship already, or hold the case as single words.",
  );
}

if (unlisted.length > 0) {
  problems.push(
    `specimen collections not named in SPECIMENS (${COLLECTION}+ vowelled words in one file):`,
  );
  for (const u of unlisted) problems.push(`   ${u.rel} — ${u.total} vowelled words`);
  problems.push("   Add each with the reason it is a collection, or remove the words.");
}

if (stale.length > 0) {
  problems.push("SPECIMENS names files that no longer hold vowelled words:");
  for (const rel of stale) problems.push(`   ${rel}`);
}

if (problems.length > 0) {
  console.error("gate:scripture — FAIL:");
  for (const line of problems) console.error(line.startsWith("   ") ? line : "  " + line);
  process.exit(1);
}

console.log(
  `gate:scripture — OK (${files.length} sources, no passage of ${PHRASE}+ vowelled words, ` +
    `${listed.size} specimen collection(s) named)`,
);

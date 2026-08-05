#!/usr/bin/env node
/**
 * CI gate: the print↔QAC word map still applies, and still lands where QAC says.
 *
 * `word-alignment.pin.json` is the one place this repo relates its two word
 * indices — the print's `data-word-index-in-ayah`, which every word box carries,
 * and the Quranic Arabic Corpus's `(surah:ayah:word:segment)`, which the roots
 * shards and `gate:edges` speak. It was derived from a 378 MB upstream corpus
 * this repo does not vendor, so it cannot be re-derived in CI. That is exactly
 * the situation an unchecked artifact lives in, and the mutashabihat off-by-one
 * (#80) is what an unchecked artifact costs: 47.8% of hop edges pointed at the
 * wrong ayah for four loops, and everything downstream looked fine.
 *
 * So this gate does not re-derive the map. It **applies** it, offline, to the
 * two things that are committed, and checks the result against a third:
 *
 *   1. the shipped word shards say which print indices exist and which are
 *      pause marks — the base the delta is a delta over;
 *   2. the pin says which of those indices continue the previous QAC word;
 *   3. the vendored QAC morphology says how many words the ayah has.
 *
 * If applying (2) to (1) does not produce (3), exactly, for all 6,232 mapped
 * ayahs, something moved and the map is a lie. Nothing about that check needs
 * the network or the upstream SVGs.
 *
 * The delta is applied here in its own ten lines rather than through
 * `lib/segmentation.mjs`. Same reason `gate:words` parses paths itself: a gate
 * that runs the code it is checking proves only that the code agrees with
 * itself. What is being checked here is the *pin*, and the reader is part of
 * what could be wrong with it.
 *
 * Section 5 checks the first thing shipped *through* the map: the `w` print
 * word indices baked into `assets/roots/**`. `build-roots.mjs` converts them
 * with `Alignment`; this gate never calls it, and asks only questions the word
 * shards and the exception table can answer on their own — is `w` there exactly
 * where the map is, is every index a lexical word of that ayah, is it ordered
 * and unique, and is it at least as long as the segment count it sits beside.
 * Same division of labour as the span checks in `gate:edges`: the producer
 * derives, the gate witnesses, and neither borrows the other's reader.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { wordsByAyah } from "../packages/etl/scripts/morphology.mjs";
import { EXCEPTIONS } from "../packages/etl/scripts/lib/segmentation.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const PIN = join(ROOT, "packages/etl/data/pages/word-alignment.pin.json");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc");
const ROOTS = join(ROOT, "apps/web/public/assets/roots/hafs-kfqc/ayah");

const fail = [];
const say = (m) => fail.push(m);

if (!existsSync(PIN)) {
  console.error(`gate:align — FAIL: no ${PIN}. Run \`pnpm align --rebuild --fetch\`.`);
  process.exit(1);
}
const pin = JSON.parse(readFileSync(PIN, "utf8"));

// ---- 1. the exception table is the same in the code and in the data --------
// Two witnesses to the same four ayahs. A reason lives beside each in the code;
// a fifth added to either side without the other is the drift this catches.
const inCode = Object.keys(EXCEPTIONS).sort();
const inPin = Object.keys(pin.exceptions ?? {}).sort();
if (inCode.join(",") !== inPin.join(",")) {
  say(`exceptions differ — segmentation.mjs has [${inCode}], the pin has [${inPin}]`);
}
for (const [key, why] of Object.entries(pin.exceptions ?? {})) {
  if (!why || why.length < 20) say(`exception ${key} has no reason worth reading: ${JSON.stringify(why)}`);
}

// ---- 2. read the base: every ayah's print indices, marks separated ----------
/** `"surah:ayah"` → { lexical: [print index…] } */
const print = new Map();
for (const file of readdirSync(WORDS).filter((f) => f.endsWith(".json"))) {
  const shard = JSON.parse(readFileSync(join(WORDS, file), "utf8"));
  for (const [key, entry] of Object.entries(shard.words)) {
    const marks = new Set(entry.marks ?? []);
    const lexical = [];
    for (let i = 0; i < entry.boxes.length; i += 1) {
      const idx = entry.from + i;
      if (!marks.has(idx)) lexical.push(idx);
    }
    if (print.has(key)) say(`${key} appears in two shards — the map assumes one page per ayah`);
    print.set(key, lexical);
  }
}

// ---- 3. apply the delta, and check it against QAC --------------------------
const qac = wordsByAyah();
let checked = 0;
let joins = 0;
let splits = 0;
let printWords = 0;
let qacWords = 0;

for (const [key, lexical] of print) {
  printWords += lexical.length;
  const expected = qac.get(key)?.length;
  if (expected === undefined) {
    say(`${key} is in the word shards but not in the QAC morphology`);
    continue;
  }
  qacWords += expected;
  if (EXCEPTIONS[key]) continue;

  const { j = [], s = {} } = pin.ayahs[key] ?? {};
  const lex = new Set(lexical);
  for (const idx of j) {
    if (!lex.has(idx)) say(`${key}: join at print ${idx}, which is not a lexical word here`);
    if (idx === lexical[0]) say(`${key}: print ${idx} is the ayah's first word and cannot continue one`);
  }
  for (const [idx, span] of Object.entries(s)) {
    if (!lex.has(Number(idx))) say(`${key}: split at print ${idx}, which is not a lexical word here`);
    if (!(span > 1)) say(`${key}: split at print ${idx} spans ${span}, which is not a split`);
  }

  // The whole map, in one pass: a join keeps the running count, anything else
  // advances it past however many QAC words its predecessor covered.
  const joined = new Set(j);
  let count = 0;
  for (let i = 0; i < lexical.length; i += 1) {
    if (i === 0 || !joined.has(lexical[i])) count += s[lexical[i]] ?? 1;
  }
  // A joined word can still be the one that carries a split; add what the loop
  // above skipped so the arithmetic is over every print word, not most of them.
  for (const [idx, span] of Object.entries(s)) {
    if (joined.has(Number(idx))) count += span - 1;
  }

  if (count !== expected) {
    say(`${key}: the map yields ${count} QAC words, the morphology has ${expected}`);
  }
  checked += 1;
  joins += j.length;
  splits += Object.keys(s).length;
}

for (const key of Object.keys(pin.ayahs)) {
  if (!print.has(key)) say(`the pin maps ${key}, which no word shard carries`);
}
for (const key of Object.keys(pin.exceptions ?? {})) {
  if (!print.has(key)) say(`the pin excepts ${key}, which no word shard carries`);
}

// ---- 4. the pin's own report matches what applying it produces --------------
// The `measured` block is what a reader quotes without rerunning anything, so a
// stale number there is a wrong claim in the record, not a cosmetic drift.
const m = pin.measured ?? {};
const expectedMeasured = {
  ayahsAligned: checked,
  ayahsTotal: print.size,
  printWords,
  qacWords,
  joins,
  splits,
};
for (const [field, value] of Object.entries(expectedMeasured)) {
  if (m[field] !== value) say(`measured.${field} says ${m[field]}, applying the map gives ${value}`);
}

// ---- 5. the roots shards' `w` is where the map says it can be ---------------
// `w` is the map's only shipped consequence so far; a wrong index here is a
// highlight on the wrong word, which reads as the app being confused about the
// mus'haf rather than about its own arithmetic.
let placed = 0;
let unplaced = 0;
let wider = 0;
if (existsSync(ROOTS)) {
  for (const file of readdirSync(ROOTS).filter((f) => f.endsWith(".json"))) {
    const surah = file.replace(".json", "");
    const shard = JSON.parse(readFileSync(join(ROOTS, file), "utf8"));
    for (const [ayah, entries] of Object.entries(shard)) {
      const key = `${surah}:${ayah}`;
      const lexical = new Set(print.get(key) ?? []);
      for (const { r, n, w } of entries) {
        const at = `${key} ${r}`;
        if (!w) {
          unplaced += 1;
          // No `w` is a claim in itself: this ayah is one the map excepts.
          if (!EXCEPTIONS[key]) say(`${at}: no w, but ${key} is not an excepted ayah`);
          continue;
        }
        placed += 1;
        if (EXCEPTIONS[key]) say(`${at}: carries w, but ${key} is excepted — the map cannot place it`);
        if (!Array.isArray(w) || w.length === 0) {
          say(`${at}: w is ${JSON.stringify(w)}, which is not a non-empty list`);
          continue;
        }
        for (let i = 0; i < w.length; i += 1) {
          if (!Number.isInteger(w[i])) say(`${at}: w contains ${JSON.stringify(w[i])}, which is not an index`);
          else if (!lexical.has(w[i])) say(`${at}: w has print word ${w[i]}, which ${key} has no lexical box for`);
          if (i > 0 && w[i] <= w[i - 1]) say(`${at}: w is ${w.join(",")} — not ascending and unique`);
        }
        // Measured over the 44,401 placed pairs: |w| === n on 39,136 and > n on
        // 5,265, never less. It cannot be less — no root in the corpus sits on
        // two rooted segments of one word (0 of 44,431), so `n` is also the
        // number of corpus words the root occupies, and the print only ever
        // splits one of those into more pieces, never merges two into fewer.
        if (w.length < n) say(`${at}: w places ${w.length} words for ${n} rooted segments`);
        if (w.length > n) wider += 1;
      }
    }
  }
} else {
  say(`no ${ROOTS} — run \`pnpm --filter @hifth/etl build:roots\``);
}

if (fail.length) {
  console.error(`gate:align — FAIL (${fail.length})`);
  for (const line of fail.slice(0, 25)) console.error(`  ${line}`);
  if (fail.length > 25) console.error(`  …and ${fail.length - 25} more`);
  console.error("\n  The map is derived, not written: fix the cause, then");
  console.error("  `pnpm align --rebuild` — add `--fetch` if the upstream cache is cold.");
  process.exit(1);
}

console.log(
  `gate:align — OK: ${checked} ayahs map print→QAC exactly ` +
    `(${printWords} print words → ${qacWords} QAC words, ${joins} joins, ${splits} splits), ` +
    `${inPin.length} named exceptions`,
);
console.log(
  `gate:align — OK: ${placed} root-ayah pairs sit on lexical print words ` +
    `(${wider} spread wider than their segment count), ` +
    `${unplaced} unplaced and all on excepted ayahs`,
);

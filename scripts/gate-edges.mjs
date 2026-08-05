#!/usr/bin/env node
/**
 * CI gate: a hop edge must share words with the ayah it departs from.
 *
 * This gate exists because the corpus shipped wrong for four loops and every
 * other check stayed green. `mutashabiha_data.json` addresses ayahs from zero,
 * `toAbsoluteAyah` addresses them from one, and the bridge between them was
 * missing a +1 — so 47.8% of the hop edges named the ayah *after* the one they
 * meant. Nothing caught it: the determinism gate only proves the ETL repeats
 * itself, `gate:verified-edges` only guards the eight edges a human has read,
 * and those eight are written as "S:A" strings that skip the conversion
 * entirely. The bad edges were structurally perfect and semantically noise.
 *
 * So this gate reads meaning, cheaply. Words are reconstructed per ayah from
 * the vendored morphology (segment FORMs concatenated per word, reduced to a
 * consonant skeleton), and each edge is scored by the longest *contiguous* run
 * of words its two ends share. Contiguous matters: mutashabihat are shared
 * phrasing, and two ayahs both containing "الله" and "من" separately are not
 * similar — two ayahs sharing four words in a row are.
 *
 * The separation is wide enough that the threshold is not a tuning knob:
 *
 *   corpus as it shipped (no shift)  47.8% of edges share zero words
 *   random ayah pairs                69.1%
 *   corpus with the +1               ~4%
 *
 * Anything above 10% means numbering broke again. The gate deliberately does
 * not check the *right* answer is present — only a human with a mushaf can say
 * that, and `gate:verified-edges` is where their verdicts live. This one
 * catches the failure that class of check cannot: data that is wholesale wrong
 * everywhere nobody has looked.
 *
 * Scope: the dataset-derived types only. `shared-root` edges are generated from
 * the morphology itself and are *defined* by a shared root rather than shared
 * phrasing, so a contiguous-run floor is the wrong question to ask of them —
 * they are counted and reported, never failed.
 *
 * ---
 *
 * The gate then checks the **spans**: the print word range a mutashabih edge
 * says it is about, on each side. A span is a stronger claim than an edge —
 * an edge points at an ayah, a span points at words inside it, and it is
 * derived through `word-alignment.pin.json`, one more artifact that can drift.
 * Four things must hold, and none of them re-derives the span (a check that
 * reruns the producer proves only that the producer agrees with itself):
 *
 *   1. both ends or neither, and only on `mutashabih` — the type whose
 *      definition is shared phrasing;
 *   2. both endpoints are **lexical print indices of that ayah**, read from the
 *      shipped word shards. That is the independent witness: the shards are a
 *      separate artifact from the pin the span was converted through, and they
 *      are what the app highlights against;
 *   3. the range is at least as wide as the shared run and at most twice it.
 *      The print writes some words the corpus counts as one (9,533 such joins),
 *      never the reverse in any shipped span — measured: printWidth − run is 0
 *      to 6 over all 5,088 span sides, never negative. Twice is the structural
 *      ceiling, since a 2→1 block is the widest the map has;
 *   4. a reverse edge that also carries spans carries the mirror of them.
 *      `sharedRuns(b, a)` mirrors `sharedRuns(a, b)`, so a→b and b→a must name
 *      the same two ranges swapped — 2,544 pairs do, and one that did not would
 *      mean the derivation is order-dependent, which is a defect in it.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  MORPHOLOGY_PATH,
  TOTAL_AYAHS,
  longestSharedRun,
  wordsByAyah as readWordsByAyah,
} from "../packages/etl/scripts/morphology.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const ADJ = join(ROOT, "apps", "web", "public", "assets", "adj");
const WORDS = join(ROOT, "apps", "web", "public", "assets", "words");

/** Share of scored edges with no shared words at all, above which CI fails. */
const ZERO_OVERLAP_LIMIT = 0.1;
/** Edge types whose promise is shared *phrasing*, and so are scored here. */
const SCORED_TYPES = new Set(["mutashabih", "related-meaning"]);

const fail = (msg) => {
  console.error(`gate:edges — FAIL: ${msg}`);
  process.exit(1);
};

for (const p of [ADJ, MORPHOLOGY_PATH]) if (!existsSync(p)) fail(`missing ${p}`);

/* ------------------------------------------------------------------ */
/* Words per ayah, as a consonant skeleton.                            */
/* ------------------------------------------------------------------ */

// Read once, from packages/etl/scripts/morphology.mjs, which `sample-edges.mjs`
// reads too. The sampler prints this same score beside each pair it draws for a
// human to audit, and a reader whose printed number disagreed with the number
// CI enforces would be the one assumed wrong.
const wordsByAyah = readWordsByAyah();

if (wordsByAyah.size !== TOTAL_AYAHS) {
  fail(
    `morphology covers ${wordsByAyah.size} ayahs, expected ${TOTAL_AYAHS} — source is incomplete`,
  );
}

/* ------------------------------------------------------------------ */
/* Score every shipped edge.                                           */
/* ------------------------------------------------------------------ */

/** `quran/<edition>/2:122#w3` → `2:122`. */
const bareKey = (to) => to.slice(to.lastIndexOf("/") + 1).split("#")[0];

/**
 * `"surah:ayah"` → the set of print indices that are words rather than pause
 * marks, read straight from the shipped word shards. Parsed here rather than
 * borrowed from `lib/segmentation.mjs` for the reason `gate:align` gives: the
 * reader is part of what could be wrong with the thing being read.
 */
function lexicalPrintWords(edition) {
  const dir = join(WORDS, edition);
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [key, entry] of Object.entries(shard.words)) {
      const marks = new Set(entry.marks ?? []);
      const lex = new Set();
      for (let i = 0; i < entry.boxes.length; i += 1) {
        const idx = entry.from + i;
        if (!marks.has(idx)) lex.add(idx);
      }
      out.set(key, lex);
    }
  }
  return out;
}

const byType = new Map();
/** The worst offenders, kept for the failure message. */
const zeroes = [];
/** Everything wrong with a span, kept for the failure message. */
const spanFail = [];
/** `from>to>type` → `[fromRange, toRange]`, for the mirror check. */
const spans = new Map();

/** One end of one span: shape, membership, width. */
function checkSide(where, key, side, run, lexical) {
  const range = side?.from;
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger)) {
    spanFail.push(`${where}: ${key} span is not a [from, to] pair of integers`);
    return;
  }
  const [lo, hi] = range;
  if (lo > hi) spanFail.push(`${where}: ${key} span [${lo}, ${hi}] runs backwards`);
  const lex = lexical.get(key);
  if (!lex) {
    spanFail.push(`${where}: ${key} carries a span but no word shard has that ayah`);
    return;
  }
  for (const idx of [lo, hi]) {
    if (!lex.has(idx)) {
      spanFail.push(`${where}: ${key} span endpoint ${idx} is not a lexical word of that ayah`);
    }
  }
  const width = hi - lo + 1;
  if (width < run) {
    spanFail.push(`${where}: ${key} span is ${width} print words for a ${run}-word run — too narrow`);
  } else if (width > 2 * run) {
    spanFail.push(`${where}: ${key} span is ${width} print words for a ${run}-word run — over the 2× ceiling`);
  }
}

for (const edition of readdirSync(ADJ, { withFileTypes: true })) {
  if (!edition.isDirectory()) continue;
  const dir = join(ADJ, edition.name);
  const lexical = lexicalPrintWords(edition.name);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const surah = file.slice(0, -5);
    const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [ayah, node] of Object.entries(shard)) {
      const from = `${surah}:${ayah}`;
      for (const edge of node.edges ?? []) {
        const to = bareKey(edge.to);
        const run = longestSharedRun(wordsByAyah.get(from), wordsByAyah.get(to));
        let stat = byType.get(edge.type);
        if (!stat) byType.set(edge.type, (stat = { n: 0, zero: 0, total: 0 }));
        stat.n += 1;
        stat.total += run;
        if (run === 0) {
          stat.zero += 1;
          if (SCORED_TYPES.has(edge.type)) zeroes.push(`${from} → ${to} (${edge.type})`);
        }

        if (!edge.span && !edge.toSpan) continue;
        const where = `${from} → ${to}`;
        if (edge.type !== "mutashabih") {
          spanFail.push(`${where}: a ${edge.type} edge carries a span; only mutashabih may`);
        }
        if (!edge.span || !edge.toSpan) {
          spanFail.push(`${where}: has ${edge.span ? "span" : "toSpan"} but not the other`);
          continue;
        }
        checkSide(where, from, edge.span, run, lexical);
        checkSide(where, to, edge.toSpan, run, lexical);
        spans.set(`${edition.name}|${from}>${to}>${edge.type}`, [
          edge.span.from.join("-"),
          edge.toSpan.from.join("-"),
        ]);
      }
    }
  }
}

if (byType.size === 0) fail("no edges found in the shipped shards");

/* ------------------------------------------------------------------ */
/* The spans, checked against their own reverses.                      */
/* ------------------------------------------------------------------ */

let mirrored = 0;
for (const [key, [there, back]] of spans) {
  const [edition, pair] = key.split("|");
  const [from, to, type] = pair.split(">");
  const reverse = spans.get(`${edition}|${to}>${from}>${type}`);
  if (!reverse) continue;
  mirrored += 1;
  if (reverse[0] !== back || reverse[1] !== there) {
    spanFail.push(
      `${from} → ${to} says [${there}]→[${back}] but ${to} → ${from} says ` +
        `[${reverse[0]}]→[${reverse[1]}] — the derivation is order-dependent`,
    );
  }
}

if (spanFail.length) {
  console.error(`gate:edges — FAIL: ${spanFail.length} span problems`);
  for (const line of spanFail.slice(0, 15)) console.error(`  ${line}`);
  if (spanFail.length > 15) console.error(`  …and ${spanFail.length - 15} more`);
  console.error(
    "\n  A span is derived, not written: it is the longest shared run converted" +
      "\n  through `word-alignment.pin.json`. Check `pnpm gate:align` first, then" +
      "\n  `spansOf` in build-adjacency.mjs, then rebuild the shards.\n",
  );
  process.exit(1);
}

let n = 0;
let zero = 0;
const lines = [];
for (const [type, s] of [...byType].sort()) {
  const scored = SCORED_TYPES.has(type);
  if (scored) {
    n += s.n;
    zero += s.zero;
  }
  lines.push(
    `  ${scored ? "·" : " "} ${type.padEnd(15)} ${String(s.n).padStart(5)} edges  ` +
      `${((s.zero / s.n) * 100).toFixed(1).padStart(5)}% share no words  ` +
      `mean run ${(s.total / s.n).toFixed(2)}${scored ? "" : "   (reported, not gated)"}`,
  );
}

if (n === 0) fail(`no ${[...SCORED_TYPES].join("/")} edges found — did the ETL stop emitting them?`);

const share = zero / n;
console.log(lines.join("\n"));

if (share > ZERO_OVERLAP_LIMIT) {
  console.error(
    `\ngate:edges — FAIL: ${zero}/${n} scored edges (${(share * 100).toFixed(1)}%) ` +
      `share no words with their source, over the ${(ZERO_OVERLAP_LIMIT * 100).toFixed(0)}% limit.\n`,
  );
  for (const z of zeroes.slice(0, 15)) console.error(`  ${z}`);
  if (zeroes.length > 15) console.error(`  …and ${zeroes.length - 15} more`);
  console.error(
    "\n  Random ayah pairs score 69% here and the off-by-one corpus scored 48%," +
      "\n  so this is not a quality wobble — an ayah-numbering assumption broke." +
      "\n  Check `datasetAbs` in build-adjacency.mjs before anything else.\n",
  );
  process.exit(1);
}

console.log(
  `gate:edges — OK (${zero}/${n} scored edges share no words, ` +
    `${(share * 100).toFixed(1)}% ≤ ${(ZERO_OVERLAP_LIMIT * 100).toFixed(0)}% limit)`,
);
console.log(
  `gate:edges — OK (${spans.size} edges carry a word span, all inside their ayah; ` +
    `${mirrored} have a reverse that mirrors them)`,
);

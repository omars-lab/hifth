#!/usr/bin/env node
/**
 * Four descriptions of one text, and a report of where they disagree.
 *
 * This repo reconciles four encodings of the Quran, none of which is the text:
 *
 * 1. **The print.** 604 vendored KFGQPC Hafs SVG pages of anonymous outlined
 *    `<path>`s. It is what a hafiz recognises and it knows nothing — no letter,
 *    no word, no ayah.
 * 2. **The ligature corpus.** The same pages upstream, pinned, with a
 *    `data-hafs` string and a 1-based `data-word-index-in-ayah` on every word
 *    group. This is where words come from, and it is gitignored cache.
 * 3. **The QAC word index.** `surah:ayah:word:segment` in Buckwalter, from the
 *    morphology. Its words are the ones roots and lemmas hang off, and it
 *    segments the text differently from the print.
 * 4. **The tajweed offsets.** `[start, end)` codepoint ranges into each ayah's
 *    *Tanzil Uthmani* text — a text this repo does not hold and will not.
 *
 * Each pair disagrees for its own reason, and each disagreement has been
 * measured separately, by a separate probe, into a separate paragraph of a
 * separate design doc. This tool is the one place all four are on one screen at
 * one ayah, which is the only place a maintainer can see that the 2→1 block at
 * word 3 and the two-word tajweed span at offset 41 are the *same* fact about
 * the print.
 *
 * ## Why a generated file and not a dev route in the app
 *
 * Argued in full in `docs/design/encoding-inspector.md`; the short of it is that
 * (2) lives in a 378 MB gitignored cache no browser can read, so a generator
 * step exists either way; that the fold is L3 arithmetic the layer rules forbid
 * L2 importing; and that a dev-only route is one careless import away from
 * moving `gate:budget`'s number, whereas an HTML file in a gitignored directory
 * cannot ship by accident. The report stays *live* regardless: the corpus is
 * embedded and `lib/tajweed-fold.mjs` is inlined verbatim, so the correction
 * toggles recompute all 6,236 ayahs in the page rather than reading a table.
 *
 * ## The one rule this script exists under
 *
 * **There is no Quran text in this repo and there will not be.** The report is
 * full of Arabic; every codepoint of it is read at runtime from the gitignored
 * `.cache/words/`, and the output goes to `packages/etl/out/`, which is
 * gitignored. Committing a generated report would vendor the mus'haf through
 * the back door. `gate:notext` and `gate:text-sources` are the check; the
 * output path is the reason they stay green.
 *
 * Not a gate, and never will be: no cache, nothing to read. Named `probe-` for
 * exactly the reason `probe-tajweed-words.mjs` is.
 *
 * Usage:
 *   node packages/etl/scripts/probe-encodings.mjs                 # from the cache
 *   node packages/etl/scripts/probe-encodings.mjs --fetch         # fill it first
 *   node packages/etl/scripts/probe-encodings.mjs --pages 40      # a fast subset
 *   node packages/etl/scripts/probe-encodings.mjs --out /tmp/x.html
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { WAQF } from "./lib/mushaf-frame.mjs";
import { EXCEPTIONS, lexicalIndices, openAlignment, qacSkeletons } from "./lib/segmentation.mjs";
import { ALL_CORRECTIONS, foldAyah, oracleDensity, oracleOf, touchClass } from "./lib/tajweed-fold.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const TAJWEED = join(DATA, "tajweed", "tajweed.hafs.uthmani-pause-sajdah.json");
const META = join(DATA, "meta", "quran-data.xml");
const DEFAULT_OUT = join(HERE, "..", "out", "encoding-inspector.html");

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const fetchMissing = process.argv.includes("--fetch");
const lastPage = Number(argOf("--pages", 604));
const out = argOf("--out", DEFAULT_OUT);

// ------------------------------------------------------------------ reading --

// The same local attribute scan `probe-tajweed-words.mjs` uses and for the same
// reason: `readTheirs` parses every path in the file to build geometry, which is
// minutes of work for a question that needs no boxes, and it drops
// `data-waw-alatf`, which one of the eight corrections is entirely about.
const WORD = /<g id="md-word-\d+"([^>]*)>/g;
const attr = (s, name) => {
  const m = s.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const unescapeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** A word that is nothing but pause/hizb marks — ink the Tanzil text does not carry. */
const isMark = (text) => [...text].length > 0 && [...text].every((c) => WAQF.has(c));

/** "surah:ayah" → Map(1-based print index → { hafs, waw, mark }). */
const byAyah = new Map();

async function readPages() {
  let bytes = 0;
  for (let page = 1; page <= lastPage; page += 1) {
    const { body } = await candidatePage(page, { offline: !fetchMissing });
    bytes += body.length;
    for (const m of body.toString("utf8").matchAll(WORD)) {
      const a = m[1];
      const surah = Number(attr(a, "data-surah"));
      const aya = Number(attr(a, "data-aya"));
      const idx = Number(attr(a, "data-word-index-in-ayah"));
      const hafs = attr(a, "data-hafs");
      if (!surah || !aya || !idx || hafs == null) continue;
      const key = `${surah}:${aya}`;
      if (!byAyah.has(key)) byAyah.set(key, new Map());
      const text = unescapeXml(hafs);
      byAyah.get(key).set(idx, { hafs: text, waw: attr(a, "data-waw-alatf") === "true", mark: isMark(text) });
    }
    if (page % 100 === 0) process.stdout.write(`  … ${page}/${lastPage} pages\n`);
  }
  return bytes;
}

/** The print's words for one ayah, or null if the indices are not 1..n contiguous. */
function wordsOf(key) {
  const m = byAyah.get(key);
  if (!m) return null;
  const idxs = [...m.keys()].sort((a, b) => a - b);
  for (let i = 0; i < idxs.length; i += 1) if (idxs[i] !== i + 1) return null;
  return idxs.map((i) => m.get(i));
}

/** The surah table, for names the report can put in a heading. */
function surahs() {
  const xml = readFileSync(META, "utf8");
  const rows = [];
  for (const m of xml.matchAll(/<sura ([^>]*)\/>/g)) {
    rows.push({
      n: Number(attr(m[1], "index")),
      name: attr(m[1], "name"),
      tname: attr(m[1], "tname"),
      ename: attr(m[1], "ename"),
      ayas: Number(attr(m[1], "ayas")),
    });
  }
  return rows.sort((a, b) => a.n - b.n);
}

// ----------------------------------------------------------------- assembly --

console.log(`\n  probe:encodings — ${pin.candidate.repo} @ ${pin.candidate.commit.slice(0, 12)}`);
console.log("  putting the print, the ligature corpus, the QAC index and the tajweed offsets on one ruler\n");

const bytes = await readPages();
const tajweedRaw = readFileSync(TAJWEED, "utf8");
const tajweed = JSON.parse(tajweedRaw);
const tajweedSha = createHash("sha256").update(tajweedRaw).digest("hex").slice(0, 16);
const alignment = openAlignment();
const skeletons = qacSkeletons();

/** Rule names, interned: 60k annotations × a string each is most of the payload. */
const rules = [];
const ruleIndex = new Map();
const ruleOf = (name) => {
  let i = ruleIndex.get(name);
  if (i === undefined) {
    ruleIndex.set(name, (i = rules.length));
    rules.push(name);
  }
  return i;
};

const annotationsBy = new Map();
for (const rec of tajweed) annotationsBy.set(`${rec.surah}:${rec.ayah}`, rec.annotations);

const ayahs = {};
let printWords = 0;
let annotations = 0;
let markDisagreements = 0;
let mapped = 0;

for (const key of byAyah.keys()) {
  const words = wordsOf(key);
  if (!words) continue;
  printWords += words.length;

  // The alignment's shards index words page-globally; the ligature corpus
  // indexes them per ayah. `from` is the bridge, and it is the only place the
  // two numbering schemes meet — get it wrong and every QAC column is shifted.
  const shard = alignment.words.get(key);
  const map = alignment.mapOf(key);
  const lexical = shard ? lexicalIndices(shard).map((g) => g - shard.from + 1) : null;

  // The shard's own mark set and this script's WAQF test are two independent
  // answers to "is this word ink the text does not carry". They agree today;
  // a disagreement would mean one of them has gone stale, so it is counted
  // rather than assumed.
  if (shard) {
    const ours = words.map((w, i) => i + 1).filter((i) => words[i - 1].mark);
    const theirs = lexicalIndices(shard).map((g) => g - shard.from + 1);
    const theirMarks = words.map((_, i) => i + 1).filter((i) => !theirs.includes(i));
    if (ours.join() !== theirMarks.join()) markDisagreements += 1;
  }

  const ann = annotationsBy.get(key) ?? [];
  annotations += ann.length;

  const entry = {
    w: words.map((x) => x.hafs),
    m: words.map((x) => (x.mark ? "1" : "0")).join(""),
    v: words.map((x) => (x.waw ? "1" : "0")).join(""),
    a: ann.map((x) => [ruleOf(x.rule), x.start, x.end]),
    p: shard?.page ?? null,
  };
  if (map && lexical) {
    mapped += 1;
    entry.q = map.map((r) => r.qac);
    const spans = {};
    map.forEach((r, i) => {
      if (r.qacSpan > 1) spans[lexical[i]] = r.qacSpan;
    });
    if (Object.keys(spans).length) entry.s = spans;
    entry.k = skeletons.get(key) ?? [];
  } else if (EXCEPTIONS[key]) {
    entry.x = EXCEPTIONS[key];
  }
  ayahs[key] = entry;
}

// ------------------------------------------------- the same numbers, in Node --

/**
 * The headline, computed here with every correction on.
 *
 * Not decoration: the report's aggregates are recomputed in the browser, and
 * two implementations of the same arithmetic is exactly what this repo's
 * anti-duplication rule exists to prevent — so this run and that one call the
 * *same* `foldAyah`, and a terminal line that disagrees with the page would
 * mean the inlining broke.
 */
const basmala = wordsOf("1:1");
const on = new Set(ALL_CORRECTIONS);
const touchCount = { one: 0, "two-adjacent": 0, wider: 0, "past-end": 0 };
const drift = new Map();
let oracleN = 0;
let oracleHit = 0;
let oracleSens = 0;
let residualAyahs = 0;

for (const [key, entry] of Object.entries(ayahs)) {
  const [surah, ayah] = key.split(":").map(Number);
  const words = entry.w.map((hafs, i) => ({ hafs, waw: entry.v[i] === "1", mark: entry.m[i] === "1" }));
  const { cps, hosts } = foldAyah({ surah, ayah, words, basmala, on });
  let missed = false;
  for (const [r, start, end] of entry.a) {
    touchCount[touchClass(hosts, start, end, cps.length)] += 1;
    const o = oracleOf(cps, { rule: rules[r], start, end });
    if (!o) continue;
    oracleN += 1;
    // Weight each check by the chance it could have failed — see `oracleDensity`.
    oracleSens += 1 - oracleDensity(cps, rules[r]);
    if (o.hit) oracleHit += 1;
    else {
      drift.set(o.delta, (drift.get(o.delta) ?? 0) + 1);
      missed = true;
    }
  }
  if (missed) residualAyahs += 1;
}

// ---------------------------------------------------------------- the report --

const payload = {
  meta: {
    generated: new Date().toISOString().slice(0, 19).replace("T", " ") + "Z",
    pin: { repo: pin.candidate.repo, commit: pin.candidate.commit },
    tajweedFile: "tajweed.hafs.uthmani-pause-sajdah.json",
    tajweedSha,
    alignmentMethod: "word-alignment.pin.json — monotone block alignment on a folded consonant skeleton",
    ayahs: Object.keys(ayahs).length,
    words: printWords,
    annotations,
    megabytes: (bytes / 1024 / 1024).toFixed(0),
  },
  rules,
  surahs: surahs(),
  exceptions: EXCEPTIONS,
  pages: Object.fromEntries(Object.entries(ayahs).map(([k, e]) => [k, e.p])),
  ayahs,
};
for (const e of Object.values(ayahs)) delete e.p;

/** JSON that is safe to sit inside a `<script>` element, and only that. */
const embed = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

const read = (p) => readFileSync(join(HERE, "lib", p), "utf8");
// The fold, verbatim but for its `export` keywords. This is the point of the
// whole arrangement: the browser runs the ETL's bytes, so a toggle in the page
// cannot drift from the probe it is meant to explain.
const foldSource = read("tajweed-fold.mjs").replace(/^export /gm, "");
const clientSource = read("encoding-inspector.client.mjs");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth — encoding inspector — ${payload.meta.generated}</title>
<style>
${read("encoding-inspector.css")}
</style>
</head>
<body>
<div id="app"></div>
<script>
const HIFTH_DATA = ${embed(payload)};
${foldSource}
${clientSource}
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);

// ------------------------------------------------------------------ summary --

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(2)}%` : "—");
console.log(`\n  ${payload.meta.ayahs}/6236 ayahs · ${printWords} print words · ${annotations} annotations`);
console.log(`  ${mapped} ayahs carry a print↔QAC map; ${Object.keys(EXCEPTIONS).length} named exceptions`);
console.log(`  mark disagreements between the shards and WAQF: ${markDisagreements}`);
console.log(`\n── the oracle, with all ${ALL_CORRECTIONS.length} corrections on`);
console.log(`  ${oracleHit}/${oracleN} = ${pct(oracleHit, oracleN)} land on the expected letter`);
console.log(`  ${oracleN}/${annotations} = ${pct(oracleN, annotations)} of annotations checked`);
console.log(`  effective (sensitivity-weighted) coverage: ${pct(oracleSens, annotations)}`);
console.log("\n── paintability");
for (const [k, n] of Object.entries(touchCount)) {
  console.log(`  ${k.padEnd(14)} ${String(n).padStart(6)}  ${pct(n, annotations)}`);
}
console.log(`\n── the residual: ${residualAyahs} ayahs, ${oracleN - oracleHit} misses`);
for (const [d, n] of [...drift].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))) {
  console.log(`   ${(d === null ? "∅" : String(d)).padStart(3)}  ${String(n).padStart(4)}  ${pct(n, oracleN - oracleHit)}`);
}
console.log(`\n  wrote ${out}  (${(html.length / 1024 / 1024).toFixed(1)} MB, self-contained, gitignored)`);
console.log("  open it with:  open " + out + "\n");

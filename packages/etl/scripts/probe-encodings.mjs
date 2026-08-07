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
 * ## `--marks`, and why it is opt-in
 *
 * The level below a word. With the flag, every page is also read through
 * `lib/diacritics.mjs` and joined by `lib/mark-join.mjs`, so each tajweed
 * annotation can be asked a question the four encodings alone cannot answer:
 * **does the codepoint this rule opens on have a drawn path, and which one.**
 * That is the offline half of `sub-word-marks.md` §⑧ ①, and the boxes it finds
 * are what the outline draws inside its word rectangles.
 *
 * It is a flag rather than the default for one reason: it puts 326,515 more
 * rectangles in the payload, which roughly doubles a report that is already
 * megabytes. The default run is the one a maintainer opens to read four
 * encodings; `--marks` is the one they open to look at ink they are not allowed
 * to draw.
 *
 * Usage:
 *   node packages/etl/scripts/probe-encodings.mjs                 # from the cache
 *   node packages/etl/scripts/probe-encodings.mjs --fetch         # fill it first
 *   node packages/etl/scripts/probe-encodings.mjs --pages 40      # a fast subset
 *   node packages/etl/scripts/probe-encodings.mjs --marks         # + the mark level
 *   node packages/etl/scripts/probe-encodings.mjs --out /tmp/x.html
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { DIACRITICS } from "@hifth/core";
import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { applierFromPin, readDiacritics } from "./lib/diacritics.mjs";
import { DRAWN_NAME, markPaths } from "./lib/mark-join.mjs";
import { WAQF } from "./lib/mushaf-frame.mjs";
import { EXCEPTIONS, lexicalIndices, openAlignment, qacSkeletons } from "./lib/segmentation.mjs";
import {
  ALL_CORRECTIONS,
  ORACLE,
  foldAyah,
  oracleDensity,
  oracleOf,
  respellerFor,
  touchClass,
} from "./lib/tajweed-fold.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const TAJWEED = join(DATA, "tajweed", "tajweed.hafs.uthmani-pause-sajdah.json");
const META = join(DATA, "meta", "quran-data.xml");
const DEFAULT_OUT = join(HERE, "..", "out", "encoding-inspector.html");
// The shipped word geometry, read for the outline (§6.4). These are *committed*
// assets under `gate:words`, not the gitignored cache — which is the whole
// reason the outline is affordable and the glyphs are not.
const ASSETS = join(HERE, "..", "..", "..", "apps", "web", "public", "assets");
const WORD_SHARDS = join(ASSETS, "words", "hafs-kfqc");
const MANIFEST = join(ASSETS, "manifest.json");
// The per-page fit from their frame to ours, four numbers a page, committed.
// `--marks` needs it and nothing else here does; see `lib/diacritics.mjs` on
// why a caller reconstitutes the transform rather than re-fitting one.
const WORD_PIN = join(DATA, "pages", "word-boxes.pin.json");

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const fetchMissing = process.argv.includes("--fetch");
const wantMarks = process.argv.includes("--marks");
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

/**
 * `--marks` only: "surah:ayah" → Map(print index → the word's resolved marks).
 *
 * Each value is {@link markPaths}'s answer — `[{ at, len, token, name, mark }]`
 * with `at` a **codepoint** index into that word's own `data-hafs` — or `null`
 * for a word that does not join. The null is kept rather than dropped, because
 * "this word has no marks" and "this word could not be resolved" are different
 * findings and the second must not be able to hide inside the first.
 */
const marksByAyah = new Map();
let markRows = null;

async function readPages() {
  let bytes = 0;
  if (wantMarks) {
    markRows = new Map(JSON.parse(readFileSync(WORD_PIN, "utf8")).pages.map((p) => [p.page, p]));
  }
  for (let page = 1; page <= lastPage; page += 1) {
    const { body } = await candidatePage(page, { offline: !fetchMissing });
    bytes += body.length;
    if (wantMarks && markRows.has(page)) {
      for (const w of readDiacritics(body.toString("utf8"), applierFromPin(markRows.get(page)))) {
        const key = `${w.surah}:${w.aya}`;
        if (!marksByAyah.has(key)) marksByAyah.set(key, new Map());
        marksByAyah.get(key).set(w.idx, markPaths(w));
      }
    }
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

/**
 * The word boxes, from the committed shards — the outline's only input.
 *
 * Read separately from everything else above, and the separation is the point.
 * The rest of this script reconciles four *encodings*; this reads one
 * **geometry**, and it reads it from `apps/web/public/assets/words/**` rather
 * than from the corpus, because those shards are committed, gated by
 * `gate:words` and re-derivable offline. The tool draws where a word sits; it
 * still does not draw the word. See the design doc §6.4 — the blindness that
 * ended was about *position*, and the one about ink did not move.
 *
 * Returns `null` if the assets are not where they should be. The report is
 * still worth generating without an outline, so this degrades rather than
 * throws, and the client says the section is unavailable instead of drawing
 * an empty frame that looks like a page with no words on it.
 */
function readBoxes(keys) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
  const want = new Set(keys);
  const boxes = {};
  const marks = {};
  const page = {};
  // One pass over the shards of the pages this run actually covers. `lastPage`
  // is honoured so `--pages 40` stays a fast subset here too.
  for (let p = 1; p <= lastPage; p += 1) {
    let shard;
    try {
      shard = JSON.parse(readFileSync(join(WORD_SHARDS, `${p}.json`), "utf8"));
    } catch {
      continue;
    }
    for (const [key, w] of Object.entries(shard.words ?? {})) {
      if (!want.has(key)) continue;
      // `from` is 1 for every shard in the shipped corpus — an ayah's boxes are
      // never split across two of them. Asserted rather than assumed, because
      // the outline's word numbering is `boxes[i - 1]` and a non-1 `from` would
      // silently shift every label by the offset.
      if (w.from !== 1) continue;
      boxes[key] = w.boxes;
      if (w.marks?.length) marks[key] = w.marks;
      page[key] = p;
    }
  }
  const [, , dw, dh] = String(manifest.viewBox).split(" ").map(Number);
  const overrides = {};
  for (const [p, vb] of Object.entries(manifest.viewBoxOverrides ?? {})) {
    const [, , w, h] = String(vb).split(" ").map(Number);
    overrides[p] = [w, h];
  }
  return { boxes, marks, page, frame: { d: [dw, dh], o: overrides } };
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
  // `d` — the mark level, print index → `[at, len, id, x, y, w, h]` rows, or
  // `null` for a word ④ could not join. A word that simply carries no marks is
  // omitted rather than stored as `[]`: absent and empty mean the same thing to
  // the outline, and 91,451 empty arrays are not free. `null` is stored,
  // because "no answer" and "the answer is none" are not the same claim.
  if (wantMarks) {
    const byIdx = marksByAyah.get(key);
    if (byIdx) {
      const d = {};
      for (const [i, resolved] of byIdx) {
        if (resolved === null) d[i] = null;
        else if (resolved.length) d[i] = resolved.map((m) => [m.at, m.len, ...m.mark]);
      }
      if (Object.keys(d).length) entry.d = d;
    }
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

// ------------------------------------------------------- `--marks`: the level --

/**
 * The offline half of `sub-word-marks.md` §⑧ ①, measured per annotation.
 *
 * ①–⑤ of `probe-diacritics.mjs` end at a word: every mark is named, joined to
 * the codepoint the print drew it for, and inside its own word's box. What is
 * still unmeasured is whether a *tajweed rule* can reach one — the rule speaks
 * in Tanzil offsets, the mark answers to a `data-hafs` codepoint index, and the
 * fold that connects them **respells** some words. So each annotation is walked
 * all the way down and its outcome recorded, including every way down that does
 * not arrive:
 *
 *   `oracle-miss`  the offset does not land on the letter its rule names, so
 *                  there is no position to resolve; already counted above.
 *   `basmala`      the letter is in the prefixed basmala — ink from 1:1, with
 *                  no print index in this ayah.
 *   `no-host`      the position falls in a space between words.
 *   `no-word`      the corpus has no word at that print index (page not read).
 *   `respelt`      the fold rewrote this word, so an offset into the string is
 *                  not an offset into `data-hafs`. Counted, never guessed.
 *   `unjoined`     `markPaths` refused the word (④'s residual).
 *   `letter`       the codepoint is a base letter and the print drew no named
 *                  path for it. **This is an answer, not a failure** — qalqalah
 *                  opens on ق, and the box to light is the letter's, which the
 *                  word shards do not carry at letter granularity.
 *   `drawn`        the codepoint has a named path, and this is its rectangle.
 *
 * The predicted name is `DRAWN_NAME[cp(letter)]` and the observed one is the
 * path's own — for a mark these agree by construction, because `pairMarks`
 * pairs *by* name, so the comparison is not evidence and is not reported as
 * such. What the per-rule tally is actually for is the shape of the answer:
 * which rules land on a mark, which land on a letter, and which cannot be
 * reached at all. `composite` is the one real disagreement — a vowel that
 * carries an iqlab meem is drawn as one glyph, so a rule naming the bare vowel
 * gets `fatha iqlab` where the bare-codepoint lookup says `fatha`.
 */
const markOutcome = {
  "oracle-miss": 0,
  basmala: 0,
  "no-host": 0,
  "no-word": 0,
  respelt: 0,
  unjoined: 0,
  letter: 0,
  drawn: 0,
};
const markByRule = new Map();
const markNames = new Map();
let markComposite = 0;
const respell = respellerFor(on);
const cpOf = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
const ORACLE_SETS = new Map(Object.entries(ORACLE).map(([r, e]) => [r, { set: new Set(e.letters), near: e.near ?? 0 }]));

/** Where in `cps` the rule's letter actually sits, for a hit. `near` is re-walked, not guessed. */
function letterAt(cps, rule, start) {
  const spec = ORACLE_SETS.get(rule);
  if (!spec) return -1;
  for (let d = 0; d <= spec.near; d += 1) if (spec.set.has(cps[start + d])) return start + d;
  return -1;
}

function markLevel(key, entry, cps, hosts) {
  const byIdx = marksByAyah.get(key);
  const tally = (rule, k) => {
    if (!markByRule.has(rule)) markByRule.set(rule, { n: 0, drawn: 0, letter: 0, unreached: 0 });
    const t = markByRule.get(rule);
    t.n += 1;
    if (k === "drawn") t.drawn += 1;
    else if (k === "letter") t.letter += 1;
    else t.unreached += 1;
    markOutcome[k] += 1;
  };

  for (const [r, start, end] of entry.a) {
    const rule = rules[r];
    const o = oracleOf(cps, { rule, start, end });
    if (!o || !o.hit) {
      tally(rule, "oracle-miss");
      continue;
    }
    const pos = letterAt(cps, rule, start);
    const host = hosts.find((h) => pos >= h.from && pos < h.to);
    if (pos < 0 || !host) {
      tally(rule, "no-host");
      continue;
    }
    if (host.print === null) {
      tally(rule, "basmala");
      continue;
    }
    const word = byIdx?.get(host.print);
    const hafs = entry.w[host.print - 1];
    if (word === undefined || hafs === undefined) {
      tally(rule, "no-word");
      continue;
    }
    if (respell(hafs) !== hafs) {
      tally(rule, "respelt");
      continue;
    }
    if (word === null) {
      tally(rule, "unjoined");
      continue;
    }
    const at = pos - host.from;
    const hit = word.find((m) => at >= m.at && at < m.at + m.len);
    if (!hit) {
      tally(rule, "letter");
      continue;
    }
    tally(rule, "drawn");
    if (DRAWN_NAME[cpOf(cps[pos])] !== hit.name) markComposite += 1;
    const seen = markNames.get(rule) ?? new Map();
    seen.set(hit.name, (seen.get(hit.name) ?? 0) + 1);
    markNames.set(rule, seen);
  }
}

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
  if (wantMarks) markLevel(key, entry, cps, hosts);
}

// ---------------------------------------------------------------- the report --

/**
 * The outline's geometry, and the one integrity claim it rests on.
 *
 * A box list and a word list are two independent descriptions of the same
 * ayah — the shards were built by `build-words.mjs` off the corpus's `<g>`
 * elements, the word list here off its `data-hafs` attributes. If they
 * disagree on *how many*, the outline would draw word 7's box under word 8's
 * label and look perfectly fine doing it. So the count is checked per ayah,
 * the mismatches are counted here and named in the report, and the client
 * refuses to number a mismatched ayah's boxes rather than guessing an
 * alignment. Zero is the expected answer; the check exists because a silent
 * off-by-one is exactly the defect this repo has already shipped once
 * (PLAN 14, and the 47.8% edge corpus before it).
 */
const geometry = readBoxes(Object.keys(ayahs));
let boxedAyahs = 0;
let countMismatches = 0;
const mismatched = [];
if (geometry) {
  for (const [key, entry] of Object.entries(ayahs)) {
    const b = geometry.boxes[key];
    if (!b) continue;
    boxedAyahs += 1;
    if (b.length !== entry.w.length) {
      countMismatches += 1;
      if (mismatched.length < 8) mismatched.push(`${key} (${b.length} boxes vs ${entry.w.length} words)`);
    }
  }
}

const payload = {
  geometry,
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
  // The mark vocabulary, so a row's `id` can be named in the browser. Null
  // without `--marks`, and the client keys the whole mark level off that.
  diacritics: wantMarks ? DIACRITICS : null,
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

// Both halves are *text* to this script, never imported, so nothing here would
// otherwise notice a syntax error in them — the report would generate, weigh
// its usual megabytes, and open to a blank page with the whole script dead in
// the console. That happened once while the ① outline was being written, and
// costs nothing to make impossible: compile the concatenation the browser will
// actually parse, and fail here instead of there.
new vm.Script(`${foldSource}\n${clientSource}`, { filename: "encoding-inspector (fold + client)" });

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
if (!geometry) {
  console.log("  word boxes: none — assets/words/hafs-kfqc/ not readable, the outline is off");
} else {
  console.log(`  word boxes: ${boxedAyahs} ayahs outlined · ${countMismatches} box/word count mismatches`);
  for (const m of mismatched) console.log(`    ${m}`);
}
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
if (wantMarks) {
  const total = Object.values(markOutcome).reduce((a, b) => a + b, 0);
  console.log(`\n── the mark level — ${total} annotations walked from an offset to a drawn path`);
  for (const [k, n] of Object.entries(markOutcome)) {
    console.log(`  ${k.padEnd(12)} ${String(n).padStart(6)}  ${pct(n, total)}`);
  }
  console.log(
    `  of the ${markOutcome.drawn} that reach a path, ${markComposite} are drawn as a composite` +
      " — a vowel and its iqlab meem in one glyph, which the bare codepoint does not predict",
  );
  console.log("\n── per rule: where the rule's own letter is drawn");
  const rows = [...markByRule].sort((a, b) => b[1].n - a[1].n);
  for (const [rule, t] of rows) {
    const names = [...(markNames.get(rule) ?? new Map())].sort((a, b) => b[1] - a[1]);
    const top = names
      .slice(0, 3)
      .map(([n, c]) => `${n} ×${c}`)
      .join(", ");
    console.log(
      `  ${rule.padEnd(16)} ${String(t.n).padStart(5)}  drawn ${pct(t.drawn, t.n).padStart(7)}` +
        `  letter ${pct(t.letter, t.n).padStart(7)}  unreached ${pct(t.unreached, t.n).padStart(7)}` +
        (top ? `  · ${top}${names.length > 3 ? ", …" : ""}` : ""),
    );
  }
}
console.log(`\n  wrote ${out}  (${(html.length / 1024 / 1024).toFixed(1)} MB, self-contained, gitignored)`);
console.log("  open it with:  open " + out + "\n");

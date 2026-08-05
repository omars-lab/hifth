#!/usr/bin/env node
/**
 * Root shard ETL (PLAN §Loop 5 / spec §9) — the ⬡ lens's data.
 *
 * Inputs (vendored + pinned, see the PROVENANCE.md next to each):
 *   - data/roots/quranic-corpus-morphology-0.4.txt — the Quranic Arabic
 *     Corpus morphology, one line per morphological SEGMENT, addressed
 *     `(surah:ayah:word:segment)` with `ROOT:` / `LEM:` in Buckwalter.
 *   - data/pages/ayah-pages.json — absolute ayah → mushaf page for this
 *     edition (QCF V2/1421H print — the quran-svg corpus's own pagination).
 *
 * Output, two directions because the lens needs both (a shard per file so the
 * app fetches only what a selection touches):
 *   - roots/<edition>/ayah/<surah>.json — ayah → the roots on it, in word
 *     order, each carrying `b`, the root bucket holding its occurrences.
 *   - roots/<edition>/root/<bucket>.json — root → every ayah carrying it, as
 *     `[abs, page, words, ...lemmaIds]` tuples. This doubles as the page
 *     table: the selection is always in its own roots' lists, so `roots.ts`
 *     computes page distance without a resolver or a second lookup.
 *
 * Granularity was the AYAH, and this file used to say that word anchors were
 * waiting on a stable word→polygon mapping. They were; it landed. Each root on
 * an ayah now carries `w`, the **print word indices** it sits at — the same
 * `data-word-index-in-ayah` numbers the word boxes carry, so a selected run of
 * words can ask for its own roots and get an answer, rather than the whole
 * ayah's. The corpus is word-addressed in its own numbering, so `w` is
 * converted through `word-alignment.pin.json`; the four ayahs that pin excepts
 * get no `w` and the lens falls back to the ayah, which is what it did for
 * every ayah before this.
 *
 * `n` stays beside `w` rather than being implied by it. They count different
 * things: `n` counts rooted *segments* while `w` lists *places on the page*,
 * and where the print writes one corpus word as two pieces `w` has two entries
 * for one occurrence. The inequality runs one way only — measured over the
 * 44,401 root-ayah pairs that carry a `w`, `w.length === n` on 39,136 and
 * `w.length > n` on 5,265, never less. That is not luck: no root in the corpus
 * sits on two rooted segments of one word (0 of 44,431 pairs), so `n` is also
 * the count of distinct corpus words the root occupies, and the print can only
 * ever split those further. A reader who assumed `w.length === n` would be
 * wrong on 11.9% of entries, always by undercounting.
 *
 * The reverse index's tuples keep ayah granularity: a root's occurrence list
 * answers "where else in the mus'haf", and that question is answered by a page
 * and an ayah, not by a word inside one.
 *
 * Bucketing: roots are packed into BUCKETS bins by descending occurrence
 * count, each root landing in the currently-smallest bin (greedy LPT). That
 * is deterministic, keeps every bucket far under budget even though root
 * frequency spans three orders of magnitude (اله on 1,879 ayahs vs 416 roots
 * on exactly one), and keeps a typical selection — median 6 distinct roots —
 * to a handful of small fetches instead of one fat index.
 *
 * Gates enforced in-script: 100% valid keys (toAbsoluteAyah throws on
 * anything out of range), all 6,236 ayahs seen in the source, every shard
 * <50KB gzipped, deterministic byte-identical output (total orders on every
 * sort; CI asserts via git diff).
 *
 * ATTRIBUTION — required by the corpus's terms of use, which permit this use
 * "in any website or application, provided its source (the Quranic Arabic
 * Corpus) is clearly indicated, and a link is made to http://corpus.quran.com".
 * The notice lives in SOURCES.md, in data/roots/PROVENANCE.md, and on the
 * RootLens surface itself.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toAbsoluteAyah, TOTAL_AYAHS } from "@hifth/core";
import { openAlignment } from "./lib/segmentation.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DATA = join(HERE, "..", "data");
const ASSETS = join(REPO, "apps", "web", "public", "assets");

const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const EDITION = manifest.edition;

/** How many root buckets to pack the reverse index into. */
const BUCKETS = 32;
/** PLAN budget: every shard <50KB gzipped. */
const GZ_LIMIT = 50 * 1024;

/* ------------------------------------------------------------------ */
/* Buckwalter → Arabic (corpus.quran.com/java/buckwalter.jsp, verbatim).*/
/* ------------------------------------------------------------------ */

/** The corpus's own transliteration table — roots and lemmas arrive in it. */
const BUCKWALTER = {
  "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  A: "ا", b: "ب", p: "ة", t: "ت", v: "ث",
  j: "ج", H: "ح", x: "خ", d: "د", "*": "ذ",
  r: "ر", z: "ز", s: "س", $: "ش", S: "ص",
  D: "ض", T: "ط", Z: "ظ", E: "ع", g: "غ",
  _: "ـ", f: "ف", q: "ق", k: "ك", l: "ل",
  m: "م", n: "ن", h: "ه", w: "و", Y: "ى",
  y: "ي", F: "ً", N: "ٌ", K: "ٍ", a: "َ",
  u: "ُ", i: "ِ", "~": "ّ", o: "ْ", "^": "ٓ",
  "#": "ٔ", "`": "ٰ", "{": "ٱ", ":": "ۜ", "@": "۟",
  '"': "۠", "[": "ۢ", ";": "ۣ", ",": "ۥ", ".": "ۦ",
  "!": "ۨ", "-": "۪", "+": "۫", "%": "۬", "]": "ۭ",
};

function toArabic(bw) {
  let out = "";
  for (const ch of bw) {
    const mapped = BUCKWALTER[ch];
    if (mapped === undefined) {
      throw new Error(`unmapped Buckwalter character ${JSON.stringify(ch)} in ${bw}`);
    }
    out += mapped;
  }
  return out;
}

/** Roots render letter-spaced — the form the rail and `Edge.root` already use. */
const spaced = (letters) => [...letters].join(" ");

/**
 * 15 lemmas carry a trailing homograph index (`EaSaA2` — the corpus's way of
 * separating two senses that are spelled identically). Roots never do. The
 * lens groups by *spelling*, and to a hafiz two identically-spelled lemmas are
 * one word, so the index is dropped and the senses merge.
 */
const stripHomograph = (lemma) => lemma.replace(/\d+$/, "");

/* ------------------------------------------------------------------ */
/* Inputs.                                                             */
/* ------------------------------------------------------------------ */

/** abs ayah (1..6236) → page (1..604). Index = abs − 1. */
const AYAH_PAGES = JSON.parse(
  readFileSync(join(DATA, "pages", "ayah-pages.json"), "utf8"),
);
if (AYAH_PAGES.length !== TOTAL_AYAHS) {
  throw new Error(
    `ayah-pages.json has ${AYAH_PAGES.length} entries, expected ${TOTAL_AYAHS}`,
  );
}
const pageOf = (abs) => AYAH_PAGES[abs - 1];

const MORPHOLOGY = readFileSync(
  join(DATA, "roots", "quranic-corpus-morphology-0.4.txt"),
  "utf8",
);

/** The print↔corpus word map — how a corpus word number becomes a `w`. */
const align = openAlignment();

/* ------------------------------------------------------------------ */
/* Pass 1 — segments → one root (+ lemma) per WORD.                    */
/* ------------------------------------------------------------------ */

// Roots are tagged on STEM segments; prefixes and suffixes carry none, so most
// words yield exactly one. Not all: 20:94's يَبْنَؤُمَّ is one orthographic word
// over two stems (ب ن ي + أ م م) and contributes both roots. Counting per
// segment rather than per word is therefore the faithful reading.
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)\t/;
const FEATURE = (name) => new RegExp(`(?:^|\\|)${name}:([^|\\t\\r\\n]+)`);
const ROOT_FEATURE = FEATURE("ROOT");
const LEM_FEATURE = FEATURE("LEM");

/** root → { lemmas: Map<lemma, words>, words, ayahs: Map<abs, {n, lemmas:Set}> } */
const roots = new Map();
/** abs ayah → `{root, word}` in word order (duplicates kept; the lens dedupes). */
const ayahRoots = new Map();

const ayahsSeen = new Set();
const seenWords = new Set();
let segments = 0;
let words = 0;
let rootedSegments = 0;

for (const line of MORPHOLOGY.split("\n")) {
  if (line.length === 0 || line.startsWith("#")) continue;
  const at = LOCATION.exec(line);
  if (!at) continue;
  segments += 1;
  const surah = Number(at[1]);
  const ayah = Number(at[2]);
  const word = Number(at[3]);
  const abs = toAbsoluteAyah(surah, ayah); // throws — the key-validity gate
  ayahsSeen.add(abs);

  const wordId = `${abs}:${word}`;
  if (!seenWords.has(wordId)) {
    seenWords.add(wordId);
    words += 1;
  }

  const features = line.split("\t")[3] ?? "";
  const rootMatch = ROOT_FEATURE.exec(features);
  if (!rootMatch) continue;
  rootedSegments += 1;

  const root = spaced(toArabic(rootMatch[1]));
  const lemmaMatch = LEM_FEATURE.exec(features);
  const lemma = lemmaMatch ? toArabic(stripHomograph(lemmaMatch[1])) : null;

  let entry = roots.get(root);
  if (!entry) {
    entry = { lemmas: new Map(), words: 0, ayahs: new Map() };
    roots.set(root, entry);
  }
  entry.words += 1;
  if (lemma) entry.lemmas.set(lemma, (entry.lemmas.get(lemma) ?? 0) + 1);

  let occurrence = entry.ayahs.get(abs);
  if (!occurrence) {
    occurrence = { n: 0, lemmas: new Set() };
    entry.ayahs.set(abs, occurrence);
  }
  occurrence.n += 1;
  if (lemma) occurrence.lemmas.add(lemma);

  const list = ayahRoots.get(abs);
  if (list) list.push({ root, word });
  else ayahRoots.set(abs, [{ root, word }]);
}

if (ayahsSeen.size !== TOTAL_AYAHS) {
  throw new Error(
    `morphology covers ${ayahsSeen.size} ayahs, expected ${TOTAL_AYAHS} — source is incomplete`,
  );
}

/* ------------------------------------------------------------------ */
/* Pass 2 — pack roots into buckets (greedy LPT, deterministic).       */
/* ------------------------------------------------------------------ */

// Biggest root first into the currently-smallest bucket. Ties broken by root
// string and by bucket index so two runs always agree.
const ordered = [...roots.keys()].sort(
  (a, b) => roots.get(b).ayahs.size - roots.get(a).ayahs.size || cmp(a, b),
);
const load = new Array(BUCKETS).fill(0);
/** root → bucket index. */
const bucketOf = new Map();
for (const root of ordered) {
  let pick = 0;
  for (let i = 1; i < BUCKETS; i++) if (load[i] < load[pick]) pick = i;
  bucketOf.set(root, pick);
  load[pick] += roots.get(root).ayahs.size;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Write — ayah shards, then root buckets.                             */
/* ------------------------------------------------------------------ */

const OUT_DIR = join(ASSETS, "roots", EDITION);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, "ayah"), { recursive: true });
mkdirSync(join(OUT_DIR, "root"), { recursive: true });

// The corpus's third term of use: the copyright notice "shall be reproduced
// appropriately in all works derived from or containing substantial portion of
// this file". These shards are exactly that — every root↔ayah pair in the
// corpus — so the notice ships *with the assets*, not only in the repo's
// SOURCES.md, and the app's root lens carries the visible credit + link.
// Copied from the source file's own header so it can never drift from it.
// Verbatim, from the file's opening sentinel through the closing one, so the
// notice can never drift from the source it is quoting.
const HEAD = MORPHOLOGY.split("\n").slice(0, 40);
const rule = HEAD.findLastIndex((l) => l.startsWith("#===="));
if (rule < 4) throw new Error("copyright block not found at the head of the morphology file");
writeFileSync(
  join(OUT_DIR, "NOTICE.txt"),
  `Derived from the Quranic Arabic Corpus morphology (version 0.4).\n` +
    `These files contain root and lemma annotation only — no Quran text.\n` +
    `Generated by packages/etl/scripts/build-roots.mjs; see SOURCES.md.\n\n` +
    `${HEAD.slice(0, rule + 1).join("\n")}\n`,
);

/** One entry per line: compact like a data file, diffable like source. */
function byLine(entries) {
  if (entries.length === 0) return "{}\n";
  return `{\n${entries
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n")}\n}\n`;
}

let maxGz = { file: "", bytes: 0 };
function write(relative, json) {
  const gz = gzipSync(json, { level: 9 }).length;
  if (gz >= GZ_LIMIT) {
    throw new Error(`${relative} is ${gz}B gzipped — over the ${GZ_LIMIT}B budget`);
  }
  if (gz > maxGz.bytes) maxGz = { file: relative, bytes: gz };
  writeFileSync(join(OUT_DIR, relative), json);
}

/**
 * QAC word number → the print indices it is written at, for one ayah. Built
 * once per ayah rather than per root: `Alignment.printWordsOf` walks the whole
 * ayah on every call, and a fat ayah has more roots than words.
 *
 * Null where the map has nothing to say — the four excepted ayahs, and any
 * ayah this print does not carry.
 */
function printByQac(key) {
  const map = align.mapOf(key);
  if (!map) return null;
  const out = new Map();
  for (const { print, qac, qacSpan } of map) {
    for (let q = qac; q < qac + qacSpan; q += 1) {
      const at = out.get(q);
      if (at) at.push(print);
      else out.set(q, [print]);
    }
  }
  return out;
}

// --- ayah/<surah>.json: ayah → [{ r, b, n, w? }] in word order, roots deduped.
let coveredAyahs = 0;
let placedRoots = 0;
let unplacedRoots = 0;
for (let surah = 1; surah <= 114; surah++) {
  const shard = [];
  for (let ayah = 1; ; ayah++) {
    let abs;
    try {
      abs = toAbsoluteAyah(surah, ayah);
    } catch {
      break; // past the surah's last ayah
    }
    const list = ayahRoots.get(abs);
    if (!list) continue; // an ayah of pure particles (huruf muqatta'at et al.)
    // root → { n: rooted segments, words: the corpus word numbers it sits at }
    const counts = new Map();
    for (const { root, word } of list) {
      let seen = counts.get(root);
      if (!seen) counts.set(root, (seen = { n: 0, words: new Set() }));
      seen.n += 1;
      seen.words.add(word);
    }
    const print = printByQac(`${surah}:${ayah}`);
    shard.push([
      String(ayah),
      [...counts].map(([r, { n, words }]) => {
        const entry = { r, b: bucketOf.get(r), n };
        // All of a root's words or none of them: a partial `w` would read as
        // the complete list of places the root occurs, and be short.
        const at = [];
        for (const word of words) {
          const indices = print?.get(word);
          if (!indices) {
            unplacedRoots += 1;
            return entry;
          }
          at.push(...indices);
        }
        placedRoots += 1;
        entry.w = [...new Set(at)].sort((a, b) => a - b);
        return entry;
      }),
    ]);
    coveredAyahs += 1;
  }
  write(join("ayah", `${surah}.json`), byLine(shard));
}

// --- root/<bucket>.json: root → { l, w, a }.
const buckets = Array.from({ length: BUCKETS }, () => []);
for (const root of [...roots.keys()].sort(cmp)) {
  const entry = roots.get(root);
  // Lemma table: most-used first (index 0 is the root's dominant form), ties
  // alphabetical. Occurrence tuples index into it.
  const lemmas = [...entry.lemmas]
    .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
    .map(([lemma]) => lemma);
  const lemmaId = new Map(lemmas.map((lemma, i) => [lemma, i]));
  const occurrences = [...entry.ayahs.keys()]
    .sort((a, b) => a - b)
    .map((abs) => {
      const occurrence = entry.ayahs.get(abs);
      const ids = [...occurrence.lemmas].map((l) => lemmaId.get(l)).sort((a, b) => a - b);
      return [abs, pageOf(abs), occurrence.n, ...ids];
    });
  buckets[bucketOf.get(root)].push([root, { l: lemmas, w: entry.words, a: occurrences }]);
}
for (let b = 0; b < BUCKETS; b++) {
  write(join("root", `${b}.json`), byLine(buckets[b]));
}

/* ------------------------------------------------------------------ */
/* Report.                                                             */
/* ------------------------------------------------------------------ */

const pairs = [...roots.values()].reduce((n, e) => n + e.ayahs.size, 0);
const lemmas = new Set([...roots.values()].flatMap((e) => [...e.lemmas.keys()]));
console.log(
  `build-roots — ${segments} segments / ${words} words → ${rootedSegments} rooted segments → ` +
    `${roots.size} roots · ${lemmas.size} lemmas · ${pairs} root-ayah pairs on ` +
    `${coveredAyahs} ayahs (edition ${EDITION})`,
);
console.log(
  `build-roots — 114 ayah shards + ${BUCKETS} root buckets; largest ${maxGz.file} at ` +
    `${maxGz.bytes}B gz (budget ${GZ_LIMIT}B)`,
);
console.log(
  `build-roots — ${placedRoots} root-ayah pairs carry print word indices, ` +
    `${unplacedRoots} do not (the ayahs the alignment excepts)`,
);

/**
 * ⑦ (what-we-depend-on) — what would adjacency spans cost if they were computed
 * over the PRINT's own words instead of the morphology corpus's?
 *
 * The shipped pipeline finds a span by taking the longest shared run of QAC word
 * skeletons between two ayahs and keeping it only when that run occurs in exactly
 * one place on both sides (build-adjacency.mjs `spansOf`), then converts the QAC
 * word numbers to print indices through the alignment pin. It keeps 2,544.
 *
 * The print splits proclitics the corpus joins, so the same phrase is more tokens
 * in print words and the uniqueness rule ties differently. This probe re-runs the
 * identical rule over print-word skeletons (read from the ligature cache the way
 * build-alignment does) on the identical mutashabih edge set, and reports how many
 * spans survive — the number the option has no cost without.
 *
 * Control: the QAC count it computes on the way past MUST reproduce 2,544, or the
 * edge set is wrong and the print number is not to be trusted. Needs the offline
 * ligature cache under data/pages/.cache/words (same as `pnpm align`).
 *
 *   node scripts/probe-print-spans.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toAbsoluteAyah, fromAbsoluteAyah } from "@hifth/core";
import { wordsByAyah, sharedRuns } from "./morphology.mjs";
import { openAlignment, skeleton } from "./lib/segmentation.mjs";
import { candidatePage } from "./lib/candidate-pages.mjs";
import { readTheirs, WAQF } from "./lib/mushaf-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const PAGES = 604;

const DATASET = JSON.parse(
  readFileSync(join(DATA, "mutashabihat", "mutashabiha_data.json"), "utf8"),
);

// Copied verbatim from build-adjacency.mjs — the curated seed adds a handful of
// mutashabih edges the dataset does not, and the count only reproduces with it.
const CURATED = {
  "2:40": [
    { type: "mutashabih", to: "2:47", note: "Same opening — continuation differs", ctx: true },
    { type: "mutashabih", to: "2:122", note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:47", w: "w3" },
  ],
  "2:45": [
    { type: "mutashabih", to: "2:153", note: "2:153 prefixes يا أيها الذين آمنوا" },
  ],
  "2:47": [
    { type: "mutashabih", to: "2:122", twin: true, note: "Identical twins — surrounding ayahs differ" },
    { type: "mutashabih", to: "2:40", note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:122", w: "w3" },
  ],
  "2:48": [
    { type: "mutashabih", to: "2:123", note: "شفاعة ↔ عدل order swapped; verbs differ" },
    { type: "related", to: "82:19", note: "Same theme — no soul avails another" },
  ],
  "2:58": [
    { type: "mutashabih", to: "7:161", note: "قولوا حطة ↔ ادخلوا الباب سجدا order swapped" },
  ],
  "2:60": [
    { type: "mutashabih", to: "7:160", note: "فانفجرت ↔ فانبجست" },
  ],
  "2:122": [
    { type: "mutashabih", to: "2:47", twin: true, note: "Identical twins — surrounding ayahs differ" },
    { type: "mutashabih", to: "2:40", note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:40", w: "w3" },
  ],
  "2:123": [
    { type: "mutashabih", to: "2:48", note: "شفاعة ↔ عدل order swapped; verbs differ" },
  ],
};
const CURATED_TYPE = { mutashabih: "mutashabih", related: "related-meaning", root: "shared-root" };

const members = (a) => (Array.isArray(a) ? a : [a]);
const first = (a) => (Array.isArray(a) ? a[0] : a);
const datasetAbs = (n) => n + 1;
const refToAbs = (ref) => {
  const [s, a] = ref.split(":").map(Number);
  return toAbsoluteAyah(s, a);
};

/* --- Edge set: the same directed mutashabih edges build-adjacency ships. --- */
const edges = new Map();
const edgeKey = (f, t, ty) => `${f}>${t}>${ty}`;
function addEdge(fromAbs, toAbs, type, meta, { curated = false } = {}) {
  if (fromAbs === toAbs) return;
  const k = edgeKey(fromAbs, toAbs, type);
  const prev = edges.get(k);
  if (prev) {
    const ctx = prev.ctx || meta.ctx;
    edges.set(k, curated ? { ...meta, ...(ctx ? { ctx: true } : {}) } : { ...prev, ...(ctx ? { ctx: true } : {}) });
    return;
  }
  edges.set(k, meta);
}
for (const [, entries] of Object.entries(DATASET)) {
  for (const entry of entries) {
    const srcMembers = members(entry.src.ayah).map(datasetAbs);
    const ctx = entry.ctx === 2;
    for (const mut of entry.muts) {
      const toAbs = datasetAbs(first(mut.ayah));
      for (const fromAbs of srcMembers) addEdge(fromAbs, toAbs, "mutashabih", ctx ? { ctx: true } : {});
    }
  }
}
for (const [ref, list] of Object.entries(CURATED)) {
  const fromAbs = refToAbs(ref);
  for (const e of list) {
    addEdge(fromAbs, refToAbs(e.to), CURATED_TYPE[e.type], {}, { curated: true });
  }
}
// Symmetrize: every a→b gains b→a.
for (const [k, meta] of [...edges]) {
  const [f, t, type] = k.split(">");
  const rk = edgeKey(t, f, type);
  if (!edges.has(rk)) {
    const { w: _w, ...rest } = meta;
    edges.set(rk, rest);
  }
}

/* --- The QAC side, exactly as build-adjacency computes it. --- */
const qac = wordsByAyah();
const align = openAlignment();
function printRange(key, firstWord, len) {
  const head = align.printWordsOf(key, firstWord);
  const tail = align.printWordsOf(key, firstWord + len - 1);
  if (!head?.length || !tail?.length) return null;
  return [Math.min(...head), Math.max(...tail)];
}
function qacSpan(srcKey, tgtKey) {
  if (align.exception(srcKey) || align.exception(tgtKey)) return null;
  const { len, runs } = sharedRuns(qac.get(srcKey), qac.get(tgtKey));
  if (len === 0 || runs.length !== 1) return null;
  const from = printRange(srcKey, runs[0].a, len);
  const to = printRange(tgtKey, runs[0].b, len);
  return from && to ? { from, to } : null;
}

/* --- The print side: the ayah's own words as folded skeletons. --- */
const isMark = (text) => text.length > 0 && [...text].every((c) => WAQF.has(c) || c === " ");
const printSkel = new Map();
{
  const perAyah = new Map(); // key -> [[idx, text]]
  for (let page = 1; page <= PAGES; page += 1) {
    const { body } = await candidatePage(page, { offline: true });
    for (const w of readTheirs(body.toString("utf8")).words) {
      if (isMark(w.hafs)) continue;
      const key = `${w.surah}:${w.aya}`;
      if (!perAyah.has(key)) perAyah.set(key, []);
      perAyah.get(key).push([w.idx, w.hafs]);
    }
  }
  for (const [key, arr] of perAyah) {
    arr.sort((a, b) => a[0] - b[0]);
    printSkel.set(key, arr.map(([, text]) => skeleton(text)));
  }
}
// The uniqueness rule over print words: no alignment conversion — a run's
// position already IS a print lexical index, which is the whole point of ⑦.
function printKeepsSpan(srcKey, tgtKey) {
  const a = printSkel.get(srcKey);
  const b = printSkel.get(tgtKey);
  if (!a?.length || !b?.length) return false;
  const { len, runs } = sharedRuns(a, b);
  return len > 0 && runs.length === 1;
}

/* --- Walk the mutashabih edges and tally. --- */
let mutEdges = 0, qacKept = 0, printKept = 0, both = 0, onlyQac = 0, onlyPrint = 0, neither = 0;
let lenLonger = 0, lenSame = 0, lenShorter = 0, printHasNoWords = 0;
for (const [k] of edges) {
  const [f, t, type] = k.split(">");
  if (type !== "mutashabih") continue;
  mutEdges += 1;
  const src = fromAbsoluteAyah(Number(f));
  const tgt = fromAbsoluteAyah(Number(t));
  const srcKey = `${src.surah}:${src.ayah}`;
  const tgtKey = `${tgt.surah}:${tgt.ayah}`;
  const q = qacSpan(srcKey, tgtKey) !== null;
  const p = printKeepsSpan(srcKey, tgtKey);
  if (q) qacKept += 1;
  if (p) printKept += 1;
  if (q && p) both += 1;
  else if (q) onlyQac += 1;
  else if (p) onlyPrint += 1;
  else neither += 1;

  // How run length moves QAC→print, on the pairs QAC kept (the phrase is real).
  if (q) {
    const qlen = sharedRuns(qac.get(srcKey), qac.get(tgtKey)).len;
    const ps = printSkel.get(srcKey), pt = printSkel.get(tgtKey);
    if (!ps?.length || !pt?.length) printHasNoWords += 1;
    else {
      const plen = sharedRuns(ps, pt).len;
      if (plen > qlen) lenLonger += 1;
      else if (plen === qlen) lenSame += 1;
      else lenShorter += 1;
    }
  }
}

console.log(JSON.stringify({
  mutEdges,
  qacKept,          // control — must be 2544
  printKept,        // the answer
  both, onlyQac, onlyPrint, neither,
  onQacKept: { lenLonger, lenSame, lenShorter, printHasNoWords },
}, null, 2));

#!/usr/bin/env node
/**
 * Adjacency shard ETL (PLAN §Loop 4a / spec §6) — the full corpus.
 *
 * Inputs (all vendored + pinned, see the PROVENANCE.md next to each):
 *   - data/mutashabihat/mutashabiha_data.json — Waqar144 mutashabihat edges,
 *     juz-keyed, ayahs addressed by ABSOLUTE number (1..6236).
 *   - data/pages/ayah-pages.json — absolute ayah → mushaf page for this
 *     edition (QCF V2/1421H print — the quran-svg corpus's own pagination).
 *   - the Loop-2 curated seed below (CURATED) — hand-verified clusters from
 *     docs/reference/linker-mock.html; richer metadata (notes/twin/root),
 *     so it wins over the dataset on collision.
 *
 * Pipeline: dataset entries → directed edges at member granularity (an edge
 * attaches to EVERY ayah of a multi-ayah source range, targeting the FIRST
 * ayah of the target range) → merge curated seed → symmetrize (every a→b
 * gains b→a; generated reverses copy note/twin/ctx/root but drop word
 * anchors) → dedupe on (from,to,type) → spec-§6 Edge records with real dir
 * (dPage from the ayah-page table, sameJuz from the juz table) → one shard
 * per surah, all 114 written (empty shards included so the app's loader
 * never 404s).
 *
 * Loop 2's `buildShards` compiler is retired here — this script emits
 * spec-shape shards directly (the adjacency.ts comment foretold it).
 *
 * Gates enforced in-script: 100% valid keys (toAbsoluteAyah/fromAbsoluteAyah
 * throw on anything out of range), every shard <50KB gzipped, deterministic
 * byte-identical output (stable sorts everywhere; CI asserts via git diff).
 * The dataset's own juz filing is cross-checked against the computed juz
 * table — mismatches warn (they are the author's filing choice, not ours;
 * we compute juz from Tanzil boundaries).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatAyahKey,
  toAbsoluteAyah,
  fromAbsoluteAyah,
  juzOf,
  TOTAL_AYAHS,
} from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DATA = join(HERE, "..", "data");
const ASSETS = join(REPO, "apps", "web", "public", "assets");

const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const EDITION = manifest.edition;

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

/** Waqar144 dataset: juz-keyed entries {src:{ayah:n|n[]}, muts:[{ayah}], ctx?:2}. */
const DATASET = JSON.parse(
  readFileSync(join(DATA, "mutashabihat", "mutashabiha_data.json"), "utf8"),
);

/**
 * The Loop-2 curated seed, verbatim from the mock (linker-mock.html §ADJ).
 * Bare "surah:ayah" refs; `w` is a word anchor on the TARGET. These edges
 * carry hand-written notes/twin flags the dataset lacks — on collision with
 * a dataset edge the curated one wins.
 */
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

/** Mock edge-type vocabulary → spec §5 registry ids. */
const CURATED_TYPE = {
  mutashabih: "mutashabih",
  related: "related-meaning",
  root: "shared-root",
};

/* ------------------------------------------------------------------ */
/* Pass 1 — collect directed edges keyed on (from,to,type).            */
/* ------------------------------------------------------------------ */

const members = (a) => (Array.isArray(a) ? a : [a]);
const first = (a) => (Array.isArray(a) ? a[0] : a);

/**
 * The dataset counts ayahs from zero; `@hifth/core` counts from one. Bridging
 * them without this `+1` is the off-by-one that shipped in Loop 4a and made
 * 47.8% of the hop edges point at an ayah with *no words in common* with their
 * source — which for a mutashabihat instrument is the whole product being
 * wrong, quietly.
 *
 * The upstream README says only "the absolute source ayah number in the Quran"
 * and never states the base, so this was measured rather than read. Taking the
 * longest shared contiguous run of words between the two ends of every edge
 * (words reconstructed at build time from the vendored morphology file):
 *
 *   base as read (0 shift) → 1153/2448 edges share zero words (47.1%), mean 0.79
 *   with this +1           →   11/2448 share zero words ( 0.4%), mean 4.74
 *   −1 and +2              → 48.9% and 46.2% — i.e. noise, like the 0 shift
 *
 * Random ayah pairs share zero words 69.1% of the time with a mean run of 0.33,
 * so the unshifted corpus was barely distinguishable from pairing at random.
 * The dataset's own range (9..6163 over 6236 ayahs) is consistent with 0-based
 * and cannot on its own distinguish the two.
 */
const datasetAbs = (n) => n + 1;
const refToAbs = (ref) => {
  const [s, a] = ref.split(":").map(Number);
  return toAbsoluteAyah(s, a); // throws on invalid — the key-validity gate
};

/** edgeKey → {fromAbs, toAbs, type, ctx?, note?, twin?, root?, w?} */
const edges = new Map();
const edgeKey = (f, t, ty) => `${f}>${t}>${ty}`;

let datasetDirected = 0;
let duplicates = 0;
let juzMismatches = 0;

function addEdge(fromAbs, toAbs, type, meta, { curated = false } = {}) {
  if (fromAbs === toAbs) return;
  const k = edgeKey(fromAbs, toAbs, type);
  const prev = edges.get(k);
  if (prev) {
    duplicates += 1;
    // ctx accumulates (a continuation hint never hurts); curated metadata
    // wins wholesale, otherwise first-in wins.
    const ctx = prev.ctx || meta.ctx;
    edges.set(k, curated ? { ...meta, ...(ctx ? { ctx: true } : {}) } : { ...prev, ...(ctx ? { ctx: true } : {}) });
    return;
  }
  edges.set(k, meta);
}

// Dataset edges: every source-range member links to the target range's first
// ayah (the hop lands on the range's start; the rail lights up wherever in
// the source range you tap).
for (const [juzKeyStr, entries] of Object.entries(DATASET)) {
  const juzKey = Number(juzKeyStr);
  for (const entry of entries) {
    const srcMembers = members(entry.src.ayah).map(datasetAbs);
    const anchor = fromAbsoluteAyah(srcMembers[0]);
    if (juzOf(anchor.surah, anchor.ayah) !== juzKey) juzMismatches += 1;
    const ctx = entry.ctx === 2;
    for (const mut of entry.muts) {
      const toAbs = datasetAbs(first(mut.ayah));
      fromAbsoluteAyah(toAbs); // validity gate on the target
      for (const fromAbs of srcMembers) {
        fromAbsoluteAyah(fromAbs); // validity gate on the source
        datasetDirected += 1;
        addEdge(fromAbs, toAbs, "mutashabih", ctx ? { ctx: true } : {});
      }
    }
  }
}

// Curated seed: richer metadata wins on collision.
let curatedCount = 0;
for (const [ref, list] of Object.entries(CURATED)) {
  const fromAbs = refToAbs(ref);
  for (const e of list) {
    curatedCount += 1;
    addEdge(
      fromAbs,
      refToAbs(e.to),
      CURATED_TYPE[e.type],
      {
        ...(e.root ? { root: e.root } : {}),
        ...(e.twin ? { twin: true } : {}),
        ...(e.ctx ? { ctx: true } : {}),
        ...(e.note ? { note: e.note } : {}),
        ...(e.w ? { w: e.w } : {}),
      },
      { curated: true },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Pass 2 — symmetrize: every a→b gains b→a.                           */
/* ------------------------------------------------------------------ */

// All three active edge types are symmetric relations. Generated reverses
// copy note/twin/ctx/root (all direction-neutral) but drop the word anchor —
// it located words on the forward target, not on the reverse one.
let generatedReverses = 0;
for (const [k, meta] of [...edges]) {
  const [f, t, type] = k.split(">");
  const rk = edgeKey(t, f, type);
  if (!edges.has(rk)) {
    const { w: _w, ...rest } = meta;
    edges.set(rk, rest);
    generatedReverses += 1;
  }
}

/* ------------------------------------------------------------------ */
/* Pass 3 — spec-shape shards with real dir annotations.               */
/* ------------------------------------------------------------------ */

const TYPE_RANK = { mutashabih: 0, "related-meaning": 1, "shared-root": 2 };

/** surah → { ayahStr → Edge[] } */
const shards = new Map();
for (let s = 1; s <= 114; s++) shards.set(s, {});

const flat = [...edges].map(([k, meta]) => {
  const [f, t, type] = k.split(">");
  return { fromAbs: Number(f), toAbs: Number(t), type, ...meta };
});
// Stable total order → byte-identical output: source, then type, then target.
flat.sort(
  (a, b) =>
    a.fromAbs - b.fromAbs ||
    TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
    a.toAbs - b.toAbs,
);

for (const e of flat) {
  const src = fromAbsoluteAyah(e.fromAbs);
  const tgt = fromAbsoluteAyah(e.toAbs);
  const sameJuz = juzOf(src.surah, src.ayah) === juzOf(tgt.surah, tgt.ayah);
  const key = formatAyahKey(EDITION, tgt.surah, tgt.ayah);
  const edge = {
    type: e.type,
    to: e.w ? `${key}#${e.w}` : key,
    page: pageOf(e.toAbs),
    dir: {
      dSurah: tgt.surah - src.surah,
      dPage: pageOf(e.toAbs) - pageOf(e.fromAbs),
      ...(sameJuz ? { sameJuz: true } : {}),
    },
    ...(e.root ? { root: e.root } : {}),
    ...(e.twin ? { twin: true } : {}),
    ...(e.ctx ? { ctx: true } : {}),
    ...(e.note ? { note: e.note } : {}),
  };
  const shard = shards.get(src.surah);
  (shard[String(src.ayah)] ??= []).push(edge);
}

/* ------------------------------------------------------------------ */
/* Write + size gate.                                                  */
/* ------------------------------------------------------------------ */

const OUT_DIR = join(ASSETS, "adj", EDITION);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const GZ_LIMIT = 50 * 1024; // PLAN budget: every shard <50KB gzipped
let totalEdges = 0;
let coveredAyahs = 0;
let maxGz = { surah: 0, bytes: 0 };

for (let surah = 1; surah <= 114; surah++) {
  const byAyah = shards.get(surah);
  // Ayahs numeric-ascending; each ayah gets spec shape {edges, ext}.
  const shard = Object.fromEntries(
    Object.keys(byAyah)
      .sort((a, b) => Number(a) - Number(b))
      .map((a) => [a, { edges: byAyah[a], ext: [] }]),
  );
  const json = JSON.stringify(shard, null, 2) + "\n";
  const gz = gzipSync(json, { level: 9 }).length;
  if (gz >= GZ_LIMIT) {
    throw new Error(
      `shard ${surah}.json is ${gz}B gzipped — over the ${GZ_LIMIT}B budget`,
    );
  }
  if (gz > maxGz.bytes) maxGz = { surah, bytes: gz };
  writeFileSync(join(OUT_DIR, `${surah}.json`), json);
  coveredAyahs += Object.keys(shard).length;
  totalEdges += Object.values(shard).reduce((n, a) => n + a.edges.length, 0);
}

if (juzMismatches > 0) {
  console.warn(
    `build-adjacency — note: ${juzMismatches} dataset entries filed under a different juz than computed (author's filing; juz is recomputed here, so harmless)`,
  );
}
console.log(
  `build-adjacency — ${datasetDirected} dataset + ${curatedCount} curated directed edges → ` +
    `${duplicates} merged, ${generatedReverses} reverses generated → ` +
    `${totalEdges} edges on ${coveredAyahs} ayahs across 114 shards (edition ${EDITION})`,
);
console.log(
  `build-adjacency — largest shard: ${maxGz.surah}.json at ${maxGz.bytes}B gz (budget ${GZ_LIMIT}B)`,
);

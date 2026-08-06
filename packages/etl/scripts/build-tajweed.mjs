#!/usr/bin/env node
/**
 * Tajweed skin ETL (PLAN §Loop 6a / spec §8) — the data behind the skin swap.
 *
 * Input (vendored + pinned, see data/tajweed/PROVENANCE.md):
 *   - data/tajweed/tajweed.hafs.uthmani-pause-sajdah.json — cpfair/quran-tajweed
 *     at `496f71cd`, one record per ayah, each annotation a `{rule, start, end}`
 *     codepoint span *inside that ayah's own* Tanzil Uthmani text.
 *
 * Output:
 *   - skins/<edition>/tajweed/<surah>.json — ayah → family → flat
 *     `[start, end, …]` spans. One shard per surah, so a page fetches at most
 *     the surahs it shows.
 *   - skins/<edition>/NOTICE.txt — the CC BY 4.0 attribution, shipped beside the
 *     bytes it applies to rather than only in the repo's SOURCES.md.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: emit `{elementId: class}` maps. Spec §8
 * describes the skin as a per-ligature class map, and that is still the target —
 * but the vendored mushaf pages have no ligature, letter or word elements to key
 * on (their glyphs are anonymous outlined `<path>`s; the only ids are the
 * per-ayah hit polygons). The spans are kept verbatim so the map becomes a pure
 * function of this same shard the day the word grain arrives, and the
 * app paints one mark per ayah until then. Collapsing the spans to a count now
 * would make the shards cheaper and the upgrade impossible.
 *
 * THAT DAY IS CLOSER AND NOT HERE, and the difference is worth writing down
 * because this comment said "the day Loop 4b's ligature corpus lands" for two
 * loops after 4b shipped. What arrived was not a ligature corpus:
 * `assets/words/**` carries 91,451 word *boxes* on our own frame, and
 * `word-alignment.pin.json` joins the print's word index to the Quranic Arabic
 * Corpus's. Both were the named blockers and both are discharged. What is left
 * is specific to this file: the annotations below are codepoint offsets into
 * each ayah's Tanzil Uthmani text, and this repo holds no Quran text and will
 * not (see `morphology.mjs`). Turning an offset into a word means joining a
 * third segmentation to the two we now have. `docs/design/word-indexing.md` ⑤
 * carries what would answer it and what it would cost — an ETL measurement,
 * not the rendering change this comment used to promise.
 *
 * THE MAPPING is 18 source rules → 7 families (see RULES below and the table in
 * PROVENANCE.md). It is lossy on purpose — seven is what a colour-blind-safe
 * palette carries honestly — and the loss is recorded, not silent: an unknown
 * source rule is a build failure, never a dropped annotation.
 *
 * Gates enforced in-script: every (surah, ayah) resolves via toAbsoluteAyah;
 * all 6,236 ayahs present in the source; every source rule id known; every
 * family id known to @hifth/core; every span a well-formed ascending integer
 * pair; every shard <50KB gzipped; total orders on every sort so two runs are
 * byte-identical (CI asserts via git diff).
 *
 * ATTRIBUTION — required by CC BY 4.0, the licence the source's README states
 * for this data file. It lives in SOURCES.md, in data/tajweed/PROVENANCE.md, in
 * the NOTICE.txt written below, and on the tajweed legend surface in the app.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toAbsoluteAyah, TOTAL_AYAHS, isTajweedRuleId } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DATA = join(HERE, "..", "data");
const ASSETS = join(REPO, "apps", "web", "public", "assets");

const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const EDITION = manifest.edition;

/** PLAN budget: every shard <50KB gzipped. */
const GZ_LIMIT = 50 * 1024;

/* ------------------------------------------------------------------ */
/* The source's 18 rules → Hifth's 7 families.                         */
/* ------------------------------------------------------------------ */

/**
 * Every rule id the pinned source emits, and where it lands.
 *
 * Two groupings are judgement calls worth stating: `lam_shamsiyyah` sits under
 * `idgham` because إدغام الشمسية *is* an idgham (the lām of «ال» assimilating
 * into a sun letter); `iqlab` and both `ikhfa` variants sit under `ghunnah`
 * because all three are realised as a nasalisation held for the same two
 * counts — a reciter hears one thing, so the page shows one thing.
 *
 * Spelling note: the source's README lists `idghaam_mutajaanisain` and
 * `idghaam_mutaqaaribain`. The *data* says `idghaam_mutajanisayn` and
 * `idghaam_mutaqaribayn`. This table follows the data, and the exhaustiveness
 * check below is what would catch it if a future pin changed its mind.
 */
const RULES = {
  hamzat_wasl: "wasl",

  madd_2: "madd",
  madd_246: "madd",
  madd_muttasil: "madd",
  madd_munfasil: "madd",
  madd_6: "madd-lazim",

  ghunnah: "ghunnah",
  ikhfa: "ghunnah",
  ikhfa_shafawi: "ghunnah",
  iqlab: "ghunnah",

  idghaam_ghunnah: "idgham",
  idghaam_no_ghunnah: "idgham",
  idghaam_shafawi: "idgham",
  idghaam_mutajanisayn: "idgham",
  idghaam_mutaqaribayn: "idgham",
  lam_shamsiyyah: "idgham",

  qalqalah: "qalqalah",
  silent: "silent",
};

// The families must be ones @hifth/core will paint; a typo here would ship a
// class nothing styles, which is exactly the sort of silent nothing this gate
// exists to prevent.
for (const [rule, family] of Object.entries(RULES)) {
  if (!isTajweedRuleId(family)) {
    throw new Error(`rule ${rule} maps to "${family}", which @hifth/core does not know`);
  }
}

/* ------------------------------------------------------------------ */
/* Read + validate.                                                    */
/* ------------------------------------------------------------------ */

const SOURCE = JSON.parse(
  readFileSync(join(DATA, "tajweed", "tajweed.hafs.uthmani-pause-sajdah.json"), "utf8"),
);
if (!Array.isArray(SOURCE)) throw new Error("tajweed source is not an array");

/** abs ayah → { family → flat [start, end, …] }. */
const byAyah = new Map();
const seenRules = new Set();
let annotations = 0;

for (const record of SOURCE) {
  // Throws on anything outside 1..114 / the surah's ayah count — the key gate.
  const abs = toAbsoluteAyah(record.surah, record.ayah);
  if (byAyah.has(abs)) throw new Error(`duplicate record for ${record.surah}:${record.ayah}`);
  const families = new Map();
  for (const annotation of record.annotations ?? []) {
    const family = RULES[annotation.rule];
    if (!family) {
      throw new Error(
        `unknown tajweed rule "${annotation.rule}" at ${record.surah}:${record.ayah} — ` +
          `the source changed its vocabulary; update RULES (and PROVENANCE.md) deliberately`,
      );
    }
    const { start, end } = annotation;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) {
      throw new Error(
        `malformed span [${start}, ${end}] for ${annotation.rule} at ${record.surah}:${record.ayah}`,
      );
    }
    seenRules.add(annotation.rule);
    annotations += 1;
    const spans = families.get(family);
    if (spans) spans.push([start, end]);
    else families.set(family, [[start, end]]);
  }
  byAyah.set(abs, families);
}

if (byAyah.size !== TOTAL_AYAHS) {
  throw new Error(
    `source covers ${byAyah.size} ayahs, expected ${TOTAL_AYAHS} — the pin is incomplete`,
  );
}
// Exhaustiveness in the other direction: a rule in the table that the data no
// longer emits means the table is describing a source we are not using.
for (const rule of Object.keys(RULES)) {
  if (!seenRules.has(rule)) throw new Error(`RULES lists "${rule}", which the source never emits`);
}

/* ------------------------------------------------------------------ */
/* Write.                                                              */
/* ------------------------------------------------------------------ */

const OUT_DIR = join(ASSETS, "skins", EDITION);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, "tajweed"), { recursive: true });

// CC BY 4.0's condition is attribution travelling with the work. These shards
// are a derivative of the annotation file, so the notice ships with them —
// SOURCES.md is for whoever reads the repo, this is for whoever gets the bytes.
writeFileSync(
  join(OUT_DIR, "NOTICE.txt"),
  [
    "Tajweed rule spans derived from cpfair/quran-tajweed",
    "  https://github.com/cpfair/quran-tajweed",
    "  commit 496f71cd191da00fa2a37ded79dbbddb033bb0ad",
    "  (c) Collin Fair, licensed CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/",
    "",
    "The rule spans are codepoint offsets into the Tanzil Uthmani Quran text",
    "(Tanzil Project, https://tanzil.net/download/). No Quran text is included",
    "in these files: they contain rule ids and offsets only.",
    "",
    "Generated by packages/etl/scripts/build-tajweed.mjs. See SOURCES.md and",
    "packages/etl/data/tajweed/PROVENANCE.md for the full provenance.",
    "",
  ].join("\n"),
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

// Families in a fixed order (the table's insertion order is stable but not
// meaningful), spans ascending by start then end: two total orders, so the
// bytes cannot depend on the order the source happened to list annotations in.
const FAMILY_ORDER = [...new Set(Object.values(RULES))].sort();

const perFamilyAyahs = new Map();
let markedAyahs = 0;

for (let surah = 1; surah <= 114; surah++) {
  const shard = [];
  for (let ayah = 1; ; ayah++) {
    let abs;
    try {
      abs = toAbsoluteAyah(surah, ayah);
    } catch {
      break; // past the surah's last ayah
    }
    const families = byAyah.get(abs);
    if (!families || families.size === 0) continue; // no rule this source covers
    const entry = {};
    for (const family of FAMILY_ORDER) {
      const spans = families.get(family);
      if (!spans) continue;
      spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      entry[family] = spans.flat();
      perFamilyAyahs.set(family, (perFamilyAyahs.get(family) ?? 0) + 1);
    }
    shard.push([String(ayah), entry]);
    markedAyahs += 1;
  }
  write(join("tajweed", `${surah}.json`), byLine(shard));
}

/* ------------------------------------------------------------------ */
/* Report.                                                             */
/* ------------------------------------------------------------------ */

const coverage = FAMILY_ORDER.map(
  (f) => `${f} ${((100 * (perFamilyAyahs.get(f) ?? 0)) / TOTAL_AYAHS).toFixed(1)}%`,
).join(" · ");
console.log(
  `build-tajweed — ${SOURCE.length} source records / ${annotations} annotations / ` +
    `${seenRules.size} rule ids → ${markedAyahs}/${TOTAL_AYAHS} marked ayahs (edition ${EDITION})`,
);
console.log(`build-tajweed — ayah coverage by family: ${coverage}`);
console.log(
  `build-tajweed — 114 surah shards; largest ${maxGz.file} at ${maxGz.bytes}B gz ` +
    `(budget ${GZ_LIMIT}B)`,
);

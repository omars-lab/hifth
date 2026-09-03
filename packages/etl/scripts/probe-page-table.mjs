/**
 * ⑨ (what-we-depend-on) — corroborate the shipped ayah→page table against an
 * independent compilation of page numbers.
 *
 * `ayah-pages.json` is derived from the page SVG geometry (extract-pages.mjs):
 * one polygon per ayah, indexed by which of the 604 pages it sits on. Nothing
 * checks it, and its only symptom of an error would be an ayah quietly filed on
 * the wrong page. This probe reads an INDEPENDENT witness — Tanzil's page
 * metadata, compiled from the Madani mushaf and independent of our SVG
 * extraction — expands its 604 page-starts into a full 6,236 ayah→page table,
 * and compares. Agreement across all 6,236 is what a fact about a printing looks
 * like rather than an authored arrangement; a disagreement flags either an
 * extraction bug or a genuine V1/V2 printing difference (cf. ④, and
 * probe-ligature-print's divergence bands).
 *
 * Instrument, not ingredient (what-we-distribute ②): the witness is READ at run
 * time to check a number, and is neither vendored here nor shipped — the pin it
 * writes carries only the comparison, never the source's bytes. The probe
 * reaches the public internet, so it is a probe and never a gate.
 *
 * NOTE on the witness: the audit of 2026-08-16 named a public-domain (Unlicense)
 * superset for this. By 2026-09-03 that file could not be relocated —
 * hablullah/data-quran is 404 and its surviving fork was relicensed to
 * CC BY-NC-ND — which is itself evidence for ①. Tanzil (CC BY) is used instead,
 * read-only and attributed here; the correctness question ⑨ asks turns on the
 * witness's independence, not on its licence.
 *
 *   node scripts/probe-page-table.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toAbsoluteAyah, fromAbsoluteAyah } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const TANZIL = "https://tanzil.net/res/text/metadata/quran-data.xml";
const AYAT = 6236;

// ours[i] = the page carrying absolute ayah (i+1), 1-based pages.
const ours = JSON.parse(readFileSync(join(DATA, "pages", "ayah-pages.json"), "utf8"));
if (ours.length !== AYAT) throw new Error(`ayah-pages.json has ${ours.length} entries, expected ${AYAT}`);

const xml = await (await fetch(TANZIL)).text();
const starts = []; // starts[p] = absolute ayah where page p (1-based) begins.
for (const m of xml.matchAll(/<page\s+index="(\d+)"\s+sura="(\d+)"\s+aya="(\d+)"\s*\/>/g)) {
  starts[Number(m[1])] = toAbsoluteAyah(Number(m[2]), Number(m[3]));
}
const PAGES = starts.length - 1;
if (starts[1] !== 1) throw new Error(`page 1 does not start at absolute ayah 1 (got ${starts[1]}) — indexing convention mismatch`);

// Expand the 604 page-starts into a full ayah→page witness table.
const witness = new Array(AYAT);
for (let p = 1; p <= PAGES; p += 1) {
  const from = starts[p];
  const to = p < PAGES ? starts[p + 1] - 1 : AYAT;
  for (let a = from; a <= to; a += 1) witness[a - 1] = p;
}

let agree = 0;
const diffs = [];
for (let i = 0; i < AYAT; i += 1) {
  if (ours[i] === witness[i]) agree += 1;
  else {
    const { surah, ayah } = fromAbsoluteAyah(i + 1);
    diffs.push({ abs: i + 1, ref: `${surah}:${ayah}`, ours: ours[i], tanzil: witness[i] });
  }
}

const pin = {
  witness: "tanzil quran-data.xml (page metadata)",
  source: TANZIL,
  pages: PAGES,
  ayat: AYAT,
  agree,
  disagree: diffs.length,
  diffs,
};
writeFileSync(join(DATA, "pages", "page-table.probe.json"), `${JSON.stringify(pin, null, 2)}\n`);
console.log(JSON.stringify({ pages: PAGES, agree, disagree: diffs.length, sampleDiffs: diffs.slice(0, 15) }, null, 2));

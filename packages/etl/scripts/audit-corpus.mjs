#!/usr/bin/env node
/**
 * Corpus completeness audit (PLAN §4 rule 7 / research §7).
 *
 * The deep-research pass could NOT verify that the quran-svg corpus ships all
 * 604 pages, so this audit runs page-by-page instead of trusting the corpus
 * wholesale. Its job is two-fold:
 *   (a) report coverage against the canonical 604-page print, and
 *   (b) assert the vendored pages are internally consistent: every manifest page
 *       has a file, every file parses, every polygon has a valid number/key, and
 *       no page contains a <text> element.
 *
 * It exits non-zero on an internal-consistency failure. Missing pages are
 * REPORTED, not failed — the audit was written when 3 of 604 were vendored and
 * had to keep working through the gap. Loop 4b closed it (604/604), and
 * `gate:pages` is what now *fails* on a missing page; this stays a report so it
 * keeps its original job of describing the corpus rather than policing it.
 *
 * Note it reads the manifest through `expandManifest` — the shipped manifest is
 * the compact ayah→page form, and this audit's whole value is cross-checking the
 * expanded polygons back against the SVG bytes they claim to describe.
 */
import { readFileSync, existsSync } from "node:fs";
import { expandManifest, isCompactManifest } from "@hifth/core";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ASSETS = join(REPO, "apps", "web", "public", "assets");
const MANIFEST = join(ASSETS, "manifest.json");

const MADANI_TOTAL_PAGES = 604;

function fail(msg) {
  console.error(`audit:corpus — FAIL: ${msg}`);
  process.exit(1);
}

if (!existsSync(MANIFEST)) fail("manifest.json missing — run extract:pages first");
const wire = JSON.parse(readFileSync(MANIFEST, "utf8"));
const manifest = isCompactManifest(wire) ? expandManifest(wire) : wire;

const problems = [];
let polygonCount = 0;

for (const page of manifest.pages) {
  const svgPath = join(ASSETS, "pages", page.edition, `${page.page}.svg`);
  if (!existsSync(svgPath)) {
    problems.push(`page ${page.page}: manifest lists it but ${svgPath} is missing`);
    continue;
  }
  const svg = readFileSync(svgPath, "utf8");
  if (!svg.trimStart().startsWith("<svg")) problems.push(`page ${page.page}: not a valid SVG root`);
  if (/<text[\s>]/.test(svg)) problems.push(`page ${page.page}: contains a <text> element`);
  if (!svg.includes(`viewBox="${page.viewBox}"`)) {
    problems.push(`page ${page.page}: manifest viewBox "${page.viewBox}" not found in SVG`);
  }
  // Every manifest polygon must appear in the SVG, and its key must decode.
  for (const poly of page.polygons) {
    polygonCount++;
    if (!svg.includes(`number="${poly.number}"`)) {
      problems.push(`page ${page.page}: polygon number ${poly.number} not in SVG`);
    }
    const expectSurah = Math.floor(poly.number / 1000);
    const expectAyah = poly.number % 1000;
    if (poly.surah !== expectSurah || poly.ayah !== expectAyah) {
      problems.push(
        `page ${page.page}: polygon ${poly.number} decodes to ${expectSurah}:${expectAyah} but manifest says ${poly.surah}:${poly.ayah}`,
      );
    }
    const expectKey = `quran/${page.edition}/${expectSurah}:${expectAyah}`;
    if (poly.key !== expectKey) {
      problems.push(`page ${page.page}: polygon ${poly.number} key "${poly.key}" != "${expectKey}"`);
    }
  }
}

// --- Coverage report (informational) ---
const vendored = manifest.pages.map((p) => p.page).sort((a, b) => a - b);
const coverage = ((vendored.length / MADANI_TOTAL_PAGES) * 100).toFixed(1);
const missing = MADANI_TOTAL_PAGES - vendored.length;
console.log("Corpus audit — edition:", manifest.edition);
// Listed as ranges: at 604 pages the enumeration is a wall, and what a reader
// needs from it is where the gaps are, not the numbers in between.
console.log(`  vendored pages: ${asRanges(vendored)} (${vendored.length}/${MADANI_TOTAL_PAGES}, ${coverage}%)`);
console.log(`  polygons validated: ${polygonCount}`);
console.log(
  missing === 0
    ? `  missing: none — the print is fully vendored`
    : `  missing: ${missing} pages — see gate:pages`,
);

/** Collapse a sorted page list to "1–604" / "7, 9, 19" / "1–3, 7–9". */
function asRanges(pages) {
  const out = [];
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(j > i ? `${pages[i]}\u2013${pages[j]}` : `${pages[i]}`);
    i = j + 1;
  }
  return out.join(", ");
}

if (problems.length > 0) {
  console.error(`\naudit:corpus — ${problems.length} internal-consistency problem(s):`);
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log("\naudit:corpus — OK (vendored pages internally consistent; coverage reported above)");

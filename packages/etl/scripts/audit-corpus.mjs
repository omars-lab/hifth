#!/usr/bin/env node
/**
 * Corpus completeness audit (PLAN §4 rule 7 / research §7).
 *
 * The deep-research pass could NOT verify that the quran-svg corpus ships all
 * 604 Madani pages, so this audit runs page-by-page instead of trusting the
 * corpus wholesale. In Loop 0 only 3 pages are vendored, so the audit's job is
 * two-fold:
 *   (a) report coverage against the canonical 604-page Madani mushaf, and
 *   (b) assert the vendored pages are internally consistent: every manifest page
 *       has a file, every file parses, every polygon has a valid number/key, and
 *       no page contains a <text> element.
 *
 * It exits non-zero on an internal-consistency failure. Missing pages (3/604)
 * are REPORTED, not failed — full vendoring is Loop 4's job. The report is the
 * artifact recorded in docs/decisions/loop-0.md.
 */
import { readFileSync, existsSync } from "node:fs";
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
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

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
console.log("Corpus audit — edition:", manifest.edition);
console.log(`  vendored pages: ${vendored.join(", ")} (${vendored.length}/${MADANI_TOTAL_PAGES}, ${coverage}%)`);
console.log(`  polygons validated: ${polygonCount}`);
console.log(`  missing: ${MADANI_TOTAL_PAGES - vendored.length} pages — full vendoring is Loop 4`);

if (problems.length > 0) {
  console.error(`\naudit:corpus — ${problems.length} internal-consistency problem(s):`);
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log("\naudit:corpus — OK (vendored pages internally consistent; coverage reported above)");

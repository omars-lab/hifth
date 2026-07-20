#!/usr/bin/env node
/**
 * Extract the three mushaf page SVGs and their polygon metadata from the
 * design mock (docs/reference/linker-mock.html) into apps/web/public/assets/.
 *
 * The mock embeds each page as a <template id="tpl-pN"> whose child is a
 * complete <svg viewBox="0 0 345 550"> with outlined <path> glyphs and
 * class="ayahPolygon" hit polygons carrying number="SSSAAA" surah="S".
 *
 * Output (deterministic — no timestamps, stable key order):
 *   apps/web/public/assets/pages/hafs-kfqc/{7,9,19}.svg
 *   apps/web/public/assets/manifest.json      (AssetManifest, see @hifth/core)
 *
 * Immutability rule (PLAN §8): the SVG bytes are copied verbatim — never edited.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const MOCK = join(REPO, "docs", "reference", "linker-mock.html");
const OUT_DIR = join(REPO, "apps", "web", "public", "assets");
const PAGES_DIR = join(OUT_DIR, "pages", "hafs-kfqc");

const EDITION = "hafs-kfqc";
const EDITION_LABEL = "حفص · مجمع الملك فهد (quranpedia)";

/** number (SSSAAA) → {surah, ayah} */
function decode(number) {
  return { surah: Math.floor(number / 1000), ayah: number % 1000 };
}

/** Build canonical ayah key, e.g. quran/hafs-kfqc/2:48 */
function ayahKey(edition, surah, ayah) {
  return `quran/${edition}/${surah}:${ayah}`;
}

function extractTemplates(html) {
  const re = /<template id="tpl-p(\d+)">([\s\S]*?)<\/template>/g;
  const pages = [];
  let m;
  while ((m = re.exec(html))) {
    const page = Number(m[1]);
    const svg = m[2].trim();
    if (!svg.startsWith("<svg")) continue; // skip icon templates
    pages.push({ page, svg });
  }
  return pages.sort((a, b) => a.page - b.page);
}

function polygonsOf(svg) {
  // Capture number/surah in either attribute order, plus the paired verse id.
  const polys = [];
  const re = /<path\b[^>]*class="ayahPolygon"[^>]*>/g;
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const number = Number(/number="(\d+)"/.exec(tag)?.[1]);
    const surahAttr = Number(/surah="(\d+)"/.exec(tag)?.[1]);
    const idAttr = /id="(verse-\d+)"/.exec(tag)?.[1] ?? `verse-${number}`;
    if (!Number.isFinite(number)) continue;
    const { surah, ayah } = decode(number);
    polys.push({
      elementId: idAttr,
      number,
      surah: Number.isFinite(surahAttr) ? surahAttr : surah,
      ayah,
      key: ayahKey(EDITION, surah, ayah),
    });
  }
  return polys.sort((a, b) => a.number - b.number);
}

function viewBoxOf(svg) {
  return /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "";
}

function main() {
  const html = readFileSync(MOCK, "utf8");
  const templates = extractTemplates(html);
  if (templates.length === 0) {
    console.error("FATAL: no page templates found in mock");
    process.exit(1);
  }

  mkdirSync(PAGES_DIR, { recursive: true });

  const manifestPages = [];
  for (const { page, svg } of templates) {
    // Immutability: write the SVG bytes verbatim.
    writeFileSync(join(PAGES_DIR, `${page}.svg`), svg + "\n");

    const polygons = polygonsOf(svg);
    // Loop 0 CI safety: outlined paths only. A <text> element would trip the
    // Safari content-visibility paint bug (research §1–§2).
    if (/<text[\s>]/.test(svg)) {
      console.error(`FATAL: page ${page} contains a <text> element`);
      process.exit(1);
    }
    manifestPages.push({
      edition: EDITION,
      page,
      viewBox: viewBoxOf(svg),
      polygons,
    });
    console.log(`page ${page}: ${svg.length} bytes, ${polygons.length} polygons`);
  }

  const manifest = {
    edition: EDITION,
    editionLabel: EDITION_LABEL,
    pages: manifestPages,
  };
  // Deterministic JSON: 2-space indent, keys in insertion order, trailing NL.
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const total = manifestPages.reduce((n, p) => n + p.polygons.length, 0);
  console.log(`\nwrote ${manifestPages.length} pages, ${total} polygons → ${OUT_DIR}`);
}

main();

#!/usr/bin/env node
/**
 * Derive the ayah anchors for the `hafs-kfqc` edition from the page SVGs that
 * are committed under apps/web/public/assets/pages/hafs-kfqc/, and write the
 * manifest the app fetches.
 *
 * Output (deterministic — no timestamps, no network, stable key order):
 *   apps/web/public/assets/manifest.json      (CompactManifest, see @hifth/core)
 *
 * This script used to do two jobs: cut three page SVGs out of the design mock,
 * and index them. Loop 4b split those. Vendoring 604 pages needs the network
 * and 348 MB of upstream corpus, so it moved to vendor-pages.mjs, which is run
 * by hand. What is left here is the half CI can run — and CI's determinism
 * check (`git diff --exit-code -- apps/web/public/assets`) now asserts
 * something stronger than it used to: the anchors that ship are re-derivable
 * from the page bytes that ship, on every commit, offline.
 *
 * Four invariants are checked here rather than trusted, because the compact
 * manifest depends on all four and each of them is a property of the corpus,
 * not of our code:
 *
 *   1. Exactly one polygon per ayah — no ayah on two pages, no page carrying an
 *      ayah twice. This is what lets the manifest be an ayah→page table.
 *   2. Every polygon's `id` is `verse-<absolute ayah>`. This is what lets the
 *      manifest omit ids. vendor-pages.mjs repairs the two upstream defects; if
 *      it stopped, this fails.
 *   3. The `surah` attribute agrees with the surah encoded in `number`.
 *   4. The derived ayah→page table reproduces packages/etl/data/pages/
 *      ayah-pages.json byte-for-byte. That file was derived in Loop 4a from the
 *      corpus's *JSON* metadata, independently of its SVGs; the two agreeing is
 *      the cross-check PROVENANCE.md asks Loop 4b for.
 *
 * A partially vendored edition is allowed (Loop 0 shipped three pages and this
 * script has to keep working on that tree) — invariants 1–3 hold on whatever is
 * present, and 4 is checked only when all 604 pages are.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compactManifest, fromAbsoluteAyah, TOTAL_AYAHS, toAbsoluteAyah } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const OUT_DIR = join(REPO, "apps", "web", "public", "assets");
const PAGES_DIR = join(OUT_DIR, "pages", "hafs-kfqc");
const AYAH_PAGES = join(HERE, "..", "data", "pages", "ayah-pages.json");

const EDITION = "hafs-kfqc";
const EDITION_LABEL = "حفص · مجمع الملك فهد (quranpedia)";
const PAGES = 604;

function die(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

/** number (SSSAAA) → {surah, ayah} */
function decode(number) {
  return { surah: Math.floor(number / 1000), ayah: number % 1000 };
}

function viewBoxOf(svg) {
  return /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "";
}

/**
 * Every ayah polygon on a page, in document order. The attribute set is the
 * contract vendor-pages.mjs preserves through svgo (see the disabled plugins in
 * the pin): `class="ayahPolygon"`, `number="SSSAAA"`, `surah="S"`, `id`.
 */
function polygonsOf(svg, page) {
  const polys = [];
  const re = /<path\b[^>]*class="ayahPolygon"[^>]*>/g;
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const number = Number(/number="(\d+)"/.exec(tag)?.[1]);
    if (!Number.isFinite(number)) die(`page ${page}: an ayahPolygon has no number attribute`);
    const { surah, ayah } = decode(number);

    const surahAttr = Number(/surah="(\d+)"/.exec(tag)?.[1]);
    if (Number.isFinite(surahAttr) && surahAttr !== surah) {
      die(`page ${page}: polygon number="${number}" says surah="${surahAttr}"`); // invariant 3
    }

    let abs;
    try {
      abs = toAbsoluteAyah(surah, ayah);
    } catch {
      die(`page ${page}: number="${number}" is not an ayah in the Hafs/Kufan counting`);
    }

    const idAttr = /\bid="([^"]*)"/.exec(tag)?.[1];
    if (idAttr !== `verse-${abs}`) {
      // Invariant 2. vendor-pages.mjs repairs the two upstream defects; reaching
      // here means it did not run, or the corpus changed shape.
      die(
        `page ${page}: polygon for ${surah}:${ayah} has id "${idAttr}", expected "verse-${abs}" — ` +
          `re-run vendor:pages, and if upstream changed, update its ID_REPAIRS`,
      );
    }

    polys.push({ elementId: idAttr, number, surah, ayah, key: `quran/${EDITION}/${surah}:${ayah}` });
  }
  return polys.sort((a, b) => a.number - b.number);
}

function main() {
  if (!existsSync(PAGES_DIR)) die(`no vendored pages at ${PAGES_DIR} — run vendor:pages first`);

  const pageNumbers = readdirSync(PAGES_DIR)
    .filter((f) => /^\d+\.svg$/.test(f))
    .map((f) => Number(f.replace(".svg", "")))
    .sort((a, b) => a - b);
  if (pageNumbers.length === 0) die(`no page SVGs in ${PAGES_DIR}`);

  const manifestPages = [];
  const seen = new Map(); // absolute ayah → page, for invariant 1
  let polygonCount = 0;

  for (const page of pageNumbers) {
    const svg = readFileSync(join(PAGES_DIR, `${page}.svg`), "utf8");
    // Standing rule since Loop 0: outlined paths only. A <text> element trips
    // the Safari content-visibility paint bug (research §1–§2).
    if (/<text[\s>]/.test(svg)) die(`page ${page} contains a <text> element`);

    const polygons = polygonsOf(svg, page);
    for (const p of polygons) {
      const abs = toAbsoluteAyah(p.surah, p.ayah);
      const already = seen.get(abs);
      if (already !== undefined) {
        die(`ayah ${p.surah}:${p.ayah} appears on pages ${already} and ${page}`); // invariant 1
      }
      seen.set(abs, page);
    }
    polygonCount += polygons.length;
    manifestPages.push({ edition: EDITION, page, viewBox: viewBoxOf(svg), polygons });
  }

  const full = { edition: EDITION, editionLabel: EDITION_LABEL, pages: manifestPages };
  const compact = compactManifest(full);

  // Invariant 4 — only meaningful once the whole print is vendored.
  const complete = pageNumbers.length === PAGES;
  if (complete) {
    if (seen.size !== TOTAL_AYAHS) {
      die(`${seen.size} ayahs anchored across ${PAGES} pages, expected ${TOTAL_AYAHS}`);
    }
    // Compared element-wise, not byte-wise: the subject is whether the two
    // upstream artifacts agree about where an ayah is, not how either file is
    // formatted.
    const committed = JSON.parse(readFileSync(AYAH_PAGES, "utf8"));
    if (committed.length !== compact.ayahPages.length) {
      die(`ayah-pages.json holds ${committed.length} entries, derived ${compact.ayahPages.length}`);
    }
    const disagree = [];
    for (let i = 0; i < committed.length; i++) {
      if (committed[i] !== compact.ayahPages[i]) disagree.push(i + 1);
    }
    if (disagree.length) {
      const { surah, ayah } = fromAbsoluteAyah(disagree[0]);
      die(
        `${disagree.length} ayah(s) sit on a different page in the page SVGs than in ` +
          `packages/etl/data/pages/ayah-pages.json — first is ${surah}:${ayah} ` +
          `(ayah-pages.json says page ${committed[disagree[0] - 1]}, the SVGs say ` +
          `${compact.ayahPages[disagree[0] - 1]}). Loop 4a derived that file from the ` +
          `corpus's JSON metadata, independently of its SVGs; the two upstream artifacts ` +
          `disagreeing is a corpus problem, not a formatting one. Do not paper over it — ` +
          `see that file's PROVENANCE.md.`,
      );
    }
    console.log(`cross-check: SVG-derived ayah→page table matches ayah-pages.json (Loop 4a, JSON-derived)`);
  } else {
    console.log(
      `note: ${pageNumbers.length}/${PAGES} pages vendored — skipping the ayah-pages.json cross-check`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Deterministic JSON: 2-space indent, keys in insertion order, trailing NL.
  // ayahPages is written on one line — 6236 numbers, one per line, would be a
  // 6236-line diff for a one-ayah change and no easier to read.
  const TOKEN = "__AYAH_PAGES__";
  const json = JSON.stringify({ ...compact, ayahPages: TOKEN }, null, 2).replace(
    JSON.stringify(TOKEN),
    JSON.stringify(compact.ayahPages),
  );
  writeFileSync(join(OUT_DIR, "manifest.json"), json + "\n");

  const overrides = Object.keys(compact.viewBoxOverrides);
  console.log(
    `\nindexed ${pageNumbers.length} pages, ${polygonCount} polygons\n` +
      `viewBox ${compact.viewBox}` +
      (overrides.length ? ` (overridden on page${overrides.length > 1 ? "s" : ""} ${overrides.join(", ")})` : "") +
      `\nwrote ${OUT_DIR}/manifest.json`,
  );
}

main();

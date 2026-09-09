#!/usr/bin/env node
/**
 * Whole-book tappable-area sweep (docs/PLAN.md follow-up 20).
 *
 * For every one of the 604 pages: draw the store's word-by-word page in the
 * print's per-page font at the print's geometry, measure each word's box, lay the
 * app's own tappable ayah shapes over it, and record every word whose box centre
 * falls outside its own ayah's shape or inside a neighbour's. This is the
 * page-by-page workbench check (QulDiff's "Where a tap lands") run across the
 * whole book by tool, reusing the exact same module — no reimplementation.
 *
 * WHY A BROWSER. The word boxes are the browser's own justified RTL text layout
 * (getExtentOfChar); only it lays the per-page glyph font out. So the sweep drives
 * a headless Chromium against the running dev server (port 5199) and calls the
 * shipped-for-dev storePage.ts functions inside the page. The point-in-polygon
 * classification is pure and DOM-free (proven exact against isPointInFill), but
 * the measurement is the browser's to give.
 *
 * OUTPUT is text-free — page numbers, ayah addresses ("s:a"/"s:a:p") and box
 * coordinates, no Qur'an letters — so it is safe to keep in the tree as evidence.
 *
 * RUN (dev server must be up on 5199, all 604 fixtures pulled):
 *   node apps/web/scripts/qul-tap-sweep.mjs --base http://localhost:5199 --out <path>
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:5199");
const OUT = arg("--out", "/tmp/qul-tap-sweep.json");
const FIRST = Number(arg("--first", "1"));
const LAST = Number(arg("--last", "604"));

const now = () => new Date().toISOString();
const log = (ev, extra = "") =>
  console.log(`${now()} pid=${process.pid} ev=${ev}${extra ? " " + extra : ""}`);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => log("pageerror", `msg="${String(e).replace(/\n/g, " ").slice(0, 200)}"`));
log("sweep_start", `base=${BASE} first=${FIRST} last=${LAST}`);

await page.goto(`${BASE}/qul-diff.html`, { waitUntil: "domcontentloaded", timeout: 30000 });

// Set up the module, the manifest and an offscreen (but laid-out) host once.
await page.evaluate(async (base) => {
  const m = await import("/src/qul-diff/storePage.ts");
  window.__qul = m;
  const mf = await fetch(`${base}/assets/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  window.__viewBoxOf = (pg) => {
    const raw = mf?.viewBoxOverrides?.[String(pg)] ?? mf?.viewBox;
    return m.parseViewBox(raw) ?? { x: 0, y: 0, w: 345, h: 550 };
  };
  const host = document.createElement("div");
  host.id = "sweep-host";
  host.style.cssText = "position:fixed;left:-99999px;top:0;width:400px;height:auto;";
  document.body.appendChild(host);
  window.__host = host;
}, BASE);

async function onePage(pg) {
  return page.evaluate(async (pg) => {
    const m = window.__qul;
    const host = window.__host;
    const [fixture, boxes, shapes] = await Promise.all([
      m.loadFixture(pg),
      m.loadWordBoxes(pg, "/"),
      m.loadTapShapes(pg, "/"),
    ]);
    if (!fixture) return { page: pg, error: "no-fixture" };
    const viewBox = window.__viewBoxOf(pg);
    const geom = m.lineGeometry(fixture, boxes, viewBox);
    const svg = m.buildStorePageSvg(fixture, geom, { page: pg, bands: true });
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
    host.replaceChildren(svg);
    m.ensureFontFace(pg);
    await m.fontReady(pg);
    m.calibrateFontSize(svg, geom);
    const wordBoxes = m.measureStoreWordBoxes(svg);
    const rep = m.classifyPlacement(wordBoxes, shapes);
    host.replaceChildren();
    const trim = (a) => a.map((x) => ({ word: x.word, ayah: x.ayah, landedIn: x.landedIn }));
    return {
      page: pg,
      shapes: shapes.length,
      rows: geom.rows,
      ayahLines: geom.ayahLines,
      paired: geom.rows === geom.ayahLines,
      total: rep.total,
      ok: rep.ok,
      inNeighbour: trim(rep.inNeighbour),
      outside: trim(rep.outside),
    };
  }, pg);
}

const results = [];
for (let pg = FIRST; pg <= LAST; pg++) {
  try {
    const r = await onePage(pg);
    results.push(r);
    if (r.error) log("page_err", `page=${pg} err=${r.error}`);
    else if (r.inNeighbour.length || r.outside.length)
      log("page_flag", `page=${pg} neighbour=${r.inNeighbour.length} outside=${r.outside.length} paired=${r.paired}`);
    if (pg % 50 === 0) log("progress", `page=${pg}`);
  } catch (e) {
    results.push({ page: pg, error: String(e).slice(0, 200) });
    log("page_throw", `page=${pg} msg="${String(e).replace(/\n/g, " ").slice(0, 160)}"`);
  }
}

await browser.close();

const flagged = results.filter((r) => !r.error && (r.inNeighbour.length || r.outside.length));
const errored = results.filter((r) => r.error);
const unpaired = results.filter((r) => !r.error && !r.paired);
const summary = {
  generatedAt: now(),
  pages: results.length,
  totalWords: results.reduce((n, r) => n + (r.total || 0), 0),
  pagesClean: results.filter((r) => !r.error && !r.inNeighbour.length && !r.outside.length).length,
  pagesFlagged: flagged.length,
  pagesUnpaired: unpaired.length,
  pagesErrored: errored.length,
  wordsInNeighbour: results.reduce((n, r) => n + (r.inNeighbour?.length || 0), 0),
  wordsOutside: results.reduce((n, r) => n + (r.outside?.length || 0), 0),
};
writeFileSync(OUT, JSON.stringify({ summary, results }, null, 2) + "\n");
log("sweep_done", `clean=${summary.pagesClean} flagged=${summary.pagesFlagged} unpaired=${summary.pagesUnpaired} errored=${summary.pagesErrored} out=${OUT}`);

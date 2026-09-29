#!/usr/bin/env node
/**
 * Whole-book PRINT-word tappable-area sweep — the tighter instrument named at the
 * end of docs/issues/qul-tap-sweep.md.
 *
 * The store sweep (qul-tap-sweep.mjs) lays the held store's re-justified words
 * over the app's tap shapes and finds a small residue at ayah boundaries. That
 * residue is the hair where TWO independent justifications of a line disagree:
 * the store's layout and the tap-shape edge. This sweep removes one of the two.
 * It takes the app's OWN print word boxes — the ones the app already ships, in
 * assets/words/<edition>/<page>.json, ayah-keyed — and lays them over the app's
 * OWN tap shapes, so there is only one justification and no store at all.
 *
 * If the boundary residue is really the two-justifications hair, dropping the
 * second justification should shrink it toward zero. It does: ~0.44% here against
 * the store sweep's 3.6%, and every neighbour case is the first word of an ayah
 * landing in the shape of the line the previous ayah ended on.
 *
 * NO HELD COPY. Unlike the store sweep this touches nothing gitignored — no
 * fixtures, no per-page font, no glyph measurement. The word boxes and the tap
 * polygons are both static committed app assets, and classifyPlacement is a pure
 * point-in-polygon test. So this reproduces on a clean clone and its output is
 * text-free (page numbers, "s:a:p" addresses, box coordinates, counts).
 *
 * WHY STILL A BROWSER. Only to reuse storePage.ts (loadTapShapes / loadWordBoxes /
 * classifyPlacement) exactly as shipped, served as TS by the dev server, with no
 * reimplementation of the SVG-path and point-in-polygon code. Nothing here needs
 * layout; a headless page is just the module host.
 *
 * RUN (dev server up on 5199):
 *   node apps/web/scripts/qul-print-tap-sweep.mjs --base http://localhost:5199 --out <path>
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:5199");
const OUT = arg("--out", "/tmp/qul-print-tap-sweep.json");
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
await page.evaluate(async () => {
  window.__qul = await import("/src/qul-diff/storePage.ts");
});

/** One page: the app's own print words against the app's own tap shapes. */
async function onePage(pg) {
  return page.evaluate(async (pg) => {
    const m = window.__qul;
    const [shapes, wb] = await Promise.all([m.loadTapShapes(pg, "/"), m.loadWordBoxes(pg, "/")]);
    if (!wb || !wb.words) return { page: pg, error: "no-boxes" };
    // One classifier box per app word box, addressed to the ayah it is keyed under.
    const boxes = [];
    for (const [ayah, entry] of Object.entries(wb.words)) {
      const from = entry.from ?? 1;
      (entry.boxes || []).forEach((b, i) => {
        boxes.push({ word: `${ayah}:${from + i}`, ayah, box: { x: b[0], y: b[1], w: b[2], h: b[3] } });
      });
    }
    const rep = m.classifyPlacement(boxes, shapes);
    const light = (arr) => arr.map((x) => ({ word: x.word, landedIn: x.landedIn ?? null }));
    return {
      page: pg,
      shapes: shapes.length,
      total: rep.total,
      ok: rep.ok,
      inNeighbour: light(rep.inNeighbour),
      outside: light(rep.outside),
    };
  }, pg);
}

const perPage = [];
for (let pg = FIRST; pg <= LAST; pg++) {
  try {
    const r = await onePage(pg);
    perPage.push(r);
    if (r.error) log("page_skip", `page=${pg} why=${r.error}`);
    else if (r.inNeighbour.length || r.outside.length)
      log("page_flag", `page=${pg} neighbour=${r.inNeighbour.length} outside=${r.outside.length} total=${r.total}`);
    if (pg % 100 === 0) log("progress", `page=${pg}`);
  } catch (e) {
    log("page_error", `page=${pg} msg="${String(e).replace(/\n/g, " ").slice(0, 160)}"`);
    perPage.push({ page: pg, error: "throw" });
  }
}
await browser.close();

const ok = perPage.filter((r) => !r.error);
const sum = (f) => ok.reduce((n, r) => n + f(r), 0);
const total = sum((r) => r.total);
const own = sum((r) => r.ok);
const neighbour = sum((r) => r.inNeighbour.length);
const outside = sum((r) => r.outside.length);
const flaggedPages = ok.filter((r) => r.inNeighbour.length || r.outside.length).length;

const outsideWords = [];
for (const r of ok) for (const w of r.outside) outsideWords.push({ page: r.page, word: w.word });

const report = {
  generatedAt: now(),
  method:
    "app's own print word boxes (assets/words/<edition>/<page>.json) vs app's own tap shapes " +
    "(assets/pages/<edition>/<page>.svg), classifyPlacement centre test; no store, no held copy",
  summary: {
    pages: ok.length,
    errored: perPage.length - ok.length,
    words: total,
    ownAyah: own,
    ownAyahShare: total ? own / total : 0,
    neighbour,
    outside,
    flaggedPages,
    cleanPages: ok.length - flaggedPages,
  },
  outsideWords,
  perPage: ok.map((r) => ({
    page: r.page,
    shapes: r.shapes,
    total: r.total,
    ok: r.ok,
    neighbour: r.inNeighbour.length,
    outside: r.outside.length,
    neighbourInto: r.inNeighbour.map((x) => x.landedIn),
  })),
};
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
log(
  "sweep_done",
  `pages=${ok.length} words=${total} own=${own} share=${(100 * own / total).toFixed(2)}% neighbour=${neighbour} outside=${outside} flaggedPages=${flaggedPages} out=${OUT}`,
);

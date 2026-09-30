#!/usr/bin/env node
/**
 * Pictures for the colour question on docs/design/highlight-texture-options.md
 * (item ②): which two colours a swept passage and a run of words should take.
 *
 * Each candidate pair is put on the built app in place of today's colours and
 * shot at phone size on page 42, in the two scenes a reader can actually see:
 *
 *   a passage on its own — the app never shows a passage and a verse at once
 *     (a tap on a verse replaces the passage), so the passage only has to read
 *     on bare paper;
 *   a run of words over its amber verse — the one place two colours cross today.
 *
 * Under each pair the letters' contrast is worked out where each colour crosses
 * the amber verse, the way the reading floor is measured everywhere else in the
 * app: the letters as they sit under the ink, against the paper under the ink.
 * The passage's figure is kept too, for the day a passage and a verse can be
 * shown together, as the highlighter decision drew them.
 *
 * Writes docs/design/highlight-texture-options/colours-<id>-<scene>.png and one
 * side-by-side, colours.png. The app must be built first (apps/web/dist).
 *
 *   node scripts/shoot-ink-colours.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const { chromium } = createRequire(join(ROOT, "apps", "web", "package.json"))("@playwright/test");

/** Today's stand-ins first, then the candidates, each as strong as it can be and still pass. */
export const PAIRS = [
  { id: "today", label: "Today: green and blue, thinned", passage: "rgba(31, 111, 102, 0.45)", run: "rgba(59, 95, 168, 0.45)" },
  { id: "A", label: "A: green and blue, as pastels", passage: "#9bd9b5", run: "#bacbf3" },
  { id: "B", label: "B: teal and violet", passage: "#74e7d7", run: "#d1baf3" },
  { id: "C", label: "C: sky blue and pink", passage: "#a8d2f0", run: "#ed9bc4" },
  { id: "D", label: "D: green and pink", passage: "#74e7a4", run: "#ed9bc4" },
];

const PAPER = "#f4efe6";
const LETTERS = "#26201a";
const AMBER = "#e8a13a";
/** The reading floor this project holds text to. */
const FLOOR = 4.5;

const rgba = (c) => {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (m) return { rgb: [m[1], m[2], m[3]].map((v) => Number(v) / 255), a: Number(m[4]) };
  const h = c.replace("#", "");
  return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), a: 1 };
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
/** One ink laid over a colour under multiply, as the page draws it. */
const under = (base, ink) => base.map((b, i) => b * (1 - ink.a + ink.a * ink.rgb[i]));

/** The letters' contrast where `ink` crosses the amber verse. */
export function overVerse(ink) {
  const amber = rgba(AMBER);
  const bg = under(under(rgba(PAPER).rgb, amber), rgba(ink));
  const fg = under(under(rgba(LETTERS).rgb, amber), rgba(ink));
  return ratio(fg, bg);
}
/** How far the ink stands off bare paper: how plainly the mark shows at all. */
export const onPaper = (ink) => ratio(rgba(PAPER).rgb, under(rgba(PAPER).rgb, rgba(ink)));

const OUT = join(ROOT, "docs", "design", "highlight-texture-options");
const DIST = join(ROOT, "apps", "web", "dist");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.error("shoot-ink-colours: apps/web/dist is not built; run `make build` first.");
    process.exit(1);
  }
  const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^\/+/, "");
    let abs = join(DIST, rel);
    if (rel.startsWith("..") || !existsSync(abs)) return void res.writeHead(404).end();
    if (statSync(abs).isDirectory()) abs = join(abs, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(abs)] ?? "application/octet-stream" });
    res.end(readFileSync(abs));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const origin = `http://127.0.0.1:${server.address().port}`;

  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (/^colours.*\.png$/.test(f)) rmSync(join(OUT, f));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: "en-US",
    serviceWorkers: "block",
  });
  const page = await ctx.newPage();
  const overlay = 'svg[aria-labelledby="page-label-42"]:visible #hifth-overlay';

  /** The marks' box, a little padded, on screen. */
  const clipOf = async (sel) => {
    const boxes = await page.locator(sel).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]),
    );
    const top = Math.max(0, Math.min(...boxes.map((b) => b[1])) - 8);
    const bottom = Math.min(844, Math.max(...boxes.map((b) => b[3])) + 8);
    return { x: 0, y: top, width: 390, height: bottom - top };
  };
  const recolour = (p) =>
    page.addStyleTag({ content: `:root:root { --ink-range: ${p.passage}; --ink-run: ${p.run}; }` });

  const shots = [];
  for (const p of PAIRS) {
    // A passage on its own: 2:255 and the verses either side.
    await page.goto(`${origin}/#/hafs-kfqc/2:255-2:256`);
    await page.locator(`${overlay} .hl-hlt.hl-ink`).first().waitFor({ timeout: 20_000 });
    await recolour(p);
    // On a phone the passage's menu rises from the bottom and lays a dark veil
    // over the page; both are hidden for this picture, so the colour is judged
    // on the paper and not through the veil (the caption says so).
    await page.addStyleTag({ content: '[class*="_scrim_"], [class*="_sheet_"] { display: none !important; }' });
    await page.waitForTimeout(900);
    const passage = join(OUT, `colours-${p.id}-passage.png`);
    await page.screenshot({ path: passage, clip: await clipOf(`${overlay} .hl-hlt.hl-ink`), animations: "disabled" });

    // A run of words over its verse: select 2:256, drop to words, grow the run.
    await page.goto(`${origin}/#/hafs-kfqc/2:256`);
    await page.locator(`${overlay} .hl-sel.hl-ink`).first().waitFor({ timeout: 20_000 });
    await recolour(p);
    // Verses are numbered from the start of the Qur'an: 2:256 is the 263rd.
    await page.locator('svg[aria-labelledby="page-label-42"]:visible #verse-263').focus();
    await page.keyboard.press("Enter");
    await page.locator(`${overlay} .hl-run`).first().waitFor({ timeout: 20_000 });
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
    await page.waitForTimeout(900);
    const run = join(OUT, `colours-${p.id}-run.png`);
    await page.screenshot({ path: run, clip: await clipOf(`${overlay} .hl-sel.hl-ink`), animations: "disabled" });

    const nums = {
      runOverVerse: overVerse(p.run),
      passageOverVerse: overVerse(p.passage),
      passageOnPaper: onPaper(p.passage),
      runOnPaper: onPaper(p.run),
    };
    shots.push({ ...p, passage: passage, run: run, nums });
    console.log(
      `ev=pair id=${p.id} run_over_verse=${nums.runOverVerse.toFixed(2)} passage_over_verse=${nums.passageOverVerse.toFixed(2)} passage_on_paper=${nums.passageOnPaper.toFixed(2)} run_on_paper=${nums.runOnPaper.toFixed(2)}`,
    );
  }

  // Side by side: one row per pair, the passage then the run, the numbers under.
  const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  const mark = (v) => `${v.toFixed(1)} to 1 ${v >= FLOOR ? "✓" : "✗ under 4.5"}`;
  const rows = shots
    .map(
      (s) => `<section><h2>${s.label}</h2><div class="pics">
        <figure><img src="${b64(s.passage)}"><figcaption>A passage on its own, with its menu and the veil behind it hidden. Shows on paper at ${s.nums.passageOnPaper.toFixed(1)} to 1.
          If it ever crossed the verse, letters there: ${mark(s.nums.passageOverVerse)}</figcaption></figure>
        <figure><img src="${b64(s.run)}"><figcaption>A run of words over its verse. Letters where they cross: ${mark(s.nums.runOverVerse)}</figcaption></figure>
      </div></section>`,
    )
    .join("");
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 860, height: 800 });
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;color:#26201a}
    h1{font-size:18px;margin:0 0 4px} p{margin:0 0 12px;color:#555}
    section{margin:0 0 18px} h2{font-size:15px;margin:0 0 6px}
    .pics{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    figure{margin:0} img{width:100%;display:block;border:1px solid #ddd}
    figcaption{font-size:12px;color:#444;margin-top:4px}
  </style><h1>Which two colours should a passage and a run of words take?</h1>
  <p>Page 42 at phone size. The amber verse stays as it is. The reading floor is 4.5 to 1.</p>${rows}`);
  await sheet.screenshot({ path: join(OUT, "colours.png"), fullPage: true });
  console.log(`ev=done sheet=${join(OUT, "colours.png")}`);

  await browser.close();
  server.close();
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

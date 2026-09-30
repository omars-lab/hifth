#!/usr/bin/env node
/**
 * Cut the pictures docs/design/highlight-texture-options-b.md embeds out of the
 * rendered docs/design/highlight-texture-options-b.html, with a real browser,
 * at real size.
 *
 *   docs/design/highlight-texture-options-b/<S1..S5,T1..T4,C1..C6,L1..L3>.png
 *                                   each option's card, in Chromium
 *   docs/design/highlight-texture-options-b/webkit-<id>.png
 *                                   the cards that use a filter or a blend, again in
 *                                   WebKit (Safari's engine) — the combination the
 *                                   research says Safari has got wrong before
 *   docs/design/highlight-texture-options-b/zoom-<id>.png
 *                                   the top of one card's first picture at three times the
 *                                   pixels — where one mark meets the next, which is too
 *                                   small to judge at phone size on a desk screen
 *   docs/design/highlight-texture-options-b/phone.png
 *                                   one card at phone width, to show the crops are phone-size
 *
 * Device scale 1; each file stays well under 1 MB. Playwright is a dependency of
 * apps/web, not the repo root, so it is resolved from there. WebKit is skipped
 * with a note if it is not installed.
 *
 *   node scripts/build-highlight-texture-options-b.mjs
 *   node scripts/shoot-highlight-texture-options-b.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./code-pointers.mjs";

const PAGE = join(ROOT, "docs/design/highlight-texture-options-b.html");
const OUT_DIR = join(ROOT, "docs/design/highlight-texture-options-b");
const ZOOM_CARDS = ["S2", "S3", "T2", "T3", "C2", "C3", "C6"];
const WEBKIT_CARDS = ["S1", "S3", "T2", "T3", "C2", "C5", "C6"];
const die = (msg) => { console.error(`shoot-highlight-texture-options-b: ${msg}`); process.exit(1); };

if (!existsSync(PAGE)) die(`${PAGE} is missing — run scripts/build-highlight-texture-options-b.mjs first`);
mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".png")) unlinkSync(join(OUT_DIR, f));

const require = createRequire(join(ROOT, "apps/web/package.json"));
const { chromium, webkit } = require("@playwright/test");
const report = (file) => console.log(`  ${file} (${(statSync(file).size / 1024).toFixed(0)} KB)`);

async function shoot(engine, ids, prefix, viewport) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(1200); // let every wipe finish so the live cards are shot with their ink down
  const all = await page.$$eval("figure[data-option]", (els) => els.map((e) => e.dataset.option));
  for (const id of ids ?? all) {
    const file = join(OUT_DIR, `${prefix}${id}.png`);
    await page.locator(`figure[data-option="${id}"]`).screenshot({ path: file });
    report(file);
  }
  await browser.close();
}

console.log("shoot-highlight-texture-options-b: cards (chromium)");
await shoot(chromium, null, "", { width: 1200, height: 900 });

console.log("shoot-highlight-texture-options-b: filter and blend cards (webkit)");
if (existsSync(webkit.executablePath())) await shoot(webkit, WEBKIT_CARDS, "webkit-", { width: 1200, height: 900 });
else console.log("  skipped: WebKit is not installed (npx playwright install webkit)");

console.log("shoot-highlight-texture-options-b: zoomed joins (chromium, 3x)");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  for (const id of ZOOM_CARDS) {
    const svg = page.locator(`figure[data-option="${id}"] .pic svg`).first();
    await svg.scrollIntoViewIfNeeded();
    const b = await svg.boundingBox();
    const file = join(OUT_DIR, `zoom-${id}.png`);
    // Lines 2–4 of the crop: where the passage's first verse ends and the verse begins.
    await page.screenshot({ path: file, clip: { x: b.x, y: b.y + b.height * 0.1, width: b.width, height: b.height * 0.3 } });
    report(file);
  }
  await browser.close();
}

console.log("shoot-highlight-texture-options-b: phone");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const file = join(OUT_DIR, "phone.png");
  await page.locator('figure[data-option="C3"]').screenshot({ path: file });
  report(file);
  await browser.close();
}

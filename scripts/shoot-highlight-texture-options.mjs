#!/usr/bin/env node
/**
 * Cut the pictures docs/design/highlight-texture-options.md embeds out of the
 * rendered docs/design/highlight-texture-options.html, with a real browser, at
 * real size.
 *
 *   docs/design/highlight-texture-options/<S1..S2,T1..T3,O1..O5,L1..L3>.png
 *                                   each option's card, in Chromium
 *   docs/design/highlight-texture-options/webkit-<id>.png
 *                                   the cards that use a filter, a mask or a blend, again in
 *                                   WebKit (Safari's engine) — the combinations one engine
 *                                   or the other has got wrong in the checker's repro
 *   docs/design/highlight-texture-options/zoom-<id>.png
 *                                   the rows of one card's first picture where the passage's
 *                                   first verse ends and the verse begins, at three times the
 *                                   pixels — the join is too small to judge at phone size on
 *                                   a desk screen
 *   docs/design/highlight-texture-options/phone.png
 *                                   one card at phone width, to show the crops are phone-size
 *
 * The two screenshots of the real app in the same folder (app-today.png and
 * app-today-close.png, taken with apps/web/e2e/tools/drive.mjs against the
 * built app) are kept: this script only replaces the files it makes.
 *
 * Device scale 1; each file stays well under 1 MB. Playwright is a dependency of
 * apps/web, not the repo root, so it is resolved from there. WebKit is skipped
 * with a note if it is not installed.
 *
 *   node scripts/build-highlight-texture-options.mjs
 *   node scripts/shoot-highlight-texture-options.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./code-pointers.mjs";

const PAGE = join(ROOT, "docs/design/highlight-texture-options.html");
const OUT_DIR = join(ROOT, "docs/design/highlight-texture-options");
const ZOOM_CARDS = ["S2", "T2", "T3", "O1", "O2", "O3", "O4", "O5"];
const WEBKIT_CARDS = ["S2", "T3", "O1", "O4", "O5", "L1"];
const KEEP = /^app-/;
const die = (msg) => { console.error(`shoot-highlight-texture-options: ${msg}`); process.exit(1); };

if (!existsSync(PAGE)) die(`${PAGE} is missing — run scripts/build-highlight-texture-options.mjs first`);
mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".png") && !KEEP.test(f)) unlinkSync(join(OUT_DIR, f));

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

console.log("shoot-highlight-texture-options: cards (chromium)");
await shoot(chromium, null, "", { width: 1200, height: 900 });

console.log("shoot-highlight-texture-options: filter, mask and blend cards (webkit)");
if (existsSync(webkit.executablePath())) await shoot(webkit, WEBKIT_CARDS, "webkit-", { width: 1200, height: 900 });
else console.log("  skipped: WebKit is not installed (npx playwright install webkit)");

console.log("shoot-highlight-texture-options: zoomed joins (chromium, 3x)");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  for (const id of ZOOM_CARDS) {
    // The overlap cards: their middle picture, the verse inside the passage. The rest: their first.
    const nth = /^O/.test(id) ? 1 : 0;
    const svg = page.locator(`figure[data-option="${id}"] .pic svg`).nth(nth);
    await svg.scrollIntoViewIfNeeded();
    const b = await svg.boundingBox();
    const file = join(OUT_DIR, `zoom-${id}.png`);
    // The middle rows of the crop: where one mark meets the next.
    await page.screenshot({ path: file, clip: { x: b.x, y: b.y + b.height * 0.1, width: b.width, height: b.height * 0.3 } });
    report(file);
  }
  await browser.close();
}

console.log("shoot-highlight-texture-options: phone");
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const file = join(OUT_DIR, "phone.png");
  await page.locator('figure[data-option="O3"]').screenshot({ path: file });
  report(file);
  await browser.close();
}

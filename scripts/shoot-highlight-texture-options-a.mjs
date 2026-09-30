#!/usr/bin/env node
/**
 * Cut the pictures docs/design/highlight-texture-options-a.md embeds out of the rendered
 * docs/design/highlight-texture-options-a.html, with a real browser, at real size.
 *
 *   docs/design/highlight-texture-options-a/<id>.png   each option's card (S1-S6, T1-T4, C1-C7, L1, L2, A1, R)
 *   docs/design/highlight-texture-options-a/phone.png  the recommendation's card at phone width,
 *                                                  to show the crops really are phone-size
 *
 * Every crop on the page is already drawn at the width a phone gives the page,
 * so a card's PNG is the card at that size plus its caption. Device scale 1;
 * each file stays well under 1 MB.
 *
 * Playwright is a dependency of apps/web, not the repo root, so it is resolved
 * from there.
 *
 *   node scripts/build-highlight-texture-options-a.mjs
 *   node scripts/shoot-highlight-texture-options-a.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./code-pointers.mjs";

const PAGE = join(ROOT, "docs/design/highlight-texture-options-a.html");
const OUT_DIR = join(ROOT, "docs/design/highlight-texture-options-a");
const die = (msg) => { console.error(`shoot-highlight-texture-options-a: ${msg}`); process.exit(1); };

if (!existsSync(PAGE)) die(`${PAGE} is missing — run scripts/build-highlight-texture-options-a.mjs first`);
mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".png")) unlinkSync(join(OUT_DIR, f));

const require = createRequire(join(ROOT, "apps/web/package.json"));
const { chromium } = require("@playwright/test");

const browser = await chromium.launch();
const report = (file) => console.log(`  ${file} (${(statSync(file).size / 1024).toFixed(0)} KB)`);

console.log("shoot-highlight-texture-options-a: cards");
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(1200); // let the wipes finish so the live cards are shot with their ink down
  for (const id of await page.$$eval("figure[data-option]", (els) => els.map((e) => e.dataset.option))) {
    const file = join(OUT_DIR, `${id}.png`);
    await page.locator(`figure[data-option="${id}"]`).screenshot({ path: file });
    report(file);
  }
  await ctx.close();
}

console.log("shoot-highlight-texture-options-a: phone");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const file = join(OUT_DIR, "phone.png");
  await page.locator('figure[data-option="R"]').screenshot({ path: file });
  report(file);
  await ctx.close();
}
await browser.close();

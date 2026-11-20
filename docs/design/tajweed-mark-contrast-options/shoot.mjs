#!/usr/bin/env node
// Remakes the pictures on the tajweed-mark contrast options page.
//
// Serve the built app first, in another terminal:
//   make build && (cd apps/web && pnpm exec vite preview --port 5796 --strictPort)
// Then, from the repo root:
//   node docs/design/tajweed-mark-contrast-options/shoot.mjs 5796
//
// Each option is a few lines of CSS laid over the real app (nothing in the app
// changes). One picture per option: the mistake picker's "A tajweed rule" row,
// wrapped onto two lines so all seven rules show at once.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.argv[2];
if (!port) throw new Error("usage: shoot.mjs <port the built app is served on>");
const here = dirname(fileURLToPath(import.meta.url));
// Playwright is the web app's own copy, found from its folder.
const { chromium } = createRequire(join(here, "../../../apps/web/package.json"))("@playwright/test");

const WRAP = `[data-part="rule"]{flex:0 0 auto} div:has(> [data-part="rule"]){flex-wrap:wrap!important;overflow:visible!important}`;
// Darker shades, same hue, each the nearest that reaches 4.5 to 1 on the
// picker's buttons (#fbf8f2).
const DARK = { wasl: "#786e61", madd: "#b95200", ghunnah: "#007f5d", idgham: "#b84685" };
const markOnly = (sel) =>
  Object.entries(DARK)
    .map(([id, c]) => `${sel}[data-rule="${id}"] > [aria-hidden="true"]{color:${c}!important}`)
    .join("");

const OPTIONS = {
  "a-today": "",
  "b-madd-darker": `:root{--tj-madd:${DARK.madd}!important}`,
  "c-picker-shades": markOnly("button"),
  "d-ink-and-bar":
    `button[data-rule] > [aria-hidden="true"]{color:var(--ink,#1c1917)!important;` +
    `border-block-end:4px solid;border-color:var(--bar);padding-block-end:2px}` +
    ["wasl", "madd", "ghunnah", "idgham", "qalqalah", "silent", "madd-lazim"]
      .map((id) => `button[data-rule="${id}"] > [aria-hidden="true"]{--bar:var(--tj-${id})}`)
      .join(""),
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "en-US" });
for (const [name, css] of Object.entries(OPTIONS)) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/#/hafs-kfqc/p7`);
  await page.locator('svg[aria-labelledby="page-label-7"]:visible').waitFor();
  await page.addStyleTag({ content: WRAP + css });

  // The mistake picker, opened on verse 2:46 as the accessibility test does.
  await page.keyboard.press("KeyM");
  const verse = page.locator("#verse-46:visible").first();
  await verse.scrollIntoViewIfNeeded();
  const box = await verse.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("dialog", { name: /^What went wrong in / }).waitFor();
  const row = page.locator('div:has(> [data-part="rule"])').first();
  await row.screenshot({ path: join(here, `${name}-picker.png`) });
  await page.close();
  console.log(`wrote ${name}`);
}
await browser.close();

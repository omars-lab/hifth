import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * hifth.app's own pages (apps/landing/): the front page, the privacy page and the
 * "no page here" page. They are plain HTML with one shared stylesheet, so each is
 * loaded here with its stylesheet inlined and its outside scripts left out, at a
 * phone's width.
 *
 * Written 2026-11-11 after the "no page here" page, seen at 390 px, ran its text
 * against the left edge of the screen: the shared `.prose` rule set the side
 * padding to 0, which took the privacy page's margin away too. Watched failing
 * before the stylesheet was fixed.
 */
const LANDING = fileURLToPath(new URL("../../landing/", import.meta.url));
const CSS = readFileSync(`${LANDING}styles.css`, "utf8");
const PAGES = ["index.html", "privacy.html", "404.html"];
const GUTTER = 16;
const WIDTH = 390;

function standalone(file: string): string {
  return readFileSync(`${LANDING}${file}`, "utf8")
    .replace(/<link rel="stylesheet"[^>]*>/, `<style>${CSS}</style>`)
    .replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, "")
    .replace(/<link rel="icon"[^>]*>/, "");
}

for (const file of PAGES) {
  test(`${file} keeps its text off the screen's edge at phone width`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 844 });
    await page.setContent(standalone(file));
    const boxes = await page.locator("main h1, main h2, main p, main li, main form").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent ?? "").trim().slice(0, 40), left: r.left, right: r.right };
      }),
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect.soft(box.left, `"${box.text}" starts too near the left edge`).toBeGreaterThanOrEqual(GUTTER - 0.5);
      expect.soft(box.right, `"${box.text}" ends too near the right edge`).toBeLessThanOrEqual(WIDTH - GUTTER + 0.5);
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll, "the page scrolls sideways").toBeLessThanOrEqual(WIDTH);
  });
}

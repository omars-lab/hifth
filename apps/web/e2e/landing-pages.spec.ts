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

/*
 * The front page's "where it runs" part shows one device's panel at a time, picked
 * with a row of radio buttons; the others are not drawn, so they have no size and
 * read as sitting at the very edge. Each device is picked in turn and only what is
 * drawn is measured, so every panel's text is checked once it is the one on show.
 * (2026-11-13: the first push after the panels arrived failed on exactly that.)
 */
for (const file of PAGES) {
  test(`${file} keeps its text off the screen's edge at phone width`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 844 });
    await page.setContent(standalone(file));
    const devices = await page.locator('input[type="radio"][name="device"]').evaluateAll((els) => els.map((el) => el.id));
    const measured = new Set<string>();
    for (const device of devices.length > 0 ? devices : [null]) {
      if (device) await page.locator(`#${device}`).check({ force: true });
      const boxes = await page.locator("main h1, main h2, main p, main li, main form").evaluateAll((els) =>
        els.flatMap((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return [];
          return [{ text: (el.textContent ?? "").trim().slice(0, 40), left: r.left, right: r.right }];
        }),
      );
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        measured.add(box.text);
        const where = device ? ` (with ${device} picked)` : "";
        expect.soft(box.left, `"${box.text}" starts too near the left edge${where}`).toBeGreaterThanOrEqual(GUTTER - 0.5);
        expect.soft(box.right, `"${box.text}" ends too near the right edge${where}`).toBeLessThanOrEqual(WIDTH - GUTTER + 0.5);
      }
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scroll, `the page scrolls sideways${device ? ` with ${device} picked` : ""}`).toBeLessThanOrEqual(WIDTH);
    }
    // Every panel was drawn at least once, so none of their text went unmeasured.
    const unseen = await page.locator(".device-panel p").evaluateAll(
      (els, seen) => els.map((el) => (el.textContent ?? "").trim().slice(0, 40)).filter((t) => !seen.includes(t)),
      [...measured],
    );
    expect(unseen, "text in a device panel that was never on show").toEqual([]);
  });
}

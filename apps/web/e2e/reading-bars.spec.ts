import { test, expect, type Page } from "@playwright/test";
import { READING_BARS_KEY, BARS_HIDE_MS } from "../src/reading-bars";

/*
 * The bars hide while reading (docs/design/app-layout.md, item ⑪): a rough
 * build behind a setting, off by default. After a few quiet seconds the bars
 * leave; a tap brings them back; they stay while a pen is in hand. The clock
 * is the test's own, so nothing here waits real seconds.
 */

test.use({ locale: "en-US", viewport: { width: 1280, height: 800 } });

const LEAF = 'svg[aria-labelledby="page-label-7"]';
const QUIET = BARS_HIDE_MS + 1500;

async function open(page: Page, hide: boolean): Promise<void> {
  if (hide) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: READING_BARS_KEY, value: "hide" });
  await page.clock.install();
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(LEAF)).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
}

test("the bars stay until the reader asks for them to hide", async ({ page }) => {
  await open(page, false);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeVisible();
});

test("after a few quiet seconds the bars leave, and a tap brings them back", async ({ page }) => {
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeHidden();

  // A tap on the edge of the window, off the book.
  await page.mouse.click(12, 400);
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeVisible();
});

test("turning the page with the bars away does not bring them back", async ({ page }) => {
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header")).toBeHidden();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeHidden();
  await expect(page.locator("header")).toBeHidden();
  // A drag is not a tap either.
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.mouse.move(520, 300, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("header")).toBeHidden();
});

test("the bars stay while a pen is in hand", async ({ page }) => {
  await open(page, true);
  await page.getByRole("radio", { name: "Highlight", exact: true }).first().click();
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header")).toBeVisible();
});

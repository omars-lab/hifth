import { test, expect, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { READING_BARS_KEY, BARS_HIDE_MS } from "../src/reading-bars";
import { SLIDER_BACK_KEY } from "../src/slider-back";

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
  await expect(page.locator("header").first()).toBeVisible();
}

test("the bars stay until the reader asks for them to hide", async ({ page }) => {
  await open(page, false);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeVisible();
});

test("after a few quiet seconds the bars leave, and a tap brings them back", async ({ page }) => {
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeHidden();

  // A tap on the edge of the window, off the book.
  await page.mouse.click(12, 400);
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page bar" })).toBeVisible();
});

test("turning the page with the bars away does not bring them back", async ({ page }) => {
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeHidden();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeHidden();
  await expect(page.locator("header").first()).toBeHidden();
  // A drag is not a tap either.
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.mouse.move(520, 300, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("header").first()).toBeHidden();
});

test("a tap on a verse in the middle of the page brings the bars back, and still chooses the verse", async ({ page }) => {
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeHidden();
  const at = await ayahTarget(page, "#verse-45:visible");
  await page.mouse.click(at.x, at.y);
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.getByRole("region", { name: /^Tools for / })).toBeVisible();
  // A verse is chosen now, so the bars stay.
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeVisible();
});

test("on a phone, a finger's tap on a verse brings the bars back", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await open(page, true);
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeHidden();
  const at = await ayahTarget(page, "#verse-45:visible");
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.locator("header").first()).toBeVisible();
  // The Back button fits beside the slider at this width.
  await page.evaluate((key) => localStorage.setItem(key, "on"), SLIDER_BACK_KEY);
  await page.reload();
  const back = (await page.locator("[data-slider-back]").boundingBox())!;
  expect(back.x).toBeGreaterThanOrEqual(0);
  expect(back.x + back.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

for (const panel of [
  { name: "the info panel", open: (page: Page) => page.getByRole("button", { name: /About Hifth/ }).click() },
  { name: "Go to", open: (page: Page) => page.keyboard.press("/") },
]) {
  test(`the bars stay while ${panel.name} is open`, async ({ page }) => {
    await open(page, true);
    await panel.open(page);
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.clock.fastForward(QUIET);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.getByRole("dialog").first()).toBeVisible();
  });
}

test("the bars stay while a pen is in hand", async ({ page }) => {
  await open(page, true);
  await page.getByRole("radio", { name: "Highlight", exact: true }).first().click();
  await page.clock.fastForward(QUIET);
  await expect(page.locator("header").first()).toBeVisible();
});

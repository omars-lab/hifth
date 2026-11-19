import { test, expect, type Locator, type Page } from "@playwright/test";
import { pageNumber } from "./page-number";
import { SLIDER_BACK_KEY } from "../src/slider-back";

/*
 * A Back button beside the page slider (docs/design/app-layout.md, item ②): a
 * rough build behind a setting, off by default. After a jump it returns to the
 * page the reader left; a second jump does not lose that page; a page turn is
 * not a jump.
 */

test.use({ locale: "en-US", viewport: { width: 1280, height: 800 } });

const NUM = "header .numeric";
const back = (page: Page): Locator => page.locator("[data-slider-back]");
const marker = (page: Page, n: number): Locator => page.locator(`[data-testid='juz-detent'][data-juz='${n}']`);
// A jump by a juz marker, for the tests here, which are about Back and not about
// pointing. A pointer sent to the marker wakes the bar's magnifier, which slides
// the marker out from under it, and the click then lands on the bar beside it
// (measured 2026-11-18 in Firefox: 1 run in 30, and twice in a row in one push).
// So the click is sent to the marker itself. Pointing at a marker under the
// magnifier is its own fault, on the backlog (pagebar-fisheye-marker-flees).
const juz = (page: Page, n: number) => ({ click: () => marker(page, n).dispatchEvent("click") });

async function open(page: Page, on: boolean): Promise<void> {
  if (on) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SLIDER_BACK_KEY, value: "on" });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(NUM)).toHaveText(pageNumber(7));
  // And until the opening link has drawn page 7. The header reads 7 before the
  // pages have loaded, and the markers appear with them: a press sent the
  // instant they appear lands before the link has put the reader on 7, and the
  // link then puts them back (the iPhone run, 6 times in 40, 2026-11-19). A
  // finger cannot beat it; a test can.
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
}

test("the button is not there until the reader switches it on", async ({ page }) => {
  await open(page, false);
  await expect(back(page)).toHaveCount(0);
});

test("with nowhere to go back to, the button is there and greyed out", async ({ page }) => {
  await open(page, true);
  await expect(back(page)).toBeVisible();
  await expect(back(page)).toBeDisabled();
});

test("after a jump, Back returns to the page the reader left, and a second jump does not lose it", async ({ page }) => {
  await open(page, true);
  await juz(page, 3).click();
  await expect(page.locator(NUM)).toHaveText(pageNumber(42));
  await expect(back(page)).toBeEnabled();
  await expect(back(page)).toHaveAccessibleName("Back to page 7");

  await juz(page, 30).click();
  await expect(page.locator(NUM)).toHaveText(pageNumber(582));
  await expect(back(page)).toHaveAccessibleName("Back to page 7");

  await back(page).click();
  await expect(page.locator(NUM)).toHaveText(pageNumber(7));
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
  await expect(back(page)).toBeDisabled();
});

test("a page turn is not a jump", async ({ page }) => {
  await open(page, true);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(NUM)).not.toHaveText(pageNumber(7));
  await expect(back(page)).toBeDisabled();
});

test("the button does not change the slider's length when a page appears on it", async ({ page }) => {
  await open(page, true);
  const slider = page.getByRole("slider");
  const before = (await slider.boundingBox())!.width;
  await juz(page, 3).click();
  await expect(back(page)).toBeEnabled();
  expect((await slider.boundingBox())!.width).toBe(before);
});

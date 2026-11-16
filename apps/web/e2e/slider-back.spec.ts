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
const juz = (page: Page, n: number): Locator => page.locator(`[data-testid='juz-detent'][data-juz='${n}']`);

async function open(page: Page, on: boolean): Promise<void> {
  if (on) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SLIDER_BACK_KEY, value: "on" });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(NUM)).toHaveText(pageNumber(7));
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

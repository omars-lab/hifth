import { test, expect, type Page } from "@playwright/test";

/*
 * An Escape pressed the moment a sheet appears closes it.
 *
 * Each sheet used to take the keyboard one step after it was drawn. In that
 * gap a key fell on the page, where every Escape steps aside while a sheet is
 * open, so it did nothing: the about box failed this way 1 run in 50 on a
 * phone (docs/issues/preact-swap.md). Here the Escape is pressed inside the
 * same task the sheet is added to the page, before any frame, to wherever the
 * keyboard is at that moment.
 */

/** Press Escape on whatever holds the keyboard, as soon as a dialog with this name is added. */
async function escapeOnArrival(page: Page, name: string): Promise<void> {
  await page.evaluate((label) => {
    new MutationObserver((_, watch) => {
      if (!document.querySelector(`[role="dialog"][aria-label="${label}"]`)) return;
      watch.disconnect();
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    }).observe(document.body, { childList: true, subtree: true });
  }, name);
}

const SHEETS: readonly { readonly what: string; readonly name: string; readonly open: (page: Page) => Promise<void> }[] = [
  {
    what: "the about box",
    name: "عن حِفظ",
    open: (page) => page.getByRole("button", { name: /عن حِفظ/ }).click(),
  },
  {
    what: "the go-to box",
    name: "اذهب إلى",
    open: (page) => page.keyboard.press("/"),
  },
  {
    what: "the mushaf picker",
    name: "المصحف",
    open: (page) => page.getByRole("button", { name: "المصحف", exact: true }).click(),
  },
];

test.describe("Hifth · an Escape pressed as a sheet appears", () => {
  for (const sheet of SHEETS) {
    test(`closes ${sheet.what}`, async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await escapeOnArrival(page, sheet.name);
      await sheet.open(page);
      await page.waitForTimeout(400);
      await expect(page.getByRole("dialog", { name: sheet.name, exact: true })).toHaveCount(0);
    });
  }
});

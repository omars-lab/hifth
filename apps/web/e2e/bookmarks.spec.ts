import { test, expect, type Page } from "@playwright/test";

/*
 * Bookmarks, against a real build (docs/decisions/bookmark-fold.md and
 * bookmark-admin.md). The unit tests prove the rules and the store; these prove
 * the journey — fold a corner, name the ribbon, see it survive a reload, and
 * clear it from the page map only after the page map has asked.
 *
 * In English because the ribbon's name is the reader's own words, and a test
 * that types one is easier to read in the language it was typed in.
 */
test.use({ locale: "en-US" });

const SHOTS = process.env.BOOKMARK_SHOTS;

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
}

async function openMap(page: Page) {
  await page.getByRole("button", { name: /what you have opened/ }).click();
  const sheet = page.getByRole("dialog", { name: "What you have opened" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("Hifth · bookmarks", () => {
  test("a folded corner drops a named ribbon that is still there after a reload", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Name").fill("Morning review");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer.png` });
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();

    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/ribbon.png` });

    // Its drawer carries its history: dropped, then renamed.
    await page.getByRole("button", { name: "Bookmark: Morning review" }).click();
    await expect(drawer.getByRole("listitem")).toHaveCount(2);
    await drawer.getByRole("button", { name: "Lift this bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toHaveCount(0);
  });

  test("clearing all from the page map asks first, and names the count", async ({ page }) => {
    await ready(page);
    const fold = page.getByRole("button", { name: "Drop a bookmark on this page" }).first();
    for (let i = 0; i < 2; i++) {
      await fold.click();
      await page.getByRole("dialog", { name: "Bookmark" }).getByRole("button", { name: "Close" }).click();
    }

    const sheet = await openMap(page);
    await expect(sheet.getByText("2 bookmarks", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Clear all…" }).click();
    const ask = sheet.getByRole("alertdialog", { name: "Clear all 2 bookmarks?" });
    await expect(ask).toBeVisible();
    if (SHOTS) {
      await ask.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/confirm.png` });
    }

    // Cancel keeps everything.
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet.getByText("2 bookmarks", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "Clear all…" }).click();
    await sheet.getByRole("alertdialog").getByRole("button", { name: "Clear", exact: true }).click();
    await expect(sheet.getByText(/^No bookmarks yet/)).toBeVisible();
  });
});

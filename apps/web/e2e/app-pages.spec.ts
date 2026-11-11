import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { APP_PAGES_KEY } from "../src/app-pages";

/*
 * Page icons along the bottom (docs/design/app-pages.md ①). The owner asked, on
 * the app's page on 2026-11-07, for a row of page icons like a Mac app's, with
 * the mushaf as the default page and settings as a page of their own. It is a
 * setting, off until the owner has tried it.
 *
 * Written before the build (2026-11-11) and watched failing: the setting and
 * the row did not exist.
 */
test.use({ locale: "en-US" });

async function openWith(page: Page, seed: Record<string, string> = {}): Promise<void> {
  await page.addInitScript(
    ([coach, values]) => {
      try {
        localStorage.setItem(coach, "1");
        if (!localStorage.getItem("app-pages-seeded")) {
          for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
          localStorage.setItem("app-pages-seeded", "1");
        }
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, seed] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
}

const row = (page: Page): Locator => page.getByRole("navigation", { name: "Pages of the app" });
const icon = (page: Page, name: string): Locator => row(page).getByRole("button", { name, exact: true });
const settings = (page: Page): Locator => page.getByRole("dialog", { name: "Settings" });

test.describe("Hifth · page icons along the bottom", () => {
  test("by default there is no row of page icons", async ({ page }) => {
    await openWith(page);
    await expect(row(page)).toHaveCount(0);
  });

  test("switched on, the row shows the mushaf and settings, and no developer page in a real build", async ({ page }) => {
    await openWith(page, { [APP_PAGES_KEY]: "row" });
    await expect(row(page)).toBeVisible();
    await expect(icon(page, "Mus'haf")).toHaveAttribute("aria-current", "page");
    await expect(icon(page, "Settings")).not.toHaveAttribute("aria-current", "page");
    await expect(row(page).getByRole("button")).toHaveCount(2);
    // The row is the lowest thing on the screen and fits inside it.
    const box = await row(page).boundingBox();
    const view = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThanOrEqual(view.height + 1);
    expect(box!.width).toBeLessThanOrEqual(view.width + 1);
  });

  test("settings open as a page of their own, with the switches and not the licence", async ({ page }) => {
    await openWith(page, { [APP_PAGES_KEY]: "row" });
    await icon(page, "Settings").click();
    await expect(icon(page, "Settings")).toHaveAttribute("aria-current", "page");
    const s = settings(page);
    await expect(s).toBeVisible();
    await expect(s.getByRole("radiogroup", { name: "Language" })).toBeVisible();
    await expect(s.getByRole("heading", { name: "Sources" })).toHaveCount(0);
    // It fills the screen down to the row, and the row stays in reach under it.
    const sheet = (await s.boundingBox())!;
    const nav = (await row(page).boundingBox())!;
    expect(sheet.y).toBeLessThanOrEqual(1);
    // Side to side too: on a wide screen the info panel is a narrow card, a page is not.
    expect(Math.abs(sheet.width - page.viewportSize()!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(sheet.y + sheet.height - nav.y)).toBeLessThanOrEqual(2);
    await icon(page, "Mus'haf").click();
    await expect(s).toHaveCount(0);
    await expect(icon(page, "Mus'haf")).toHaveAttribute("aria-current", "page");
  });

  test("going to settings and back leaves the mushaf as it was", async ({ page, isMobile }) => {
    await openWith(page, { [APP_PAGES_KEY]: "row" });
    const leaf = page.locator("svg[aria-labelledby='page-label-7']:visible");
    // The same drawing must come back, not a fresh one: a mark only this one carries.
    await leaf.evaluate((el) => ((el as unknown as { kept: boolean }).kept = true));
    if (!isMobile) await page.locator("header").first().getByRole("button", { name: /zoom in/i }).click();
    const width = (await leaf.boundingBox())!.width;
    await icon(page, "Settings").click();
    await expect(settings(page)).toBeVisible();
    // The page-turn keys belong to the settings page while it is up.
    // One press, then time for a turn to finish if one had started.
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(900);
    expect(page.url()).toContain("/p7");
    await page.keyboard.press("Escape");
    await expect(settings(page)).toHaveCount(0);
    await expect(leaf).toBeVisible();
    expect(await leaf.evaluate((el) => (el as unknown as { kept?: boolean }).kept === true)).toBe(true);
    expect(Math.abs((await leaf.boundingBox())!.width - width)).toBeLessThanOrEqual(1);
    expect(page.url()).toContain("/p7");
  });

  test("the info panel switches the row on", async ({ page }) => {
    await openWith(page);
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const group = page.getByRole("radiogroup", { name: "Page icons along the bottom" });
    await expect(group.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
    await group.getByRole("radio", { name: "On" }).click();
    await expect(row(page)).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), APP_PAGES_KEY)).toBe("row");
  });
});

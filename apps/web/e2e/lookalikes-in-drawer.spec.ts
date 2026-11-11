import { test, expect, type Locator, type Page } from "@playwright/test";
import { DRAWER_TOOLS_KEY } from "../src/drawer-tools";

/*
 * A verse's look-alikes inside its drawer, in three sections (the owner's
 * comments on the drawer page, 2026-11-07): the same surah, earlier surahs and
 * later surahs, each saying so when it has none, and no chips opening a card of
 * their own. Built under the setting that puts a verse's tools in its drawer;
 * the chips and their card stay the default.
 *
 * Written before the build (2026-11-10) and watched failing: the drawer had no
 * look-alikes in it and the chips were still on the page.
 */

test.use({ locale: "en-US" });

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });
const looks = (page: Page): Locator => drawer(page).getByRole("region", { name: /^Look-alikes · / });
const section = (page: Page, title: string): Locator =>
  looks(page).getByRole("group", { name: new RegExp(`^${title}`) });

for (const size of [
  { name: "a laptop", width: 1440, height: 900 },
  { name: "an iPad on its side", width: 1180, height: 820 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("with the setting on, a verse's look-alikes are three sections in its drawer, and no chips", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
      await page.goto("/#/hafs-kfqc/2:48");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });

      await expect(looks(page)).toBeVisible({ timeout: 10_000 });
      for (const title of ["Similar in this surah", "In earlier surahs", "In later surahs"])
        await expect(section(page, title)).toBeVisible();
      // 2:48's passage twin later in al-Baqarah is listed under this surah.
      await expect(section(page, "Similar in this surah").getByRole("button", { name: /2:123/ }).first()).toBeAttached();
      // Nothing comes before al-Baqarah but al-Fatihah: that section says it has none.
      await expect(section(page, "In earlier surahs")).toContainText("None");

      // No chips on the page, and no card opened for the list.
      await expect(page.getByRole("group", { name: "Links from this ayah" })).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("with the setting on, opening a tool folds the look-alikes away, and folding it brings them back", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
      await page.goto("/#/hafs-kfqc/2:48");
      await expect(looks(page)).toBeVisible({ timeout: 20_000 });
      const roots = drawer(page).getByRole("button", { name: /^Same roots · / });
      await roots.click();
      await expect(drawer(page).getByRole("region", { name: /^Roots · / })).toBeVisible();
      await expect(looks(page)).toHaveCount(0);
      await roots.click();
      await expect(looks(page)).toBeVisible();
    });
  });
}

test("by default the chips stay, and the drawer has no look-alikes in it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hafs-kfqc/2:48");
  await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("group", { name: "Links from this ayah" }).first()).toBeVisible();
  await expect(looks(page)).toHaveCount(0);
});

test("with the setting on, the look-alikes' ✕ folds them for this verse, and the next verse brings them back", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
  await page.goto("/#/hafs-kfqc/2:48");
  await expect(looks(page)).toBeVisible({ timeout: 20_000 });
  await looks(page).getByRole("button", { name: "Close" }).first().click();
  await expect(looks(page)).toHaveCount(0);
  await expect(drawer(page)).toBeVisible();
  await page.evaluate(() => (location.hash = "#/hafs-kfqc/2:123"));
  await expect(drawer(page)).toHaveAccessibleName(/2:123/, { timeout: 10_000 });
  await expect(looks(page)).toBeVisible({ timeout: 10_000 });
});

test("with the setting on, a link that opens the look-alikes lands in the drawer, not on a card", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
  await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
  await expect(looks(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

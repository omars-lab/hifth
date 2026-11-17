import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

/*
 * The steps the App Store review notes give Apple's reviewer
 * (docs/design/store-listing.md, "How to try it"), walked as written.
 *
 * Written 2026-11-17, after walking the store build as a reviewer would: the
 * old steps said "tap any verse, a row of links appears under it", which is
 * not what an iPad shows. A reviewer who cannot follow the notes turns the app
 * down as broken. So the notes now name an exact page, verse and button, and
 * this test fails the day any of them changes, before the notes go out stale.
 *
 * It runs in the iphone run (WebKit, the iPad's own engine) and the android
 * run, each at an iPad-sized screen set below; the ipad run takes only its own
 * file. The record of which file runs where (gate:e2e-runs) says so.
 */

test.use({
  locale: "en-US",
  viewport: { width: 1024, height: 1366 },
  hasTouch: true,
  isMobile: true,
});

test("the review notes' steps work as written on an iPad", async ({ page }) => {
  // 1. A first open, with nothing saved, is page 7, in the device's language.
  await page.goto("/");
  await expect(page).toHaveURL(/#\/hafs-kfqc\/p7$/, { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // 2. Tap verse 40 of al-Baqarah (#verse-47 counts from 1:1).
  await tapAyah(page, "#verse-47:visible");
  await expect(page).toHaveURL(/#\/hafs-kfqc\/2:40/);

  // 3. The "≈ 2" button: two verses in this chapter read almost the same.
  const similar = page.getByRole("button", { name: "Similar verses in this surah · 2" });
  await expect(similar).toBeVisible({ timeout: 10_000 });
  await expect(similar).toContainText("2");
  await similar.click();
  const list = page.getByRole("dialog", { name: /^Similar in this surah/ });
  await expect(list).toBeVisible();
  await expect(list.getByRole("button", { name: "Hop to Al-Baqarah · 2:47" })).toBeVisible();
  await expect(list.getByRole("button", { name: "Hop to Al-Baqarah · 2:122" })).toBeVisible();

  // 4. "Hop to" turns to that verse.
  await list.getByRole("button", { name: "Hop to Al-Baqarah · 2:47" }).click();
  await expect(page).toHaveURL(/#\/hafs-kfqc\/2:47/);
});

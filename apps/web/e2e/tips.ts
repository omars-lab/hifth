import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Open the three tips the way a reader now has to: from the button in settings.
 *
 * They used to open by themselves on a device's first visit. Since 2026-09-25
 * (the owner's call) a first open goes straight to the page, and the tips wait
 * behind the wordmark's sheet. Returns the strip, already on screen.
 */
export async function openTips(page: Page): Promise<Locator> {
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await page.getByRole("button", { name: /عن حِفظ/ }).click();
  const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
  await sheet.getByRole("button", { name: "عرض الإرشادات" }).click();
  await expect(sheet).toHaveCount(0);
  const strip = page.getByRole("region", { name: "كيف تتنقّل" });
  await expect(strip).toBeVisible();
  return strip;
}

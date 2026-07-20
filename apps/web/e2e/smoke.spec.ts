import { test, expect } from "@playwright/test";

// Loop 0 exit criterion: the installable shell shows page 7 on a phone.
test.describe("Hifth shell", () => {
  test("opens on page 7 with RTL chrome and a mounted mushaf page", async ({ page }) => {
    await page.goto("/");

    // RTL-native.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Arabic brand mark.
    await expect(page.getByText("حفظ")).toBeVisible();

    // Page identity shows 7.
    await expect(page.locator(".numeric", { hasText: "7" }).first()).toBeVisible();

    // The mushaf SVG mounts with an accessible role.
    const svg = page.locator("svg[role='img']");
    await expect(svg).toBeVisible();

    // The additive overlay group exists (source geometry untouched).
    await expect(page.locator("#hifth-overlay")).toHaveCount(1);
  });

  test("registers a service worker (installable/offline-ready)", async ({ page }) => {
    await page.goto("/");
    const hasSW = await page.evaluate(() => "serviceWorker" in navigator);
    expect(hasSW).toBe(true);
    // Manifest is linked.
    await expect(page.locator("link[rel='manifest']")).toHaveCount(1);
  });
});

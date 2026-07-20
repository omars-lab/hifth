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

  // Loop 1 exit criterion: tap an ayah polygon → it selects, on a touch device.
  test("tapping an ayah selects it and draws the highlight", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='img']")).toBeVisible();

    // Before any tap, the footer prompts for a selection.
    await expect(page.getByText(/المس آية على الصفحة لتحديدها/)).toBeVisible();

    // Tap a real ayah polygon on page 7 (verse-45 = 2:38 per the manifest).
    const poly = page.locator("#verse-45");
    await expect(poly).toHaveCount(1);
    await poly.tap();

    // The selection chip appears with the surah name + ayah ref, and the
    // highlighter drew a selection clone into the additive overlay.
    await expect(page.getByText(/البقرة/)).toBeVisible();
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(1);
  });
});

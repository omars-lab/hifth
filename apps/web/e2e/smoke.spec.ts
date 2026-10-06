import { test, expect } from "@playwright/test";
import { pageNumber } from "./page-number";

// Loop 0 exit criterion: the installable shell shows page 7 on a phone.
test.describe("Hifth shell", () => {
  test("opens on page 7 with RTL chrome and a mounted mushaf page", async ({ page }) => {
    await page.goto("/");

    // RTL-native.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Arabic brand mark. Scoped to the chrome and matched exactly: "حفظ" is the
    // app's name, so it recurs in body copy (the install notice reads
    // "ثبّت حفظ ليبقى معك دون إنترنت"), and an unscoped substring match is a
    // strict-mode violation the moment any such string renders.
    await expect(
      page.getByRole("banner").getByText("حفظ", { exact: true }),
    ).toBeVisible();

    // Page identity shows 7.
    await expect(page.locator(".numeric", { hasText: pageNumber(7) }).first()).toBeVisible();

    // The mushaf SVG mounts with an accessible role.
    const svg = page.locator("svg[role='group']");
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
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // Before any tap, the footer prompts for a selection.
    await expect(page.getByText(/المس آية على الصفحة لتحديدها/)).toBeVisible();

    // Tap a real ayah polygon on page 7 (verse-45 = 2:38 per the manifest).
    const poly = page.locator("#verse-45");
    await expect(poly).toHaveCount(1);
    await poly.tap();

    // The selection chip appears with the surah name + ayah ref, and the
    // highlighter drew the mark into the additive overlay.
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة، ٢:٣٨/ }),
    ).toBeVisible();
    // One marker band per line the ayah occupies — 2:38 runs across two on
    // page 7. Not asserted as a bare count: `toHaveCount(1)` passed here for
    // six loops and would pass again on a single hairline outline, which is
    // what a mis-styled fallback renders as. A rough band inside each inked
    // group is the claim worth making.
    const swipes = page.locator("#hifth-overlay .hl-sel");
    await expect(swipes).toHaveCount(2);
    await expect(swipes.locator("path.hl-band")).toHaveCount(2);
    await expect(page.locator("#hifth-overlay .hl-sel.hl-ink")).toHaveCount(2);
  });

  test("the opening pages' hand-drawn verses get the marker too, not a ring", async ({ page }) => {
    // Pages 1 and 2 draw each ayah as one leaning outline, not a run of line
    // boxes; until the pen learned to read them, 1:7 showed the faint fallback
    // ring on the demo's first page. It runs across three lines there.
    await page.goto("/#/hafs-kfqc/1:7");
    const overlay = page.locator('svg[aria-labelledby="page-label-1"]:visible #hifth-overlay');
    await expect(overlay.locator(".hl-sel.hl-ink")).toHaveCount(3, { timeout: 20_000 });
    await expect(overlay.locator(".hl-sel:not(.hl-ink)")).toHaveCount(0);
  });
});

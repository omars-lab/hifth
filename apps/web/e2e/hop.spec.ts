import { test, expect } from "@playwright/test";

// Loop 2 exit criterion (PLAN §Loop 2):
//   tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed.
// 2:48 is verse-55 on page 7; 2:123 is verse-130 on page 19. Both are vendored.
test.describe("Hifth · the hop", () => {
  test("tap 2:48 → rail → popover → cross-page hop to 2:123 → bead back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // 1. Tap 2:48 on page 7.
    const ayah = page.locator("#verse-55");
    await expect(ayah).toHaveCount(1);
    await ayah.tap();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();

    // 2. The hop rail appears with at least the same-surah loop chip (↻).
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    const loopChip = rail.getByRole("button", { name: /متشابهات في السورة/ });
    await expect(loopChip).toBeVisible();

    // 3. Open its popover; the 2:123 hop row is listed and enabled (vendored).
    await loopChip.tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const hopBtn = sheet.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ });
    await expect(hopBtn).toBeEnabled();

    // 4. Hop — cross-page to page 19. The page id updates and 2:123 becomes
    //    current (its selection highlight lands on the newly mounted page).
    await hopBtn.tap();
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
    ).toBeVisible();
    // the origin 2:48 kept its breadcrumb (still on the mounted page 7).
    await expect(page.locator("#hifth-overlay .hl-crumb")).not.toHaveCount(0);

    // 5. A trail bead for the origin (2:48) is threaded; tap it to rewind.
    const bead = page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ });
    await expect(bead).toBeVisible();
    await bead.tap();

    // Back on page 7 with 2:48 current again — same code path as a forward hop.
    await expect(page.locator("header .numeric")).toHaveText("7");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();
  });

  test("un-vendored hop targets are surfaced but disabled (no ghost pages)", async ({ page }) => {
    // 2:120 on page 19 is the one ayah in the vendored corpus whose chips are
    // *entirely* dead ends: ↻ holds only 2:145 (page 22) and ▶ only 13:37
    // (page 254), neither vendored until Loop 4b. Two chips, so this covers the
    // rail's promise across buckets rather than depth inside one sheet — the
    // 47.8%-wrong corpus this used to lean on is gone, and with it any bucket
    // that had three dead ends in it.
    await page.goto("/#/hafs-kfqc/2:120");
    // Both dead-end pages stay unmounted, but 2:145's page 22 does not — a hop
    // target keeps its page warm. Name page 19 rather than taking `.first()`,
    // which resolves to whichever <svg> is first in the DOM, warm or visible.
    await expect(page.locator('svg[aria-labelledby="page-label-19"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٠/ }),
    ).toBeVisible();

    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();

    for (const chipName of [/متشابهات في السورة/, /سور لاحقة/]) {
      const chip = rail.getByRole("button", { name: chipName });
      await expect(chip).toBeVisible();
      await chip.tap();

      const sheet = page.getByRole("dialog");
      // Every link is shown, but every leap is disabled — honest dead-end notes.
      const hopBtns = sheet.getByRole("button", { name: /انتقل إلى/ });
      await expect(hopBtns.first()).toBeVisible();
      const count = await hopBtns.count();
      for (let i = 0; i < count; i++) {
        await expect(hopBtns.nth(i)).toBeDisabled();
      }
      await expect(sheet.getByText(/غير متوفّرة بعد/).first()).toBeVisible();

      await sheet.getByRole("button", { name: "إغلاق" }).tap();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
});

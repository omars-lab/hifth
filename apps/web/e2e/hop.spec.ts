import { test, expect } from "@playwright/test";

// Loop 2 exit criterion (PLAN §Loop 2):
//   tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed.
// 2:48 is verse-55 on page 7; 2:123 is verse-130 on page 19. Both are vendored.
test.describe("Hifth · the hop", () => {
  test("tap 2:48 → rail → popover → cross-page hop to 2:123 → bead back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='img']")).toBeVisible();

    // 1. Tap 2:48 on page 7.
    const ayah = page.locator("#verse-55");
    await expect(ayah).toHaveCount(1);
    await ayah.tap();
    await expect(page.getByText(/البقرة · ٢:٤٨/)).toBeVisible();

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
    await expect(page.locator(".numeric", { hasText: "19" }).first()).toBeVisible();
    await expect(page.getByText(/البقرة · ٢:١٢٣/)).toBeVisible();
    // page 19 is now mounted and carries verse-130.
    await expect(page.locator("#verse-130")).toHaveCount(1);
    // the origin 2:48 kept its breadcrumb (still on the mounted page 7).
    await expect(page.locator("#hifth-overlay .hl-crumb")).not.toHaveCount(0);

    // 5. A trail bead for the origin (2:48) is threaded; tap it to rewind.
    const bead = page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ });
    await expect(bead).toBeVisible();
    await bead.tap();

    // Back on page 7 with 2:48 current again — same code path as a forward hop.
    await expect(page.locator(".numeric", { hasText: "7" }).first()).toBeVisible();
    await expect(page.getByText(/البقرة · ٢:٤٨/)).toBeVisible();
  });

  test("an un-vendored hop target is surfaced but disabled (no ghost page)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='img']")).toBeVisible();

    // 2:48 → 82:19 is a related-meaning edge on page 587, which is NOT vendored.
    await page.locator("#verse-55").tap();
    const rail = page.getByRole("group", { name: "روابط الآية" });
    // The "later surahs" chip (▶) carries the 82:19 related edge.
    const laterChip = rail.getByRole("button", { name: /سور لاحقة/ });
    await expect(laterChip).toBeVisible();
    await laterChip.tap();

    const sheet = page.getByRole("dialog");
    const hopBtn = sheet.getByRole("button", { name: /انتقل إلى/ });
    // The link is shown, but the leap is disabled — an honest dead-end note.
    await expect(hopBtn).toBeDisabled();
    await expect(sheet.getByText(/غير متوفّرة بعد/)).toBeVisible();
  });
});

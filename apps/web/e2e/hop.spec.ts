import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

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
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // 2:48's ▶ bucket (Loop 4a data): mutashabihat 7:140 + 14:5 and the
    // related-meaning 82:19 — all on pages that are NOT vendored yet (4b).
    await tapAyah(page, "#verse-55");
    const rail = page.getByRole("group", { name: "روابط الآية" });
    const laterChip = rail.getByRole("button", { name: /سور لاحقة/ });
    await expect(laterChip).toBeVisible();
    await laterChip.tap();

    const sheet = page.getByRole("dialog");
    // Every link is shown, but every leap is disabled — honest dead-end notes.
    const hopBtns = sheet.getByRole("button", { name: /انتقل إلى/ });
    await expect(hopBtns.first()).toBeVisible();
    const count = await hopBtns.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      await expect(hopBtns.nth(i)).toBeDisabled();
    }
    await expect(sheet.getByText(/غير متوفّرة بعد/).first()).toBeVisible();
  });
});

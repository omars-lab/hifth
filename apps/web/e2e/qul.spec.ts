import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

// The ↗ per-verse "open on QUL" link (task #68). Nothing is copied from QUL —
// the link points a reader at that verse's own page in QUL's library, addressed
// by the ayah's absolute position in the mus'haf. So what a runner should pin is
// the wiring: the link shows only when a verse is selected, and it points at the
// exact address `qul.ts` builds. Following the link would leave the app, so this
// test reads the href rather than clicking it.
test.describe("Hifth · open a verse on QUL (task #68)", () => {
  test("the link appears on selection and points at that verse's QUL page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // Nothing selected → no link at all (it renders null without a verse).
    await expect(page.getByRole("link", { name: /QUL/ })).toHaveCount(0);

    // Select 2:48 (verse-55 on page 7, vendored).
    await tapAyah(page, "#verse-55");
    const link = page.getByRole("link", { name: /٢:٤٨.*QUL/ });
    await expect(link).toBeVisible();

    // 2:48 is the 55th ayah of the mus'haf (Al-Fatiha's 7, then 48 into
    // Al-Baqara), so its QUL page is /cms/verses/55. This is the whole point of
    // `qulVerseUrl`.
    await expect(link).toHaveAttribute("href", "https://qul.tarteel.ai/cms/verses/55");
    await expect(link).toHaveAttribute("target", "_blank");
  });
});

import { test, expect } from "@playwright/test";
import { SOURCE_REPO } from "../src/provenance";

/*
 * The colophon, against a real build — PLAN follow-up ⑤ (task #45).
 *
 * Hifth is GPL-3.0-or-later and publishing it *conveys* it, so the deployed
 * page owes its reader the Corresponding Source for the build they are running.
 * That obligation is only discharged if the offer is reachable from the running
 * app, which is exactly what a unit test cannot prove: `Colophon.test.tsx`
 * renders the sheet in isolation and would stay green if nothing in the chrome
 * opened it. This spec starts where a reader starts.
 *
 * Note on the commit: `vite.config.ts` bakes the SHA into the *bundle*, while
 * Playwright transpiles this file with esbuild and no `define`, so a spec that
 * imported `sourceUrl()` would compare the bundle's real commit against its own
 * "dev" fallback and fail. `SOURCE_REPO` is a plain constant and is safe to
 * import — the commit is asserted by shape instead.
 */

const SOURCE_LINK = new RegExp(`^${SOURCE_REPO}(/tree/[0-9a-f]{7,40})?$`);

test.describe("Hifth · colophon (GPL §6)", () => {
  test("the wordmark opens the source offer for this build", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // A reader who wants to know what they are running presses the app's name.
    await page.getByRole("button", { name: /عن حِفظ/ }).tap();
    const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
    await expect(sheet).toBeVisible();

    const source = sheet.getByRole("link", { name: /الشيفرة المصدرية/ });
    await expect(source).toBeVisible();
    // The offer must resolve somewhere real, and — when the build knows its own
    // commit — to that commit's tree rather than to a branch that moves.
    await expect(source).toHaveAttribute("href", SOURCE_LINK);
  });

  test("every source whose licence asks to be named is named, with its link", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /عن حِفظ/ }).tap();
    const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
    await expect(sheet).toBeVisible();

    // The Quranic Arabic Corpus's terms are explicit — its source "clearly
    // indicated" and "a link is made to http://corpus.quran.com". quran-tajweed
    // is CC BY 4.0. The mutashabihat data asks for a mention in the app itself.
    for (const href of [
      "http://corpus.quran.com",
      "https://github.com/cpfair/quran-tajweed",
      "https://github.com/Waqar144/Quran_Mutashabihat_Data",
      "https://github.com/quranpedia/quran-svg",
    ]) {
      await expect(sheet.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });

  test("Escape closes it and focus returns to the wordmark", async ({ page }) => {
    await page.goto("/");
    const wordmark = page.getByRole("button", { name: /عن حِفظ/ });
    // Opened from the keyboard, deliberately: WebKit does not focus a button on
    // tap, so a tapped opener has nothing to restore *to* and the assertion
    // below would be measuring the browser rather than the sheet. Restoration
    // only matters to the reader who is navigating by keyboard anyway.
    await wordmark.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "عن حِفظ" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "عن حِفظ" })).toBeHidden();
    await expect(wordmark).toBeFocused();
  });
});

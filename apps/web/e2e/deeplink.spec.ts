import { test, expect, type Page } from "@playwright/test";

// Cold-opening a link is the teacher-shares-a-link path, and it is the one path
// where two things race to decide what the reader sees: PageStage's initial
// mount (which defaults to START_PAGE) and the link's own navigateTo. Both end
// in setCurrentPage, so before the fix whichever *fetch* returned last won —
// the same link showed page 7 or page 9 depending on the network. The golden
// harness caught it exactly once, as a flake, which is how a race announces
// itself and also how it gets dismissed.
//
// The invariant these tests hold: what the chrome says and what the stage shows
// are never allowed to disagree.

/**
 * The page number in the chrome. Scoped to the banner deliberately: "صفحة" is
 * the app's own word for "page", so it also appears in the stage's sr-only
 * label and in every live announcement. Matching it as loose text resolves to
 * three elements and says nothing about which page is actually showing.
 */
const headerPage = (page: Page) => page.getByRole("banner").locator(".numeric");

test.describe("Hifth · cold deep links", () => {
  // All three live on page 9 while the app cold-opens on page 7, so each one
  // has to survive the race rather than be saved by already being there.
  for (const key of ["2:58", "2:59", "2:60"]) {
    test(`#/hafs-kfqc/${key} shows page 9, not the page it booted on`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/${key}`);

      // `:visible` is the whole point: the losing page stays mounted with its
      // host display:none, so a plain locator finds it and proves nothing.
      await expect(page.locator('svg[aria-labelledby="page-label-9"]:visible')).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toHaveCount(0);
      await expect(headerPage(page)).toHaveText("9");
    });
  }

  test("a bare page link moves the stage, not just the header", async ({ page }) => {
    // `p19` names no ayah, so it never went through navigateTo and used to
    // renumber the header while the reader kept looking at page 7.
    await page.goto("/#/hafs-kfqc/p19");

    await expect(page.locator('svg[aria-labelledby="page-label-19"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toHaveCount(0);
    await expect(headerPage(page)).toHaveText("19");
  });
});

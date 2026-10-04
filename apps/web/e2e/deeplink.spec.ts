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

test.describe("Hifth · a verse wider than a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // At the jump's magnification a full line is wider than a phone, so a verse
  // running whole lines was cut at both edges: 18:10 met the reader in its
  // middle, and Ayat al-Kursi lost the ends of every middle line (2026-10-04).
  // The jump now comes down just enough for the verse to fit across.
  for (const [key, pg, id] of [
    ["18:10", 294, 2150],
    ["2:255", 42, 262],
  ] as const) {
    test(`a link to ${key} opens with the whole verse across the screen`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/${key}`);
      const outline = page.locator(`svg[aria-labelledby="page-label-${pg}"]:visible #verse-${id}`);
      await expect(outline).toHaveCount(1, { timeout: 20_000 });
      // Read once the jump has come to rest: two samples apart, the same.
      let last = "";
      await expect
        .poll(
          async () => {
            const box = await outline.boundingBox();
            if (!box) return "no box";
            const now = [box.x, box.width].map(Math.round).join(",");
            const settled = now === last;
            last = now;
            if (!settled) return "moving";
            return box.x >= 0 && box.x + box.width <= 390 ? "whole" : `cut: ${now}`;
          },
          { intervals: [400], timeout: 15_000, message: "the verse sits inside both edges of the screen" },
        )
        .toBe("whole");
    });
  }
});

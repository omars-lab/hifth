import { test, expect, type Page } from "@playwright/test";

/*
 * Bookmarks, against a real build (docs/decisions/bookmark-fold.md and
 * bookmark-admin.md). The unit tests prove the rules and the store; these prove
 * the journey — fold a corner, name the ribbon, see it survive a reload, and
 * clear it from the page map only after the page map has asked.
 *
 * In English because the ribbon's name is the reader's own words, and a test
 * that types one is easier to read in the language it was typed in.
 */
test.use({ locale: "en-US" });

const SHOTS = process.env.BOOKMARK_SHOTS;

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
}

async function openMap(page: Page) {
  await page.getByRole("button", { name: /what you have opened/ }).click();
  const sheet = page.getByRole("dialog", { name: "What you have opened" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("Hifth · bookmarks", () => {
  test("a folded corner drops a named ribbon that is still there after a reload", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Name").fill("Morning review");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer.png` });
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();

    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toBeVisible();
    // The line a screen reader hears once the new name is written to the phone.
    await expect(page.getByText("Bookmark renamed: Morning review")).toBeAttached();
    await page.reload();
    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/ribbon.png` });

    // Its drawer carries its history: dropped, then renamed.
    await page.getByRole("button", { name: "Bookmark: Morning review" }).click();
    await expect(drawer.getByRole("listitem")).toHaveCount(2);
    await drawer.getByRole("button", { name: "Lift this bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmark: Morning review" })).toHaveCount(0);
  });

  test("a bookmarked page keeps its corner folded; unfolding it lifts the bookmark, and Undo puts it back", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await drawer.getByLabel("Name").fill("Keep");
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();

    // Folded, and still folded after a reload.
    const ribbon = page.getByRole("button", { name: "Bookmark: Keep" });
    const unfold = page.getByRole("button", { name: /Unfold this corner/ });
    await expect(page.getByText("Bookmark renamed: Keep")).toBeAttached();
    await page.reload();
    await expect(ribbon).toBeVisible();
    await expect(unfold).toHaveAttribute("data-folded", "");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/folded.png` });

    await unfold.click();
    await expect(ribbon).toHaveCount(0);
    await expect(unfold).toHaveCount(0);
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/undo.png` });

    await undo.click();
    await expect(ribbon).toBeVisible();
    await expect(unfold).toHaveCount(1);
    await expect(undo).toHaveCount(0);
  });

  test("the red seam follows the page you stay on, not the one you glance at", async ({ page }) => {
    // The seam moves once a page has been open a few seconds (six). Real time,
    // not a faked clock: the page's own drawing runs on the clock too.
    const seam = page.getByRole("img", { name: "Where you left off" });
    await page.goto("/#/hafs-kfqc/p110");
    // By page number: the first drawing in the page may be a neighbour kept warm, and hidden.
    await expect(page.locator('svg[aria-labelledby="page-label-110"]')).toBeVisible();
    await expect(seam).toHaveCount(0);
    await page.waitForTimeout(7000);
    await expect(seam).toHaveCount(1);

    // A quick look elsewhere does not take it along. (Going back by link is also
    // what caught the address bug: a link to a page the app had written itself
    // was once ignored after the reader moved on.)
    await page.goto("/#/hafs-kfqc/p300");
    await expect(page.locator('svg[aria-labelledby="page-label-300"]')).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(seam).toHaveCount(0);
    await page.goto("/#/hafs-kfqc/p110");
    await expect(seam).toHaveCount(1);

    // And it is kept on the phone: there straight after a reload, well before a
    // fresh wait could have laid it again.
    await page.reload();
    await expect(seam).toHaveCount(1, { timeout: 3000 });
  });

  // 2026-10-10, walking the live site on a phone: on a page bound on its left,
  // the seam lay wholly on the paper, nine points wide, and the ink starts about
  // eight points in, so the ribbon covered the ends of the lines on that side.
  for (const at of [7, 8]) {
    test(`the red seam on page ${at} lies across the bound edge and covers no ink`, async ({ page }) => {
      const seam = page.getByRole("img", { name: "Where you left off" });
      await page.goto(`/#/hafs-kfqc/p${at}`);
      await expect(page.locator(`svg[aria-labelledby="page-label-${at}"]`)).toBeVisible();
      await page.waitForTimeout(7000);
      await expect(seam).toHaveCount(1);
      const m = await page.evaluate((n) => {
        const host = document.querySelector(`[data-host-page="${n}"]`)!;
        const hb = host.getBoundingClientRect();
        let l = Infinity;
        let r = -Infinity;
        for (const p of host.querySelectorAll("svg path")) {
          if (p.closest("defs") || /ayahPolygon/.test(p.getAttribute("class") ?? "")) continue;
          const b = p.getBoundingClientRect();
          if (b.width === 0 || b.width > hb.width * 0.97) continue;
          l = Math.min(l, b.left);
          r = Math.max(r, b.right);
        }
        const s = document.querySelector("[data-bookmark-seam]")!.getBoundingClientRect();
        return { inkLeft: l, inkRight: r, seamLeft: s.left, seamRight: s.right };
      }, at);
      const overlap = Math.min(m.seamRight, m.inkRight) - Math.max(m.seamLeft, m.inkLeft);
      expect(overlap, `the seam (${m.seamLeft}..${m.seamRight}) is clear of the ink (${m.inkLeft}..${m.inkRight})`).toBeLessThan(0);
    });
  }

  test("clearing all from the page map asks first, and names the count", async ({ page }) => {
    await ready(page);
    // The corner folds once; a second bookmark on the same page comes from the
    // first one's drawer, since tapping a folded corner unfolds it.
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await drawer.getByRole("button", { name: "Add another here" }).click();
    await drawer.getByRole("button", { name: "Close" }).click();

    const sheet = await openMap(page);
    await expect(sheet.getByText("2 bookmarks", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Clear all…" }).click();
    const ask = sheet.getByRole("alertdialog", { name: "Clear all 2 bookmarks?" });
    await expect(ask).toBeVisible();
    if (SHOTS) {
      await ask.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/confirm.png` });
    }

    // Cancel keeps everything.
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet.getByText("2 bookmarks", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "Clear all…" }).click();
    await sheet.getByRole("alertdialog").getByRole("button", { name: "Clear", exact: true }).click();
    await expect(sheet.getByText(/^No bookmarks yet/)).toBeVisible();
  });
});

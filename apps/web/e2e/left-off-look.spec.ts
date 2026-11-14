import { test, expect, type Page } from "@playwright/test";
import { LEFT_OFF_LOOK_KEY } from "../src/left-off-look";

/*
 * Telling where you left off from your own bookmarks (decision bookmark-fold,
 * open question ①). The owner, on the app's page: "these bookmarks are
 * confusing with the red one". Built four ways, as a setting:
 *
 *   label    the red ribbon keeps its place and says "Left off" at its head (default)
 *   mark     the red ribbon becomes a small red mark at the head of the fold
 *   tabs     the bookmarks become small tabs with their names; only red is a ribbon
 *   ribbons  both stay ribbons, as before
 *
 * Written before the build (2026-11-13) and watched failing.
 */

test.use({ locale: "en-US", viewport: { width: 1440, height: 900 } });

const seam = (page: Page) => page.getByRole("img", { name: "Where you left off" });
const label = (page: Page) => page.locator("[data-left-off-label]");

/** Open page 7 with the chosen look, and stay until the red ribbon settles on it. */
async function stayOnPage7(page: Page, look?: string): Promise<void> {
  if (look) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: LEFT_OFF_LOOK_KEY, value: look });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(`svg[aria-labelledby="page-label-7"]`)).toBeVisible();
  await expect(seam(page)).toHaveCount(1, { timeout: 15_000 });
}

/** How far a box overlaps the page's writing, in its own column: below zero is clear. */
async function overlapWithInk(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel)!.getBoundingClientRect();
    let worst = -Infinity;
    for (const host of document.querySelectorAll("[data-host-page]")) {
      const hb = host.getBoundingClientRect();
      for (const p of host.querySelectorAll("svg path")) {
        if (p.closest("defs") || /ayahPolygon/.test(p.getAttribute("class") ?? "")) continue;
        const b = p.getBoundingClientRect();
        if (b.width === 0 || b.width > hb.width * 0.97) continue;
        const across = Math.min(box.right, b.right) - Math.max(box.left, b.left);
        const down = Math.min(box.bottom, b.bottom) - Math.max(box.top, b.top);
        worst = Math.max(worst, Math.min(across, down));
      }
    }
    return worst;
  }, selector);
}

test("by default the red ribbon says what it is, in a label at its head that covers no writing", async ({ page }) => {
  test.slow();
  await stayOnPage7(page);
  await expect(label(page)).toBeVisible();
  await expect(label(page)).toHaveText("Left off");
  const at = await page.evaluate(() => {
    const s = document.querySelector("[data-bookmark-seam]")!.getBoundingClientRect();
    const l = document.querySelector("[data-left-off-label]")!.getBoundingClientRect();
    return { seamTop: s.top, seamCentre: (s.left + s.right) / 2, labelTop: l.top, labelCentre: (l.left + l.right) / 2 };
  });
  expect(Math.abs(at.labelCentre - at.seamCentre), "the label sits on the red ribbon").toBeLessThan(2);
  expect(at.labelTop - at.seamTop, "at its head").toBeLessThan(30);
  expect(await overlapWithInk(page, "[data-left-off-label]"), "the label is clear of the writing").toBeLessThan(0);
});

test("with the mark chosen, the red one is a small mark at the head of the fold, not a ribbon", async ({ page }) => {
  test.slow();
  await stayOnPage7(page, "mark");
  const box = (await seam(page).boundingBox())!;
  expect(box.height, "no longer runs the height of the page").toBeLessThan(40);
  await expect(label(page)).toHaveCount(0);
  expect(await overlapWithInk(page, "[data-bookmark-seam]"), "the mark is clear of the writing").toBeLessThan(0);
});

test("with both as ribbons, the red ribbon runs the page and has no label, as before", async ({ page }) => {
  test.slow();
  await stayOnPage7(page, "ribbons");
  const box = (await seam(page).boundingBox())!;
  expect(box.height).toBeGreaterThan(300);
  await expect(label(page)).toHaveCount(0);
});

test("with tabs chosen, a bookmark shows its name on a tab that covers no writing", async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: LEFT_OFF_LOOK_KEY, value: "tabs" });
  await page.goto("/#/hafs-kfqc/p42");
  await expect(page.locator(`svg[aria-labelledby="page-label-42"]`)).toBeVisible();
  await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Bookmark" });
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
  const tab = page.locator("[data-bookmark-overlay] [data-bookmark]");
  await expect(tab).toHaveCount(1);
  const name = (await tab.getAttribute("title"))!;
  expect(name.length).toBeGreaterThan(0);
  await expect(tab.getByText(name)).toBeVisible();
  await page.waitForTimeout(400);
  expect(await overlapWithInk(page, "[data-bookmark-overlay] [data-bookmark]"), "the tab is clear of the writing").toBeLessThan(0);
});

test("by default a bookmark's name is not written on the page", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/p42");
  await expect(page.locator(`svg[aria-labelledby="page-label-42"]`)).toBeVisible();
  await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Bookmark" });
  await drawer.getByRole("button", { name: "Close" }).click();
  const tab = page.locator("[data-bookmark-overlay] [data-bookmark]");
  await expect(tab).toHaveCount(1);
  await expect(tab.getByText((await tab.getAttribute("title"))!)).toBeHidden();
});

test("the info panel offers the four looks and keeps the one picked", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/p7");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const choice = page.getByRole("radiogroup", { name: "Telling where you left off from your bookmarks" });
  await expect(choice.getByRole("radio")).toHaveCount(4);
  await choice.getByRole("radio", { name: "Bookmarks become named tabs" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), LEFT_OFF_LOOK_KEY)).toBe("tabs");
});

test.describe("on a phone, where one page fills the screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Walking it at 390 wide (2026-11-13): the page ran to the screen's edge, so
  // a label centred on the ribbon hung half off it and read "off". It slides
  // along the ribbon onto the screen instead, as far as its inner edge, and so
  // still touches it.
  for (const p of [7, 8]) {
    test(`page ${p}: the whole label is on the screen, on the ribbon, and covers no writing`, async ({ page }) => {
      test.slow();
      await page.goto(`/#/hafs-kfqc/p${p}`);
      await expect(page.locator(`svg[aria-labelledby="page-label-${p}"]`)).toBeVisible();
      await expect(seam(page)).toHaveCount(1, { timeout: 15_000 });
      await expect(label(page)).toBeVisible();
      const at = await page.evaluate(() => {
        const s = document.querySelector("[data-bookmark-seam]")!.getBoundingClientRect();
        const l = document.querySelector("[data-left-off-label]")!.getBoundingClientRect();
        return { width: innerWidth, left: l.left, right: l.right, seamLeft: s.left, seamRight: s.right };
      });
      expect(at.left, "not cut by the screen's left edge").toBeGreaterThanOrEqual(0);
      expect(at.right, "not cut by the screen's right edge").toBeLessThanOrEqual(at.width);
      expect(at.left <= at.seamRight && at.right >= at.seamLeft, "still touching the ribbon").toBe(true);
      expect(await overlapWithInk(page, "[data-left-off-label]"), "the label is clear of the writing").toBeLessThan(0);
    });
  }
});

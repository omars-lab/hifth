import { test, expect, type Locator } from "@playwright/test";

// Opening a look-alike row expands its comparison under it. A row near the foot
// of a long list expanded below the list's edge, where nothing said it was
// there — seen in Firefox (2026-10-09), where nothing else moves the list.
// Runs in desktop-firefox and on the two phones; Chrome on a desktop already
// moves the list on its own, so the desktop project would not see the fault.

async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await target.boundingBox());
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
}

test.describe("Hifth · a look-alike comparison", () => {
  test("opening the last look-alike row brings it into view: whole, or from its top", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "en"));
    await page.goto("/#/hafs-kfqc/10:15?open=lookalikes");
    await page.getByRole("button", { name: /later surahs/ }).first().click();
    const list = page.getByRole("dialog", { name: /later surahs/ });
    await expect(list).toBeVisible({ timeout: 20_000 });
    await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await list.locator("[aria-expanded=false]").last().click();
    const crops = list.locator("svg");
    await expect(crops).toHaveCount(2, { timeout: 10_000 });
    const row = crops.last().locator("xpath=ancestor::li[1]");
    await settle(row);
    // What the reader sees of the list: from under its title, which on a phone
    // is pinned over the rows inside the scrolling sheet, to the sheet's foot.
    const port = await list.evaluate((el) => {
      let at: Element | null = el.querySelector("li");
      while (at && at !== el && !/auto|scroll/.test(getComputedStyle(at).overflowY)) at = at.parentElement;
      const r = (at ?? el).getBoundingClientRect();
      const title = el.querySelector("header")?.getBoundingClientRect();
      return { top: Math.max(r.top, title?.bottom ?? r.top), bottom: r.bottom };
    });
    const box = (await row.boundingBox())!;
    if (box.height <= port.bottom - port.top) {
      expect(box.y + box.height, "the opened row runs past the list's foot").toBeLessThanOrEqual(port.bottom + 1);
      expect(box.y, "the opened row's top is under the title").toBeGreaterThanOrEqual(port.top - 1);
    } else {
      expect(Math.abs(box.y - port.top), "a row too tall to show whole starts just under the title").toBeLessThanOrEqual(1);
    }
  });

  // A look-alike row naming a whole passage was measured against the passage's
  // first verse, though the verse that matches is often a later one: 15:30's
  // passage row in surah 38 said nothing and would not open (lookalike-rows ①).
  test("a passage row opens onto the verse inside it that matches", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "en"));
    await page.goto("/#/hafs-kfqc/15:30?open=lookalikes");
    // 15:30 has look-alikes only in later surahs, so the link opens that list itself.
    const list = page.getByRole("dialog", { name: /later surahs/ });
    await expect(list).toBeVisible({ timeout: 20_000 });
    const row = list.getByRole("listitem").filter({ hasText: /38:72.38:75/ });
    const open = row.locator("[aria-expanded]");
    await expect(open, "the passage row offers to open").toHaveCount(1);
    await open.click();
    await expect(row.locator("svg")).toHaveCount(2, { timeout: 10_000 });
    await expect(row, "the comparison stands on the verse that matches").toContainText("38:73");
  });
});

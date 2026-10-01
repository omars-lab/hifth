import { expect, test, type Page } from "@playwright/test";

/*
 * The open book is the same size in every browser.
 *
 * A leaf's width is not written anywhere: it is the height the desk leaves,
 * times the page's own shape (345 wide to 550 tall, plus its printed head and foot). Chrome worked that out;
 * Firefox did not, and fell back to the width of whatever the leaf held — so a
 * spread in Firefox came out a third narrower, each page shrunk and floating in
 * a tall empty leaf, and on some windows not drawn at all (owner, 2026-09-28:
 * "weird state", two blank leaves beside an open note). This runs in both.
 */

const leaves = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-page]")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const leaf = el.getBoundingClientRect();
        const svg = el.querySelector(`svg[aria-labelledby="page-label-${el.dataset.page}"]`);
        const art = svg?.getBoundingClientRect();
        return { page: el.dataset.page, w: leaf.width, h: leaf.height, artW: art?.width ?? 0 };
      }),
  );

for (const [w, h] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`at ${w}×${h} both leaves are page-shaped and the page fills its leaf`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/#/hafs-kfqc/p8");
    await expect(page.locator('svg[aria-labelledby="page-label-8"]:visible')).toBeVisible();
    await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toBeVisible();

    const found = await leaves(page);
    expect(found.map((l) => l.page).sort()).toEqual(["7", "8"]);
    for (const l of found) {
      // Page-shaped: width is the height times 345/594.85 — the text's 345 × 550
      // plus the running head and page number printed above and below it
      // (PageSpread.module.css) — to the pixel.
      expect(Math.abs(l.w - (l.h * 345) / 594.85), `leaf ${l.page} width`).toBeLessThan(2);
      // And the drawing reaches across it, rather than shrinking to fit a
      // narrower box and leaving the leaf mostly paper.
      expect(l.artW, `page ${l.page} drawing width`).toBeGreaterThan(l.w * 0.95);
    }
  });
}

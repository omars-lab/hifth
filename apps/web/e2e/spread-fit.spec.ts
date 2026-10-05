import { expect, test, type Page } from "@playwright/test";
import { lum, pixelsAt } from "./ink";

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

/*
 * The crease down the middle of the book stops where the paper stops.
 *
 * It used to be drawn on the frame that holds the two leaves, and that frame is
 * as tall as the desk. A page is shorter than the desk — a little on most
 * pages, a lot on the two opening pages, which are drawn nearly square — so the
 * crease ran on past the head and foot of the paper, out across the empty desk,
 * from the toolbar to the bottom bar (2026-10-04). Read off the screen: the desk
 * just above and below the paper is the same colour at the seam as it is a
 * hand's width away from it.
 */
for (const p of [2, 44]) {
  test(`on page ${p} the crease does not run past the paper`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/hafs-kfqc/p${p}`);
    await expect(page.locator(`svg[aria-labelledby="page-label-${p}"]:visible`)).toBeVisible();
    const geo = await page.evaluate(() => {
      const book = document.querySelector<HTMLElement>('[data-testid="page-book"]')!.getBoundingClientRect();
      const papers = [...document.querySelectorAll<HTMLElement>("[data-host-page]")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0);
      return {
        seam: book.left + book.width / 2,
        top: book.top,
        bottom: book.bottom,
        paperTop: Math.min(...papers.map((r) => r.top)),
        paperBottom: Math.max(...papers.map((r) => r.bottom)),
      };
    });
    const mean = (px: { length: number } & Parameters<typeof lum>[0][]) =>
      px.reduce((a, c) => a + lum(c), 0) / px.length;
    for (const [from, to, where] of [
      // A pixel clear of the paper, whose edge is antialiased into the desk.
      [geo.top, geo.paperTop - 2, "above"],
      [geo.paperBottom + 2, geo.bottom, "below"],
    ] as const) {
      // Rows of bare desk only; a page taller than the book leaves none.
      if (to - from < 2) continue;
      const rows = { y: Math.ceil(from), height: Math.floor(to - from) };
      const atSeam = mean(await pixelsAt(page, { x: Math.round(geo.seam - 14), width: 28, ...rows }));
      // Beside it is the desk just clear of the band on both sides — near enough
      // that the desk's own soft shading is the same as at the seam.
      const aside =
        (mean(await pixelsAt(page, { x: Math.round(geo.seam - 42), width: 28, ...rows })) +
          mean(await pixelsAt(page, { x: Math.round(geo.seam + 14), width: 28, ...rows }))) /
        2;
      expect(Math.abs(atSeam - aside), `desk ${where} the paper, at the seam vs beside it`).toBeLessThan(1.5);
    }
  });
}

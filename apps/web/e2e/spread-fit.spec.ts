import { expect, test, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
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

/*
 * The book's first two leaves are the same size as every other leaf.
 *
 * The print draws the opening pages' text as a small square block, and the app
 * used to cut the paper to that square: the open book began as two squat cards
 * with the scripture half again as large as on the pages after it, and the paper
 * jumped in size at the first turn (2026-10-08, walking the pitch as a first
 * visitor). Now the paper is the page's shape and the block sits in its middle,
 * still spanning the page's width so the opening text stays large (the owner's
 * pick over shrinking it to every other page's size of type).
 */
const paperOf = (page: Page, p: number) =>
  page.evaluate((p) => {
    const host = [...document.querySelectorAll<HTMLElement>(`[data-host-page="${p}"]`)].find(
      (el) => el.getBoundingClientRect().width > 0,
    )!;
    const svg = host.querySelector<SVGSVGElement>("svg")!;
    const paper = host.getBoundingClientRect();
    const art = svg.getBoundingClientRect();
    return {
      w: paper.width,
      h: paper.height,
      // how much of the paper's width the drawing spans
      across: art.width / paper.width,
      // screen pixels per unit of the drawing: the size of the type
      scale: art.width / svg.viewBox.baseVal.width,
      // where the drawing's middle sits on the paper, as a share of the paper
      artMidX: (art.left + art.width / 2 - paper.left) / paper.width,
      artMidY: (art.top + art.height / 2 - paper.top) / paper.height,
    };
  }, p);

test("the opening pages are the size of every other page, their text across the full width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hafs-kfqc/p3");
  await expect(page.locator('svg[aria-labelledby="page-label-3"]:visible')).toBeVisible();
  const usual = await paperOf(page, 3);

  await page.goto("/#/hafs-kfqc/p1");
  await expect(page.locator('svg[aria-labelledby="page-label-1"]:visible')).toBeVisible();
  await expect(page.locator('svg[aria-labelledby="page-label-2"]:visible')).toBeVisible();
  for (const p of [1, 2]) {
    const opening = await paperOf(page, p);
    expect(Math.abs(opening.w - usual.w), `page ${p} paper width`).toBeLessThan(2);
    expect(Math.abs(opening.h - usual.h), `page ${p} paper height`).toBeLessThan(2);
    expect(Math.abs(opening.across - usual.across), `page ${p} text across the page`).toBeLessThan(0.02);
    expect(Math.abs(opening.artMidY - 0.5), `page ${p} text in the middle, top to bottom`).toBeLessThan(0.03);
    expect(Math.abs(opening.artMidX - 0.5), `page ${p} text in the middle, side to side`).toBeLessThan(0.04);
  }

  // And a click on a verse there still picks that verse.
  const { x, y } = await ayahTarget(page, 'svg[aria-labelledby="page-label-1"]:visible #verse-5');
  await page.mouse.click(x, y);
  await expect(page).toHaveURL(/1:5/);
});

// The other way stays as a setting (the owner keeps runner-up options): the
// opening text at the size of type every other page uses, in the middle of the
// same page-shaped paper. Switched in the info panel, with the book open.
test.describe("in English", () => {
  test.use({ locale: "en-US" });

  test("chosen in settings, the opening text is the size of every other page's", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#/hafs-kfqc/p3");
    await expect(page.locator('svg[aria-labelledby="page-label-3"]:visible')).toBeVisible();
    const usual = await paperOf(page, 3);

    await page.goto("/#/hafs-kfqc/p1");
    await expect(page.locator('svg[aria-labelledby="page-label-1"]:visible')).toBeVisible();
    await page.getByRole("button", { name: /About Hifth/ }).click();
    await page.locator('[data-opening-text="even"]').click();
    await expect(page.locator('[data-opening-text="even"]')).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    for (const p of [1, 2]) {
      const opening = await paperOf(page, p);
      expect(Math.abs(opening.h - usual.h), `page ${p} paper height`).toBeLessThan(2);
      expect(Math.abs(opening.scale / usual.scale - 1), `page ${p} size of type`).toBeLessThan(0.02);
      expect(Math.abs(opening.artMidY - 0.5), `page ${p} text in the middle, top to bottom`).toBeLessThan(0.03);
      expect(Math.abs(opening.artMidX - 0.5), `page ${p} text in the middle, side to side`).toBeLessThan(0.04);
    }

    // Kept on this device: a fresh load opens the same way.
    await page.reload();
    await expect(page.locator('svg[aria-labelledby="page-label-1"]:visible')).toBeVisible();
    const again = await paperOf(page, 1);
    expect(Math.abs(again.scale / usual.scale - 1), "after a reload").toBeLessThan(0.02);

    // And a click on a verse there still picks that verse.
    const { x, y } = await ayahTarget(page, 'svg[aria-labelledby="page-label-1"]:visible #verse-5');
    await page.mouse.click(x, y);
    await expect(page).toHaveURL(/1:5/);
  });
});

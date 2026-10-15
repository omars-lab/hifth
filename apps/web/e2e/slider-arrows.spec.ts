import { test, expect, type Page } from "@playwright/test";

/*
 * The two arrows at the ends of the page slider are one pair, so they are
 * drawn the same size. They were two text marks, each drawn from whichever
 * font on the machine happened to have it: in Chrome one came out short and
 * wide and the other tall and narrow, and in Firefox in English the left one
 * was a third the size of the right (2026-10-12, walking the first screen).
 * Each still points the way it did: earlier in the book is to the right.
 */

/** The drawn arrow inside each end button: its box, and which way it points. */
async function arrows(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true }).first();
  await expect(button).toBeVisible();
  return button.evaluate((b) => {
    const mark = b.querySelector("[aria-hidden='true']")!;
    const range = document.createRange();
    range.selectNodeContents(mark);
    const r = range.getBoundingClientRect();
    return { width: r.width, height: r.height, points: mark.getAttribute("data-points") };
  });
}

for (const locale of ["en-US", "ar"]) {
  test.describe(`Hifth · the page slider's end arrows (${locale})`, () => {
    test.use({ locale });

    test("both arrows are drawn the same size, each pointing its own way", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
      await page.goto("/#/hafs-kfqc/p50");
      const ar = locale === "ar";
      const earlier = await arrows(page, ar ? "الصفحة السابقة" : "Previous page");
      const later = await arrows(page, ar ? "الصفحة التالية" : "Next page");
      expect(Math.abs(earlier.width - later.width), "the two arrows' widths").toBeLessThan(0.5);
      expect(Math.abs(earlier.height - later.height), "the two arrows' heights").toBeLessThan(0.5);
      // Big enough to see at a glance, and no bigger than the button's middle.
      expect(earlier.width).toBeGreaterThanOrEqual(6);
      expect(earlier.height).toBeGreaterThanOrEqual(8);
      expect(earlier.height).toBeLessThanOrEqual(16);
      // Earlier in the book is to the right, whatever the app's language.
      expect(earlier.points).toBe("right");
      expect(later.points).toBe("left");
    });
  });
}

/*
 * Walking the demo at a desk, 2026-10-15: a verse's tools rise as a card in the
 * middle of the bar, and the page slider ran in under the card's one side and
 * out of its other, its marker for the page hidden under it, at a desk, on a
 * laptop and on an iPad on its side (plan item 109). A control cut in two by a
 * card reads as broken, as it did on a phone (where the card covers the whole
 * bar). While the card is up the track steps out of sight, and the arrows at
 * the slider's two ends stay, clear beside it; when the card goes, the track
 * comes back.
 */
for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1180, height: 820 },
]) {
  for (const locale of ["en-US", "ar"]) {
    test.describe(`Hifth · the page slider under a verse's tools on a ${size.width} by ${size.height} screen (${locale})`, () => {
      test.use({ viewport: size, locale });

      test("no part of the slider shows cut by the card, the end arrows stay, and the track comes back when the card goes", async ({ page }) => {
        const ar = locale === "ar";
        await page.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
        await page.goto("/#/hafs-kfqc/2:48");
        const card = page.getByRole("region", { name: ar ? /^أدوات / : /^Tools for / });
        await expect(card).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(600);
        const c = (await card.boundingBox())!;
        const meets = (a: { x: number; y: number; width: number; height: number }) =>
          a.x < c.x + c.width && a.x + a.width > c.x && a.y < c.y + c.height && a.y + a.height > c.y;
        const inside = (a: { x: number; y: number; width: number; height: number }) =>
          a.x >= c.x - 0.5 && a.x + a.width <= c.x + c.width + 0.5 && a.y >= c.y - 0.5;
        const bar = page.getByRole("navigation", { name: ar ? "شريط الصفحات" : "Page bar", exact: true });
        const track = bar.getByRole("slider");
        if (await track.isVisible()) {
          const t = (await track.boundingBox())!;
          expect(!meets(t) || inside(t), `the slider at ${JSON.stringify(t)} cut by the card at ${JSON.stringify(c)}`).toBe(true);
        }
        for (const name of ar ? ["الصفحة السابقة", "الصفحة التالية"] : ["Previous page", "Next page"]) {
          const arrow = bar.getByRole("button", { name, exact: true });
          await expect(arrow, `the ${name} arrow`).toBeVisible();
          expect(meets((await arrow.boundingBox())!), `the ${name} arrow under the card`).toBe(false);
        }
        await card.getByRole("button", { name: ar ? "إغلاق" : "Close" }).click();
        await expect(card).toBeHidden();
        await expect(track).toBeVisible();
      });
    });
  }
}

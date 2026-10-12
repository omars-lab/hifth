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

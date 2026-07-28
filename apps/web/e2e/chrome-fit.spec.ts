import { test, expect, type Page } from "@playwright/test";

/*
 * The chrome fits the phone — at every width a phone actually has.
 *
 * This exists because for six loops it did not. `.chrome` is a flex row with no
 * wrap: anything that does not fit is not clipped, it is pushed off the *start*
 * edge — in RTL, off the left — and the document grows a horizontal scrollbar.
 * The intrinsic width was a flat 430 CSS px, so on a 390 px iPhone the ⓘ was
 * half off screen, the mushaf could be panned sideways by accident, and taps
 * inside sheets landed on the wrong element because the page was offset.
 *
 * Two assertions, and the second is the one that is easy to lose:
 *
 *   1. Nothing overflows, at 320 → 430. 320 is the narrowest phone still in the
 *      wild (SE 1st gen); 430 is the widest (15 Pro Max). Both the header itself
 *      and the document are checked — a row can fit its own box while pushing
 *      the <html> element wider, and only the document check catches that.
 *   2. The header's *height* is the same at every one of those widths. The
 *      stage gets whatever height the chrome leaves it, and the golden
 *      baselines are element shots of the stage. A responsive rule that fixes
 *      the width by letting something wrap costs the reader a strip of mushaf
 *      and re-photographs all ten baselines — silently, since no width
 *      assertion here would notice.
 *
 * Widths are set with `setViewportSize` on the project's own device, so this
 * runs once in WebKit and once in Chromium. That is deliberate: fitting is
 * decided by text metrics, and the two engines do not measure Arabic
 * identically — a change can fit on one and overflow on the other.
 */

/** Phone widths, narrowest first. */
const WIDTHS = [320, 360, 375, 390, 412, 430] as const;

/** Header box + the document's own overflow, in one round trip. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("header")!;
    return {
      // `window.innerWidth` is not usable here: under mobile emulation it
      // reports the *visual* viewport, which an overflowing document widens.
      // `clientWidth` on a block-level header tracks the layout viewport.
      headerScroll: header.scrollWidth,
      headerClient: header.clientWidth,
      headerHeight: Math.round(header.getBoundingClientRect().height),
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
    };
  });
}

test.describe("Hifth · the chrome fits a phone", () => {
  test("no horizontal overflow, and a constant header height, from 320 to 430", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:47");
    await expect(page.locator("main svg[role='group']").first()).toBeVisible();

    const heights = new Map<number, number>();

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      // One frame for the media queries to apply before measuring.
      await expect
        .poll(async () => (await measure(page)).headerClient, { timeout: 5_000 })
        .toBe(width);

      const m = await measure(page);
      expect(m.headerScroll, `header overflows its own box at ${width}px`).toBeLessThanOrEqual(
        m.headerClient,
      );
      expect(m.docScroll, `the document scrolls sideways at ${width}px`).toBeLessThanOrEqual(
        m.docClient,
      );
      heights.set(width, m.headerHeight);
    }

    // Every width, one height. Reported as a map so a failure names the width
    // that moved rather than just "expected 69, got 82".
    const distinct = new Set(heights.values());
    expect(Object.fromEntries(heights), "header height varies by viewport width").toEqual(
      Object.fromEntries([...heights.keys()].map((w) => [w, [...distinct][0]])),
    );
  });

  test("still fits with the widest page number the mushaf has", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:47");
    await expect(page.locator("main svg[role='group']").first()).toBeVisible();

    // The corpus vendored today is three pages, so the header can only ever be
    // driven to a one-digit number by navigation. The worst case is page 604 —
    // the last page of the mushaf, and the widest that field ever gets — so the
    // text is set directly. Nothing else about the row changes: this is the
    // same span, the same font, the same flex item, two glyphs wider.
    await page.locator("header span.numeric").evaluate((el) => {
      el.textContent = "604";
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await expect.poll(async () => (await measure(page)).headerClient, { timeout: 5_000 }).toBe(320);

    const m = await measure(page);
    expect(m.headerScroll, "page 604 overflows the header at 320px").toBeLessThanOrEqual(
      m.headerClient,
    );
    expect(m.docScroll, "page 604 makes the document scroll at 320px").toBeLessThanOrEqual(
      m.docClient,
    );
  });
});

import { test, expect, type Page } from "@playwright/test";
import { inkToken, lum, pixelsOf } from "./ink";

/*
 * The highlighter as a reader sees it, one scenario per test: where a band
 * stops, what colour it is, how it mixes with the letters and with other
 * marks, and what it does for a reader who has asked the system for more
 * contrast or less motion.
 *
 * The unit tests (rough.test.ts, highlighter.test.ts) know the shape and the
 * markup. Only a browser knows what the stylesheet made of them — a colour
 * that resolved, a blend that is actually on, a media query that actually
 * matched — so each claim here is read back from the page, not from the code.
 */

/** 2:47 on page 7: one full line, then the head of the next up to 2:48. */
const VERSE = "/#/hafs-kfqc/2:47";
const OVERLAY = 'svg[aria-labelledby="page-label-7"]:visible #hifth-overlay';

async function openVerse(page: Page): Promise<void> {
  await page.goto(VERSE);
  await expect(page.locator(`${OVERLAY} .hl-sel.hl-ink`)).toHaveCount(2, { timeout: 20_000 });
}

type Span = { left: number; right: number };

/**
 * Where the page's words start and end across the line, and where each verse
 * band starts and ends, in the page's own units. The print draws every word on
 * a page as one shape, so that shape's box is the block of text: a full line
 * is set edge to edge across it.
 */
async function measure(page: Page, overlay = OVERLAY): Promise<{ text: Span; frame: Span; bands: Span[] }> {
  return page.locator(overlay).evaluate((overlay) => {
    const svg = (overlay as SVGGElement).ownerSVGElement!;
    const inRoot = (el: SVGGraphicsElement): Span => {
      const b = el.getBBox();
      // The element's own units to the page's: up to the screen, back down.
      const m = svg.getCTM()!.inverse().multiply(el.getCTM()!);
      const xs = [b.x, b.x + b.width].flatMap((x) =>
        [b.y, b.y + b.height].map((y) => new DOMPoint(x, y).matrixTransform(m).x),
      );
      return { left: Math.min(...xs), right: Math.max(...xs) };
    };
    const text = inRoot(svg.querySelector<SVGGraphicsElement>("#content")!);
    const bands = [...overlay.querySelectorAll<SVGGraphicsElement>(".hl-band")].map(inRoot);
    const vb = svg.viewBox.baseVal;
    return { text, frame: { left: vb.x, right: vb.x + vb.width }, bands };
  });
}

test.describe("Hifth · the highlighter on the page", () => {
  /**
   * Two ways onto a page. Page 7 is the one the app opens on, so it is laid out
   * before its verse is drawn. A link straight to page 19 draws the passage
   * while that page is still off screen, where its words cannot be measured;
   * the bands used to keep the full width of the verse boxes from then on.
   */
  const MARGIN_CASES = [
    { name: "a verse on the page the app opens on", link: VERSE, page: 7, count: 2 },
    { name: "a passage on a page a link opens straight to", link: "/#/hafs-kfqc/2:121-2:122", page: 19, count: 4 },
  ] as const;

  for (const c of MARGIN_CASES) {
    test(`a band stops just past the words, not at the edge of the page: ${c.name}`, async ({ page }) => {
      // The owner, 2026-09-30: the band "shouldn't go to end of page, there
      // should be a slight margin near beginning or ending of line of text".
      // The print's verse boxes run the page's full width, well past the first
      // and last word of a full line, and the band used to fill the box end to
      // end.
      const overlay = `svg[aria-labelledby="page-label-${c.page}"]:visible #hifth-overlay`;
      await page.goto(c.link);
      await expect(page.locator(`${overlay} .hl-band`)).toHaveCount(c.count, { timeout: 20_000 });
      const text = (await measure(page, overlay)).text;
      expect(text.right - text.left, "the block of text was measured").toBeGreaterThan(200);

      // A slight overhang, like a real pen: past the words, never to the edge.
      // Polled, because a page opened off screen fits its bands once it lands.
      const OVERHANG = 4;
      await expect
        .poll(async () => {
          const { bands } = await measure(page, overlay);
          return bands.every((b) => b.right <= text.right + OVERHANG && b.left >= text.left - OVERHANG);
        })
        .toBe(true);

      const { frame, bands } = await measure(page, overlay);
      expect(frame.right - text.right, "the page has room outside its words").toBeGreaterThan(4);
      // ...and it still covers them: the full line reaches past both ends of
      // its words.
      const full = bands.reduce((a, b) => (b.right - b.left > a.right - a.left ? b : a));
      expect(full.right, "the full line's band covers its first word").toBeGreaterThanOrEqual(text.right);
      expect(full.left, "the full line's band covers its last word").toBeLessThanOrEqual(text.left);
    });
  }

  test("both ends of a band stand nearly upright, not slanted like a rhombus", async ({ page }) => {
    // The owner, on the first drawing of the rough band: "too diagonal —
    // straighten vertically more, just slight slants". Measured on the curve
    // the browser actually draws, sampled along its length: at each end, how
    // far across the line the top corner sits from the bottom corner.
    await openVerse(page);
    const ends = await page.locator(`${OVERLAY} .hl-band`).evaluateAll((els) =>
      els.map((el) => {
        const path = el as SVGPathElement;
        const g = path.closest<SVGGElement>("[data-y]")!;
        const mid = Number(g.dataset.y);
        const half = Number(g.dataset.width) / 2;
        const len = path.getTotalLength();
        const pts = Array.from({ length: 400 }, (_, i) => path.getPointAtLength((len * i) / 400));
        // Only the edges, not the rounding where an end meets its corner.
        const top = pts.filter((p) => p.y < mid - half / 2).map((p) => p.x);
        const bottom = pts.filter((p) => p.y > mid + half / 2).map((p) => p.x);
        return {
          half,
          start: Math.max(...top) - Math.max(...bottom),
          end: Math.min(...bottom) - Math.min(...top),
        };
      }),
    );
    expect(ends.length).toBeGreaterThan(0);
    for (const e of ends) {
      expect(Math.abs(e.start), "the end where the pen lands leans only slightly").toBeLessThan(e.half * 0.4);
      expect(Math.abs(e.end), "the far end leans only slightly").toBeLessThan(e.half * 0.4);
    }
  });

  test("the verse is marked in the verse's own amber", async ({ page }) => {
    await openVerse(page);
    const fill = await page.locator(`${OVERLAY} .hl-sel.hl-ink`).first().evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe(await inkToken(page, "--ink-sel"));
  });

  test("every mark blends with the page, so the letters under it stay black", async ({ page }) => {
    // The verse's amber is opaque on purpose: under a multiply blend the paper
    // does the lightening, and the letters stay as dark as the print made them.
    // Without the blend the same amber would paint straight over the words.
    await openVerse(page);
    const blends = await page
      .locator(`${OVERLAY} .hl-ink`)
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).mixBlendMode));
    expect(blends.length).toBeGreaterThan(0);
    for (const b of blends) expect(b).toBe("multiply");

    // The middle of the band, where the ink always covers the letters.
    const px = await pixelsOf(page, `${OVERLAY} .hl-sel.hl-ink`, { middle: 0.4 });
    const darkest = px.reduce((m, p) => Math.min(m, lum(p)), 255);
    expect(darkest, "a letter under the amber is still near-black").toBeLessThan(70);
  });

  test("the streaks come off for a reader who asks for more contrast", async ({ page }) => {
    await openVerse(page);
    const filterOf = () =>
      page.locator(`${OVERLAY} .hl-band`).first().evaluate((el) => getComputedStyle(el).filter);
    expect(await filterOf(), "the streaks are on by default").toMatch(/url\(/);

    await page.emulateMedia({ contrast: "more" });
    expect(await filterOf(), "more contrast: flat ink").toBe("none");

    await page.emulateMedia({ contrast: "no-preference", forcedColors: "active" });
    expect(await filterOf(), "forced colours: flat ink").toBe("none");
  });

  test("the ink is simply there for a reader who asks for less motion", async ({ page }) => {
    await openVerse(page);
    const animationOf = () =>
      page.locator(`${OVERLAY} .hl-ink`).first().evaluate((el) => getComputedStyle(el).animationName);
    expect(await animationOf(), "the pen wipes the line in by default").toBe("hifth-ink");

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await animationOf(), "less motion: no wipe").toBe("none");
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The parts only a wide screen draws come in their own file, after the page.
 *
 * The page-edge strips you grab to turn a page and the pens' homes on a
 * computer or a big iPad are never drawn on a phone, so a phone should never
 * download them (docs/performance.md, item 21). On a wide screen they arrive a
 * moment after the first page. If that file never arrives at all, the reader
 * still has a page that reads and turns: a missing later file shows nothing in
 * its place instead of blanking the app.
 */

const WIDE_FILE = /\/assets\/wide-screen-[^/]+\.js$/;

// A first visit: every request seen by the test, none answered by a service worker.
test.use({ serviceWorkers: "block" });

const pageSvg = (page: Page, n: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);

test.describe("Hifth · the wide-screen parts load on their own", () => {
  test("a phone never asks for them", async ({ page, isMobile }) => {
    test.skip(!isMobile, "a phone's claim");
    const asked: string[] = [];
    page.on("request", (r) => {
      if (WIDE_FILE.test(r.url())) asked.push(r.url());
    });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    // Guard against a build with no such file (the check would pass vacuously):
    // the start-up script names it, to fetch it on a wide screen.
    const src = await page.locator('script[type="module"][src]').first().getAttribute("src");
    const main = await (await page.request.get(new URL(src!, page.url()).href)).text();
    expect(/wide-screen-[\w-]+\.js/.test(main), "the start-up script names the wide-screen file").toBe(true);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(pageSvg(page, 8)).toBeVisible();
    await page.waitForTimeout(800);
    expect(asked, "the phone downloaded the wide-screen parts").toEqual([]);
  });

  test("on a wide screen they arrive, and the page edge turns the page", async ({ page, isMobile }) => {
    test.skip(isMobile, "a wide screen's claim");
    let held = false;
    await page.route(WIDE_FILE, async (route) => {
      held = true;
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(page.getByTestId("edge-grab-left")).toBeAttached();
    expect(held, "the strips came from their own file").toBe(true);
  });

  test("an iPad held upright has them before the first squeeze of the Pencil", async ({ browser, isMobile }) => {
    // Upright, an iPad draws no page-edge strips, so nothing on the first page
    // asks for the file. The Pencil's ring of pens is in it, and a first squeeze
    // that waited for a download would show the ring late. So any screen wider
    // than a phone fetches it once the page is up, without being asked.
    test.skip(isMobile, "a wide screen's claim");
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, serviceWorkers: "block" });
    const page = await context.newPage();
    const asked = page.waitForRequest(WIDE_FILE, { timeout: 6000 });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(page.getByTestId("edge-grab-left"), "upright, there are no strips to ask for it").toHaveCount(0);
    await asked;
    await context.close();
  });

  test("a phone on its side never asks for them either", async ({ browser, isMobile }) => {
    test.skip(isMobile, "drawn as a phone in a desktop browser, so it runs once");
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: "block" });
    const page = await context.newPage();
    const asked: string[] = [];
    page.on("request", (r) => {
      if (WIDE_FILE.test(r.url())) asked.push(r.url());
    });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.waitForTimeout(3000);
    expect(asked, "the phone on its side downloaded the wide-screen parts").toEqual([]);
    await context.close();
  });

  test("if their file never arrives, the page still reads and turns", async ({ page, isMobile }) => {
    test.skip(isMobile, "a wide screen's claim");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(WIDE_FILE, (route) => route.abort());
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.waitForTimeout(800);
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(page.getByTestId("edge-grab-left")).toHaveCount(0);

    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/p9$/);
    await expect(pageSvg(page, 9)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

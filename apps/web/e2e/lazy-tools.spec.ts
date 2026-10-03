import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * Rarely used tools load when they are first opened, not with the first page.
 *
 * Start-up on a slow phone is mostly download time, so every kilobyte in the
 * first script is paid before the reader sees a page (the optimizing-performance
 * skill). The sheets below are opened by a minority of readers and never before
 * the page is up, so they live in one file of their own, fetched the first time
 * any of them opens (src/components/later.tsx).
 *
 * Two claims, and both need a real build: which source files ended up in the
 * first script is only known after bundling, and "opening it while it is still
 * on its way shows nothing broken" is only known with a slow network.
 */

/** Source files that must not be in the script the first page waits for. */
const LATER = [
  "components/Colophon.tsx",
  "components/RevisionMap.tsx",
  "components/PackShelf.tsx",
  "components/BookmarkShelf.tsx",
  "components/EditionPicker.tsx",
  "components/RootLens.tsx",
  "components/NoteBox.tsx",
  "components/CropSheet.tsx",
  "components/WordParts.tsx",
  "components/WordPartsHost.tsx",
  "components/BookmarkDrawer.tsx",
  "components/DiffView.tsx",
];

/** The one file they share. */
const TOOLS_FILE = /\/assets\/rarely-used-[^/]+\.js$/;

// A first visit: nothing cached yet, and every request seen by the test (a
// service worker would answer from its own cache, out of the test's sight).
test.use({ serviceWorkers: "block" });

const pageSvg = (page: Page, n: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);

test.describe("Hifth · rarely used tools load when first opened", () => {
  test("the first script carries none of them", async ({ page }) => {
    await page.goto("/");
    const src = await page.locator('script[type="module"][src]').first().getAttribute("src");
    expect(src, "the page names its start-up script").toBeTruthy();
    const url = new URL(src!, page.url()).href;
    const map = await (await page.request.get(`${url}.map`)).json();
    const sources: string[] = map.sources;
    // Guard against a map that names nothing (the check would pass vacuously).
    expect(sources.some((s) => s.endsWith("src/App.tsx"))).toBe(true);
    const inside = LATER.filter((f) => sources.some((s) => s.endsWith(`src/${f}`)));
    expect(inside, "tools still in the start-up script").toEqual([]);
  });

  // Each opened by its own button, with the tools' file held back for a moment,
  // as on a slow connection the first time. The file is not asked for until the
  // button is pressed; the page must not move, nothing may spin, and the sheet
  // then appears.
  const SHEETS: { name: string; open: (p: Page) => Promise<void>; sheet: (p: Page) => Locator }[] = [
    {
      name: "about",
      open: (p) => p.getByRole("button", { name: /عن حِفظ/ }).click(),
      sheet: (p) => p.getByRole("dialog", { name: "عن حِفظ" }),
    },
    {
      name: "the revision record",
      open: (p) => p.getByRole("button", { name: /ما فتحتَه من المصحف/ }).click(),
      sheet: (p) => p.getByRole("dialog", { name: "ما فتحتَه من المصحف" }),
    },
    {
      name: "the edition picker",
      open: (p) => p.getByRole("button", { name: "المصحف", exact: true }).click(),
      sheet: (p) => p.getByRole("dialog", { name: "المصحف" }),
    },
  ];

  for (const s of SHEETS) {
    test(`${s.name}: opening it on a slow first load shows nothing broken`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let fetched = false;
      await page.route(TOOLS_FILE, async (route) => {
        fetched = true;
        await new Promise((r) => setTimeout(r, 1200));
        await route.continue();
      });

      await page.goto("/#/hafs-kfqc/p7");
      await expect(pageSvg(page, 7)).toBeVisible();
      const before = await pageSvg(page, 7).boundingBox();
      expect(fetched, "the tools were fetched before anyone opened one").toBe(false);

      const asked = page.waitForRequest(TOOLS_FILE);
      await s.open(page);
      await asked;
      // While it is on its way: no spinner, and the page has not moved.
      await expect(page.getByRole("progressbar")).toHaveCount(0);
      expect(await pageSvg(page, 7).boundingBox()).toEqual(before);

      await expect(s.sheet(page)).toBeVisible();
      expect(await pageSvg(page, 7).boundingBox()).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
});

/**
 * Press Escape inside the same step the named sheet is added to the page,
 * before any frame is drawn. A sheet whose code has only just arrived is drawn
 * by no tap of the reader's, so it must listen from the moment it shows, or the
 * Escape falls on the page behind it.
 */
async function escapeAsItAppears(page: Page, name: string): Promise<void> {
  await page.evaluate((name) => {
    const w = window as Window & { focusAsItAppeared?: string };
    const named = (d: Element) => {
      const by = d.getAttribute("aria-labelledby");
      return (d.getAttribute("aria-label") ?? (by ? document.getElementById(by)?.textContent : null)) === name;
    };
    new MutationObserver((_, watch) => {
      if (![...document.querySelectorAll('[role="dialog"]')].some(named)) return;
      watch.disconnect();
      w.focusAsItAppeared = document.activeElement?.tagName ?? "";
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }).observe(document.body, { childList: true, subtree: true });
  }, name);
}

test.describe("Hifth · a sheet that has just loaded hears an Escape at once", () => {
  test("the bookmark drawer", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await escapeAsItAppears(page, "علامة");
    await page.keyboard.press("KeyB");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog", { name: "علامة" })).toHaveCount(0);
    // The name field was ready the moment the drawer showed, so the first letters typed land in it.
    expect(await page.evaluate(() => (window as Window & { focusAsItAppeared?: string }).focusAsItAppeared)).toBe("INPUT");
  });

  test("the map of what you have opened", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await escapeAsItAppears(page, "ما فتحتَه من المصحف");
    await page.getByRole("button", { name: /ما فتحتَه من المصحف/ }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog", { name: "ما فتحتَه من المصحف" })).toHaveCount(0);
  });
});

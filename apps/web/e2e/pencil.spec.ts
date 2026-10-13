import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { LANG_STORAGE_KEY } from "../src/lang";

/*
 * The Apple Pencil's double-tap and squeeze (docs/PLAN.md, 96; docs/design/
 * pencil-gestures.md, ①, option B). A web page never hears either; the iPad
 * app does, and hands each one to the page with the reader's own pencil
 * setting and, when the pencil hovers, where its tip is. The simulator cannot
 * send the gestures, so these tests play the app: they call what the page
 * exposes to it, exactly as the app's Swift does.
 *
 * What they hold the page to: a squeeze opens Hifth's pens beside the tip,
 * whole on the screen, and picking one puts it in hand and puts the pens
 * away; a double-tap swaps between the last tool used and plain selecting; a
 * setting that means nothing in Hifth does nothing. On an iPad held sideways
 * and upright, in both languages.
 */

const SIDEWAYS = { width: 1180, height: 820 };
const UPRIGHT = { width: 820, height: 1180 };

type Gesture = { kind: string; pref: string; x?: number; y?: number };

async function openOn(browser: Browser, view: { width: number; height: number }, lang: string, inApp = true) {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: view, locale: "en-US" });
  const page = await context.newPage();
  await page.addInitScript(
    ([coach, langKey, l, app]) => {
      // What the app sets before any of the page's own code runs.
      if (app) (window as unknown as { __HIFTH_NATIVE__: unknown }).__HIFTH_NATIVE__ = Object.freeze({ platform: "ios", publicBase: "https://example.test/hifth/" });
      try {
        localStorage.setItem(coach, "1");
        localStorage.setItem(langKey, l);
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, LANG_STORAGE_KEY, lang, inApp] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
  return { page, context };
}

/** What the app's Swift runs for a gesture. */
async function pencil(page: Page, e: Gesture): Promise<void> {
  await page.evaluate((g) => (window as unknown as { __HIFTH_PAGE__?: { pencil?: (x: unknown) => void } }).__HIFTH_PAGE__?.pencil?.(g), e);
}

function inHand(page: Page): Locator {
  return page.locator("[data-page][data-tool]").first();
}

function palette(page: Page): Locator {
  return page.locator("[data-pencil-pens]");
}

async function wholeOnScreen(page: Page, el: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await el.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x, "off the left").toBeGreaterThanOrEqual(0);
  expect(box.y, "off the top").toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, "off the right").toBeLessThanOrEqual(view.width);
  expect(box.y + box.height, "off the foot").toBeLessThanOrEqual(view.height);
  return box;
}

for (const [held, view] of [["sideways", SIDEWAYS], ["upright", UPRIGHT]] as const)
  for (const lang of ["en", "ar"]) {
    test.describe(`an iPad held ${held}, in ${lang}`, () => {
      test("a squeeze opens the pens beside the tip, whole on the screen, and a pick puts that pen in hand", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        await expect(palette(page)).toHaveCount(0);
        // Near each side of the screen, so the pens have to stand on whichever side has room.
        for (const at of [{ x: 200, y: 300 }, { x: view.width - 60, y: view.height - 120 }]) {
          await pencil(page, { kind: "squeeze", pref: "palette", ...at });
          await expect(palette(page)).toBeVisible();
          await expect(palette(page).getByRole("radio")).toHaveCount(10);
          const box = await wholeOnScreen(page, palette(page));
          // Beside the tip, not over it, and close to it.
          const covers = at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;
          expect(covers, "covers the tip").toBe(false);
          const gapX = Math.max(box.x - at.x, at.x - (box.x + box.width), 0);
          const gapY = Math.max(box.y - at.y, at.y - (box.y + box.height), 0);
          expect(Math.hypot(gapX, gapY), "far from the tip").toBeLessThan(80);
          await page.keyboard.press("Escape");
          await expect(palette(page)).toHaveCount(0);
        }
        await pencil(page, { kind: "squeeze", pref: "palette", x: 300, y: 300 });
        await palette(page).locator("[role=radio][aria-keyshortcuts=M]").click();
        await expect(palette(page)).toHaveCount(0);
        await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
        await context.close();
      });

      test("a double-tap swaps between the last tool used and plain selecting", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        // Nothing used yet: there is nothing to swap to, so the pens open instead.
        await pencil(page, { kind: "doubleTap", pref: "eraser" });
        await expect(palette(page)).toBeVisible();
        await wholeOnScreen(page, palette(page));
        await palette(page).locator("[role=radio][aria-keyshortcuts=M]").click();
        await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
        await pencil(page, { kind: "doubleTap", pref: "previous" });
        await expect(inHand(page)).toHaveAttribute("data-tool", "select");
        await pencil(page, { kind: "doubleTap", pref: "eraser" });
        await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
        await expect(palette(page)).toHaveCount(0);
        await context.close();
      });

      test("the colours setting opens the highlighter's four pens", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        await pencil(page, { kind: "doubleTap", pref: "colours", x: 400, y: 400 });
        await expect(palette(page)).toBeVisible();
        await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
        const pens = palette(page).getByRole("radiogroup").filter({ hasNot: page.locator("[aria-keyshortcuts]") }).first();
        await expect(pens.getByRole("radio")).toHaveCount(4);
        await wholeOnScreen(page, palette(page));
        await pens.getByRole("radio").nth(1).click();
        await expect(palette(page)).toHaveCount(0);
        await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
        await context.close();
      });

      test("a setting that means nothing here does nothing", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        for (const pref of ["ignore", "shortcut", "unknown"]) {
          await pencil(page, { kind: "squeeze", pref, x: 300, y: 300 });
          await pencil(page, { kind: "doubleTap", pref });
        }
        await page.waitForTimeout(300);
        await expect(palette(page)).toHaveCount(0);
        await expect(inHand(page)).toHaveAttribute("data-tool", "select");
        await context.close();
      });
    });
  }

test("in a browser the page offers the app nothing", async ({ browser }) => {
  const { page, context } = await openOn(browser, SIDEWAYS, "en", false);
  expect(await page.evaluate(() => typeof (window as unknown as { __HIFTH_PAGE__?: unknown }).__HIFTH_PAGE__)).toBe("undefined");
  await context.close();
});

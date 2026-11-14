import { test, expect, type Locator, type Page } from "@playwright/test";
import { LANG_STORAGE_KEY } from "../src/lang";
import { TOUCH_FULL_TOOLS_KEY } from "../src/touch-full-tools";

/*
 * Keeping the tools in full screen on a phone and an upright iPad (decision
 * verse-tap-and-hold ①; backlog full-screen-keeps-tools). A laptop and an iPad
 * on its side keep them down the side (full-screen-tools.spec.ts); a phone and
 * an upright iPad put them away with the bars, so marking a mistake meant
 * leaving full screen. Built three ways, as a setting:
 *
 *   button  a round Tools button stays in the bottom corner; the tray it opens
 *           folds back once a tool is picked, so it never lies on the page (default)
 *   row     the bottom line stays, tools and all; only the top bar and the slider go
 *   none    full screen puts them away with the other bars, as before
 *
 * Written before the build (2026-11-14) and watched failing.
 */

test.use({ locale: "en-US" });
test.skip(({ isMobile }) => !isMobile, "the phone's own bars");

const button = (page: Page): Locator => page.locator("[data-full-touch-tools]").getByRole("button", { name: /^Page tools · / });
const tray = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^What went wrong in / });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const showBars = (page: Page): Locator => page.getByRole("button", { name: "Show the bars" });

async function openInFullScreen(page: Page, mode?: string): Promise<void> {
  if (mode) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: TOUCH_FULL_TOOLS_KEY, value: mode });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.locator("[data-full]")).toHaveCount(1);
  await expect(page.locator("header")).toBeHidden();
}

/**
 * The lowest point of a verse on the screen, across its middle: the last line a
 * reader sees, where an open tray would lie.
 */
async function lastLineWord(page: Page): Promise<{ x: number; y: number }> {
  const at = await page.evaluate(() => {
    const x = window.innerWidth / 2;
    for (let y = window.innerHeight - 8; y > window.innerHeight / 2; y -= 4) {
      for (const dx of [0, -30, 30, -60, 60]) {
        if (document.elementFromPoint(x + dx, y)?.closest("path.ayahPolygon")) return { x: x + dx, y };
      }
    }
    return null;
  });
  expect(at, "a verse near the foot of the screen").not.toBeNull();
  return at!;
}

async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished)));
}

function apart(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;
}

for (const where of [
  { name: "a phone", use: {} },
  { name: "a short phone", use: { viewport: { width: 375, height: 667 } } },
  { name: "an upright iPad", use: { viewport: { width: 768, height: 1024 } } },
]) {
  test.describe(`in full screen on ${where.name}`, () => {
    test.use(where.use);

    test("by default a Tools button stays, and a mistake on the last line is marked without leaving full screen", async ({ page }) => {
      test.slow();
      await openInFullScreen(page);
      await expect(button(page)).toBeVisible();
      await button(page).click();
      await settled(tray(page));
      await tray(page).getByRole("radio", { name: "Mistake", exact: true }).click();
      // Picking folds the tray back to the button, which now shows the tool.
      await expect(tray(page)).toHaveCount(0);
      await expect(button(page)).toHaveAccessibleName(/Mistake is on$/);
      const at = await lastLineWord(page);
      await page.mouse.click(at.x, at.y);
      await picker(page).getByRole("button", { name: "The whole word" }).click();
      await expect(washes(page)).toHaveCount(1);
      await expect(page.locator("header"), "still full screen").toBeHidden();
    });

    test("the Tools button and Show the bars sit apart, and off the page", async ({ page }) => {
      // Safari's "Install Hifth" notice, until hidden, pushes the page ~160px
      // down and past the foot of a phone screen, whatever the button does; a
      // reader who has hidden it is the case this checks (backlog
      // full-screen-install-notice).
      await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
      await openInFullScreen(page);
      const a = (await button(page).boundingBox())!;
      const b = (await showBars(page).boundingBox())!;
      expect(apart(a, b), "English").toBe(true);
      const size = page.viewportSize()!;
      expect(a.y + a.height, "on the screen").toBeLessThanOrEqual(size.height);
      // The corner is where a line ends in Arabic, so the button must not lie
      // on the page at all, not only off its middle.
      const written = (await page.locator('svg[aria-labelledby="page-label-7"]').boundingBox())!;
      expect(apart(a, written), "the button is off the page").toBe(true);
    });

    test("picking the highlighter keeps the tray up for its colours, and a colour folds it", async ({ page }) => {
      await openInFullScreen(page);
      await button(page).click();
      await settled(tray(page));
      await tray(page).getByRole("radio", { name: "Highlight", exact: true }).click();
      const colours = tray(page).getByRole("radiogroup", { name: "Highlighter colour" });
      await expect(colours).toBeVisible();
      await colours.getByRole("radio").nth(1).click();
      await expect(tray(page)).toHaveCount(0);
      await expect(button(page)).toHaveAccessibleName(/Highlight/);
    });

    test("the Tools button and the way back sit apart in Arabic too", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "ar"), LANG_STORAGE_KEY);
      await page.goto("/#/hafs-kfqc/p7");
      await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
      await page.locator("[data-full-enter]").click();
      await expect(page.locator("[data-full]")).toHaveCount(1);
      const c = (await page.locator("[data-full-touch-tools] button").first().boundingBox())!;
      const d = (await page.locator("[data-show-bars]").boundingBox())!;
      expect(apart(c, d), "Arabic").toBe(true);
    });

    test("the bottom line can stay instead, and its button brings the bars back", async ({ page }) => {
      await openInFullScreen(page, "row");
      await expect(page.locator("footer")).toBeVisible();
      await expect(page.locator('[data-phone-bar="c"]')).toBeVisible();
      await expect(page.locator("[data-full-touch-tools]")).toHaveCount(0);
      // One way back, in the line itself, not a second over it.
      await expect(showBars(page)).toHaveCount(1);
      await showBars(page).click();
      await expect(page.locator("header")).toBeVisible();
    });

    test("or full screen puts the tools away, as before", async ({ page }) => {
      await openInFullScreen(page, "none");
      await expect(page.locator("[data-full-touch-tools]")).toHaveCount(0);
      await expect(page.locator('[data-phone-bar="c"]')).toBeHidden();
      await expect(showBars(page)).toBeVisible();
    });
  });
}

test("the setting is in the info panel, the button chosen until the reader picks", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
  await page.getByRole("button", { name: /About Hifth/ }).tap();
  const group = page.getByRole("dialog", { name: /About Hifth/ }).getByRole("radiogroup", { name: "In full screen, the tools" });
  await group.scrollIntoViewIfNeeded();
  await expect(group.getByRole("radio", { name: "A Tools button in the corner" })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio")).toHaveCount(3);
  await group.getByRole("radio", { name: "The bottom line stays" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOUCH_FULL_TOOLS_KEY)).toBe("row");
});

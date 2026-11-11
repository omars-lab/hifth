import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { WORD_TAP_KEY } from "../src/word-tap";
import { DRAWER_MARKS_KEY } from "../src/drawer-marks";

/*
 * Which drawer sits on which (docs/design/ayah-drawer.md ①). The owner asked,
 * on the app's page on 2026-11-07, that it always be clear which drawer is open
 * and which one sits on which: settings, then the verse, then the word. The
 * first picture (2026-11-10) showed the word's drawer on the verse's with the
 * same face and the same verse named twice, nothing tying the top to the bottom.
 *
 * Two ways are built and the reader picks in the info panel: a path in the top
 * drawer's heading (the default), or a tag naming each drawer's level.
 *
 * Written before the build (2026-11-10) and watched failing.
 */
test.use({ locale: "en-US", viewport: { width: 1440, height: 900 } });

const verse = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });
const word = (page: Page): Locator => page.getByRole("dialog", { name: /^The parts of a word in / });

async function openBoth(page: Page, seed: Record<string, string> = {}): Promise<void> {
  await page.addInitScript(
    ([coach, tap, values]) => {
      try {
        localStorage.setItem(coach, "1");
        localStorage.setItem(tap, "word");
        for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, WORD_TAP_KEY, seed] as const,
  );
  await page.goto("/#/hafs-kfqc/2:45");
  await expect(verse(page)).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.locator("#hifth-overlay .hl-sel").count()).toBeGreaterThan(0);
  const at = await page.evaluate(() => {
    const r = [...document.querySelectorAll("#hifth-overlay .hl-sel")]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0)
      .sort((a, b) => a.top - b.top)[0]!;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect(word(page)).toBeVisible();
}

test.describe("Hifth · which drawer sits on which", () => {
  test.skip(({ isMobile }) => !!isMobile, "the stacked drawers are a wide screen's");

  test("by default the word's drawer names the verse's under it, and that name steps back down", async ({ page }) => {
    await openBoth(page);
    const back = word(page).getByRole("button", { name: /Back to Al-Baqarah · 2:45/ });
    await expect(back).toBeVisible();
    // The path reads verse, then word, in one line.
    await expect(word(page).getByText("The parts of a word", { exact: true })).toBeVisible();
    await back.click();
    await expect(word(page)).toHaveCount(0);
    await expect(verse(page)).toBeVisible();
  });

  test("set to tags, each drawer names its level and no path is drawn", async ({ page }) => {
    await openBoth(page, { [DRAWER_MARKS_KEY]: "tag" });
    await expect(verse(page).getByText("Verse", { exact: true })).toBeVisible();
    await expect(word(page).getByText("Word", { exact: true })).toBeVisible();
    await expect(word(page).getByRole("button", { name: /Back to/ })).toHaveCount(0);
    // The upper drawer has a coloured top edge of its own, so the two do not read as one.
    // (Their colours alone differ already, the verse's drawer having no border, so the width is what is asked.)
    expect(await word(page).evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThanOrEqual(3);
  });

  test("the info panel switches between the two", async ({ page }) => {
    await page.addInitScript((coach) => localStorage.setItem(coach, "1"), COACH_STORAGE_KEY);
    await page.goto("/#/hafs-kfqc/p7");
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const group = page.getByRole("radiogroup", { name: "How a drawer shows what it sits on" });
    await expect(group.getByRole("radio", { name: "A path in its heading" })).toHaveAttribute("aria-checked", "true");
    await group.getByRole("radio", { name: "A tag naming its level" }).click();
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAWER_MARKS_KEY)).toBe("tag");
  });
});

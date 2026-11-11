import { test, expect, type Locator, type Page } from "@playwright/test";
import { WORD_TAP_KEY } from "../src/word-tap";

/*
 * A word's drawer stacked on top of the verse's (decision selection-drawer,
 * open question ①). The owner asked on the drawer page whether a tap on a word
 * gets a word drawer on top of the verse's. It is built as a setting, today's
 * way (a second tap puts the verse out) still the default, so these tests turn
 * the setting on first, and one checks the default is untouched.
 *
 * Written before the build (2026-11-09) and watched failing: the second tap
 * put the verse out and no word drawer opened.
 */

test.use({ locale: "en-US" });

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });
const parts = (page: Page): Locator => page.getByRole("dialog", { name: /^The parts of a word in / });

/** The middle of the lit verse's first line, in window pixels. */
async function inLitVerse(page: Page): Promise<{ x: number; y: number }> {
  await expect
    .poll(() => page.locator("#hifth-overlay .hl-sel").count(), { message: "a verse is lit" })
    .toBeGreaterThan(0);
  return page.evaluate(() => {
    const r = [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0)
      .sort((a, b) => a.top - b.top)[0]!;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

for (const size of [
  { name: "a laptop", width: 1440, height: 900 },
  { name: "an iPad on its side", width: 1180, height: 820 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("with the setting on, a second tap on the lit verse opens the word above the verse's drawer, and both stay", async ({
      page,
    }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "word"), WORD_TAP_KEY);
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });

      const at = await inLitVerse(page);
      await page.mouse.click(at.x, at.y);

      await expect(parts(page)).toBeVisible();
      await parts(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      // The verse stays lit and its drawer stays up, under the word's.
      await expect(drawer(page)).toBeVisible();
      await expect(page.locator("#hifth-overlay .hl-sel").first()).toBeAttached();
      const word = (await parts(page).boundingBox())!;
      const verse = (await drawer(page).boundingBox())!;
      expect(word.y + word.height, "the word's drawer sits on top of the verse's").toBeLessThanOrEqual(verse.y + 1);
      expect(word.y + word.height).toBeGreaterThan(verse.y - 4);
      // The page lifts the lit verse clear of the word's drawer, as it does for
      // the verse's own: the first picture (2026-11-09) left 2:45 under it.
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              Math.max(
                ...[...document.querySelectorAll("#hifth-overlay .hl-sel")]
                  .map((el) => el.getBoundingClientRect())
                  .filter((b) => b.width > 0)
                  .map((b) => b.bottom),
              ),
            ),
          { message: "the lit verse's lowest line stands above the word's drawer" },
        )
        .toBeLessThanOrEqual(word.y + 1);

      // Closing the word's drawer leaves the verse's.
      await page.keyboard.press("Escape");
      await expect(parts(page)).toHaveCount(0);
      await expect(drawer(page)).toBeVisible();
    });

    // The word's drawer stands on the verse's. When the verse's drawer goes
    // away under it, the word's goes with it, rather than floating over a gap
    // (checked 2026-11-10, the open note on the stacked drawer).
    for (const away of [
      {
        how: "the page goes full screen",
        go: (page: Page) =>
          page.getByRole("button", { name: "Full screen" }).filter({ visible: true }).first().click(),
      },
      {
        how: "the highlighter is picked",
        go: (page: Page) =>
          page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio", { name: "Highlight", exact: true }).click(),
      },
    ]) {
      test(`with the word's drawer stacked, it closes with the verse's when ${away.how}`, async ({ page }) => {
        await page.addInitScript((key) => localStorage.setItem(key, "word"), WORD_TAP_KEY);
        await page.goto("/#/hafs-kfqc/2:45");
        await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
        const at = await inLitVerse(page);
        await page.mouse.click(at.x, at.y);
        await expect(parts(page)).toBeVisible();

        await away.go(page);
        if (away.how.includes("full screen")) await expect(drawer(page)).toHaveCount(0);
        await expect(parts(page), "no word drawer left over the page").toHaveCount(0);
      });
    }

    test("with the setting on and the highlighter in hand, a second tap still puts the verse out", async ({
      page,
    }) => {
      // The page opens words only under the plain pointer; under the
      // highlighter the second tap went nowhere at all (found 2026-11-09).
      await page.addInitScript((key) => localStorage.setItem(key, "word"), WORD_TAP_KEY);
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
      await page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio", { name: "Highlight", exact: true }).click();
      const at = await inLitVerse(page);
      await page.mouse.click(at.x, at.y);
      await expect(drawer(page)).toHaveCount(0);
      await expect(parts(page)).toHaveCount(0);
    });

    test("with the setting on, holding the lit verse does not also open the word", async ({ page }) => {
      // A hold has its own meaning; the word's drawer opened on the release
      // as well, on top of it (found 2026-11-09).
      await page.addInitScript((key) => localStorage.setItem(key, "word"), WORD_TAP_KEY);
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
      const at = await inLitVerse(page);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
      await page.waitForTimeout(400);
      await expect(parts(page)).toHaveCount(0);
    });

    test("by default, a second tap on the lit verse still puts it out", async ({ page }) => {
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
      const at = await inLitVerse(page);
      await page.mouse.click(at.x, at.y);
      await expect(drawer(page)).toHaveCount(0);
      await expect(parts(page)).toHaveCount(0);
    });
  });
}

test("the setting is in the info panel, putting the verse out chosen until the reader picks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hafs-kfqc/2:45");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const group = page
    .getByRole("dialog", { name: /About Hifth/ })
    .getByRole("radiogroup", { name: "Tapping the lit verse again" });
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio", { name: "Puts the verse out" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: "Opens the word you tapped" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), WORD_TAP_KEY)).toBe("word");
});

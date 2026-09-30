import { test, expect, type Locator, type Page } from "@playwright/test";
import { inkToken } from "./ink";

/*
 * The highlighter's colours. A passage is pastel green and a run of words
 * pastel blue by default, and while the highlighter is on the toolbar offers
 * its four pens — green, blue, yellow, pink — to paint the next passage with.
 * The owner, 2026-09-30: "should be defaults, there should be settings to
 * update them, selectable from the toolbar for the highlighter".
 *
 * Runs on a computer and on both phones: each has its own toolbar.
 */
test.use({ locale: "en-US" });

const GREEN = "rgb(155, 217, 181)";
const BLUE = "rgb(186, 203, 243)";
const PINK = "rgb(237, 155, 196)";
const PASSAGE = "/#/hafs-kfqc/2:47-2:48";

async function passageFill(page: Page): Promise<string> {
  const ink = page.locator('svg[aria-labelledby="page-label-7"]:visible #hifth-overlay .hl-hlt.hl-ink');
  await expect.poll(() => ink.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  return ink.first().evaluate((el) => getComputedStyle(el).fill);
}

/** Switch the highlighter on from whichever bar this device shows. */
async function highlighterOn(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.locator('[data-phone-bar="c"]').getByRole("button", { name: /^Page tools · / }).click();
  await page.getByRole("radio", { name: "Highlight", exact: true }).click();
}

const pens = (page: Page): Locator => page.getByRole("radiogroup", { name: "Highlighter colour" });

test.describe("Hifth · the highlighter's colours", () => {
  test("a passage is pastel green and a run of words pastel blue by default", async ({ page }) => {
    await page.goto(PASSAGE);
    expect(await passageFill(page), "the passage").toBe(GREEN);
    expect(await inkToken(page, "--ink-run"), "a run of words").toBe(BLUE);
  });

  test("the toolbar offers four pens while the highlighter is on, green first", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pens(page)).toHaveCount(0);
    await highlighterOn(page, !!isMobile);
    const radios = pens(page).getByRole("radio");
    await expect(radios).toHaveCount(4);
    expect(await radios.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
      "Green",
      "Blue",
      "Yellow",
      "Pink",
    ]);
    await expect(pens(page).getByRole("radio", { name: "Green" })).toHaveAttribute("aria-checked", "true");
  });

  test("a pen picked in the toolbar paints the passage, and is remembered", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await highlighterOn(page, !!isMobile);
    await pens(page).getByRole("radio", { name: "Pink" }).click();
    await expect(pens(page).getByRole("radio", { name: "Pink" })).toHaveAttribute("aria-checked", "true");

    await page.goto(PASSAGE);
    await page.reload();
    expect(await passageFill(page), "the passage, after a reload").toBe(PINK);
    // The run of words keeps its own colour whatever pen is picked.
    expect(await inkToken(page, "--ink-run")).toBe(BLUE);
  });
});

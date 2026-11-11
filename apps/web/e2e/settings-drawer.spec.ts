import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { SETTINGS_AT_KEY } from "../src/settings-at";

/*
 * The reading settings behind one button in the top bar, in a drawer of their
 * own (docs/design/ayah-drawer.md ①). The owner asked, on the app's page on
 * 2026-11-07, for a settings button in the bar holding what the bar carries
 * today. Both are built and the reader picks in the info panel; the bar keeps
 * its controls by default until the owner has tried the drawer.
 *
 * Written before the build (2026-11-10) and watched failing: the bar had no
 * settings button, and the setting did not exist.
 */
test.use({ locale: "en-US" });

async function openWith(page: Page, seed: Record<string, string> = {}): Promise<void> {
  await page.addInitScript(
    ([coach, values]) => {
      try {
        localStorage.setItem(coach, "1");
        if (!localStorage.getItem("settings-at-seeded")) {
          for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
          localStorage.setItem("settings-at-seeded", "1");
        }
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, seed] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
}

const head = (page: Page): Locator => page.locator("header").first();
const opener = (page: Page): Locator => head(page).getByRole("button", { name: "Reading settings" });
const drawer = (page: Page): Locator => page.getByRole("region", { name: "Reading settings" });

test.describe("Hifth · the reading settings in a drawer", () => {
  test.skip(({ isMobile }) => !!isMobile, "the bar's reading controls are a wide screen's");

  test("by default the bar keeps its controls and has no settings button", async ({ page }) => {
    await openWith(page);
    await expect(head(page).getByRole("radiogroup", { name: "Pages shown" })).toBeVisible();
    await expect(opener(page)).toHaveCount(0);
  });

  test("set to the drawer, one button opens the controls the bar carried", async ({ page }) => {
    await openWith(page, { [SETTINGS_AT_KEY]: "drawer" });
    await expect(opener(page)).toBeVisible();
    await expect(opener(page)).toHaveAttribute("aria-expanded", "false");
    // The controls left the bar.
    await expect(head(page).getByRole("button", { name: /zoom in/i })).toHaveCount(0);
    await opener(page).click();
    await expect(opener(page)).toHaveAttribute("aria-expanded", "true");
    const d = drawer(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole("button", { name: /zoom in/i })).toBeVisible();
    await expect(d.getByRole("radiogroup", { name: "Language" })).toBeVisible();
    await expect(d.getByRole("group", { name: "Page appearance" })).toBeVisible();
    // The keyboard hints keep each word on one line: the drawer is only as wide
    // as its widest control, and "Go to" broke in two to fit (seen 2026-11-10).
    const hint = async (word: string): Promise<number> =>
      (await d.getByText(word, { exact: true }).boundingBox())!.height;
    expect(await hint("Go to")).toBeLessThanOrEqual((await hint("Pages")) + 1);
    // A control in it works from there.
    const one = d.getByRole("radiogroup", { name: "Pages shown" }).getByRole("radio").filter({ hasText: "One" });
    await one.click();
    await expect(one).toHaveAttribute("aria-checked", "true");
  });

  test("Escape puts the drawer away and gives the button back the keyboard", async ({ page }) => {
    await openWith(page, { [SETTINGS_AT_KEY]: "drawer" });
    await opener(page).click();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);
    await expect(opener(page)).toBeFocused();
  });

  test("pressing the button again puts it away", async ({ page }) => {
    await openWith(page, { [SETTINGS_AT_KEY]: "drawer" });
    await opener(page).click();
    await expect(drawer(page)).toBeVisible();
    await opener(page).click();
    await expect(drawer(page)).toHaveCount(0);
  });

  test("the info panel switches between the two", async ({ page }) => {
    await openWith(page);
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const group = page.getByRole("radiogroup", { name: "Where the reading settings sit" });
    await group.getByRole("radio", { name: "In a drawer behind one button" }).click();
    await page.keyboard.press("Escape");
    await expect(opener(page)).toBeVisible();
  });
});

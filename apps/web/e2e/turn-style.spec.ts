import { test, expect, type Page } from "@playwright/test";
import { watchFolds, foldsSeen } from "./fold";
import { TURN_STYLE_KEY } from "../src/turn-style";

/*
 * The turn style — the reader's choice of how a page turn looks (page-turn-curl,
 * decided 2026-09-26): the flat seam by default, or the curl, or the shadow.
 *
 * Each row turns 7 → 8 → 9. The first turn stays inside one opening (facing
 * pages), which no style curls or lifts, so it is always the seam's crease; the
 * second turns a leaf, and draws in the chosen style. And each row ends at rest
 * with nothing left on the page — a leaf or a shadow that stayed would sit over
 * the words.
 */

const NUM = "header .numeric";
const NEXT = "الصفحة التالية";

async function openWith(page: Page, style: string | null): Promise<void> {
  await watchFolds(page);
  if (style) {
    await page.addInitScript(
      ([k, v]) => {
        localStorage.setItem(k, v);
      },
      [TURN_STYLE_KEY, style] as const,
    );
  }
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await expect(page.locator(NUM)).toHaveText("7");
}

async function turnTwice(page: Page): Promise<void> {
  await page.getByRole("button", { name: NEXT }).tap();
  await expect(page.locator(NUM)).toHaveText("8");
  await page.getByRole("button", { name: NEXT }).tap();
  await expect(page.locator(NUM)).toHaveText("9");
  await expect(page.locator("[data-fold]")).toHaveCount(0);
}

test.describe("Hifth · turn style", () => {
  for (const [stored, drawn] of [
    [null, "seam"],
    ["curl", "curl"],
    ["lift", "lift"],
  ] as const) {
    test(`a leaf turns in the ${drawn} style${stored ? "" : " when nothing was chosen"}`, async ({ page }) => {
      await openWith(page, stored);
      await turnTwice(page);
      const seen = await foldsSeen(page);
      expect(seen.map((f) => [f.word, f.style])).toEqual([
        ["crease", "seam"],
        ["gap", drawn],
      ]);
    });
  }

  test("the setting is picked in the about sheet and remembered", async ({ page }) => {
    await openWith(page, null);
    await page.getByRole("button", { name: /عن حِفظ/ }).tap();
    const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
    const group = sheet.getByRole("radiogroup", { name: "تقليب الصفحة" });
    await expect(group.getByRole("radio", { checked: true })).toHaveText("خطّ مسطّح");
    await group.getByRole("radio", { name: "انثناء الورقة" }).tap();
    await expect(group.getByRole("radio", { checked: true })).toHaveText("انثناء الورقة");
    expect(await page.evaluate((k) => localStorage.getItem(k), TURN_STYLE_KEY)).toBe("curl");
  });
});

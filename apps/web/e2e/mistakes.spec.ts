import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The mistake tool, step 3 of docs/design/page-toolbar-plan.md: M picks it, a
 * tap on a word marks it in a quiet red and the tool stays on; a second tap on
 * the marked word opens the sign picker; picking a sign records it; the mark is
 * still there after a reload; clearing it asks nothing and Undo puts it back.
 * Desktop only, like the bar it sits on.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const toolBtn = (page: Page, name: string): Locator => bar(page).getByRole("radio", { name, exact: true });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const signRings = (page: Page): Locator => page.locator("[data-mistake-sign]:visible");
const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^Which sign did you slip on in / });
const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

test.describe("Hifth · the mistake tool", () => {
  test("M marks words, a second tap picks the sign, and it outlasts a reload", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("KeyM");
    await expect(toolBtn(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Tap a word to mark a slip");

    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(1);
    await expect(said(page)).toHaveText(/^Slip marked on /);
    // The tool stays on for the next slip, and the tap did not select the verse.
    await expect(toolBtn(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);
    // The wash is the app's danger colour, not a stock red.
    const fill = await washes(page).first().evaluate((el) => getComputedStyle(el).fill);
    const danger = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--danger)";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(fill).toBe(danger);

    // A second tap on the same word opens the picker instead of marking again.
    await page.mouse.click(at.x, at.y);
    await expect(picker(page)).toBeVisible();
    await expect(washes(page)).toHaveCount(1);
    const signs = picker(page).locator("[data-sign]");
    expect(await signs.count()).toBeGreaterThan(0);
    await expect(picker(page).getByRole("button", { name: "The whole word" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await signs.first().click();
    await expect(picker(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(/^Slip marked on the /);
    await expect(signRings(page)).toHaveCount(1);

    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(washes(page)).toHaveCount(1);
    await expect(signRings(page)).toHaveCount(1);

    // The picker remembers the sign; Escape closes it without a change.
    await page.keyboard.press("KeyM");
    const again = await ayahTarget(page, "#verse-46");
    await page.mouse.click(again.x, again.y);
    await expect(picker(page).locator('[data-sign][aria-pressed="true"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(signRings(page)).toHaveCount(1);
  });

  test("a marked slip shows on the calendar, and stays there once the mark is cleared", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyM");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(1);
    // Picking the sign later is the same slip, not a second one.
    await page.mouse.click(at.x, at.y);
    await picker(page).locator("[data-sign]").first().click();
    await expect(picker(page)).toHaveCount(0);

    const cellFor7 = async () => {
      await page.getByRole("button", { name: /what you have opened$/ }).click();
      const sheet = page.getByRole("dialog", { name: "What you have opened" });
      await sheet.getByRole("radio", { name: "Page", exact: true }).click();
      return { sheet, cell: sheet.getByRole("list", { name: "Map of the mus'haf" }).locator('[data-id="7"]') };
    };
    const first = await cellFor7();
    const sheet = first.sheet;
    let cell = first.cell;
    await expect(cell).toHaveAttribute("data-slips", "1");
    await expect(cell).toHaveAccessibleName(/1 mistake marked$/);
    await expect(sheet.getByText("Where you marked a mistake")).toBeVisible();
    // A page with no slip carries no dot.
    await expect(sheet.locator('[data-id="8"]')).not.toHaveAttribute("data-slips", /.*/);
    await page.keyboard.press("Escape");

    // Clearing the red mark off the page says "I have it now", not "I never slipped".
    await page.keyboard.press("KeyM");
    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "Clear mark" }).click();
    await expect(washes(page)).toHaveCount(0);
    ({ cell } = await cellFor7());
    await expect(cell).toHaveAttribute("data-slips", "1");
  });

  test("clearing a mark asks nothing, and Undo puts it back", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyM");
    const at = await ayahTarget(page, "#verse-47");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(1);

    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "Clear mark" }).click();
    await expect(washes(page)).toHaveCount(0);
    const undo = page.locator("[data-undo-bar]");
    await expect(undo).toContainText("Mark cleared");
    await undo.getByRole("button", { name: "Undo" }).click();
    await expect(washes(page)).toHaveCount(1);
    await expect(said(page)).toHaveText("Mark put back");
  });
});

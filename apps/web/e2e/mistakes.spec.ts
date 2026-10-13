import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { MISTAKE_TAP_KEY } from "../src/mistake-tap";

/*
 * The mistake tool, step 3 of docs/design/page-toolbar-plan.md, as the owner
 * reshaped it on 2026-10-13 (docs/PLAN.md, item 103): M picks it, a tap on a
 * word asks what went wrong (the harakat, the whole word, or another verse it
 * went into), and nothing is marked until the reader says. The mark is red,
 * the tool stays on, it is still there after a reload, and clearing it asks
 * nothing while Undo puts it back. The older way, a tap that marks at once
 * and a second tap for the sign, is a setting. Desktop only, like the bar.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const toolBtn = (page: Page, name: string): Locator => bar(page).getByRole("radio", { name, exact: true });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const signRings = (page: Page): Locator => page.locator("[data-mistake-sign]:visible");
const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^What went wrong in / });
/** A tap on the word, then "The whole word": a word marked wrong. */
async function markWholeWord(page: Page, at: { x: number; y: number }): Promise<void> {
  await page.mouse.click(at.x, at.y);
  await picker(page).getByRole("button", { name: "The whole word" }).click();
  await expect(picker(page)).toHaveCount(0);
}
const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

test.describe("Hifth · the mistake tool", () => {
  test("a tap asks what went wrong, nothing is marked until you say, and it outlasts a reload", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("KeyM");
    await expect(toolBtn(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Click a word to mark a mistake");

    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    // The three kinds, and none chosen for you.
    await expect(picker(page)).toBeVisible();
    await expect(picker(page).getByRole("button", { name: "The whole word" })).toBeVisible();
    expect(await picker(page).locator("[data-sign]").count()).toBeGreaterThan(0);
    await expect(picker(page).getByRole("button", { name: "Went into another verse…" })).toBeVisible();
    await expect(picker(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(picker(page).getByRole("button", { name: "Clear mark" })).toHaveCount(0);
    await expect(washes(page)).toHaveCount(0);
    // Closed without a choice, nothing happened.
    await page.keyboard.press("Escape");
    await expect(picker(page)).toHaveCount(0);
    await expect(washes(page)).toHaveCount(0);

    await markWholeWord(page, at);
    await expect(washes(page)).toHaveCount(1);
    await expect(said(page)).toHaveText(/^Wrong word marked on /);
    // The tool stays on for the next mistake, and the tap did not select the verse.
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

    // A tap on the marked word opens the picker again, to change or clear it.
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
    await expect(said(page)).toHaveText(/^Wrong harakat marked: the /);
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

  test("a marked mistake shows on the calendar, and stays there once the mark is cleared", async ({ page }) => {
    // Opened with the tool in hand; the first test here presses the key.
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(toolBtn(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await picker(page).locator("[data-sign]").first().click();
    await expect(picker(page)).toHaveCount(0);
    await expect(washes(page)).toHaveCount(1);
    await expect(said(page)).toHaveText(/^Wrong harakat marked: the /);
    // Picking a different sign later is the same mistake, not a second one.
    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "The whole word" }).click();
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
    // A page with no mistake carries no dot.
    await expect(sheet.locator('[data-id="8"]')).not.toHaveAttribute("data-slips", /.*/);
    await page.keyboard.press("Escape");

    // Clearing the red mark off the page says "I have it now", not "I never got it wrong".
    await page.keyboard.press("KeyM");
    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "Clear mark" }).click();
    await expect(washes(page)).toHaveCount(0);
    ({ cell } = await cellFor7());
    await expect(cell).toHaveAttribute("data-slips", "1");
  });

  test("clearing a mark asks nothing, and Undo puts it back", async ({ page }) => {
    // Opened with the tool in hand; the first test here presses the key.
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(toolBtn(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    const at = await ayahTarget(page, "#verse-47");
    await markWholeWord(page, at);
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

  test("set to mark at once, a tap marks the word and a second tap asks what went wrong", async ({ page }) => {
    // The plan's first way (page-toolbar-plan step 3), kept as a setting.
    await page.addInitScript((k) => {
      try {
        localStorage.setItem(k, "quiet");
      } catch {
        /* private mode */
      }
    }, MISTAKE_TAP_KEY);
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(1);
    await expect(picker(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(/^Wrong word marked on /);
    await page.mouse.click(at.x, at.y);
    await expect(picker(page)).toBeVisible();
    await expect(picker(page).getByRole("button", { name: "The whole word" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the setting is in the info panel, asks first by default, and is remembered", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const choices = page.getByRole("dialog").locator('[aria-labelledby="colophon-mistake-tap"]').getByRole("radio");
    await expect(choices).toHaveText(["Ask what went wrong", "Mark at once"]);
    await expect(choices.first()).toHaveAttribute("aria-checked", "true");
    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate((k) => localStorage.getItem(k), MISTAKE_TAP_KEY)).toBe("quiet");
  });
});

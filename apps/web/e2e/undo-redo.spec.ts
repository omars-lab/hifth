import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * Undo and redo for every kept mark (docs/design/notes-style-toolbar.md ③, the
 * owner's pick on 2026-10-12): two buttons beside the tools, and Ctrl+Z / ⌘Z
 * with Shift for redo. Inside a note's box the keys stay with the text.
 * Desktop only, like the bar the buttons sit on.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const undo = (page: Page): Locator => bar(page).getByRole("button", { name: "Undo", exact: true });
const redo = (page: Page): Locator => bar(page).getByRole("button", { name: "Redo", exact: true });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const pins = (page: Page): Locator => page.locator("[data-note-pin]:visible");
const box = (page: Page): Locator => page.getByRole("dialog", { name: /^Your note on / });
const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

test.describe("Hifth · undo and redo for marks", () => {
  test("a slip marked comes off with Undo and back with Redo, by button and by key", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible();
    // Nothing done yet, so nothing to take back.
    await expect(undo(page)).toBeDisabled();
    await expect(redo(page)).toBeDisabled();

    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(1);
    await expect(undo(page)).toBeEnabled();

    await undo(page).click();
    await expect(washes(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(/^Undone: Slip marked on /);
    await expect(undo(page)).toBeDisabled();
    await redo(page).click();
    await expect(washes(page)).toHaveCount(1);
    await expect(said(page)).toHaveText(/^Redone: Slip marked on /);

    await page.keyboard.press("ControlOrMeta+KeyZ");
    await expect(washes(page)).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+Shift+KeyZ");
    await expect(washes(page)).toHaveCount(1);

    // What was undone stays undone after a reload: the device holds it too.
    await page.keyboard.press("ControlOrMeta+KeyZ");
    await expect(washes(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(/^Undone: /);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(washes(page)).toHaveCount(0);
  });

  test("a fresh note and its words come off in one Undo, and Ctrl+Z in the box is the text's", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const text = box(page).getByRole("textbox");
    await expect(text).toBeFocused();
    await text.pressSequentially("Made up");

    // Typing in the box: the key takes back letters, never the pin.
    await page.keyboard.press("ControlOrMeta+KeyZ");
    await expect(box(page)).toBeVisible();
    await expect(pins(page)).toHaveCount(1);

    await text.fill("Made up words");
    await page.keyboard.press("Escape");
    await expect(said(page)).toHaveText("Note saved");

    // One step: the pin and what was typed in it, not an empty pin left behind.
    await undo(page).click();
    await expect(pins(page)).toHaveCount(0);
    await expect(undo(page)).toBeDisabled();
    await redo(page).click();
    await expect(pins(page)).toHaveCount(1);
    await expect(said(page)).toHaveText("Redone: Note saved");
    await pins(page).first().click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Made up words");
  });

  test("a pin dropped and closed empty leaves nothing to undo", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    // Escape is heard once the box has taken the typing, as a reader's would be.
    await expect(box(page).getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(pins(page)).toHaveCount(0);
    await expect(undo(page)).toBeDisabled();
  });
});

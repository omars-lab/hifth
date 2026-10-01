import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The note tool, step 2 of docs/design/page-toolbar-plan.md: N picks it, a tap
 * on a verse pins a note there and opens a box to type in, the tool goes back
 * to Select, the note is still there after a reload, and a deleted note comes
 * back with Undo. Desktop only, like the bar it sits on. English, so the names
 * read as the plan writes them.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const toolBtn = (page: Page, name: string): Locator => bar(page).getByRole("radio", { name, exact: true });
const pins = (page: Page): Locator => page.locator("[data-note-pin]:visible");
const box = (page: Page): Locator => page.getByRole("dialog", { name: /^Your note on / });
/** The app's one spoken line. A note's line is said only once the device has kept it. */
const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

async function pinOnVerse(page: Page, selector: string): Promise<void> {
  await page.keyboard.press("KeyN");
  await expect(toolBtn(page, "Note")).toHaveAttribute("aria-checked", "true");
  const at = await ayahTarget(page, selector);
  await page.mouse.click(at.x, at.y);
}

test.describe("Hifth · the note tool", () => {
  test("N picks it, a tap pins a note, and what was typed is there after a reload", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("KeyN");
    await expect(toolBtn(page, "Note")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Tap a word to pin a note");
    const cursor = await page
      .locator('[data-tool="note"][data-page="7"]')
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toContain("crosshair");
    await page.keyboard.press("Escape");
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");

    await pinOnVerse(page, "#verse-46");
    await expect(box(page)).toBeVisible();
    await expect(pins(page)).toHaveCount(1);
    // Used once, then put down — and the tap pinned a note rather than selecting.
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);

    // The box is labelled, and the textarea has focus to type straight into.
    const text = box(page).getByRole("textbox");
    await expect(text).toBeFocused();
    await text.fill("Check the madd here");
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(said(page)).toHaveText("Note saved");

    // The pin is a button named by its verse.
    const pin = page.getByRole("button", { name: /^Note on / });
    await expect(pin).toHaveCount(1);

    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(pins(page)).toHaveCount(1);
    await pins(page).first().click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Check the madd here");
  });

  test("a pin opens from the keyboard, and a note closed empty is not kept", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await pinOnVerse(page, "#verse-46");
    await expect(box(page)).toBeVisible();
    await box(page).getByRole("button", { name: "Done" }).click();
    await expect(pins(page)).toHaveCount(0);

    await pinOnVerse(page, "#verse-47");
    await box(page).getByRole("textbox").fill("A question");
    await box(page).getByRole("button", { name: "Done" }).click();
    await expect(pins(page)).toHaveCount(1);
    // Focus came back to the pin, so Enter reopens it.
    await expect(pins(page).first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(box(page).getByRole("textbox")).toHaveValue("A question");
  });

  test("deleting a note asks nothing, and Undo puts it back", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await pinOnVerse(page, "#verse-46");
    await box(page).getByRole("textbox").fill("To delete");
    await box(page).getByRole("button", { name: "Done" }).click();
    await expect(pins(page)).toHaveCount(1);

    await pins(page).first().click();
    await box(page).getByRole("button", { name: "Delete note" }).click();
    await expect(pins(page)).toHaveCount(0);
    const undo = page.locator("[data-undo-bar]");
    await expect(undo).toContainText("Note deleted");
    await undo.getByRole("button", { name: "Undo" }).click();
    await expect(pins(page)).toHaveCount(1);
    await expect(said(page)).toHaveText("Note put back");

    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(pins(page)).toHaveCount(1);
  });

  // The hint beside the tools changes length with the tool. The buttons must not
  // slide with it, or the second click of a double-click, or the click that puts
  // a tool down, lands on a different button (they moved up to 100px).
  test("the tool buttons hold still whatever tool is on", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const where = async () => Math.round((await toolBtn(page, "Bookmark").boundingBox())!.x);
    const at = await where();
    for (const name of ["Bookmark", "Note", "Highlight", "Crop", "Read", "Select"]) {
      await toolBtn(page, name).click();
      await expect(toolBtn(page, name)).toHaveAttribute("aria-checked", "true");
      expect(await where(), `after picking ${name}`).toBe(at);
    }
  });

  test("at the narrowest computer window the pens and the longest hint fit beside the tools", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    for (const name of ["Read", "Highlight"]) {
      await toolBtn(page, name).dblclick();
      await expect(toolBtn(page, name)).toHaveAttribute("data-locked", "true");
      const box = (await bar(page).boundingBox())!;
      expect(box.x + box.width, name).toBeLessThanOrEqual(1024);
      // Two short lines at most, so the row does not eat the page.
      expect(box.height, name).toBeLessThanOrEqual(56);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
      await page.screenshot({ path: test.info().outputPath(`bar-${name}.png`), clip: { x: 0, y: box.y - 4, width: 1024, height: box.height + 8 } });
    }
  });

  // Locking a tool on (docs/design/page-toolbar-plan.md, "Double-click locks any
  // tool on"): a hafiz recording a run of slips pays one tap a slip, not two.
  test("a double-click locks the note tool on, so each slip is one tap; a click puts it down", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await toolBtn(page, "Note").dblclick();
    await expect(toolBtn(page, "Note")).toHaveAttribute("aria-checked", "true");
    await expect(toolBtn(page, "Note")).toHaveAttribute("data-locked", "true");
    await expect(bar(page)).toContainText("Note stays on: click it again to put it down");

    let at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await box(page).getByRole("textbox").fill("First slip");
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);
    // Still on after the note is closed.
    await expect(toolBtn(page, "Note")).toHaveAttribute("aria-checked", "true");

    at = await ayahTarget(page, "#verse-51");
    await page.mouse.click(at.x, at.y);
    await expect(box(page)).toBeVisible();
    await box(page).getByRole("textbox").fill("Second slip");
    // A tap on the next verse closes this box and pins there, in one tap.
    at = await ayahTarget(page, "#verse-54");
    await page.mouse.click(at.x, at.y);
    await expect(pins(page)).toHaveCount(3);
    await expect(toolBtn(page, "Note")).toHaveAttribute("aria-checked", "true");
    await box(page).getByRole("button", { name: "Done" }).click();
    await expect(pins(page)).toHaveCount(2);

    // A click on the locked tool puts it down, and the lock goes with it.
    await toolBtn(page, "Note").click();
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-locked]")).toHaveCount(0);
    // Picked again by one click, it is used once, as before.
    await toolBtn(page, "Note").click();
    at = await ayahTarget(page, "#verse-47");
    await page.mouse.click(at.x, at.y);
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
  });

  test("Escape puts a locked tool down", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await toolBtn(page, "Bookmark").dblclick();
    await expect(toolBtn(page, "Bookmark")).toHaveAttribute("data-locked", "true");
    await page.keyboard.press("Escape");
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-locked]")).toHaveCount(0);
  });
});

test.describe("Hifth · the page tools in Arabic", () => {
  test.use({ locale: "ar" });

  test("at the narrowest computer window the Arabic hint fits beside the tools too", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const tools = page.getByRole("toolbar").first().getByRole("radio");
    // In the bar's order: Read first, the highlighter third.
    for (const [at, name] of [[0, "read"], [2, "highlight"]] as const) {
      await tools.nth(at).dblclick();
      await expect(tools.nth(at)).toHaveAttribute("data-locked", "true");
      const box = (await page.getByRole("toolbar").first().boundingBox())!;
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(1024);
      expect(box.height, name).toBeLessThanOrEqual(56);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
      await page.screenshot({ path: test.info().outputPath(`bar-ar-${name}.png`), clip: { x: 0, y: box.y - 4, width: 1024, height: box.height + 8 } });
    }
  });
});

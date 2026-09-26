import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The page tools on a phone, step 5 of docs/design/page-toolbar-plan.md: three
 * layouts on trial (docs/decisions/phone-toolbar.md), picked by the address.
 * Each must reach every tool, and a tool picked on a phone must work on the
 * page by a tap: here the word tool opens a word into its parts.
 */
test.use({ locale: "en-US" });
test.skip(({ isMobile }) => !isMobile, "the phone's own bars");

const parts = (page: Page): Locator => page.getByRole("dialog", { name: /^The parts of a word in / });
const radio = (page: Page, name: string): Locator => page.getByRole("radio", { name, exact: true });
const bar = (page: Page, id: string): Locator => page.locator(`[data-phone-bar="${id}"]`);

test.describe("Hifth · the page tools on a phone", () => {
  test("C, shown by default: the Tools button slides the tools up, and a tool picked works by a tap", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(bar(page, "c")).toBeVisible();
    // The desktop bar and the other two layouts are not there.
    await expect(page.locator('[data-phone-bar="a"], [data-phone-bar="b"]')).toHaveCount(0);
    await expect(page.getByRole("toolbar", { name: "Page tools" })).toHaveCount(0);

    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await expect(page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio")).toHaveCount(7);
    await radio(page, "Word").click();
    await expect(page.getByText("Tap a word to open it into its parts")).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(parts(page)).toBeVisible();
    // No keyboard on a phone, so no word about Shift.
    await expect(parts(page).getByText(/Shift/)).toBeHidden();
    await page.keyboard.press("Escape");

    // Closing the tray puts the page back to plain reading.
    await page.getByRole("button", { name: "Close the tools" }).click();
    await expect(bar(page, "c").getByRole("button", { name: /Select is on$/ })).toBeVisible();
  });

  test("A: a strip under the top bar, one tap to a tool", async ({ page }) => {
    await page.goto("/?phonebar=a#/hafs-kfqc/p7");
    await expect(bar(page, "a").getByRole("radio")).toHaveCount(7);
    await radio(page, "Mistake").click();
    await expect(radio(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Tap a word to mark a slip")).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("[data-mistake-word]:visible")).toHaveCount(1);
  });

  test("B: the pen case fans the tools out and closes on a pick", async ({ page }) => {
    await page.goto("/?phonebar=b#/hafs-kfqc/p7");
    const button = bar(page, "b").getByRole("button", { name: /^Page tools · / });
    await button.click();
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(7);
    await radio(page, "Note").click();
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(0);
    await expect(button).toHaveAccessibleName("Page tools · Note is on");
    // A tap anywhere else closes it without a pick.
    await button.click();
    await page.locator("footer").click({ position: { x: 8, y: 8 } });
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(0);
  });
});

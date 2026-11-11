import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { TOOL_HELP_KEY } from "../src/tool-help";

/*
 * Each page tool's help in a label that shows when the pointer rests on its
 * button (docs/design/ayah-drawer.md ①). The owner asked, on the app's page on
 * 2026-11-07, for the line of help beside the tool bar to move into a hover
 * label on each tool. The label is built for everyone; whether the line beside
 * the bar stays as well is a setting, the line still on by default until the
 * owner has tried it without.
 *
 * Written before the build (2026-11-10) and watched failing: a tool's button
 * carried only the browser's own plain title, and the line always showed.
 */
test.use({ locale: "en-US" });

async function openWith(page: Page, seed: Record<string, string> = {}): Promise<void> {
  await page.addInitScript(
    ([coach, values]) => {
      try {
        localStorage.setItem(coach, "1");
        if (!localStorage.getItem("tool-help-seeded")) {
          for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
          localStorage.setItem("tool-help-seeded", "1");
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

const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const eraser = (page: Page): Locator => bar(page).getByRole("radio", { name: "Eraser", exact: true });
/** The line of help printed beside the tools. */
const line = (page: Page): Locator => bar(page).locator("[data-tool-help-line]");

test.describe("Hifth · tool help in a label on each tool", () => {
  test.skip(({ isMobile }) => !!isMobile, "the bar with a pointer to rest is a computer's");

  test("resting on a tool shows its name, its key and what it does", async ({ page }) => {
    await openWith(page);
    await eraser(page).hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Eraser");
    await expect(tip).toContainText("E");
    await expect(tip).toContainText("Click a mark to take it off");
    // The button is described by its label, so a screen reader hears it too.
    await expect(eraser(page)).toHaveAccessibleDescription(/Click a mark to take it off/);
    // The browser's own plain label would show on top of ours.
    await expect(eraser(page)).not.toHaveAttribute("title", /.*/);
    // By default the line beside the bar is still there.
    await expect(line(page)).toBeVisible();
  });

  test("the label goes when the pointer leaves", async ({ page }) => {
    await openWith(page);
    await eraser(page).hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.mouse.move(5, 400);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("a tool reached by the keyboard shows its label too", async ({ page }) => {
    await openWith(page);
    await bar(page).getByRole("radio", { checked: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("set to the label only, the line beside the bar goes", async ({ page }) => {
    await openWith(page, { [TOOL_HELP_KEY]: "hover" });
    await expect(bar(page)).toBeVisible();
    await expect(line(page)).toHaveCount(0);
    await eraser(page).hover();
    await expect(page.getByRole("tooltip")).toContainText("Click a mark to take it off");
  });

  test("the info panel switches between the two", async ({ page }) => {
    await openWith(page);
    await expect(line(page)).toBeVisible();
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const group = page.getByRole("radiogroup", { name: "Help for the page tools" });
    await group.getByRole("radio", { name: "Only when you rest on a tool" }).click();
    await page.keyboard.press("Escape");
    await expect(line(page)).toHaveCount(0);
  });
});

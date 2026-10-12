import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { MARK_TOOLS_KEY } from "../src/mark-tools";
import { PEN_HOME_KEY } from "../src/pen-home";

/*
 * Note, Harakat and Word as three buttons or as one
 * (docs/design/notes-style-toolbar.md, ②). The owner asked on 2026-10-12 for
 * the one button to be built as a setting and the three kept as the default:
 * one button stands where Note stood, showing the one last used, and while it
 * is on the three wait beside the tools, where the highlighter's colours do.
 *
 * Runs on a computer and on both phones: each has its own toolbar.
 */
test.use({ locale: "en-US" });

async function openWith(page: Page, seed: Record<string, string>, size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size);
  await page.addInitScript(
    ([coach, values]) => {
      try {
        localStorage.setItem(coach, "1");
        if (!localStorage.getItem("mark-tools-seeded")) {
          for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
          localStorage.setItem("mark-tools-seeded", "1");
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

/** Bring out this device's tools: the phone's Tools button, or the Mark up button where the pens wait behind one. */
async function showTools(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.locator('[data-phone-bar="c"]').getByRole("button", { name: /^Page tools · / }).click();
  else if (await page.getByRole("button", { name: "Mark up" }).count()) await page.getByRole("button", { name: "Mark up" }).click();
}

const bar = (page: Page): Locator => page.getByRole("radiogroup", { name: "Page tools" });
const aims = (page: Page): Locator => page.getByRole("radiogroup", { name: "Note, Harakat or Word" });
const ONE = { [MARK_TOOLS_KEY]: "one" };

test.describe("Hifth · Note, Harakat and Word as three buttons or one", () => {
  test("three buttons by default, each its own, and nothing waits beside them", async ({ page, isMobile }) => {
    await openWith(page, {});
    await showTools(page, !!isMobile);
    await expect(bar(page).getByRole("radio")).toHaveCount(10);
    for (const name of ["Note", "Harakat", "Word"]) await expect(bar(page).getByRole("radio", { name, exact: true })).toHaveCount(1);
    await bar(page).getByRole("radio", { name: "Note", exact: true }).click();
    await expect(aims(page)).toHaveCount(0);
  });

  test("one button stands for the three, offers them while it is on, and keeps the one last used", async ({ page, isMobile }) => {
    await openWith(page, ONE);
    await showTools(page, !!isMobile);
    await expect(bar(page).getByRole("radio")).toHaveCount(8);
    for (const name of ["Harakat", "Word"]) await expect(bar(page).getByRole("radio", { name, exact: true })).toHaveCount(0);
    await expect(aims(page)).toHaveCount(0);

    await bar(page).getByRole("radio", { name: "Note", exact: true }).click();
    await expect(aims(page)).toBeVisible();
    await expect(aims(page).getByRole("radio", { name: "Note" })).toHaveAttribute("aria-checked", "true");

    await aims(page).getByRole("radio", { name: "Harakat" }).click();
    const joined = bar(page).getByRole("radio", { name: "Harakat", exact: true });
    await expect(joined).toHaveAttribute("aria-checked", "true");
    await expect(aims(page).getByRole("radio", { name: "Harakat" })).toHaveAttribute("aria-checked", "true");

    // Put down, it still stands for the one last used.
    await joined.click();
    await expect(aims(page)).toHaveCount(0);
    await expect(joined).toHaveAttribute("aria-checked", "false");
  });

  test("on a computer N, K and W still pick each one, the tools do not slide, and a lock holds", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "a phone has no keys to press");
    await openWith(page, ONE, { width: 1024, height: 800 });
    const read = bar(page).getByRole("radio", { name: "Read", exact: true });
    const before = (await read.boundingBox())!.x;
    await page.keyboard.press("k");
    await expect(bar(page).getByRole("radio", { name: "Harakat", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(aims(page)).toBeVisible();
    expect((await read.boundingBox())!.x, "the tools slid when the three appeared").toBe(before);
    await page.keyboard.press("w");
    await expect(bar(page).getByRole("radio", { name: "Word", exact: true })).toHaveAttribute("aria-checked", "true");

    // Locked on, a pick from the three keeps it locked.
    await bar(page).getByRole("radio", { name: "Word", exact: true }).dblclick();
    await expect(bar(page).locator("[data-locked]")).toHaveCount(1);
    await aims(page).getByRole("radio", { name: "Note" }).click();
    await expect(bar(page).getByRole("radio", { name: "Note", exact: true })).toHaveAttribute("data-locked", "true");
  });

  test("behind the Mark up button, the one button offers the three in the bottom row", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "a phone has its own tray");
    await openWith(page, { ...ONE, [PEN_HOME_KEY]: "bottom" }, { width: 1180, height: 820 });
    await showTools(page, false);
    await expect(bar(page).getByRole("radio")).toHaveCount(8);
    await bar(page).getByRole("radio", { name: "Note", exact: true }).click();
    await expect(page.locator('[data-pen-home="bottom"]').getByRole("radiogroup", { name: "Note, Harakat or Word" })).toBeVisible();
  });

  test("the setting is in the info panel, switches the bar at once, and is remembered", async ({ page, isMobile }) => {
    await openWith(page, {});
    const about = page.getByRole("button", { name: /About Hifth/ });
    if (isMobile) await about.tap();
    else await about.click();
    const choices = page.getByRole("dialog").locator('[aria-labelledby="colophon-mark-tools"]').getByRole("radio");
    await expect(choices).toHaveCount(2);
    await expect(choices.first()).toHaveAttribute("aria-checked", "true");
    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate((k) => localStorage.getItem(k), MARK_TOOLS_KEY)).toBe("one");
    await page.keyboard.press("Escape");
    await showTools(page, !!isMobile);
    await expect(bar(page).getByRole("radio")).toHaveCount(8);
  });
});

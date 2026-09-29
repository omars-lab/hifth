import { test, expect, type Page } from "@playwright/test";

/*
 * The web app on an iPad-sized WebKit — the same engine the native shell hosts.
 *
 * The shell (native/) adds no layout of its own: it shows this app in a window
 * that is an iPad screen, portrait or landscape, and the app decides what to
 * draw from the width and height it is given. So the question "what does the
 * iPad app look like?" is answered here, headless and in seconds, and the
 * shell's own XCUITest smoke only has to prove that the window opens at the
 * right route (native/HifthUITests/SmokeTests.swift).
 *
 * Two facts these tests pin, both of which the shell depends on:
 *
 *   • Portrait is one page and landscape is the open mus'haf. The desktop
 *     breakpoint is 1024×740 (docs/design/desktop.md); an iPad Pro 11 is
 *     834×1194 upright and 1194×834 on its side, so one and the same route
 *     draws one leaf or two depending only on how the iPad is held.
 *   • Turning the iPad keeps the reader's place. The shell does nothing on
 *     rotation; the page's own resize handling has to carry the route across.
 */

const PORTRAIT = { width: 834, height: 1194 } as const;
const LANDSCAPE = { width: 1194, height: 834 } as const;

const leaf = (page: Page, n: number) =>
  page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);

test.describe("Hifth · on an iPad", () => {
  test("upright, a page is one page", async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(leaf(page, 8)).toBeVisible({ timeout: 20_000 });
    await expect(leaf(page, 7)).toHaveCount(0);
  });

  test("on its side, the same page is an open mus'haf", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(leaf(page, 8)).toBeVisible({ timeout: 20_000 });
    await expect(leaf(page, 7)).toBeVisible();
  });

  test("turning the iPad keeps the reader's place", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/2:255");
    // 2:255 is on page 42; landscape opens 41|42.
    await expect(leaf(page, 42)).toBeVisible({ timeout: 20_000 });
    await expect(leaf(page, 41)).toBeVisible();

    await page.setViewportSize(PORTRAIT);
    await expect(leaf(page, 42)).toBeVisible();
    await expect(leaf(page, 41)).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:255");

    await page.setViewportSize(LANDSCAPE);
    await expect(leaf(page, 41)).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:255");
  });

  test("a finger on a verse selects it, on either leaf of the spread", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(leaf(page, 7)).toBeVisible({ timeout: 20_000 });
    // Page 7 is the left-hand leaf of the 7|8 opening; verse-45 is 2:38.
    const poly = leaf(page, 7).locator("#verse-45");
    await expect(poly).toHaveCount(1);
    await poly.tap();
    await expect(page.locator("#hifth-overlay .hl-sel.hl-ink")).not.toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:38");
  });
});

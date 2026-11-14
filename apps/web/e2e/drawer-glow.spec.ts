import { test, expect, type Locator, type Page } from "@playwright/test";
import { DRAWER_GLOW_KEY } from "../src/drawer-glow";

/*
 * The lit verse glows while the pointer rests on its drawer (decision
 * selection-drawer, open question ②). Built as a setting with three choices:
 * the amber deepens (the default), a ring round each line, or no change.
 *
 * Written before the build (2026-11-13) and watched failing: the verse looked
 * the same with the pointer on the drawer as off it.
 */

test.use({ locale: "en-US", viewport: { width: 1440, height: 900 } });

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });

/** How the first line of the lit verse is painted: its fill and its edge. */
async function paint(page: Page): Promise<{ fill: string; stroke: string }> {
  return page.evaluate(() => {
    const band = document.querySelector<SVGElement>("#hifth-overlay .hl-sel.hl-ink .hl-band");
    if (!band) return { fill: "", stroke: "" };
    const style = getComputedStyle(band);
    return { fill: style.fill, stroke: style.stroke };
  });
}

async function openVerse(page: Page, choice?: string): Promise<void> {
  if (choice) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: DRAWER_GLOW_KEY, value: choice });
  await page.goto("/#/hafs-kfqc/2:45");
  await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await paint(page)).fill, { message: "the verse is lit" }).not.toBe("");
  // Start with the pointer well away from the drawer.
  await page.mouse.move(5, 5);
}

async function restOnDrawer(page: Page): Promise<void> {
  const box = (await drawer(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
}

test("by default the verse's amber deepens while the pointer rests on its drawer, and goes back after", async ({ page }) => {
  await openVerse(page);
  const before = await paint(page);
  await restOnDrawer(page);
  await expect.poll(async () => (await paint(page)).fill).not.toBe(before.fill);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await paint(page)).fill).toBe(before.fill);
});

test("with the ring chosen, the verse's lines get an edge while the pointer rests on its drawer", async ({ page }) => {
  await openVerse(page, "ring");
  const before = await paint(page);
  expect(before.stroke).toBe("none");
  await restOnDrawer(page);
  await expect.poll(async () => (await paint(page)).stroke).not.toBe("none");
  expect((await paint(page)).fill).toBe(before.fill);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await paint(page)).stroke).toBe("none");
});

test("with no change chosen, the verse looks the same with the pointer on its drawer", async ({ page }) => {
  await openVerse(page, "none");
  const before = await paint(page);
  await restOnDrawer(page);
  await page.waitForTimeout(400);
  expect(await paint(page)).toEqual(before);
});

test("the info panel offers the three choices and keeps the one picked", async ({ page }) => {
  await openVerse(page);
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const choice = page.getByRole("radiogroup", { name: "While the pointer rests on a verse's drawer" });
  await expect(choice.getByRole("radio")).toHaveCount(3);
  await choice.getByRole("radio", { name: "A ring round its lines" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), DRAWER_GLOW_KEY)).toBe("ring");
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  // A finger has no resting place: a tap in the drawer must not leave the
  // verse looking different once the finger has gone.
  test("a tap in the drawer leaves the verse as it was", async ({ page }) => {
    await openVerse(page);
    const before = await paint(page);
    const box = (await drawer(page).boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 8);
    await page.waitForTimeout(400);
    expect(await paint(page)).toEqual(before);
  });
});

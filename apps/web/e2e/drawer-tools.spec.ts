import { test, expect, type Locator, type Page } from "@playwright/test";
import { DRAWER_TOOLS_KEY } from "../src/drawer-tools";

/*
 * A verse's tool opening inside its drawer, not as another card (decision
 * selection-drawer, open question ③). The owner asked for it five times on the
 * drawer's page; it is built as a setting, the separate card still the default,
 * so these tests turn the setting on first.
 *
 * Same roots is the first tool moved. Pitch step 6 opens the roots list from a
 * link and expects the card: if the default here ever flips, that step changes
 * with it.
 *
 * Written before the build (2026-11-09) and watched failing: Same roots opened
 * its own card and the drawer stepped aside.
 */

test.use({ locale: "en-US" });

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The lit verse's lines, as boxes in window pixels. */
async function litLines(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
  );
}

/** Wait until something stops moving: two identical boxes in a row. */
async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await target.boundingBox());
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
}

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });

for (const size of [
  { name: "a laptop", width: 1440, height: 900 },
  { name: "an iPad on its side", width: 1180, height: 820 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("with the setting on, Same roots opens inside the drawer, not as its own card, and the verse stays in sight", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
      await drawer(page).getByRole("button", { name: /^Same roots · / }).click();

      // The list is a part of the drawer, and no card opened beside it.
      const list = drawer(page).getByRole("region", { name: /^Roots · / });
      await expect(list).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // The nearest root opens by itself, its verses ready to go to.
      await expect(list.getByRole("button", { name: /^Hop to / }).first()).toBeVisible({ timeout: 10_000 });

      // The drawer grew, and no line of the lit verse is under it.
      await settle(drawer(page));
      await expect.poll(async () => (await litLines(page)).length, { message: "a verse is lit" }).toBeGreaterThan(0);
      const box = (await drawer(page).boundingBox())!;
      const under = (await litLines(page)).filter((line) => overlaps(line, box));
      expect(under, "lines of the verse under the drawer").toEqual([]);

      // Pressing Same roots again folds the list away and leaves the drawer.
      await drawer(page).getByRole("button", { name: /^Same roots · / }).click();
      await expect(list).toBeHidden();
      await expect(drawer(page)).toBeVisible();
    });
  });
}

test("with the setting on, Escape folds the roots list away first, and a second Escape puts the drawer away", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
  await page.goto("/#/hafs-kfqc/2:45");
  await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
  await drawer(page).getByRole("button", { name: /^Same roots · / }).click();
  const list = drawer(page).getByRole("region", { name: /^Roots · / });
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
});

test("the setting is in the info panel, the separate card chosen until the reader picks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hafs-kfqc/2:45");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const group = page.getByRole("dialog", { name: /About Hifth/ }).getByRole("radiogroup", { name: "Where a verse's tools open" });
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio", { name: "In a card of their own" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: "Inside the verse's drawer" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), DRAWER_TOOLS_KEY)).toBe("drawer");
});

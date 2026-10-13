import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { fakePlayer } from "./player";

/*
 * A surah's recitation kept on the device (docs/PLAN.md, item 101). The menu
 * on the surah's name at the top of the page offers to keep it; the line stays
 * open and counts the files as they come, then offers to remove them, with
 * their size. A kept verse then plays from its copy on the device rather than
 * from the recording server, which is the whole point: no connection needed,
 * and no wait for the first verse. The info panel lists what is kept.
 *
 * The files are made-up bytes the stand-in player hands back (1,000 each), so
 * the sizes shown are numbers this test can work out: 286 files, 0.3 MB.
 */
test.use({ locale: "en-US", serviceWorkers: "block" });

const corner = (page: Page): Locator => page.locator('[data-host-page="7"] [data-running-head="surah"]');
const menu = (page: Page): Locator => page.getByRole("menu", { name: "More for Al-Baqarah" });

async function holdSurah(page: Page): Promise<void> {
  const b = (await corner(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(menu(page)).toBeVisible();
}

test("a surah kept from its menu plays from the device, and the info panel lists it", async ({ page }) => {
  const player = await fakePlayer(page, { recitation: "x".repeat(1000) });
  await page.addInitScript((coach) => {
    try {
      localStorage.setItem(coach, "1");
    } catch {
      /* private mode */
    }
  }, COACH_STORAGE_KEY);
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();

  // Not kept yet: the verse Play offers is asked of the recording server.
  await holdSurah(page);
  // Every line can be pressed: on a phone the row ran Play off the screen's
  // edge once this long line joined it, so a menu too wide stands as a column.
  const view = page.viewportSize()!;
  for (const line of await menu(page).getByRole("menuitem").all()) {
    const b = (await line.boundingBox())!;
    expect(b.x, await line.innerText()).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, await line.innerText()).toBeLessThanOrEqual(view.width);
  }
  await expect.poll(async () => (await player.asked()).length).toBeGreaterThan(0);
  await page.keyboard.press("Escape");

  await holdSurah(page);
  await menu(page).getByRole("menuitem", { name: "Keep its recitation on this device" }).click();
  // The line stays where the reader pressed it and says how far it has got.
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem", { name: /^(Saving its recitation — .* of 286 · Stop|Remove its kept recitation · 0\.3 MB)$/ })).toBeVisible();
  await expect(menu(page).getByRole("menuitem", { name: "Remove its kept recitation · 0.3 MB" })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");

  // Kept: with no connection at all, Play hands the player the copy on the
  // device, and nothing more is asked of the recording server, for this verse
  // or the ones after it.
  await page.context().setOffline(true);
  const asked = (await player.asked()).length;
  const played = (await player.files()).length;
  await holdSurah(page);
  await menu(page).getByRole("menuitem", { name: "Play" }).click();
  await expect.poll(async () => (await player.files()).length).toBeGreaterThan(played);
  expect((await player.files()).at(-1)).not.toMatch(/\.mp3$/);
  await page.waitForTimeout(500);
  expect((await player.asked()).length).toBe(asked);
  await expect(page.getByText("This recitation could not be played")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.context().setOffline(false);

  await page.getByRole("button", { name: /About Hifth/ }).click();
  const shelf = page.getByRole("region", { name: "Recitations kept on this device" });
  await expect(shelf.getByRole("listitem")).toHaveText([/^Al-Baqarah · 0\.3 MB/]);
  await shelf.getByRole("button", { name: "Remove the recitation of Al-Baqarah from this device" }).click();
  await expect(shelf.getByRole("listitem")).toHaveCount(0);
  await expect(shelf).toContainText("No surah's recitation is kept here yet.");
});

import { test, expect, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * Golden images of the whole iPad screen, both ways up.
 *
 * golden.spec.ts photographs one page's geometry on a phone and masks the
 * chrome. This file is the other kind of picture: the screen a person holding
 * the iPad app sees — the open mus'haf on its side, one leaf upright — so a
 * change that moves the leaves, the gutter or the desk shows up as a diff and
 * not as a surprise in the shell. The chrome is masked here too, for the same
 * reason as there: text renders differently from one font build to the next,
 * and it is asserted by role in its own specs.
 *
 * Baselines live in e2e/__screenshots__/darwin next to the phone set and are
 * refreshed the same way (`make golden-update`, look at the diff first).
 */

const SHOTS = [
  { name: "ipad-landscape-p8-selection", viewport: { width: 1194, height: 834 }, link: "2:47", leaf: 7 },
  { name: "ipad-portrait-p7-selection", viewport: { width: 834, height: 1194 }, link: "2:47", leaf: 7 },
] as const;

async function quiet(page: Page): Promise<void> {
  // Storage already promised, coach marks seen: neither banner nor tour may
  // depend on a race for the picture to be stable (same trick as golden.spec.ts).
  await page.addInitScript((coachKey: string) => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* no storage, no coach marks */
    }
  }, COACH_STORAGE_KEY);
}

test.describe("Hifth · the iPad screen", () => {
  for (const shot of SHOTS) {
    test(shot.name, async ({ page }) => {
      await quiet(page);
      await page.setViewportSize(shot.viewport);
      await page.goto(`/#/hafs-kfqc/${shot.link}`);
      const svg = page.locator(`svg[aria-labelledby="page-label-${shot.leaf}"]:visible`);
      await expect(svg).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#hifth-overlay .hl-sel.hl-ink")).not.toHaveCount(0);
      await page.addStyleTag({ content: '[role="dialog"] { visibility: hidden !important; }' });
      await expect(page).toHaveScreenshot(`${shot.name}.png`, {
        mask: [page.locator("header"), page.locator("footer"), page.locator("nav:has(input[type='range'])")],
        animations: "disabled",
      });
    });
  }
});

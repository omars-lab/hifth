import { test, expect, type Page } from "@playwright/test";
import { ayahTarget, tapAyah } from "./ayah";

/*
 * Loop 5 — the drag-to-highlight gesture (PLAN §Loop 5, spec §9).
 *
 * The whole risk of this feature is in a real browser: whether a long press
 * followed by a drag reaches our handlers at all, or whether the platform takes
 * it for text selection / a callout / a native scroll (research §4). Unit tests
 * cover the thresholds; only this tour can prove the gesture survives the trip.
 *
 * The gesture is driven with the mouse rather than the touchscreen because
 * Playwright's touchscreen exposes `tap()` only — there is no way to hold a
 * touch point down and then move it. @use-gesture sees the same Pointer Events
 * either way, which is exactly the layer the intent split reads.
 */

/**
 * Open the app as a reader who has been here before.
 *
 * The gesture is the subject; first-run chrome is not. Both the coach strip and
 * the storage notice are strips *in the layout* above the stage, so on a
 * 412×839 phone they shorten it enough to push page 7's last ayahs below the
 * fold, and a drag that starts below the fold lands on nothing. Seeding the
 * returning-reader state is also the honest setup: nobody long-press-drags on
 * the visit where they are still being told what a tap does. (`ayahTarget`
 * catches the aim itself going wrong; this is about which screen we aim at.)
 */
async function openApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("hifth.coach.v1", "1"); // CoachMarks.COACH_STORAGE_KEY
    } catch {
      /* private mode — the strip stays hidden anyway */
    }
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("svg[role='group']")).toBeVisible();
}

/** Press at (x, y), hold past the long-press threshold, drag to (x2, y2), release. */
async function longPressDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts?: { holdMs?: number; beforeRelease?: () => Promise<void> },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // LONG_PRESS_MS is 350 in @hifth/core; hold well past it so the first move
  // frame classifies as a marquee.
  await page.waitForTimeout(opts?.holdMs ?? 550);
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await opts?.beforeRelease?.();
  await page.mouse.up();
}

test.describe("Hifth · drag-to-highlight", () => {
  test("long-press then drag washes the ayahs the marquee crossed", async ({ page }) => {
    await openApp(page);

    // Two adjacent ayahs near the *top* of page 7 (2:39 and 2:40 are verse-46 /
    // verse-47). Near the top on purpose: the page is taller than any phone
    // viewport by design — you pan it — so the last ayahs of the page are below
    // the fold on the smaller of the two devices, and a drag is only a drag
    // where a finger can actually go.
    const first = await ayahTarget(page, "#verse-46");
    const second = await ayahTarget(page, "#verse-47");

    await longPressDrag(
      page,
      first,
      second,
      {
        // While the finger is still down the live marquee rect is on the page.
        beforeRelease: async () => {
          await expect(page.locator("#hifth-overlay rect.hl-marquee")).toHaveCount(1);
        },
      },
    );

    // Released: the rect is gone and the passage carries the amber wash.
    await expect(page.locator("#hifth-overlay rect.hl-marquee")).toHaveCount(0);
    await expect(page.locator("#hifth-overlay .hl-hlt")).not.toHaveCount(0);
  });

  test("an immediate drag still pans the page and highlights nothing", async ({ page }) => {
    await openApp(page);

    const start = await ayahTarget(page, "#verse-46");

    const host = page.locator("svg[role='group']");
    const before = await host.boundingBox();

    // No hold: press and move at once — the Loop-1 pan, unchanged.
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 60, start.y - 40, { steps: 10 });
    await page.mouse.up();

    const after = await host.boundingBox();
    expect(after!.x).not.toBeCloseTo(before!.x, 0);
    await expect(page.locator("#hifth-overlay .hl-hlt")).toHaveCount(0);
    // …and a pan that ends over an ayah must not select it either.
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);
  });

  test("tap-to-select still works alongside the marquee", async ({ page }) => {
    await openApp(page);
    await tapAyah(page, "#verse-55");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();
  });
});

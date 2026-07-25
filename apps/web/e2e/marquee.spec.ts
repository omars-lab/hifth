import { test, expect, type Page } from "@playwright/test";

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
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // Two adjacent ayahs on page 7 (2:47 and 2:48 are verse-54 / verse-55).
    const first = await page.locator("#verse-54").boundingBox();
    const second = await page.locator("#verse-55").boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    await longPressDrag(
      page,
      { x: first!.x + first!.width / 2, y: first!.y + first!.height / 2 },
      { x: second!.x + second!.width / 2, y: second!.y + second!.height / 2 },
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
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    const box = await page.locator("#verse-54").boundingBox();
    expect(box).not.toBeNull();
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

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
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await page.locator("#verse-55").tap();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The page bar's spread under the pointer — option B, the fisheye the owner
 * chose from the number-line decision page and asked to keep behind a settings
 * switch (`docs/decisions/page-bar.md`, the number-line question settled to B on
 * 2026-09-22).
 *
 * `detent-live.spec.ts` and `pagebar-detents.spec.ts` cover the grow-on-approach
 * that ships underneath. This file adds only what the fisheye does on top of it:
 * a hover spreads the neighbourhood apart (a marker beside the pointer slides
 * outward, not just swells), and the bar names the juz around the pointer and
 * the exact page under it — labels that exist *only* while the spread is on.
 * Flip the switch off and both go away, leaving the plain grow-on-approach bar.
 *
 * Desktop-only for the same reason as the detents: the spread is imperative and
 * gated on `(hover: hover) and (pointer: fine)`, and a hover-without-dragging is
 * a pointer gesture a phone has no way to make.
 */

const FISHEYE_KEY = "hifth.pagebar.fisheye.v1";

/** The signed translateX a marker is currently warped by, in px (0 if none). */
const shiftOf = (mark: Locator): Promise<number> =>
  mark.evaluate((el) => {
    const m = ((el as HTMLElement).style.transform || "").match(/translateX\(([-\d.]+)px\)/);
    return m && m[1] ? parseFloat(m[1]) : 0;
  });

/** Move the mouse to the centre of a marker (a hover, no button down). */
async function hoverCentre(page: Page, mark: Locator): Promise<void> {
  const box = await mark.boundingBox();
  if (!box) throw new Error("marker has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function ready(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await expect(page.locator("[data-testid='juz-detent']").first()).toBeVisible();
}

test.describe("Hifth · the page bar's spread (option B, the fisheye)", () => {
  test("on, a hover names the page under the pointer and the juz around it", async ({
    page,
  }) => {
    // Default is on — nothing seeded. Hover a marker mid-track; the lens layer
    // draws a page tag under the pointer and at least one juz number nearby.
    await ready(page);
    const near = page.locator("[data-testid='juz-detent']").nth(14); // juz 15, mid-track
    await hoverCentre(page, near);

    // The page tag is the one readout that only the fisheye draws.
    await expect(page.locator("nav [class*='lensPage']")).toBeVisible();
    // Juz numbers bloom around the pointer — the window is ±26 pages, so a
    // mid-track hover names several.
    expect(await page.locator("nav [class*='lensJuz']").count()).toBeGreaterThan(0);
  });

  test("on, a marker beside the pointer slides outward", async ({ page }) => {
    // The spread *warps position*, not only size: a neighbour of the hovered
    // marker is displaced along the bar. The hovered one sits at the pointer, so
    // its own shift is ~0; the claim is about its neighbour.
    await ready(page);
    const marks = page.locator("[data-testid='juz-detent']");
    await hoverCentre(page, marks.nth(14));
    // A marker one juz over is inside the lens radius and is pushed aside.
    const neighbour = marks.nth(15);
    expect(Math.abs(await shiftOf(neighbour))).toBeGreaterThan(0.5);
  });

  test("off, the same hover draws no labels and shifts nothing", async ({ page }) => {
    // Seed the switch off before the app loads. The grow-on-approach still runs
    // (that is option C, always on), but the fisheye's position warp and its
    // labels must both be absent.
    await page.addInitScript((k: string) => {
      try {
        localStorage.setItem(k, "0");
      } catch {
        /* private mode — the default-on path, not what this test wants, but
           the assertions below still hold because nothing was warped. */
      }
    }, FISHEYE_KEY);
    await ready(page);
    const marks = page.locator("[data-testid='juz-detent']");
    await hoverCentre(page, marks.nth(14));

    await expect(page.locator("nav [class*='lensPage']")).toHaveCount(0);
    await expect(page.locator("nav [class*='lensJuz']")).toHaveCount(0);
    // No translateX anywhere — the neighbour that slid aside with the lens on
    // stays put with it off.
    expect(await shiftOf(marks.nth(15))).toBe(0);
  });
});

import { test, expect, type Locator } from "@playwright/test";

/*
 * The page-bar decision page (docs/design/page-bar-options.html), and the one
 * thing on it a unit test cannot reach: option C's refinement, which is a *felt*
 * interaction — a juz marker that grows as the pointer nears it, so it is easy to
 * tap yet never in the way of a drag.
 *
 * The maths of the growth is a pure function with its own unit tests
 * (packages/core · markerEmphasis). What only a laid-out browser with a real
 * pointer can prove is the wiring the owner decided by: that a hover swells the
 * marker under the cursor and leaves a far one alone, that letting go of the
 * pointer settles it back, that option A never grows anything, and — the whole
 * promise of the refinement — that a marker does not grow while a drag is under
 * way. That is why this runs on the desktop project (a pointer and a keyboard)
 * and nowhere else: on a touch device there is no "hover near without dragging"
 * to test.
 *
 * It also checks the page records both questions as decided (option C), because
 * that banner is the decision's public face and a stale one would mislead the
 * reader the page exists for.
 */

const PAGE = "/docs/design/page-bar-options.html";

/** Read the scale a marker is currently drawn at from its inline transform. */
const scaleOf = (mark: Locator): Promise<number> =>
  mark.evaluate((el) => {
    const m = ((el as HTMLElement).style.transform || "").match(/scale\(([-\d.]+)\)/);
    return m && m[1] ? parseFloat(m[1]) : 1;
  });

/** Move the mouse to the centre of a marker (a hover, no button down). */
async function hoverCentre(page: import("@playwright/test").Page, mark: Locator) {
  const box = await mark.boundingBox();
  if (!box) throw new Error("marker has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("page-bar decision page · a marker that grows as you reach for it (option C)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator("#detent-stage .mark").first()).toBeVisible();
  });

  test("records both questions as decided — option C", async ({ page }) => {
    const banners = page.locator(".decided");
    await expect(banners).toHaveCount(2);
    await expect(banners.nth(0)).toContainText("Decided");
    await expect(banners.nth(0)).toContainText("a marker is a button");
    await expect(banners.nth(1)).toContainText("Decided");
    await expect(banners.nth(1)).toContainText("both");
  });

  test("under C, the marker under the pointer grows and a far one stays put", async ({ page }) => {
    await page.locator('#live-detents .seg button[data-rule="C"]').click();
    const marks = page.locator("#detent-stage .mark");
    const near = marks.nth(15);
    const far = marks.nth(0);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5); // swells toward the ~2.4 peak
    expect(await scaleOf(far)).toBeLessThan(1.05); // eased away — barely moves
  });

  test("letting the pointer leave the marker settles it back", async ({ page }) => {
    await page.locator('#live-detents .seg button[data-rule="C"]').click();
    const near = page.locator("#detent-stage .mark").nth(15);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5);
    // Move the pointer off the whole board.
    await page.mouse.move(5, 5);
    const stage = page.locator("#detent-stage");
    await stage.dispatchEvent("pointerleave");
    expect(await scaleOf(near)).toBeLessThanOrEqual(1.001);
  });

  test("under A, hovering a marker never grows it", async ({ page }) => {
    // A is the default rule; assert it is the pressed one, then hover.
    await expect(page.locator('#live-detents .seg button[data-rule="A"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const near = page.locator("#detent-stage .mark").nth(15);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeLessThanOrEqual(1.001);
  });

  test("a marker does not grow while a drag is under way — the growth never eats the drag", async ({
    page,
  }) => {
    await page.locator('#live-detents .seg button[data-rule="C"]').click();
    const near = page.locator("#detent-stage .mark").nth(15);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5); // grown at rest under the pointer

    // Grab the page handle and drag it. While dragging, every marker must be back
    // at its plain size, so a drag never lands on a swollen button.
    const handle = page.locator("#detent-stage .handle");
    const hb = await handle.boundingBox();
    if (!hb) throw new Error("handle has no box");
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 120, hb.y + hb.height / 2, { steps: 6 });
    expect(await scaleOf(near)).toBeLessThanOrEqual(1.001);
    await page.mouse.up();
  });
});

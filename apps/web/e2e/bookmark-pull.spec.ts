import { test, expect, type Locator, type Page } from "@playwright/test";
import { BOOKMARK_HAND_KEY } from "../src/bookmark-hand";

/*
 * Dropping and lifting a bookmark by hand (decision bookmark-fold, open
 * question ②). The owner, on the app's page (2026-11-07): "how do I interact
 * with the bookmark? how do I pull it down? pull it up?" Built four ways, as a
 * setting:
 *
 *   both    pull a new ribbon out of the top corner, push one back up to lift
 *           it, and the corner rests a little further folded (default)
 *   pull    the pulling and pushing, with the corner as small as before
 *   corner  taps only, with the clearer corner
 *   clicks  taps only, as before
 *
 * A tap does what it always did in every way. Written before the build
 * (2026-11-13) and watched failing.
 */

test.use({ locale: "en-US" });

const corner = (page: Page) => page.getByRole("button", { name: "Drop a bookmark on this page" }).first();
const drawer = (page: Page) => page.getByRole("dialog", { name: "Bookmark" });
const ribbons = (page: Page) => page.getByRole("button", { name: /^Bookmark: / });
// The bar that offers to put a lifted bookmark back, not the toolbar's own
// Undo for marks, which a computer also shows.
const undoBar = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).filter({ hasText: /^Undo$/ });

async function ready(page: Page, hand?: string): Promise<void> {
  if (hand) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: BOOKMARK_HAND_KEY, value: hand });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(`svg[aria-labelledby="page-label-7"]`)).toBeVisible();
}

/** Press in the middle of `target`, move by `dy` (down is positive) in small steps, and let go. */
async function drag(page: Page, target: Locator, dy: number, beforeLetGo?: () => Promise<void>): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("nothing to press");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 8 });
  if (beforeLetGo) await beforeLetGo();
  await page.mouse.up();
}

/** Drop one bookmark the old way, by a tap, and name it. */
async function dropByTap(page: Page, name: string): Promise<Locator> {
  await corner(page).click();
  await drawer(page).getByLabel("Name").fill(name);
  await drawer(page).getByRole("button", { name: "Save name" }).click();
  await expect(drawer(page)).toBeHidden();
  const ribbon = page.getByRole("button", { name: `Bookmark: ${name}` });
  await expect(ribbon).toBeVisible();
  return ribbon;
}

test("pulling the top corner down drops a bookmark, with a ribbon following the hand", async ({ page }) => {
  await ready(page);
  await drag(page, corner(page), 70, async () => {
    // While the hand is still down, a new ribbon hangs from the corner.
    const pulled = page.locator("[data-bookmark-pull]").first();
    await expect(pulled).toBeVisible();
    expect((await pulled.boundingBox())!.height, "the ribbon comes down with the hand").toBeGreaterThan(30);
  });
  await expect(drawer(page)).toBeVisible();
  await drawer(page).getByLabel("Name").fill("Pulled");
  await drawer(page).getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("button", { name: "Bookmark: Pulled" })).toBeVisible();
  await expect(page.locator("[data-bookmark-pull]:visible")).toHaveCount(0);
});

test("a short pull goes back and drops nothing", async ({ page }) => {
  await ready(page);
  await drag(page, corner(page), 20);
  await expect(page.locator("[data-bookmark-pull]:visible")).toHaveCount(0);
  await expect(drawer(page)).toBeHidden();
  await expect(ribbons(page)).toHaveCount(0);
});

test("pushing a bookmark up lifts it, and Undo puts it back", async ({ page }) => {
  await ready(page);
  const ribbon = await dropByTap(page, "Keep");
  await drag(page, ribbon, -40);
  await expect(ribbon).toHaveCount(0);
  await expect(drawer(page)).toBeHidden();
  const undo = undoBar(page);
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(ribbon).toBeVisible();
  await expect(page.getByText("Bookmark put back: Keep")).toBeAttached();
});

test("a small push lets the bookmark fall back, without opening it", async ({ page }) => {
  await ready(page);
  const ribbon = await dropByTap(page, "Stay");
  await drag(page, ribbon, -9);
  await expect(ribbon).toBeVisible();
  await expect(drawer(page)).toBeHidden();
  await expect(undoBar(page)).toHaveCount(0);
});

test("a tap still drops and opens a bookmark when pulling is on", async ({ page }) => {
  await ready(page);
  const ribbon = await dropByTap(page, "Tapped");
  await ribbon.click();
  await expect(drawer(page)).toBeVisible();
});

test("with taps only, a pull or a push does nothing", async ({ page }) => {
  await ready(page, "clicks");
  await drag(page, corner(page), 70, async () => {
    await expect(page.locator("[data-bookmark-pull]:visible")).toHaveCount(0);
  });
  await expect(drawer(page)).toBeHidden();
  await expect(ribbons(page)).toHaveCount(0);

  const ribbon = await dropByTap(page, "Fixed");
  await drag(page, ribbon, -40);
  await expect(ribbon).toBeVisible();
  await expect(undoBar(page)).toHaveCount(0);
});

test("the clearer corner rests further folded than the plain one", async ({ context }) => {
  // A fresh page for each way: a second visit to the same address only moves
  // the part after "#", so the page would not reload and pick up the setting.
  const flapWidth = async (hand: string) => {
    const page = await context.newPage();
    await ready(page, hand);
    const flap = page.locator("[class*='foldFlap']").first();
    await expect(flap).toBeAttached();
    await page.mouse.move(0, 0);
    return (await flap.boundingBox())!.width;
  };
  const plain = await flapWidth("pull");
  const clear = await flapWidth("both");
  expect(clear / plain, `clearer ${clear}px against plain ${plain}px`).toBeGreaterThan(1.3);
  expect(await flapWidth("corner")).toBeCloseTo(clear, 0);
  expect(await flapWidth("clicks")).toBeCloseTo(plain, 0);
});

test("a finger pulls the corner down too", async ({ page, browserName, hasTouch }) => {
  // A finger on a page normally pans it; on the corner it must pull instead.
  test.skip(browserName !== "chromium" || !hasTouch, "touches are sent through Chromium's own touch input");
  await ready(page);
  const box = (await corner(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", at: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: at }] });
  await touch("touchStart", y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", y + i * 9);
  await touch("touchEnd", y + 72);
  await expect(drawer(page)).toBeVisible();
});

test("the info panel offers the four ways and keeps the one picked", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const choice = page.getByRole("radiogroup", { name: "How you drop and lift a bookmark" });
  await expect(choice.getByRole("radio")).toHaveCount(4);
  await expect(choice.getByRole("radio", { name: "Pull it out, push it back, and a clearer corner" })).toBeChecked();
  await choice.getByRole("radio", { name: "Tap only", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), BOOKMARK_HAND_KEY)).toBe("clicks");
});

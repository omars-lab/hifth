import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { FULL_SCREEN_TOOLS_KEY } from "../src/full-screen-tools";

/*
 * Keeping the tools in full screen (decision verse-tap-and-hold ①, and the
 * notes-style toolbar's ⑤). The owner, on the app's page (2026-11-07): "Where
 * is the side tool bar?" Full screen put every bar away, the tools too, so
 * marking a mistake meant leaving it first. Built four ways, as a setting:
 *
 *   side   the tools stay down the side of the window, where the page does not reach (default)
 *   edge   they hide, and come back while the pointer rests at that side of the window
 *   dock   a small row of tool icons stays, and opens out under the pointer or a tap
 *   none   full screen puts them away with the other bars, as before
 *
 * Written before the build (2026-11-13) and watched failing.
 */

test.use({ locale: "en-US", viewport: { width: 1280, height: 800 } });

const tools = (page: Page): Locator => page.locator('[data-pen-home="side"]');
const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^What went wrong in / });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");

async function openInFullScreen(page: Page, mode?: string): Promise<void> {
  if (mode) await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: FULL_SCREEN_TOOLS_KEY, value: mode });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toBeVisible();
  await page.keyboard.press("KeyF");
  await expect(page.locator("[data-full]")).toHaveCount(1);
  // Full screen: the bars above and below the book are gone.
  await expect(page.locator("header")).toBeHidden();
}

/** Every box a page of the book takes up. */
async function leaves(page: Page): Promise<{ x: number; y: number; width: number; height: number }[]> {
  return page.locator("main [data-page]").evaluateAll((els) =>
    els.filter((el) => (el as HTMLElement).offsetWidth > 0).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

/** The tools sit wholly on the screen and on no page of the book. */
async function onScreenBesideTheBook(page: Page, label: string): Promise<void> {
  const box = (await tools(page).boundingBox())!;
  const size = page.viewportSize()!;
  expect(box.x, `${label}: off the screen's left`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label}: off the screen's right`).toBeLessThanOrEqual(size.width);
  expect(box.y, `${label}: off the top`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${label}: off the bottom`).toBeLessThanOrEqual(size.height);
  for (const leaf of await leaves(page)) {
    const apart = box.x + box.width <= leaf.x + 1 || leaf.x + leaf.width <= box.x + 1;
    expect(apart, `${label}: the tools sit on a page`).toBe(true);
  }
}

test("by default the tools stay down the side in full screen, and a mistake can be marked without leaving it", async ({ page }) => {
  test.slow();
  await openInFullScreen(page);
  await expect(tools(page)).toBeVisible();
  await tools(page).getByRole("radio", { name: "Mistake", exact: true }).click();
  const at = await ayahTarget(page, "#verse-46");
  await page.mouse.click(at.x, at.y);
  await picker(page).getByRole("button", { name: "The whole word" }).click();
  await expect(washes(page)).toHaveCount(1);
  await expect(page.locator("header"), "still full screen").toBeHidden();
});

test("the tools cover no page, in full screen, on a laptop, a wide screen and a narrow one, with the pens out too", async ({ page }) => {
  test.slow();
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 1280, height: 640 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await openInFullScreen(page);
    await expect(tools(page)).toBeVisible();
    await page.waitForTimeout(400);
    await onScreenBesideTheBook(page, `${size.width}×${size.height}`);
    await tools(page).getByRole("radio", { name: "Highlight", exact: true }).click();
    await page.waitForTimeout(400);
    await onScreenBesideTheBook(page, `${size.width}×${size.height}, pens out`);
    await tools(page).getByRole("button", { name: "Done" }).click();
    // Out again, since the next size opens the same page without a reload.
    await page.keyboard.press("Escape");
    await expect(page.locator("header")).toBeVisible();
  }
});

test("in full screen, the tools' own full-screen button brings the bars back", async ({ page }) => {
  await openInFullScreen(page);
  await tools(page).getByRole("button", { name: "Leave full screen" }).click();
  await expect(page.locator("header")).toBeVisible();
});

test("with the tools hidden at the edge, they come back while the pointer rests at that side, and go again after", async ({ page }) => {
  test.slow();
  await openInFullScreen(page, "edge");
  await expect(tools(page)).not.toBeInViewport();
  const size = page.viewportSize()!;
  await page.mouse.move(size.width - 4, size.height / 2);
  await expect(tools(page)).toBeInViewport({ ratio: 1 });
  // Once there, they stay while the pointer is on them.
  const box = (await tools(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(900);
  await expect(tools(page)).toBeInViewport({ ratio: 1 });
  await page.mouse.move(size.width / 2, size.height / 2);
  await expect(tools(page)).not.toBeInViewport();
});

test("with the dock, the tools are small until the pointer is on them, then open out", async ({ page }) => {
  test.slow();
  await openInFullScreen(page, "dock");
  await expect(tools(page)).toBeVisible();
  await page.mouse.move(640, 400);
  await page.waitForTimeout(400);
  const small = (await tools(page).boundingBox())!;
  await tools(page).hover();
  await page.waitForTimeout(400);
  const open = (await tools(page).boundingBox())!;
  expect(open.height, "opens out under the pointer").toBeGreaterThan(small.height * 1.4);
  await tools(page).getByRole("radio", { name: "Mistake", exact: true }).click();
  await expect(tools(page).getByRole("radio", { name: "Mistake", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("with the dock on a touch screen, a tap opens it before any tool is picked", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  const page = await context.newPage();
  await openInFullScreen(page, "dock");
  const dock = tools(page);
  await expect(dock).toHaveAttribute("data-dock", "shut");
  const before = await dock.getAttribute("data-tool");
  await dock.getByRole("radio", { name: "Mistake", exact: true }).tap();
  await expect(dock).toHaveAttribute("data-dock", "open");
  // The tap opened the dock and picked nothing; the next one picks.
  await expect(dock).toHaveAttribute("data-tool", before!);
  await dock.getByRole("radio", { name: "Mistake", exact: true }).tap();
  await expect(dock).toHaveAttribute("data-tool", "mistake");
  await context.close();
});

test("with the tools put away, full screen hides them with the other bars, as before", async ({ page }) => {
  await openInFullScreen(page, "none");
  await expect(page.getByRole("toolbar", { name: "Page tools" })).toBeHidden();
});

test("the info panel offers the four ways and keeps the one picked", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/p7");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const choice = page.getByRole("radiogroup", { name: "In full screen, the tools" });
  await expect(choice.getByRole("radio")).toHaveCount(4);
  await choice.getByRole("radio", { name: "A small dock that opens out" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), FULL_SCREEN_TOOLS_KEY)).toBe("dock");
});

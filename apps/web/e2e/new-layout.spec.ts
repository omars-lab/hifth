import { test, expect, type Locator, type Page } from "@playwright/test";
import { pageNumber } from "./page-number";
import { NEW_LAYOUT_KEY } from "../src/new-layout";
import { SLIDER_BACK_KEY } from "../src/slider-back";

/*
 * "The new layout" (docs/design/app-layout.md, item ②): one switch, off by
 * default, that moves Go to, one page or two, the size buttons and Full screen
 * onto the page bar at the bottom. The slider itself does not change; other
 * tests hold its look and its gestures, and they run with the switch off.
 */

test.use({ locale: "en-US", viewport: { width: 1280, height: 800 } });

const NUM = "header .numeric";
const bar = (page: Page): Locator => page.getByRole("navigation", { name: "Page bar" });
const header = (page: Page): Locator => page.locator("header");

async function open(page: Page, on: boolean, extra: Record<string, string> = {}): Promise<void> {
  const store = { ...(on ? { [NEW_LAYOUT_KEY]: "bar" } : {}), ...extra };
  await page.addInitScript((pairs) => {
    for (const [key, value] of Object.entries(pairs)) localStorage.setItem(key, value);
  }, store);
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator(NUM)).toHaveText(pageNumber(7));
}

test("off by default: the top bar keeps Go to, the size buttons and one page or two", async ({ page }) => {
  await open(page, false);
  await expect(header(page).getByRole("button", { name: /^Go to/ })).toBeVisible();
  await expect(header(page).getByRole("radio", { name: "One page" })).toBeVisible();
  await expect(bar(page).getByRole("button", { name: /^Go to/ })).toHaveCount(0);
});

test("on: the page label on the bar opens Go to, and the top bar's Go to button is gone", async ({ page }) => {
  await open(page, true);
  await expect(header(page).getByRole("button", { name: /^Go to/ })).toHaveCount(0);
  const label = bar(page).getByRole("button", { name: /^Go to/ });
  await expect(label.locator(".numeric")).toHaveText(pageNumber(7));
  // As drawn, not as typed: each part of the label keeps its space before the dot.
  expect(await label.evaluate((el) => (el as HTMLElement).innerText)).toMatch(/\S \u00b7 \S/);
  await label.click();
  await expect(page.getByRole("dialog", { name: "Go to" })).toBeVisible();
});

test("on: one page or two, and the size buttons, work from the bar", async ({ page }) => {
  await open(page, true);
  await expect(header(page).getByRole("radio", { name: "One page" })).toHaveCount(0);
  await expect(header(page).getByRole("button", { name: "Zoom in" })).toHaveCount(0);

  await bar(page).getByRole("radio", { name: "One page" }).click();
  await expect(bar(page).getByRole("radio", { name: "One page" })).toBeChecked();
  await bar(page).getByRole("radio", { name: "Two pages" }).click();
  await expect(bar(page).getByRole("radio", { name: "Two pages" })).toBeChecked();

  const level = bar(page).getByText(/^\d+%$/);
  const before = await level.textContent();
  await bar(page).getByRole("button", { name: "Zoom in" }).click();
  await expect(level).not.toHaveText(before!);
  await bar(page).getByRole("button", { name: "Zoom out" }).click();
  await expect(level).toHaveText(before!);
});

test("on: Full screen is on the bar, and the way out stays in reach", async ({ page }) => {
  await open(page, true);
  await bar(page).getByRole("button", { name: "Full screen" }).click();
  await expect(page.locator("[data-full]")).toHaveCount(1);
  await page.getByRole("button", { name: "Leave full screen" }).click();
  await expect(page.locator("[data-full]")).toHaveCount(0);
});

test("on, on an upright iPad: Full screen is on the bar too, and the way out stays in reach", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, true);
  await expect(page.locator("[data-full-enter]")).toHaveCount(0);
  await bar(page).getByRole("button", { name: "Full screen" }).click();
  await expect(page.locator("[data-full]")).toHaveCount(1);
  await page.locator("[data-show-bars]").click();
  await expect(page.locator("[data-full]")).toHaveCount(0);
});

test("on: the page turns name their keys, the pictures of keys leave the top bar, and the keys still work", async ({ page }) => {
  await open(page, true);
  await expect(header(page).locator("kbd")).toHaveCount(0);
  await expect(bar(page).getByRole("button", { name: "Next page" })).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
  await expect(bar(page).getByRole("button", { name: "Previous page" })).toHaveAttribute("aria-keyshortcuts", "ArrowRight");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(NUM)).not.toHaveText(pageNumber(7));
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "Go to" })).toBeVisible();
});

test("on: after a jump, Back on the bar still returns to the page the reader left", async ({ page }) => {
  await open(page, true, { [SLIDER_BACK_KEY]: "on" });
  await page.locator("[data-testid='juz-detent'][data-juz='3']").click();
  await expect(page.locator(NUM)).toHaveText(pageNumber(42));
  await page.locator("[data-slider-back]").click();
  await expect(page.locator(NUM)).toHaveText(pageNumber(7));
});

test("on: every control on the bar is 32 to 44 points tall, and the page turns can be hit across 44", async ({ page }) => {
  await open(page, true);
  // The juz marks on the slider are the slider's own, and other tests hold them.
  const boxes = await bar(page).locator("button:visible:not([data-testid='juz-detent'])").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { name: el.getAttribute("aria-label") ?? el.textContent ?? "", w: r.width, h: r.height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(6);
  for (const b of boxes) {
    expect(b.h, b.name).toBeGreaterThanOrEqual(32);
    expect(b.h, b.name).toBeLessThanOrEqual(44);
  }
  for (const name of ["Next page", "Previous page"]) {
    const b = (await bar(page).getByRole("button", { name }).boundingBox())!;
    expect(b.width, name).toBeGreaterThanOrEqual(44);
    expect(b.height, name).toBeGreaterThanOrEqual(44);
  }
});

for (const [what, width, height] of [
  ["a phone", 390, 844],
  ["an upright iPad", 820, 1180],
  ["a laptop", 1280, 800],
] as const) {
  test(`on: the bar fits ${what} with nothing cut off`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, true);
    const nav = (await bar(page).boundingBox())!;
    expect(await bar(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const b of await bar(page).locator("button:visible").all()) {
      const box = (await b.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(nav.x - 0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(nav.x + nav.width + 0.5);
    }
    // The slider keeps a useful length.
    const track = (await page.getByRole("slider").boundingBox())!;
    expect(track.width).toBeGreaterThan(width < 600 ? 150 : 300);
  });
}

test.describe("in Arabic", () => {
  test.use({ locale: "ar" });
  test("on: the bar reads right to left, earlier pages to the right", async ({ page }) => {
    await open(page, true);
    const keyed = page.locator("nav[data-keyed]");
    const at = async (l: Locator): Promise<number> => (await l.boundingBox())!.x;
    const prev = await at(keyed.locator("button").first());
    const label = await at(keyed.locator("[data-bar-goto]"));
    const zoom = await at(keyed.locator("[data-bar-view]"));
    expect(prev).toBeGreaterThan(label);
    expect(label).toBeGreaterThan(zoom);
  });
});

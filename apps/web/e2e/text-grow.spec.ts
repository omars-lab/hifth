import { test, expect, type Page } from "@playwright/test";

// Larger text, rough build (backlog row a11y-larger-text). A reader's chosen
// way makes the bars and panels grow; the mus'haf page keeps its own size, and
// nothing runs off the side of a small phone. With no way picked, nothing moves.
//
// The switch is only in a build made with VITE_TEXT_GROW=1 (`make text-grow-e2e`),
// because the app has no room left under its size cap for it yet: the way the
// owner picks gets a trim first. The ordinary build must carry none of it.
const grown = process.env.HIFTH_TEXT_GROW === "1";

test("the ordinary build carries no larger-text code, so a link to it changes nothing", async ({ page }) => {
  test.skip(grown, "this run serves the larger-text build");
  await page.goto("/?grow=own&size=1.5#/hafs-kfqc/2:48");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.textGrow)).toBeUndefined();
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  for (const src of scripts) expect(await (await page.request.get(src)).text()).not.toContain("hifth.text.grow");
});

async function sizes(page: Page) {
  const bar = page.locator('[data-phone-bar] button').first();
  await expect(bar).toBeVisible();
  const page7 = page.locator("svg[role='group']").first();
  await expect(page7).toBeVisible();
  // The words themselves, not only the box around them: on iPhone Safari the
  // app's "keep text at 100%" rule stopped the words growing while their boxes
  // grew (found on the SE simulator, 2026-11-20).
  const words = await bar.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().height;
  });
  return {
    words,
    bar: (await bar.boundingBox())!.height,
    page: (await page7.boundingBox())!.width,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  };
}

test("a chosen size grows the bar's buttons, not the page, and nothing runs off the side", async ({ page }) => {
  test.skip(!grown, "needs the larger-text build: make text-grow-e2e");
  // The narrowest phone we support, the iPhone SE.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/#/hafs-kfqc/2:48");
  const before = await sizes(page);

  await page.goto("/?grow=own&size=1.5#/hafs-kfqc/2:48");
  await page.reload();
  const after = await sizes(page);

  expect(after.bar / before.bar).toBeGreaterThan(1.4);
  expect(after.words / before.words).toBeGreaterThan(1.4);
  // Every button on the top bar is still on the screen: when the words really
  // grew on the iPhone SE, the info button was pushed off the right edge.
  const cut = await page.locator("[data-top-bar] button").evaluateAll((all) =>
    all
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1)).length,
  );
  expect(cut, "top-bar buttons cut off at the screen's edge").toBe(0);
  expect(after.page).toBeCloseTo(before.page, 0);
  expect(after.overflow).toBeLessThanOrEqual(0);
});

test("with no way picked, the app is exactly as it was", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/2:48");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.textGrow)).toBeUndefined();
});

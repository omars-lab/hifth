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

for (const lang of ["ar", "en"]) test(`a chosen size grows the bar's buttons, not the page, and nothing runs off the side (${lang})`, async ({ page }) => {
  test.skip(!grown, "needs the larger-text build: make text-grow-e2e");
  // The narrowest phone we support, the iPhone SE. English is the wider row:
  // on the SE simulator its info button was pushed off the edge (2026-11-20).
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
  const before = await sizes(page);

  await page.goto(`/?lang=${lang}&grow=own&size=1.5#/hafs-kfqc/2:48`);
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

// The verse's drawer lifts the chosen verse above itself. With no tool open it
// sits in the bottom bar's room and says nothing; grown, it rose past that room
// and covered the verse on the SE simulator at 1.5 times (2026-11-20). It also
// measured itself at its size before growing.
// In Safari on an iPhone, an app not yet on the Home Screen shows a banner
// asking to install it, a third of the SE's screen. The test browsers' storage
// is kept, so the banner never showed there; here the storage says it is not
// kept, as Safari's does. On the SE simulator at 1.5 times, the grown top bar,
// the banner and the grown drawer left no room for the verse (2026-11-20).
for (const banner of [false, true]) for (const way of ["off", "own"]) test(`the chosen verse stays above its drawer on an iPhone SE (larger text ${way}${banner ? ", install banner" : ""})`, async ({ page }) => {
  test.skip(!grown, "needs the larger-text build: make text-grow-e2e");
  if (banner) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
      if (navigator.storage) {
        navigator.storage.persisted = async () => false;
        navigator.storage.persist = async () => false;
      }
    });
  }
  // The SE's screen less Safari's own bars, about the room the page really
  // gets there: shorter than the bare 667 our test browsers give it.
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto(`/?lang=en&grow=${way}&size=1.5#/hafs-kfqc/2:48`);
  await page.reload();
  const drawer = page.getByRole("region", { name: /^Tools for / });
  await expect(drawer).toBeVisible();
  if (banner) {
    // Proves the banner really shows here, so the grown run means something;
    // grown, it waits while the drawer is open.
    const notice = page.getByText("Install Hifth so it stays with you offline");
    if (way === "off") await expect(notice).toBeVisible();
    else await expect(notice).toBeHidden();
  }
  const covered = async () =>
    page.evaluate(() => {
      const card = document.querySelector("[data-verse-drawer]")!.getBoundingClientRect();
      const lines = [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0);
      if (lines.length === 0) return -1;
      return Math.round(Math.max(0, ...lines.map((r) => r.bottom - card.top)));
    });
  await expect.poll(covered, { message: "pixels of the verse under the drawer", timeout: 8_000 }).toBe(0);
  if (way === "own") {
    const zoom = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-verse-drawer]")!).zoom) || 1);
    expect(zoom, "the drawer still grows for the reader who asked").toBeGreaterThan(1.2);
  }
});

test("with no way picked, the app is exactly as it was", async ({ page }) => {
  await page.goto("/#/hafs-kfqc/2:48");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.textGrow)).toBeUndefined();
});

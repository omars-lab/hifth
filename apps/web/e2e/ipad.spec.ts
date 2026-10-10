import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The web app on an iPad-sized WebKit — the same engine the native shell hosts.
 *
 * The shell (native/) adds no layout of its own: it shows this app in a window
 * that is an iPad screen, portrait or landscape, and the app decides what to
 * draw from the width and height it is given. So the question "what does the
 * iPad app look like?" is answered here, headless and in seconds, and the
 * shell's own XCUITest smoke only has to prove that the window opens at the
 * right route (native/HifthUITests/SmokeTests.swift).
 *
 * Two facts these tests pin, both of which the shell depends on:
 *
 *   • Portrait is one page and landscape is the open mus'haf. The desktop
 *     breakpoint is 1024×775 (docs/design/desktop.md); an iPad Pro 11 is
 *     834×1194 upright and 1194×834 on its side, so one and the same route
 *     draws one leaf or two depending only on how the iPad is held.
 *   • Turning the iPad keeps the reader's place. The shell does nothing on
 *     rotation; the page's own resize handling has to carry the route across.
 */

const PORTRAIT = { width: 834, height: 1194 } as const;
const LANDSCAPE = { width: 1194, height: 834 } as const;

const leaf = (page: Page, n: number) =>
  page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);

/**
 * Wait for page n to be on screen once. While a spread is first laid out, the
 * app can for a moment hold a second copy of a leaf with a size, out of sight;
 * a check that page n is visible then finds two and fails at once instead of
 * waiting, which made the spread test fail about one run in a few.
 */
async function shown(page: Page, n: number): Promise<void> {
  await expect(leaf(page, n)).toHaveCount(1, { timeout: 20_000 });
  await expect(leaf(page, n)).toBeVisible();
}

test.describe("Hifth · on an iPad", () => {
  test("upright, a page is one page", async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 8);
    await expect(leaf(page, 7)).toHaveCount(0);
  });

  test("on its side, the same page is an open mus'haf", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 8);
    await shown(page, 7);
  });

  test("turning the iPad keeps the reader's place", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/2:255");
    // 2:255 is on page 42; landscape opens 41|42.
    await shown(page, 42);
    await shown(page, 41);

    await page.setViewportSize(PORTRAIT);
    await shown(page, 42);
    await expect(leaf(page, 41)).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:255");

    await page.setViewportSize(LANDSCAPE);
    await shown(page, 41);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:255");
  });

  // The large iPad is wide enough for the desktop layout, where a page turns
  // by its edge rather than by a swipe across it. With one page showing there
  // is no edge to take, so a finger has to be able to swipe it over, as it
  // does on a phone. Found walking the pitch upright (2026-10-06): the swipe
  // did nothing and only the page bar's small arrows turned the page.
  test("the large iPad upright turns its one page with a swipe", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 8);
    await expect(leaf(page, 7)).toHaveCount(0);

    const box = (await leaf(page, 8).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (0.3 + i * 0.05), y);
    await page.mouse.up();

    await shown(page, 9);
    await expect(leaf(page, 8)).toHaveCount(0);
  });

  test("a finger on a verse selects it, on either leaf of the spread", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 7);
    // Page 7 is the right-hand leaf of the 7|8 opening; verse-45 is 2:38.
    const poly = leaf(page, 7).locator("#verse-45");
    await expect(poly).toHaveCount(1);
    await poly.tap();
    await expect(page.locator("#hifth-overlay .hl-sel.hl-ink")).not.toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/2:38");
  });

  // Found walking the pitch in the iPad app (2026-10-08): a pinch that ended
  // on a verse selected it and opened its hold menu, because the second
  // finger's lift was read as a tap of its own. Two fingers are a pinch, and
  // nothing in a pinch selects a verse or pins a note, however long they rest.
  test("two fingers resting on a verse and lifting select nothing", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 7);
    await pinchOn(page, leaf(page, 7).locator("#verse-45"));
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/p8");
  });

  test("two fingers on a verse with the note tool picked pin no note", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 7);
    await page.keyboard.press("KeyN");
    // The page says which tool is in hand; this project reads in Arabic, so
    // the bar's own names are not English here.
    await expect(page.locator('[data-tool="note"][data-page="7"]')).toHaveCount(1);
    await pinchOn(page, leaf(page, 7).locator("#verse-45"));
    await expect(page.locator("[data-note-pin]:visible")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  // Found in the iPad app held sideways (2026-10-08): each page of the open
  // book is its own surface, so a pinch across the fold reached each page as a
  // lone finger dragging, which means "select a run of verses". A run across
  // both pages lit up, the passage panel opened, and nothing grew.
  test("a pinch across the fold magnifies the open book and selects nothing", async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 7);
    await shown(page, 8);
    const before = (await leaf(page, 7).boundingBox())!.width;
    // The zoom readout, in this project's Arabic digits.
    await expect(page.getByText("١٠٠٪")).toHaveCount(1);
    await pinchAcrossTheFold(page, leaf(page, 7), leaf(page, 8));
    await expect(page.getByText("١٠٠٪")).toHaveCount(0);
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("#/hafs-kfqc/p8");
    await expect.poll(async () => (await leaf(page, 7).boundingBox())!.width).toBeGreaterThan(before * 1.3);
  });

  // A link to a verse, and a hop from one verse to its look-alike, land with the
  // page magnified. On the large iPad held upright the magnified page then fills
  // the screen from edge to edge, with no desk left beside it, and the look-alike
  // buttons stood on the first letters of the top line (walking the pitch,
  // 2026-10-10). They go into the bars around the page instead.
  for (const how of ["a link", "a hop"] as const) {
    test(`after ${how}, the look-alike buttons on the large iPad upright stay off the page`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 1366 });
      const pageNo = how === "a link" ? 7 : 19;
      await page.goto("/#/hafs-kfqc/2:48");
      await shown(page, 7);
      if (how === "a hop") {
        await page.getByRole("group", { name: "روابط الآية" }).getByRole("button", { name: /متشابهات في السورة/ }).tap();
        await page.getByRole("dialog").getByRole("button", { name: /انتقل إلى البقرة، ٢:١٢٣/ }).tap();
        await shown(page, 19);
      }
      // Landed magnified, so the page has no desk left either side.
      await expect(page.getByText("١٥٥٪")).toHaveCount(1);
      await expect.poll(async () => (await leaf(page, pageNo).boundingBox())!.width).toBeGreaterThan(850);
      const rail = page.getByRole("group", { name: "روابط الآية" });
      await expect(rail).toBeVisible();
      const stage = (await page.locator("main").boundingBox())!;
      const paper = (await leaf(page, pageNo).boundingBox())!;
      // The part of the page on screen: the page, cut to the stage it is shown in.
      const shownPaper = {
        x0: Math.max(stage.x, paper.x),
        y0: Math.max(stage.y, paper.y),
        x1: Math.min(stage.x + stage.width, paper.x + paper.width),
        y1: Math.min(stage.y + stage.height, paper.y + paper.height),
      };
      for (const chip of await rail.locator("button[data-direction]").all()) {
        const c = (await chip.boundingBox())!;
        const over =
          c.x < shownPaper.x1 && c.x + c.width > shownPaper.x0 && c.y < shownPaper.y1 && c.y + c.height > shownPaper.y0;
        expect(over, `a button at ${JSON.stringify(c)} on the page shown at ${JSON.stringify(shownPaper)}`).toBe(false);
        // And still on the screen, where a finger can reach it.
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.width).toBeLessThanOrEqual(1024);
        expect(c.y + c.height).toBeLessThanOrEqual(1366);
      }
    });
  }
});

/**
 * One finger on each page of the open book, near the fold, drawn apart and
 * lifted: the pinch a reader makes to magnify the opening.
 */
async function pinchAcrossTheFold(page: Page, one: Locator, other: Locator): Promise<void> {
  // The mus'haf opens right to left, so which page is on the left is read off
  // the screen rather than assumed from the page numbers.
  const a1 = (await one.boundingBox())!;
  const b1 = (await other.boundingBox())!;
  const [l, r] = a1.x < b1.x ? [a1, b1] : [b1, a1];
  const y = l.y + l.height / 2;
  const a = l.x + l.width - 60;
  const b = r.x + 60;
  const finger = (type: string, id: number, x: number, from: number) =>
    page.evaluate(
      ({ type, id, x, y, from }) => {
        const held = (window as unknown as { __held?: Record<number, Element | null> }).__held ?? {};
        (window as unknown as { __held?: Record<number, Element | null> }).__held = held;
        if (type === "pointerdown") held[id] = document.elementFromPoint(from, y);
        held[id]?.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: "touch",
            isPrimary: id === 1,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
      },
      { type, id, x, y, from },
    );
  await finger("pointerdown", 1, a, a);
  await finger("pointerdown", 2, b, b);
  // Fingers settle before they spread, as a hand does; a still finger that
  // then moves is the stroke that used to sweep verses.
  await page.waitForTimeout(400);
  for (let step = 1; step <= 10; step += 1) {
    await finger("pointermove", 1, a - step * 15, a);
    await finger("pointermove", 2, b + step * 15, b);
    await page.waitForTimeout(30);
  }
  await finger("pointerup", 2, b + 150, b);
  await finger("pointerup", 1, a - 150, a);
  await page.waitForTimeout(400);
}

/**
 * Two fingers come down on the element, a little apart, rest past the hold
 * time, and lift, the second one first and where it landed. Built from
 * pointer events by hand: Playwright's touch tap is one finger only.
 */
async function pinchOn(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const at = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  const finger = (type: string, id: number, primary: boolean) =>
    page.evaluate(
      ({ type, id, primary, x, y }) => {
        document.elementFromPoint(x, y)?.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: "touch",
            isPrimary: primary,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
      },
      { type, id, primary, x: at.x + (primary ? -12 : 12), y: at.y },
    );
  await finger("pointerdown", 1, true);
  await finger("pointerdown", 2, false);
  await page.waitForTimeout(500);
  await finger("pointerup", 2, false);
  await finger("pointerup", 1, true);
  await page.waitForTimeout(300);
}

// The iPad mini held upright is narrower than a laptop, so it never had the
// large iPad's rule, and a link lands with the page magnified to the window's
// width: the look-alike buttons stood in the page's top corner, on the first
// letters of its top two lines (plan item 43). And the verse's drawer, kept in
// the middle with the bar's ends meant to show beside it, cut into all three of
// the bar's buttons, the room beside it too narrow for them (plan item 44).
// With the drawer up the buttons ride its head; put away, they go to the bar.
for (const [lang, group, close] of [
  ["en", "Links from this ayah", "Close"],
  ["ar", "روابط الآية", "إغلاق"],
] as const) {
  test.describe(`Hifth · on an iPad mini held upright (${lang})`, () => {
    test.use({ viewport: { width: 744, height: 1133 } });

    const box = async (l: Locator) => (await l.boundingBox())!;
    const meets = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    const inside = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x >= b.x - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y >= b.y - 0.5 && a.y + a.height <= b.y + b.height + 0.5;

    async function chipsOffThePage(page: Page, within: Locator): Promise<void> {
      const rail = page.getByRole("group", { name: group });
      await expect(rail).toBeVisible();
      const stage = await box(page.locator("main"));
      const paper = await box(leaf(page, 7));
      const x = Math.max(stage.x, paper.x);
      const y = Math.max(stage.y, paper.y);
      const shownPaper = {
        x,
        y,
        width: Math.min(stage.x + stage.width, paper.x + paper.width) - x,
        height: Math.min(stage.y + stage.height, paper.y + paper.height) - y,
      };
      const home = await box(within);
      const chips = await rail.locator("button[data-direction]").all();
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        const c = await box(chip);
        expect(meets(c, shownPaper), `a button at ${JSON.stringify(c)} on the page shown at ${JSON.stringify(shownPaper)}`).toBe(false);
        expect(inside(c, home), `a button at ${JSON.stringify(c)} outside its home at ${JSON.stringify(home)}`).toBe(true);
      }
    }

    test("the look-alike buttons stay off the page, on the drawer and then the bar, and the drawer cuts no button in the bar", async ({ page }) => {
      await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
      await shown(page, 7);
      const drawer = page.locator("section").filter({ has: page.locator("header") }).filter({ has: page.getByRole("button", { name: close }) }).last();
      await expect(drawer).toBeVisible();
      await page.waitForTimeout(600);
      await chipsOffThePage(page, drawer);
      // Each button in the bar is either wholly under the drawer or wholly
      // clear of it: one cut by the drawer's edge reads as broken.
      const d = await box(drawer);
      for (const b of await page.locator("footer[data-keep-clear]").locator("button, a").all()) {
        const r = await b.boundingBox();
        if (!r || r.width === 0) continue;
        expect(!meets(r, d) || inside(r, d), `a bar button at ${JSON.stringify(r)} cut by the drawer at ${JSON.stringify(d)}`).toBe(true);
      }
      await drawer.getByRole("button", { name: close }).click();
      await expect(drawer).toBeHidden();
      await chipsOffThePage(page, page.locator("footer[data-keep-clear]"));
    });
  });
}

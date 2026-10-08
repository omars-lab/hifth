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

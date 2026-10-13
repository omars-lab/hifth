import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { fakePlayer } from "./player";

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

  test("on its side, the tools bar tells a finger to tap, not to click", async ({ page }) => {
    // Held sideways the iPad is wide enough for the desk's tools bar, and the
    // bar spoke to a mouse: "point at a vowel-sign, click" to a finger.
    // Since 2026-10-11 the tools wait behind the Mark up button there
    // (notes-style-toolbar ①), so it is opened first.
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p8");
    await shown(page, 7);
    await page.getByRole("button", { name: "الأقلام" }).tap();
    const bar = page.getByRole("toolbar");
    await page.keyboard.press("KeyK");
    await expect(bar).toContainText("اضغط قرب علامة تشكيل لتكتب عليها ملاحظة");
    await page.keyboard.press("Escape");
    await expect(page.getByText("المس آية على الصفحة لتحديدها")).toBeVisible();
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

// Walking the demo on a large iPad held upright, 2026-10-12: the screen is
// wider than the width where the verse's drawer stays a card in the middle of
// the bar, but the bar's far end (the verse's name, the look-alike buttons and
// Mark up) is wider than the room beside the card, and the verse's name slid
// under it, only its top edge showing above. A short window as wide did the
// same in English, whose words are longer (plan item 94). The drawer covers
// the whole bar whenever a button would be cut, whatever the width; and the
// look-alike buttons, whose home there is the bar, ride the drawer's head
// while it covers the bar, as on the iPad mini, rather than vanish under it.
for (const [lang, group, close] of [
  ["en", "Links from this ayah", "Close"],
  ["ar", "روابط الآية", "إغلاق"],
] as const) {
  for (const size of [
    { width: 1032, height: 1376 },
    { width: 1024, height: 700 },
  ]) {
    test.describe(`Hifth · the verse's drawer on a ${size.width} by ${size.height} screen (${lang})`, () => {
      test.use({ viewport: size });

      test("the drawer cuts no button in the bar, and hides no look-alike button", async ({ page }) => {
        await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
        await shown(page, 7);
        const drawer = page.locator("section").filter({ has: page.locator("header") }).filter({ has: page.getByRole("button", { name: close }) }).last();
        await expect(drawer).toBeVisible();
        await page.waitForTimeout(600);
        const meets = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        const inside = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
          a.x >= b.x - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y >= b.y - 0.5 && a.y + a.height <= b.y + b.height + 0.5;
        const d = (await drawer.boundingBox())!;
        const bar = page.locator("footer[data-keep-clear]").locator("button, a");
        expect(await bar.count()).toBeGreaterThan(0);
        for (const b of await bar.all()) {
          const r = await b.boundingBox();
          if (!r || r.width === 0) continue;
          expect(!meets(r, d) || inside(r, d), `a bar button at ${JSON.stringify(r)} cut by the drawer at ${JSON.stringify(d)}`).toBe(true);
        }
        // Each look-alike button is on top where it stands: a tap there reaches it.
        const chips = await page.getByRole("group", { name: group }).locator("button[data-direction]").all();
        expect(chips.length).toBeGreaterThan(0);
        for (const chip of chips) {
          const reached = await chip.evaluate((b) => {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return r.width > 0 && hit !== null && b.contains(hit);
          });
          expect(reached, "a look-alike button a tap can reach").toBe(true);
        }
      });
    });
  }
}

// Checking the corner cards on the iPad mini held sideways, 2026-10-12, after
// the note (plan item 89): the screen is wide enough for the roots list to
// stand as a card in a corner but too short for the laptop layout, and the
// list, the full height of its corner, lay over the verse it is open on: a
// quarter of it in English, nearly half in Arabic, where the list stands on
// the left. The page lifted the verse above the list's top, which on a card
// that tall is no lift at all, and nothing moved the page aside (plan item 90).
// Moved aside, the page stood in Arabic under the look-alike buttons' corner,
// and they sat on its top line; they cross to the list's side, as they do for
// the share card there.
/** Whether the lit verse shows beside an open corner card: its start clear, at most `most` of it under (a tenth unless asked). */
async function verseInSight(page: Page, list: Locator, most = 0.1) {
  const wash = page.locator("#hifth-overlay [data-hl-group='selection']");
  const card = (await list.boundingBox())!;
  const lit = (await wash.evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }),
  )).filter((b) => b.width > 0);
  if (!lit.length) return "no verse lit";
  const cut = (b: (typeof lit)[number]) =>
    Math.max(0, Math.min(b.x + b.width, card.x + card.width) - Math.max(b.x, card.x)) *
    Math.max(0, Math.min(b.y + b.height, card.y + card.height) - Math.max(b.y, card.y));
  const share = lit.reduce((s, b) => s + cut(b), 0) / lit.reduce((s, b) => s + b.width * b.height, 0);
  // The verse begins at the right-hand end of its topmost line.
  const top = lit.filter((b) => b.y < Math.min(...lit.map((l) => l.y)) + b.height / 2);
  const start = Math.max(...top.map((b) => b.x + b.width));
  const y = top[0]!.y + top[0]!.height / 2;
  const startUnder = start - 1 > card.x && start - 1 < card.x + card.width && y > card.y && y < card.y + card.height;
  return !startUnder && share <= most ? "in sight" : `start under=${startUnder} share=${Math.round(share * 100)}%`;
}

for (const [locale, roots, group] of [
  ["en-US", /^Roots · /, "Links from this ayah"],
  ["ar", /^الجذور، /, "روابط الآية"],
] as const) {
  test.describe(`Hifth · the corner lists on an iPad mini on its side (${locale})`, () => {
    test.use({ viewport: { width: 1133, height: 744 }, locale });

    test("the open list leaves its verse in sight", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
      await page.goto("/#/hafs-kfqc/2:48");
      await shown(page, 7);
      await page.getByRole("button", { name: roots }).click();
      const list = page.getByRole("dialog");
      await expect(list).toBeVisible();
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      await expect.poll(() => verseInSight(page, list), { message: "how much of the verse the roots list covers", timeout: 8_000 }).toBe("in sight");
      const paper = (await leaf(page, 7).boundingBox())!;
      const chips = await page.getByRole("group", { name: group }).locator("button[data-direction]").all();
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        const c = (await chip.boundingBox())!;
        const on = c.x < paper.x + paper.width && c.x + c.width > paper.x && c.y < paper.y + paper.height && c.y + c.height > paper.y;
        expect(on, `a look-alike button at ${JSON.stringify(c)} on the page at ${JSON.stringify(paper)}`).toBe(false);
        // Riding the list's top row, clear of its own Close.
        const x = (await list.getByRole("button", { name: locale === "ar" ? "إغلاق" : "Close" }).first().boundingBox())!;
        const hits = c.x < x.x + x.width && c.x + c.width > x.x && c.y < x.y + x.height && c.y + c.height > x.y;
        expect(hits, `a look-alike button at ${JSON.stringify(c)} on the list's Close at ${JSON.stringify(x)}`).toBe(false);
      }
    });

    test("the roots list leaves the whole of a verse too wide for the room beside it in sight", async ({ page }) => {
      // Walking the demo's headline verse on the mini held sideways, 2026-10-12,
      // after item 90: with the page moved aside, 2:255 at the zoom a link
      // lands it at is wider than the room beside the list, and its lines'
      // ends stayed under the card, a tenth of the verse. Nothing drew a verse
      // too wide for the room a little smaller, as one too tall is (plan item 92).
      await page.addInitScript((key) => localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
      await page.goto("/#/hafs-kfqc/2:255");
      await shown(page, 42);
      await page.getByRole("button", { name: roots }).click();
      const list = page.getByRole("dialog");
      await expect(list).toBeVisible();
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      await expect.poll(() => verseInSight(page, list, 0), { message: "how much of the verse the roots list covers", timeout: 8_000 }).toBe("in sight");
    });

    test("a look-alike list's buttons ride its top row, clear of its Close and inside the card", async ({ page }) => {
      // The same walk: with a look-alike list open in English, its two buttons
      // sat on the list's Close, the second half past the card's edge.
      await page.addInitScript((key) => localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
      await page.goto("/#/hafs-kfqc/2:48");
      await shown(page, 7);
      const rail = page.getByRole("group", { name: group });
      await rail.locator("button[data-direction]").first().click();
      const list = page.getByRole("dialog");
      await expect(list).toBeVisible();
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const card = (await list.boundingBox())!;
      const x = (await list.getByRole("button", { name: locale === "ar" ? "إغلاق" : "Close" }).first().boundingBox())!;
      for (const chip of await rail.locator("button[data-direction]").all()) {
        const c = (await chip.boundingBox())!;
        const hits = c.x < x.x + x.width && c.x + c.width > x.x && c.y < x.y + x.height && c.y + c.height > x.y;
        expect(hits, `a look-alike button at ${JSON.stringify(c)} on the list's Close at ${JSON.stringify(x)}`).toBe(false);
        const inside = c.x >= card.x - 0.5 && c.x + c.width <= card.x + card.width + 0.5 && c.y >= card.y - 0.5;
        expect(inside, `a look-alike button at ${JSON.stringify(c)} outside the card at ${JSON.stringify(card)}`).toBe(true);
      }
    });

    test.describe("in the iPad app's shorter room", () => {
      // The iPad app keeps the iPad's own bars above and below the page, so its
      // room is about 40 pixels shorter than this window's. There the verse did
      // not fit above the first look-alike list, which covered 6% of it, and 15%
      // once the list's heading moved down a row for its buttons: the page now
      // moves aside for it, as for the roots list (plan item 90).
      test.use({ viewport: { width: 1133, height: 700 } });

      test("the first look-alike list leaves its verse in sight", async ({ page }) => {
        await page.addInitScript((key) => localStorage.setItem(key, "1"), COACH_STORAGE_KEY);
        await page.goto("/#/hafs-kfqc/2:48");
        await shown(page, 7);
        await page.getByRole("group", { name: group }).locator("button[data-direction]").first().click();
        const list = page.getByRole("dialog");
        await expect(list).toBeVisible();
        await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
        await expect.poll(() => verseInSight(page, list), { message: "how much of the verse the look-alike list covers", timeout: 8_000 }).toBe("in sight");
      });
    });
  });
}

// Walked for item 60 on the open book: a surah played from its corner on the
// iPad held sideways turns the book from opening to opening with the
// recitation, and its end leaves the last verse lit with Play on it, as it
// does on one page. The hold is a finger's, sent as touch pointer events.
test.describe("Hifth · a recitation on the iPad held sideways", () => {
  test.use({ locale: "en-US" });

  test("a surah played from its corner turns the open book with it and ends with its last verse lit", async ({ page }) => {
    const player = await fakePlayer(page);
    await page.addInitScript((coach) => {
      try {
        localStorage.setItem(coach, "1");
      } catch {
        /* private mode */
      }
    }, COACH_STORAGE_KEY);
    await page.setViewportSize(LANDSCAPE);
    await page.goto("/#/hafs-kfqc/p563");
    await shown(page, 563);
    await shown(page, 564);
    const head = page.locator('[data-host-page="563"] [data-running-head="surah"]');
    const b = (await head.boundingBox())!;
    const finger = (type: string) =>
      page.evaluate(
        ({ type, x, y }) => {
          document.elementFromPoint(x, y)?.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: type === "pointerup" ? 0 : 1,
            }),
          );
        },
        { type, x: b.x + b.width / 2, y: b.y + b.height / 2 },
      );
    await finger("pointerdown");
    await page.waitForTimeout(600);
    await finger("pointerup");
    await page.getByRole("menu", { name: /^More for / }).getByRole("menuitem", { name: "Play", exact: true }).click();
    await expect.poll(player.files).toEqual(["067001.mp3"]);
    // The surah begins on 562, the left leaf of the opening before.
    await shown(page, 562);
    await shown(page, 561);
    for (let n = 2; n <= 30; n++) {
      await player.end();
      await expect.poll(player.files).toHaveLength(n);
    }
    await shown(page, 564);
    await shown(page, 563);
    await page.waitForTimeout(400);
    await player.end();
    await page.waitForTimeout(400);
    const lit = await page
      .locator("#hifth-overlay [data-hl-group='selection']")
      .evaluateAll((els) => [...new Set(els.map((el) => (el.getAttribute("data-hl-key") ?? "?").split("/").pop()))]);
    expect(lit).toEqual(["67:30"]);
    await expect(page).toHaveURL(/#\/hafs-kfqc\/67:30(\?|$)/);
    await expect(page.getByRole("region", { name: /^Tools for / }).getByRole("button", { name: /^Play .*67:30$/ })).toBeVisible();
    await shown(page, 564);
    await shown(page, 563);
  });
});

/*
 * Held upright, a verse's page opens a little bigger than the screen, so a
 * hafiz reads down to its foot and turns. The next page used to open at the
 * same height, on its lower half, and they slid it down to start at the top
 * (docs/PLAN.md, item 75). The owner chose on 2026-10-13: at the size the page
 * opened at, a turn forward lands at the top of the next page and a turn back
 * at the foot of the one before. Keeping the same height is a setting, and so
 * is opening the page whole (item 98).
 */
test.describe("Hifth · turning an upright iPad's page that opened bigger than the screen", () => {
  /** Where the page's top edge sits once it has stopped moving. */
  async function settledTop(page: Page, n: number): Promise<{ top: number; height: number }> {
    let last = Number.NaN;
    let box = { top: 0, height: 0 };
    await expect
      .poll(async () => {
        const b = (await leaf(page, n).boundingBox())!;
        const same = Math.abs(b.y - last) < 0.5;
        last = b.y;
        box = { top: b.y, height: b.height };
        return same;
      }, { intervals: [300] })
      .toBe(true);
    return box;
  }

  async function open(page: Page, settings: Record<string, string> = {}): Promise<void> {
    await page.addInitScript((pairs) => {
      for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, v);
    }, { [COACH_STORAGE_KEY]: "1", ...settings });
    await page.setViewportSize(PORTRAIT);
    // 2:46 is low on page 7, so the page opens framed on its lower half.
    await page.goto("/#/hafs-kfqc/2:46");
    await shown(page, 7);
  }

  // By key: the verse's card stands over the page bar's arrows while it is up.
  // The pages run right to left, so the left arrow turns forward.
  const turn = (page: Page, way: "forward" | "back") =>
    page.keyboard.press(way === "forward" ? "ArrowLeft" : "ArrowRight");

  test("a turn forward lands at the top of the next page, and back at the foot of the one before", async ({ page }) => {
    await open(page);
    const opened = await settledTop(page, 7);
    expect(opened.top, "the page opens bigger than the screen, framed on its lower half").toBeLessThan(-100);

    await turn(page, "forward");
    await shown(page, 8);
    const next = await settledTop(page, 8);
    expect(next.top, "the next page's top is in sight").toBeGreaterThan(-2);
    // It sits just under the bars at the top of the screen, not a screen lower.
    expect(next.top, "the next page starts high on the screen").toBeLessThan(PORTRAIT.height / 4);

    await turn(page, "back");
    await shown(page, 7);
    const back = await settledTop(page, 7);
    expect(back.top, "the page before shows its foot").toBeLessThan(-100);
    expect(back.top + back.height, "its foot is in sight").toBeLessThanOrEqual(PORTRAIT.height + 2);
  });

  test("set to keep the same height, the next page opens where the last one was", async ({ page }) => {
    await open(page, { "hifth.turn-landing.v1": "same" });
    const opened = await settledTop(page, 7);
    await turn(page, "forward");
    await shown(page, 8);
    const next = await settledTop(page, 8);
    expect(Math.abs(next.top - opened.top), "the same height as the page before").toBeLessThan(4);
  });

  test("set to open the page whole, a verse's page fits the screen", async ({ page }) => {
    await open(page, { "hifth.open-size.v1": "whole" });
    const opened = await settledTop(page, 7);
    expect(opened.top, "the page's top is in sight").toBeGreaterThanOrEqual(-1);
    expect(opened.top + opened.height, "and so is its foot").toBeLessThanOrEqual(PORTRAIT.height);
  });
});

/*
 * Held upright, a verse's page opens a little bigger than the screen. Turned on
 * its side the open book shows both pages whole, and turned back upright the
 * page stayed whole, so the reader lost the size it had opened at
 * (docs/PLAN.md, item 69). The owner chose on 2026-10-13: turning back upright
 * brings back the opening size; staying whole is a setting (item 99).
 */
test.describe("Hifth · turning an iPad on its side and back upright", () => {
  /** The page's width once it has stopped changing. */
  async function settledWidth(page: Page, n: number): Promise<number> {
    let last = Number.NaN;
    let width = 0;
    await expect
      .poll(async () => {
        const b = await leaf(page, n).boundingBox();
        if (!b) return false;
        const same = Math.abs(b.width - last) < 0.5;
        last = b.width;
        width = b.width;
        return same;
      }, { intervals: [300], timeout: 20_000 })
      .toBe(true);
    return width;
  }

  async function sidewaysAndBack(page: Page, settings: Record<string, string> = {}) {
    await page.addInitScript((pairs) => {
      for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, v);
    }, { [COACH_STORAGE_KEY]: "1", ...settings });
    await page.setViewportSize(PORTRAIT);
    await page.goto("/#/hafs-kfqc/2:46");
    await shown(page, 7);
    const opened = await settledWidth(page, 7);
    await page.setViewportSize(LANDSCAPE);
    await shown(page, 8);
    const sideways = await settledWidth(page, 7);
    await page.setViewportSize(PORTRAIT);
    await shown(page, 7);
    await expect(leaf(page, 8)).toHaveCount(0);
    return { opened, sideways, back: await settledWidth(page, 7) };
  }

  test("back upright, the page comes back at the size it opened at", async ({ page }) => {
    const { opened, back } = await sidewaysAndBack(page);
    expect(Math.abs(back - opened), "back upright, the same size as it opened").toBeLessThan(2);
  });

  test("set to stay whole, back upright the page fits the screen", async ({ page }) => {
    const { opened, back } = await sidewaysAndBack(page, { "hifth.upright-again.v1": "whole" });
    // It opened at 155%; whole is 100%, about two thirds as wide.
    expect(back / opened, "back upright, the whole page").toBeLessThan(0.7);
  });
});

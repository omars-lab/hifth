import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { LANG_STORAGE_KEY } from "../src/lang";
import { RING_INNER, RING_OUTER, TIP_PENS, TIP_PENS_KEY, type TipPens } from "../src/pen-ring";
import { threeButtons } from "./three-buttons";

/*
 * The Apple Pencil's double-tap and squeeze (docs/PLAN.md, 96; docs/design/
 * pencil-gestures.md, ①, option B). A web page never hears either; the iPad
 * app does, and hands each one to the page with the reader's own pencil
 * setting and, when the pencil hovers, where its tip is. The simulator cannot
 * send the gestures, so these tests play the app: they call what the page
 * exposes to it, exactly as the app's Swift does.
 *
 * What they hold the page to: a squeeze opens Hifth's pens at the tip, whole
 * on the screen and never under it, and picking one puts it in hand and puts
 * the pens away; a double-tap swaps between the last tool used and plain
 * selecting; a setting that means nothing in Hifth does nothing. On an iPad
 * held sideways and upright, in both languages, and in both layouts the pens
 * have (pen-ring.ts): rings round the tip, the default, and a row beside it.
 */

const SIDEWAYS = { width: 1180, height: 820 };
const UPRIGHT = { width: 820, height: 1180 };

type Gesture = { kind: string; pref: string; x?: number; y?: number };
type Box = { x: number; y: number; width: number; height: number };

async function openOn(
  browser: Browser,
  view: { width: number; height: number },
  lang: string,
  { inApp = true, tip = null as TipPens | null, three = true } = {},
) {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: view, locale: "en-US" });
  if (three) await threeButtons(context);
  const page = await context.newPage();
  await page.addInitScript(
    ([coach, langKey, l, app, tipKey, tipPens]) => {
      // What the app sets before any of the page's own code runs.
      if (app) (window as unknown as { __HIFTH_NATIVE__: unknown }).__HIFTH_NATIVE__ = Object.freeze({ platform: "ios", publicBase: "https://example.test/hifth/" });
      try {
        localStorage.setItem(coach, "1");
        localStorage.setItem(langKey, l);
        // Only when nothing is saved, so a test that picks the layout keeps it over a reload.
        if (tipPens && localStorage.getItem(tipKey) === null) localStorage.setItem(tipKey, tipPens);
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, LANG_STORAGE_KEY, lang, inApp, TIP_PENS_KEY, tip] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
  return { page, context };
}

/** What the app's Swift runs for a gesture. */
async function pencil(page: Page, e: Gesture): Promise<void> {
  await page.evaluate((g) => (window as unknown as { __HIFTH_PAGE__?: { pencil?: (x: unknown) => void } }).__HIFTH_PAGE__?.pencil?.(g), e);
}

function inHand(page: Page): Locator {
  return page.locator("[data-page][data-tool]").first();
}

function palette(page: Page): Locator {
  return page.locator("[data-pencil-pens]");
}

/** The tools, as against a tool's own choices: only a tool has a key. */
function tools(page: Page): Locator {
  return palette(page).locator("[role=radio][aria-keyshortcuts]");
}

/** A tool's own choices: the highlighter's pens, or Note, Harakat and Word. */
function choices(page: Page): Locator {
  return palette(page).locator("[role=radio]:not([aria-keyshortcuts])");
}

function inView(page: Page, box: Box, what: string): void {
  const view = page.viewportSize()!;
  expect(box.x, `${what} off the left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${what} off the top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} off the right`).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height, `${what} off the foot`).toBeLessThanOrEqual(view.height);
}

async function wholeOnScreen(page: Page, el: Locator): Promise<Box> {
  const box = (await el.boundingBox())!;
  inView(page, box, "the pens");
  return box;
}

async function boxes(buttons: Locator): Promise<Box[]> {
  return buttons.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

/** How far a point is from a box; 0 inside it. */
function gap(at: { x: number; y: number }, box: Box): number {
  return Math.hypot(Math.max(box.x - at.x, at.x - (box.x + box.width), 0), Math.max(box.y - at.y, at.y - (box.y + box.height), 0));
}

/** How far each button's middle is from a point. */
function reach(at: { x: number; y: number }, all: Box[]): number[] {
  return all.map((b) => Math.hypot(b.x + b.width / 2 - at.x, b.y + b.height / 2 - at.y));
}

/** No two buttons one on the other. */
function apart(all: Box[]): void {
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      const d = Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
      expect(d, `buttons ${i} and ${j} overlap`).toBeGreaterThanOrEqual(40);
    }
}

/**
 * Not over the tip, and close to it. The row is one box beside the tip. The
 * rings are buttons round a hole, so it is each button that must be off the
 * tip, and what is under the tip must still be the page.
 */
async function offTheTipAndNear(page: Page, layout: TipPens, at: { x: number; y: number }): Promise<void> {
  const box = await wholeOnScreen(page, palette(page));
  if (layout === "row") {
    expect(gap(at, box), "covers the tip").toBeGreaterThan(0);
    expect(gap(at, box), "far from the tip").toBeLessThan(80);
    return;
  }
  const all = await boxes(palette(page).getByRole("radio"));
  for (const b of all) inView(page, b, "a button");
  const gaps = all.map((b) => gap(at, b));
  expect(Math.min(...gaps), "a button covers the tip").toBeGreaterThan(0);
  expect(Math.min(...gaps), "far from the tip").toBeLessThan(100);
  const under = await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest("[data-pencil-pens]"), [at.x, at.y]);
  expect(under, "the pens are what is under the tip").toBe(false);
}

for (const layout of TIP_PENS)
  for (const [held, view] of [["sideways", SIDEWAYS], ["upright", UPRIGHT]] as const)
    for (const lang of ["en", "ar"]) {
      test.describe(`the pens as ${layout}, an iPad held ${held}, in ${lang}`, () => {
        test("a squeeze opens the pens at the tip, whole on the screen, and a pick puts that pen in hand", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          await expect(palette(page)).toHaveCount(0);
          // Near each side of the screen, so the pens have to stand on whichever side has room.
          for (const at of [{ x: 200, y: 300 }, { x: view.width - 60, y: view.height - 120 }]) {
            await pencil(page, { kind: "squeeze", pref: "palette", ...at });
            await expect(palette(page)).toBeVisible();
            await expect(palette(page)).toHaveAttribute("data-pencil-pens", layout);
            // Held sideways the iPad counts as a computer, so the eraser joins the pens.
            await expect(palette(page).getByRole("radio")).toHaveCount(held === "sideways" ? 11 : 10);
            await offTheTipAndNear(page, layout, at);
            await page.keyboard.press("Escape");
            await expect(palette(page)).toHaveCount(0);
          }
          await pencil(page, { kind: "squeeze", pref: "palette", x: 300, y: 300 });
          await palette(page).locator("[role=radio][aria-keyshortcuts=M]").click();
          await expect(palette(page)).toHaveCount(0);
          await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
          await context.close();
        });

        test("Escape puts the pens away even the moment they appear", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          // The pens heard Escape only once the browser had a spare moment after
          // drawing them, so a key pressed as they appeared did nothing (a push
          // run caught it). Press it as soon as they are on the page.
          await page.evaluate(
            (g) =>
              new Promise<void>((done) => {
                const seen = new MutationObserver(() => {
                  if (!document.querySelector("[data-pencil-pens]")) return;
                  seen.disconnect();
                  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
                  done();
                });
                seen.observe(document.body, { childList: true, subtree: true });
                (window as unknown as { __HIFTH_PAGE__?: { pencil?: (x: unknown) => void } }).__HIFTH_PAGE__?.pencil?.(g);
              }),
            { kind: "squeeze", pref: "palette", x: 300, y: 300 },
          );
          await expect(palette(page)).toHaveCount(0);
          await context.close();
        });

        test("a double-tap swaps between the last tool used and plain selecting", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          // Nothing used yet: there is nothing to swap to, so the pens open instead.
          await pencil(page, { kind: "doubleTap", pref: "eraser" });
          await expect(palette(page)).toBeVisible();
          await wholeOnScreen(page, palette(page));
          await palette(page).locator("[role=radio][aria-keyshortcuts=M]").click();
          await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
          await pencil(page, { kind: "doubleTap", pref: "previous" });
          await expect(inHand(page)).toHaveAttribute("data-tool", "select");
          await pencil(page, { kind: "doubleTap", pref: "eraser" });
          await expect(inHand(page)).toHaveAttribute("data-tool", "mistake");
          await expect(palette(page)).toHaveCount(0);
          await context.close();
        });

        test("the colours setting opens the highlighter's four pens", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          await pencil(page, { kind: "doubleTap", pref: "colours", x: 400, y: 400 });
          await expect(palette(page)).toBeVisible();
          await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
          const pens = palette(page).getByRole("radiogroup").filter({ hasNot: page.locator("[aria-keyshortcuts]") }).first();
          await expect(pens.getByRole("radio")).toHaveCount(4);
          await wholeOnScreen(page, palette(page));
          await pens.getByRole("radio").nth(1).click();
          await expect(palette(page)).toHaveCount(0);
          await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
          await context.close();
        });

        test("a setting that means nothing here does nothing", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          for (const pref of ["ignore", "shortcut", "unknown"]) {
            await pencil(page, { kind: "squeeze", pref, x: 300, y: 300 });
            await pencil(page, { kind: "doubleTap", pref });
          }
          await page.waitForTimeout(300);
          await expect(palette(page)).toHaveCount(0);
          await expect(inHand(page)).toHaveAttribute("data-tool", "select");
          await context.close();
        });

        test("the arrow keys go along the tools, each one in hand, and the pens stay out", async ({ browser }) => {
          const { page, context } = await openOn(browser, view, lang, { tip: layout });
          await pencil(page, { kind: "squeeze", pref: "palette", x: 400, y: 400 });
          await expect(palette(page)).toBeVisible();
          // The keys start from the tool in hand, with nothing tapped first.
          await expect(tools(page).and(page.locator("[aria-keyshortcuts=V]"))).toBeFocused();
          const next = lang === "ar" ? "ArrowLeft" : "ArrowRight";
          const count = await tools(page).count();
          await page.keyboard.press(next);
          await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
          await expect(palette(page)).toBeVisible();
          await page.keyboard.press(next);
          await expect(inHand(page)).toHaveAttribute("data-tool", "bookmark");
          // All the way round, back to where they started.
          for (let i = 2; i < count; i++) await page.keyboard.press(next);
          await expect(inHand(page)).toHaveAttribute("data-tool", "select");
          await expect(palette(page)).toBeVisible();
          // And the other key goes back one, round the end if it has to.
          const keys = await tools(page).evaluateAll((all) => all.map((b) => b.getAttribute("aria-keyshortcuts")));
          const before = (keys.indexOf("V") - 1 + count) % count;
          await page.keyboard.press(lang === "ar" ? "ArrowRight" : "ArrowLeft");
          await expect(tools(page).nth(before)).toBeFocused();
          await expect(tools(page).nth(before)).toHaveAttribute("aria-checked", "true");
          await expect(palette(page)).toBeVisible();
          await context.close();
        });
      });
    }

/*
 * The rings themselves (docs/design/pencil-gestures.md, ④; the owner,
 * 2026-11-10: "layers of an onion"). The tools stand on a circle round the
 * tip; a tool with choices of its own adds them as an outer ring.
 */
for (const [held, view] of [["sideways", SIDEWAYS], ["upright", UPRIGHT]] as const)
  for (const lang of ["en", "ar"]) {
    test.describe(`the rings, an iPad held ${held}, in ${lang}`, () => {
      const TIP = { x: 420, y: 500 };

      test("the tools stand in a ring round the tip, in the way the language reads, and a touch in the hole lands on the page", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        await pencil(page, { kind: "squeeze", pref: "palette", ...TIP });
        await expect(palette(page)).toHaveAttribute("data-pencil-pens", "rings");
        const all = await boxes(tools(page));
        for (const d of reach(TIP, all)) expect(Math.abs(d - RING_INNER), "a tool off the ring").toBeLessThan(3);
        apart(all);
        // The first tool at the top; the next to its right in English, to its left in Arabic.
        const mid = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
        expect(Math.abs(mid(all[0]!).x - TIP.x)).toBeLessThan(3);
        expect(mid(all[0]!).y).toBeLessThan(TIP.y);
        if (lang === "ar") expect(mid(all[1]!).x).toBeLessThan(TIP.x);
        else expect(mid(all[1]!).x).toBeGreaterThan(TIP.x);
        // The hole is the page's: a touch there puts the pens away, with no tool picked.
        // A tap, as an iPad sends it (the test's Firefox sends a mouse click on
        // this pretend iPad with no pointer event at all, 2026-11-11).
        await page.touchscreen.tap(TIP.x, TIP.y);
        await expect(palette(page)).toHaveCount(0);
        await expect(inHand(page)).toHaveAttribute("data-tool", "select");
        await context.close();
      });

      test("the highlighter adds an outer ring of its pens, and a pen picked puts the rings away", async ({ browser }) => {
        const { page, context } = await openOn(browser, view, lang);
        // With room all round, then in a corner, where the outer ring must still be whole.
        for (const at of [TIP, { x: view.width - 40, y: view.height - 40 }]) {
          await pencil(page, { kind: "squeeze", pref: "palette", ...at });
          const before = await boxes(tools(page));
          await expect(choices(page)).toHaveCount(0);
          await palette(page).locator("[role=radio][aria-keyshortcuts=H]").click();
          await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
          // The passage's four pens and the held words' four.
          await expect(choices(page)).toHaveCount(8);
          // The tools did not move under the hand when the outer ring came out.
          expect(await boxes(tools(page))).toEqual(before);
          const outer = await boxes(choices(page));
          const centre = { x: before[0]!.x + before[0]!.width / 2, y: before[0]!.y + before[0]!.height / 2 + RING_INNER };
          for (const d of reach(centre, outer)) expect(Math.abs(d - RING_OUTER), "a pen off the outer ring").toBeLessThan(3);
          for (const b of outer) inView(page, b, "a pen");
          apart([...before, ...outer]);
          await offTheTipAndNear(page, "rings", at);
          await choices(page).nth(1).click();
          await expect(palette(page)).toHaveCount(0);
          await expect(inHand(page)).toHaveAttribute("data-tool", "highlight");
          // Opened again with the highlighter in hand, its pens are out at once;
          // plain selecting has none, so picking it puts the rings away.
          await pencil(page, { kind: "squeeze", pref: "palette", ...at });
          await expect(choices(page)).toHaveCount(8);
          await palette(page).locator("[role=radio][aria-keyshortcuts=V]").click();
          await expect(palette(page)).toHaveCount(0);
          await expect(inHand(page)).toHaveAttribute("data-tool", "select");
        }
        await context.close();
      });

      test("the one Mark button adds an outer ring of Note, Harakat and Word", async ({ browser }) => {
        // One button for the three is the app's default; the tests above ask for three.
        const { page, context } = await openOn(browser, view, lang, { three: false });
        await pencil(page, { kind: "squeeze", pref: "palette", ...TIP });
        await expect(palette(page).locator("[data-aim]")).toHaveCount(0);
        await palette(page).locator("[role=radio][aria-keyshortcuts=N]").click();
        await expect(inHand(page)).toHaveAttribute("data-tool", "note");
        await expect(palette(page).locator("[data-aim]")).toHaveCount(3);
        const outer = await boxes(palette(page).locator("[data-aim]"));
        for (const d of reach(TIP, outer)) expect(Math.abs(d - RING_OUTER), "a choice off the outer ring").toBeLessThan(3);
        apart([...(await boxes(tools(page))), ...outer]);
        await palette(page).locator("[data-aim=word]").click();
        await expect(palette(page)).toHaveCount(0);
        await expect(inHand(page)).toHaveAttribute("data-tool", "word");
        await context.close();
      });
    });
  }

test("the info panel offers rings or a row in the iPad app, and the pick is used at once and remembered", async ({ browser }) => {
  const { page, context } = await openOn(browser, SIDEWAYS, "en");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const picks = page.getByRole("dialog").locator('[aria-labelledby="colophon-tip-pens"]').getByRole("radio");
  await expect(picks).toHaveCount(2);
  await expect(picks.and(page.locator('[data-tip-pens-choice="rings"]'))).toHaveAttribute("aria-checked", "true");
  await picks.and(page.locator('[data-tip-pens-choice="row"]')).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), TIP_PENS_KEY)).toBe("row");
  await page.keyboard.press("Escape");
  await pencil(page, { kind: "squeeze", pref: "palette", x: 300, y: 300 });
  await expect(palette(page)).toHaveAttribute("data-pencil-pens", "row");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
  await pencil(page, { kind: "squeeze", pref: "palette", x: 300, y: 300 });
  await expect(palette(page)).toHaveAttribute("data-pencil-pens", "row");
  await context.close();
});

test("in a browser the page offers the app nothing, and the info panel no pencil setting", async ({ browser }) => {
  const { page, context } = await openOn(browser, SIDEWAYS, "en", { inApp: false });
  expect(await page.evaluate(() => typeof (window as unknown as { __HIFTH_PAGE__?: unknown }).__HIFTH_PAGE__)).toBe("undefined");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator('[aria-labelledby="colophon-tip-pens"]')).toHaveCount(0);
  await context.close();
});

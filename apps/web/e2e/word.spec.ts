import { test, expect, type Page } from "@playwright/test";
import { ayahTarget, tapAyah } from "./ayah";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * word-C — the long-press that drops into word granularity (PLAN 13, task #65).
 *
 * The unit tests know the ladder returns `"word"` and the pen draws the bands.
 * What only a real browser can answer is whether the *same* hold that has meant
 * "marquee" since Loop 5 can mean two things depending on where it began, and
 * still reach our handlers rather than the platform's text selection — and
 * whether the shard the gesture depends on actually arrives when a finger asks
 * for it, over the wire, at ~3.6 KB, on a page that was never precached.
 *
 * Driven with the mouse for the same reason `marquee.spec.ts` is: Playwright's
 * touchscreen exposes `tap()` only, and a hold is the whole gesture here.
 * @use-gesture reads Pointer Events either way.
 */

/** Open the app as a reader who has been here before — see `marquee.spec.ts`. */
async function openApp(page: Page): Promise<void> {
  await page.addInitScript((coachKey: string) => {
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode — the strip stays hidden anyway */
    }
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
  }, COACH_STORAGE_KEY);
  await page.goto("/");
  await expect(page.locator("svg[role='group']")).toBeVisible();
}

/** Every band of word ink currently on the page. */
function wordInk(page: Page) {
  return page.locator("#hifth-overlay [data-hl-group='word']");
}

/**
 * How much word ink is down, in viewBox units.
 *
 * Summing `--hl-len` rather than counting bands, because a run that grows along
 * one line stays one band: the count would sit at 1 while the ink doubled, and
 * "the drag extended the run" would pass on a run that never moved.
 */
async function wordInkLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    let total = 0;
    for (const el of document.querySelectorAll("#hifth-overlay [data-hl-group='word']")) {
      total += Number((el as SVGElement).style.getPropertyValue("--hl-len")) || 0;
    }
    return total;
  });
}

/**
 * The rightmost edge of the word ink, in viewBox units.
 *
 * A position, where `wordInkLength` is a size — together they separate "the run
 * moved" from "the run grew", which is the whole difference between an arrow key
 * and a shifted one. Rightmost because the line runs right to left: the word a
 * run starts at is its right edge.
 */
async function wordInkRight(page: Page): Promise<number> {
  return page.evaluate(() => {
    let right = -Infinity;
    for (const el of document.querySelectorAll("#hifth-overlay [data-hl-group='word']")) {
      const line = el as SVGLineElement;
      right = Math.max(right, line.x1.baseVal.value, line.x2.baseVal.value);
    }
    return right;
  });
}

/**
 * Press at `from`, hold past LONG_PRESS_MS (350 in @hifth/core), nudge, then run
 * `move` with the button still down.
 *
 * The nudge is not decoration and its *size* is not arbitrary. The ladder is
 * consulted from the drag handler, so a press that never moves is never
 * classified — and @use-gesture is configured with `filterTaps: true`, which
 * gives drag a 3 px threshold, so a 1 px nudge produces no frame to classify
 * with. `NUDGE_PX` clears that threshold and nothing else: at this stage's scale
 * (~345 viewBox units across a 412 px phone) it is about 5 units, well inside
 * one word, so the hold still lands on the word it was aimed at.
 */
const NUDGE_PX = 6;

async function holdThen(
  page: Page,
  from: { x: number; y: number },
  move: (page: Page) => Promise<void>,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(from.x - NUDGE_PX, from.y);
  await move(page);
}

test.describe("Hifth · word selection", () => {
  test("a hold inside the selected ayah drops to words; a drag extends the run", async ({
    page,
  }) => {
    await openApp(page);

    // 2:39 — near the top of page 7, so the whole ayah is above the fold on both
    // devices and a drag has somewhere to go (`marquee.spec.ts` explains why the
    // bottom of the page is not a place to test a gesture).
    await tapAyah(page, "#verse-46");
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);
    await expect(wordInk(page)).toHaveCount(0);

    const at = await ayahTarget(page, "#verse-46");
    await holdThen(page, at, async () => {
      // The shard is fetched on this frame — ~3.6 KB, deliberately not
      // precached — so the first band is a round trip away. Waiting for the ink
      // rather than for a timeout is what makes this assert the arrival.
      await expect(wordInk(page)).not.toHaveCount(0);
    });

    const one = await wordInkLength(page);
    expect(one, "a word has width").toBeGreaterThan(0);

    // Extend leftwards — Arabic runs right to left, so the words after the one
    // under the finger are to its left.
    await page.mouse.move(at.x - 70, at.y, { steps: 10 });
    const many = await wordInkLength(page);
    expect(many, "the drag swept more words than the hold landed on").toBeGreaterThan(one);

    await page.mouse.up();

    // The ayah is still lit underneath. That is the point of the descent: the
    // reader has refined their selection, not replaced it.
    await expect(wordInk(page)).not.toHaveCount(0);
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);

    // The band is marker ink, on the same pen as everything else on this page.
    const first = wordInk(page).first();
    await expect(first).toHaveClass(/hl-ink/);
    expect(await first.evaluate((el) => el.tagName.toLowerCase())).toBe("line");
  });

  test("Escape climbs back to the whole ayah, not out of the selection", async ({ page }) => {
    await openApp(page);
    await tapAyah(page, "#verse-46");

    const at = await ayahTarget(page, "#verse-46");
    await holdThen(page, at, async () => {
      await expect(wordInk(page)).not.toHaveCount(0);
    });
    await page.mouse.up();

    await page.keyboard.press("Escape");

    // One rung, not two: the words let go, the ayah does not.
    await expect(wordInk(page)).toHaveCount(0);
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);
  });

  /*
   * word-D4 — the keyboard's way in, which is the same sentence as the finger's.
   *
   * A browser is the only place this can be asserted. The descent works by
   * running *before* the highlighter's own keydown and stopping the event, so
   * what is really under test is capture-phase ordering between two listeners on
   * two different nodes, plus focus actually sitting on the polygon — none of
   * which a jsdom render reproduces faithfully.
   */
  test("Enter again descends to words; ← carries the run and Shift+← grows it", async ({
    page,
  }) => {
    await openApp(page);

    await page.locator("#verse-46").focus();
    // The first Enter is Loop 3's: it selects the ayah, and no word ink appears.
    await page.keyboard.press("Enter");
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);
    await expect(wordInk(page)).toHaveCount(0);

    // The second is the keyboard's hold. The shard is a round trip away here too,
    // so waiting for the ink asserts the fetch as well as the grammar.
    await page.keyboard.press("Enter");
    await expect(wordInk(page)).not.toHaveCount(0);
    const startRight = await wordInkRight(page);

    // ← is forward: the line runs right to left, and this is the mapping the ayah
    // stepper already uses. Asserted as "the ink is somewhere else" rather than
    // "the ink is exactly one word further left", because a run that steps over
    // a line ending moves right and down — true of the run, awkward for a number.
    await page.keyboard.press("ArrowLeft");
    await expect(wordInk(page)).not.toHaveCount(0);
    const movedRight = await wordInkRight(page);
    const movedLength = await wordInkLength(page);
    expect(movedRight, "a plain arrow carries the run to another word").not.toBe(startRight);

    // Shift leaves the anchor standing, so the run grows instead of moving.
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await wordInkLength(page), "Shift extends the run").toBeGreaterThan(movedLength);

    // The arrows never reached the page-turner underneath: PageDown/PageUp and
    // ←/→ are the app's page keys, and a run in hand takes the arrows off them.
    // Read off the slider rather than the stage, because a page that turned and a
    // page that never loaded look identical in the SVG and quite different here.
    await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "صفحة 7 من 604");

    // And Escape climbs exactly one rung, as it does for the finger.
    await page.keyboard.press("Escape");
    await expect(wordInk(page)).toHaveCount(0);
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);
  });

  test("a word run is announced as its outcome, not as its words", async ({ page }) => {
    await openApp(page);

    await page.locator("#verse-46").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(wordInk(page)).not.toHaveCount(0);

    // «… مواضع مشابهة» — how many places this run is about, which is the question
    // the reader asked by selecting it. What the announcement must never contain
    // is the selection itself: reading scripture back through a UI string is the
    // one thing the word grain is built to avoid (`docs/design/word-indexing.md`
    // §10 — we ship rectangles, not text).
    await expect(page.locator("div.sr-only[role='status']")).toHaveText(/مشابه/);
  });

  test("the same hold outside the selection still paints a marquee", async ({ page }) => {
    await openApp(page);

    // Select one ayah, then begin the hold on a *different* one. This is the
    // whole risk of adding a fifth verdict to a ladder that already had four:
    // the new one is separated from the marquee by a single bit of context, so
    // a bug in reading that bit shows up as the Loop 5 gesture disappearing.
    await tapAyah(page, "#verse-46");
    const elsewhere = await ayahTarget(page, "#verse-50");

    await holdThen(page, elsewhere, async () => {
      await page.mouse.move(elsewhere.x - 40, elsewhere.y + 30, { steps: 10 });
      await expect(page.locator("#hifth-overlay rect.hl-marquee")).toHaveCount(1);
    });
    await page.mouse.up();

    await expect(page.locator("#hifth-overlay .hl-hlt")).not.toHaveCount(0);
    await expect(wordInk(page)).toHaveCount(0);
  });

  /*
   * The one assertion here that is about what a word run does *not* do.
   *
   * A word run now has an accessible surface — a key that reaches it and a
   * sentence that reports it — but that surface is deliberately *spoken*, in the
   * one live region the whole app announces through, and not *structural*. The
   * overlay stays decorative: laying word ink into it must not add a node, a
   * name or a role to the tree. If it ever does — a stray `role` on a band, a
   * `<title>` inside the overlay — the ayah buttons stop being the only thing a
   * screen reader finds on the page, and they stop being findable in print
   * order. That is a regression the pixel goldens cannot see, the announcement
   * test above would not notice, and the DOM assertions would walk straight past.
   *
   * Compared before-against-after rather than against a committed baseline, so
   * this stays a statement about the *gesture* and does not have to be
   * re-recorded every time an unrelated ayah label changes. The live region is
   * outside the stage subtree, so it is not in this snapshot by construction.
   */
  test("laying word ink leaves the accessibility tree untouched", async ({ page }) => {
    await openApp(page);
    await tapAyah(page, "#verse-46");
    await expect(page.locator("#hifth-overlay [data-hl-group='selection']")).not.toHaveCount(0);

    const stage = page.locator("svg[role='group']").first();
    const before = await stage.ariaSnapshot();

    const at = await ayahTarget(page, "#verse-46");
    await holdThen(page, at, async () => {
      await expect(wordInk(page)).not.toHaveCount(0);
    });
    await page.mouse.move(at.x - 70, at.y, { steps: 10 });
    await page.mouse.up();
    await expect(wordInk(page)).not.toHaveCount(0);

    expect(await stage.ariaSnapshot(), "word ink is decorative and must stay so").toBe(before);
  });
});

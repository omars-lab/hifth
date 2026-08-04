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
   * Every other tree in the app gets a committed aria snapshot (see
   * `share-a11y.spec.ts`). A word run gets none, and that is not an omission
   * this test papers over: word selection has no accessible surface at all —
   * `onSelectWords` has no listener above the stage yet, so nothing announces a
   * word run, and there is no keyboard path down to word granularity. A
   * snapshot file would photograph that absence and read, to the next author,
   * as coverage.
   *
   * What is worth pinning is the invariant that holds *because* of the absence:
   * the overlay is decorative, so laying word ink into it must not add a node,
   * a name or a role to the tree. If it ever does — a stray `role` on a band, a
   * `<title>` inside the overlay — the ayah buttons stop being the only thing a
   * screen reader finds on the page, and they stop being findable in print
   * order. That is a regression the pixel goldens cannot see and the DOM
   * assertions above would not notice.
   *
   * Compared before-against-after rather than against a committed baseline, so
   * this stays a statement about the *gesture* and does not have to be
   * re-recorded every time an unrelated ayah label changes.
   *
   * The missing keyboard and screen-reader path is tracked as an issue, not
   * left here to be discovered — see docs/issues.json.
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

import { test, expect, type Page } from "@playwright/test";
import { foldBetween } from "@hifth/core";
import { tapAyah, ayahTarget } from "./ayah";
import { watchFolds, foldWords } from "./fold";

/*
 * The fold — what a page turn draws, and everything it must not.
 *
 * This app's page turn has one axiom (`docs/design/page-transition.md` §3.1):
 * **no glyph moves**. A mus'haf reader's memory is spatial — the shape of a page
 * is part of what they memorised — so an animation that slides the page image is
 * an animation that moves scripture off the position it was learned at. The fold
 * is the way around that: a band that is not a page passes over two stationary
 * pages, and they swap under it.
 *
 * The band's job is to say **what was between the two leaves**, and this is where
 * the file earns its place. `foldBetween` (@hifth/core) answers one of four words
 * — crease, gap, hole, none — and in *this* build every turn is a `hole`, because
 * pages 7, 9 and 19 are the only pages vendored and none of them are adjacent in
 * the print. A band drawn as a gap between 7 and 9 would be the interface
 * asserting that they are consecutive leaves. They are not; page 8 exists and we
 * do not have it. That is the exact class of lie `PLAN.md` forbids, it is one
 * wrong array away in the predicate, and this file is what would notice.
 *
 * Nothing here re-derives the four words. The first test reads the attribute off
 * the band and compares it against core for the same pair, so a stylesheet that
 * decided parity for itself — or a `PageStage` that mapped "both pages are
 * vendored" onto `gap` — fails here even though every screenshot looks right.
 *
 * Runs on the two phone projects. The desktop spread's own claim about the fold
 * (it crosses the whole open book, and a crease on a spread animates nothing) is
 * asserted in `desktop.spec.ts`, where the spread exists.
 */

/** The Madani print. Same number the page bar's track spans. */
const TOTAL = 604;
/** This build's inventory, in reading order. `nearestPage`'s domain. */
const VENDORED = [7, 9, 19] as const;

const NUM = "header .numeric";
const NEXT = "الصفحة التالية";
const PREV = "الصفحة السابقة";

/**
 * The box a dragged turn is measured against — the *layer*, not the stage.
 *
 * `PageStage.measureFit` reads exactly this element, so a commit threshold
 * expressed as 25% of "the stage" is 25% of this width and no other. Aiming a
 * test at the stage instead would measure a box that includes the gutter padding
 * and quietly drag a few per cent short of the threshold it meant to cross.
 */
async function stageBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator("[aria-busy]").first().boundingBox();
  if (!box) throw new Error("the stage layer has no box");
  return box;
}

/** Open the app on page 7 with the fold recorder already armed (`./fold`). */
async function open(page: Page): Promise<void> {
  await watchFolds(page);
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await expect(page.locator(NUM)).toHaveText("7");
}

test.describe("Hifth · the fold", () => {
  test("the band says exactly what core says about the pair", async ({ page }) => {
    await open(page);

    // Every turn the inventory allows, both directions. Two pages is a small
    // sweep; it is also *all* of them, which is the property that matters —
    // this loop has no rows to add when Loop 4b vendors the rest of the print.
    const turns: Array<[number, number]> = [];
    for (let i = 0; i < VENDORED.length - 1; i += 1) {
      turns.push([VENDORED[i]!, VENDORED[i + 1]!]);
      turns.push([VENDORED[i + 1]!, VENDORED[i]!]);
    }

    for (const [from, to] of turns) {
      // Get to `from` without turning — the slider is a jump, so it neither
      // draws a band nor pollutes what the next turn's band says.
      await page.getByRole("slider").fill(String(from));
      await expect(page.locator(NUM)).toHaveText(String(from));

      const before = (await foldWords(page)).length;
      await page.getByRole("button", { name: to > from ? NEXT : PREV }).tap();

      // The band is up for 240 ms. Read the attribute off it while it crosses.
      const band = page.locator("[data-fold]");
      await expect(band).toHaveAttribute("data-fold", foldBetween(from, to, TOTAL));

      await expect(page.locator(NUM)).toHaveText(String(to));
      // One band per turn, not one per frame or one per re-render.
      expect((await foldWords(page)).length - before).toBe(1);
    }
  });

  test("in this build every turn is a hole, and never a gap or a crease", async ({ page }) => {
    await open(page);
    // Stated separately from the row above, and not derived from `foldBetween`,
    // because it is a claim about *this build* rather than about the predicate:
    // if both agreed by both being wrong, the test above would still pass.
    await page.getByRole("button", { name: NEXT }).tap();
    await expect(page.locator(NUM)).toHaveText("9");
    await page.getByRole("button", { name: NEXT }).tap();
    await expect(page.locator(NUM)).toHaveText("19");

    const seen = await foldWords(page);
    expect(seen).toEqual(["hole", "hole"]);
  });

  test("a hop draws no fold at all", async ({ page }) => {
    await open(page);

    // 2:48 on page 7 hops to 2:123 on page 19 — the same two pages a turn would
    // put a band between, reached the other way. A mutashabihat edge is a
    // relationship in the *text*; a fold is a relationship in the *paper*, and
    // drawing one for the other is the whole reason §4.5's last row exists.
    await tapAyah(page, "#verse-55");
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await rail.getByRole("button", { name: /متشابهات في السورة/ }).tap();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ })
      .tap();

    await expect(page.locator(NUM)).toHaveText("19");
    expect(await foldWords(page)).toEqual([]);
  });

  test("no glyph moves while the page turns", async ({ page }) => {
    await open(page);

    // The axiom, measured. Sample every mounted page's SVG on every frame for
    // the length of a turn and assert that no page's box ever moves — the swap
    // is a change of *which* page is painted, never of where any page sits.
    //
    // The sampler is armed before the tap rather than after, because the first
    // frame is the one a 16 px translate would show.
    //
    // It runs until the test stops it, not for a fixed window, and it records a
    // frame at a time rather than a list per page. Both were the same mistake:
    // a fixed 600 ms window that was enough here and not on CI, and a
    // per-page sample count standing in for "we watched the swap happen".
    // Neither is a claim about the product — how many frames the arriving page
    // appears in is a fact about how fast the machine fetched its SVG. What the
    // axiom actually says is checked below, off frames the sampler either did
    // or did not capture the overlap in.
    await page.evaluate(() => {
      type Rect = [number, number, number, number];
      const w = window as unknown as {
        __frames: Array<Record<string, Rect>>;
        __stop: boolean;
      };
      w.__frames = [];
      w.__stop = false;
      const t0 = performance.now();
      const tick = (): void => {
        const frame: Record<string, Rect> = {};
        for (const svg of document.querySelectorAll("svg[aria-labelledby^='page-label-']")) {
          const host = svg.parentElement;
          if (!host || getComputedStyle(host).display === "none") continue;
          const r = svg.getBoundingClientRect();
          frame[svg.getAttribute("aria-labelledby") ?? "?"] = [
            Math.round(r.x),
            Math.round(r.y),
            Math.round(r.width),
            Math.round(r.height),
          ];
        }
        w.__frames.push(frame);
        // The cap is only so a turn that never lands ends as a failed
        // assertion rather than a page pinned at 60 fps forever.
        if (!w.__stop && performance.now() - t0 < 10_000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.getByRole("button", { name: NEXT }).tap();
    await expect(page.locator(NUM)).toHaveText("9");

    // Stop and read in one call. Frames sampled after the turn landed are of a
    // page that has stopped moving, so they can only strengthen the check below
    // — the arriving page's resting box must equal the box it had while the
    // band was still crossing it.
    const frames = await page.evaluate(() => {
      const w = window as unknown as {
        __frames: Array<Record<string, number[]>>;
        __stop: boolean;
      };
      w.__stop = true;
      return w.__frames;
    });

    // The moment the axiom is about: both pages painted in the same frame. The
    // cross-fade puts the two of them on the stage together by construction, so
    // a turn with no such frame is either a swap that skipped the fade or a
    // sampler that never ran — and both would leave the rest of this row
    // asserting that one stationary page stayed where it was.
    const together = frames.filter((f) => f["page-label-7"] && f["page-label-9"]);
    expect(together.length, "the two pages were never on the stage at once").toBeGreaterThan(0);

    // No page's box ever changed, across every frame it appeared in — the swap
    // is a change of *which* page is painted, never of where any page sits.
    const boxes = new Map<string, number[]>();
    for (const frame of frames) {
      for (const [id, rect] of Object.entries(frame)) {
        const first = boxes.get(id);
        if (first === undefined) boxes.set(id, rect);
        else expect(rect, `${id} moved mid-turn`).toEqual(first);
      }
    }
    expect([...boxes.keys()].sort()).toEqual(["page-label-7", "page-label-9"]);
  });

  test("two turns inside one sweep leave one band and one visible page", async ({ page }) => {
    await open(page);

    // §3.4: one fold, ever. A second turn *re-targets* the band that is already
    // crossing rather than inserting a second one — which is why the band's
    // position is a CSS transition and not a per-turn animation.
    //
    // Two presses, not §6.3's three: this build holds three pages, so 7 → 9 → 19
    // is every step there is. Loop 4b makes the third press meaningful.
    const next = page.getByRole("button", { name: NEXT });
    await next.tap();
    await next.tap();

    // Mid-flight: exactly one band in the document, whatever else is happening.
    expect(await page.locator("[data-fold]").count()).toBeLessThanOrEqual(1);

    await expect(page.locator(NUM)).toHaveText("19");
    await expect(page.locator("[data-fold]")).toHaveCount(0);

    // …and exactly one page is painted. The cross-fade writes inline opacity on
    // every mounted host, so an interrupted turn is precisely where two of them
    // could be left half-faded on top of each other.
    const visible = await page.evaluate(() => {
      let n = 0;
      for (const svg of document.querySelectorAll("svg[aria-labelledby^='page-label-']")) {
        const host = svg.parentElement;
        if (!host) continue;
        const s = getComputedStyle(host);
        if (s.display !== "none" && parseFloat(s.opacity) > 0) n += 1;
      }
      return n;
    });
    expect(visible).toBe(1);
  });

  test("reduced motion inserts no band at all, and still turns the page", async ({ browser }) => {
    // §5.1. Not inserted-and-instant: *not inserted*. The tokens are already 0ms
    // under `prefers-reduced-motion`, so a band that was still added would be a
    // one-frame flash of a fore-edge — worse than the nothing it replaces, and
    // invisible to every other test in this suite.
    //
    // What the fold says is not lost: the leaf's own free corner and fore-edge
    // stack say which side is bound at rest, and the announcer and page bar both
    // name the page on arrival.
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      await open(page);
      await page.getByRole("button", { name: NEXT }).tap();
      await expect(page.locator(NUM)).toHaveText("9");
      expect(await foldWords(page)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("a turn to a page that never arrives leaves the reader where they were", async ({
    browser,
  }) => {
    // Its own context, with the service worker blocked. `page.route` does not
    // see requests a service worker makes on the page's behalf, and this app
    // runtime-caches `/assets/pages/` — so with the worker in play the abort
    // below is a no-op and the turn quietly succeeds, which is a green test
    // asserting nothing. Blocking it is not a simplification of the real
    // failure: offline, a page we have never fetched is a cache miss and then a
    // network error, which is the same nothing arriving here.
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    try {
      await open(page);

      // §5.3. The failure this guards is not the fetch — it is landing anyway: a
      // stage that swapped before the mount resolved would paint sunk paper
      // where scripture belongs, under a header that had already moved on.
      await page.route("**/assets/pages/**/9.svg", (route) => route.abort());
      await page.getByRole("button", { name: NEXT }).tap();

      // The band retreats the way it came, the number does not move, and the app
      // says which page failed — page 9, not the page still on screen.
      await expect(page.getByRole("alert")).toContainText("٩");
      await expect(page.locator(NUM)).toHaveText("7");
      await expect(page.locator("[data-fold]")).toHaveCount(0);
      await expect(page.locator("svg[aria-labelledby='page-label-7']")).toBeVisible();

      // Unblocked, the same press lands. The failure was a state, not a latch.
      await page.unroute("**/assets/pages/**/9.svg");
      await page.getByRole("button", { name: NEXT }).tap();
      await expect(page.locator(NUM)).toHaveText("9");
    } finally {
      await context.close();
    }
  });

  test("a long horizontal drag is still a marquee, not a page turn", async ({ page }) => {
    await open(page);

    // The gesture ladder's safety argument, from the other side
    // (`page-turning.md` §4.2). Now that `"turn"` is a verdict, this row is the
    // one that says the marquee did not pay for it: a ladder that put `turn`
    // above `marquee` would eat every highlight that happens to travel
    // sideways, which on a right-to-left page is most of them. Rule 2 asks
    // about the hold *before* rule 3 asks about the axis, and 400 ms of stillness
    // is the answer to rule 2.
    const from = await ayahTarget(page, "#verse-54");
    await page.touchscreen.tap(from.x, from.y);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.waitForTimeout(400); // past LONG_PRESS_MS (350 in @hifth/core)
    for (let i = 1; i <= 10; i += 1) {
      await page.mouse.move(from.x - i * 20, from.y);
    }
    await page.mouse.up();

    expect(await foldWords(page)).toEqual([]);
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("a sideways flick turns the page, and the band tracks the finger", async ({ page }) => {
    await open(page);

    // §4.1's free slot, spent. At fit-zoom a horizontal drag on this stage was a
    // measured no-op — `holdAxis` centres an axis that fits, so the transform
    // did not move — and this is the gesture that took the slot. Rightward is
    // the *next* page: `loop-1.md` pins that to the book's direction, and it is
    // the same `1` the wheel and the arrow keys mean.
    const box = await stageBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();

    // Mid-drag, past the commit distance but before the release: the band is on
    // the stage and the stage says which phase it is in. `tracking` is the state
    // that only a dragged turn can reach — a wheel turn goes straight to
    // `crossing` — so this assertion is the whole difference between the two.
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(box.x + box.width * 0.3 + i * (box.width * 0.05), y);
    }
    await expect(page.locator("[data-fold]")).toHaveCount(1);
    await expect(page.locator("[data-turn]")).toHaveAttribute("data-turn", "tracking");

    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
    // One band for the whole gesture — the tracked band is *handed over* to the
    // crossing rather than replaced by a second one (§3.4).
    expect(await foldWords(page)).toEqual(["hole"]);
    await expect(page.locator("[data-fold]")).toHaveCount(0);
  });

  test("a leftward flick turns back", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: NEXT }).tap();
    await expect(page.locator(NUM)).toHaveText("9");

    const box = await stageBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.7, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(box.x + box.width * 0.7 - i * (box.width * 0.05), y);
    }
    await page.mouse.up();

    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("a short drag springs back and turns nothing", async ({ page }) => {
    await open(page);

    // §4.3's commit rule, at the half of it that says *no*. Under 25% of the
    // stage and released without a flick, the reader was looking rather than
    // turning — so the band goes back the way it came and the page does not
    // move. This is the row that would fail if the threshold were dropped to
    // "any horizontal drag at all", which is the tempting simplification.
    const box = await stageBox(page);
    const y = box.y + box.height / 2;
    const start = box.x + box.width * 0.35;
    await page.mouse.move(start, y);
    await page.mouse.down();
    // 12% of the stage, in slow steps so the release velocity is not a flick.
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(start + i * (box.width * 0.02), y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();

    // The band was inserted — the reader saw their drag — and then removed.
    expect(await foldWords(page)).toEqual(["hole"]);
    await expect(page.locator("[data-fold]")).toHaveCount(0);
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("a vertical drag pans and draws no band", async ({ page }) => {
    await open(page);

    // Rule 3 needs `|dx| > 2·|dy|`, and the reason it is a ratio rather than a
    // sign is this gesture: on a 390×844 phone the page overflows *vertically*
    // at rest, so a vertical pan is live at the same zoom where the horizontal
    // slot is free. Both must work, on the same surface, with no mode.
    const box = await stageBox(page);
    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.7;
    await page.mouse.move(x, startY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(x, startY - i * 20);
    }
    await page.mouse.up();

    expect(await foldWords(page)).toEqual([]);
    await expect(page.locator(NUM)).toHaveText("7");
  });
});

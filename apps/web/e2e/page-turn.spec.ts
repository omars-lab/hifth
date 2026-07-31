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
    await page.evaluate(() => {
      const w = window as unknown as {
        __rects: Record<string, Array<[number, number, number, number]>>;
      };
      w.__rects = {};
      const t0 = performance.now();
      const tick = (): void => {
        for (const svg of document.querySelectorAll("svg[aria-labelledby^='page-label-']")) {
          const host = svg.parentElement;
          if (!host || getComputedStyle(host).display === "none") continue;
          const id = svg.getAttribute("aria-labelledby") ?? "?";
          const r = svg.getBoundingClientRect();
          (w.__rects[id] ??= []).push([
            Math.round(r.x),
            Math.round(r.y),
            Math.round(r.width),
            Math.round(r.height),
          ]);
        }
        if (performance.now() - t0 < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.getByRole("button", { name: NEXT }).tap();
    await expect(page.locator(NUM)).toHaveText("9");

    const rects = await page.evaluate(
      () =>
        (window as unknown as { __rects: Record<string, number[][]> }).__rects,
    );
    // Both pages must have been sampled: the one being left and the one
    // arriving. A turn that sampled one page only would pass the loop below
    // while proving nothing about the swap.
    expect(Object.keys(rects).sort()).toEqual(["page-label-7", "page-label-9"]);
    for (const [id, frames] of Object.entries(rects)) {
      expect(frames.length, `${id} was sampled`).toBeGreaterThan(3);
      for (const frame of frames) {
        expect(frame, `${id} moved mid-turn`).toEqual(frames[0]);
      }
    }
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

    // The gesture ladder's floor (`page-turning.md` §4.2). Drag-to-turn is not
    // built — `PointerIntent` has no `"turn"` verdict — and this row is what
    // makes adding it a deliberate act: a ladder that put `turn` above `marquee`
    // would eat every highlight that happens to travel sideways, which on a
    // right-to-left page is most of them.
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
});

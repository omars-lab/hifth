import { test, expect, type Locator, type Page } from "@playwright/test";
import { watchFolds, foldsSeen } from "./fold";
import { contextWithout } from "./inventory";

/*
 * The desktop spread — an open mus'haf, and honest about the half it does not
 * have.
 *
 * Everything here is a claim no phone project can check, which is the entire
 * reason a fifth Playwright project exists. Three of the four are geometry
 * against the real layout engine, and geometry is exactly what the jsdom
 * component tests in `src/components/PageSpread.test.tsx` cannot see: those
 * assert DOM order, and DOM order only becomes *sides* once an RTL flow has run.
 * A `flex-direction: row-reverse` added by someone "fixing" the layout would
 * pass every unit test in this repo and put the mus'haf on backwards.
 *
 * The fourth is the mount gate, and it is checked by resizing rather than by
 * trusting the media query: the whole argument for gating in JavaScript instead
 * of CSS is that a hidden leaf still costs a ~170 KB fetch and a Highlighter, so
 * the assertion has to be that the element is *absent*, not that it is invisible.
 *
 * Page 7 throughout, and it now faces a real page 8. This build vendored all 604
 * (Loop 4b), so every opening is complete and the facing leaf is a second
 * `PageStage` rather than the well that says a page is missing — which is what
 * `renders a vendored facing leaf` in the component test was written against.
 * The well is not gone and is not untested: an edition arrives partial the way
 * `hafs-kfqc` was partial for six loops, so the row that asserts it drives a
 * trimmed inventory (`./inventory`) rather than waiting for a hole to happen to
 * be there. See docs/design/desktop.md §4.
 *
 * The last rows are about the fold. Everything the band *says* is asserted on the
 * phone projects in `page-turn.spec.ts`; what belongs here is what needs a second
 * leaf to be false, and there are two of those. A turn *across* openings crosses
 * the whole open book (docs/design/page-transition.md §3.5), so the band is a
 * child of the book and sweeps its full width — a band confined to the live leaf
 * would look correct in every screenshot and would stop dead at the gutter. And a
 * turn *inside* one opening draws no band at all, because the crease between
 * those two leaves is already on screen, drawn by the gutter. That second claim
 * was unreachable before 4b: with only 7, 9 and 19 vendored, no turn this project
 * could make was ever a crease.
 */

/** The spread wrapper. Only exists above the breakpoint — that is the point. */
const spread = (page: Page): Locator => page.getByTestId("page-spread");

/**
 * The open book inside it: the two leaves and nothing else.
 *
 * A different width from the wrapper, and the difference is the point of the two
 * elements — `page-spread` is the desk and runs the width of the window, so a
 * fold measured against it would be allowed to sweep empty field and still pass.
 */
const book = (page: Page): Locator => page.getByTestId("page-book");

/** The visible page's SVG — the only host not `display: none` (PageStage). */
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);

/** The header's page number. The one place the app says where the reader is. */
const NUM = "header .numeric";

/** A bounding box that is definitely there. */
async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "element has no box").not.toBeNull();
  return box!;
}

/**
 * The box of a page, once exactly one copy of it is on screen.
 *
 * A complete corpus put the same page number in two places at once: the live
 * stage cross-fades the arriving page over the leaving one while the *facing*
 * stage is remounting around the new opening, and for a frame or two both
 * stages hold the same number. `boundingBox()` on two matches is a strict-mode
 * error rather than a failure, which is the least useful thing a measurement
 * can do — so wait for the turn to settle before reading it.
 */
async function restingBox(page: Page, pageNo: number) {
  await expect(pageSvg(page, pageNo)).toHaveCount(1);
  return boxOf(pageSvg(page, pageNo));
}

test.describe("Hifth · the desktop spread", () => {
  test("appears above the breakpoint and does not exist below it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(spread(page)).toBeVisible();

    // Below on the *height* axis alone, at a width that still qualifies. This is
    // the case a width-only breakpoint would have got wrong, and it is the one
    // that matters: a mus'haf leaf is portrait, so in a 1440×720 window each
    // leaf would be handed less page than a 320px phone gives (the arithmetic is
    // in docs/design/desktop.md §3, and the row below measures it rather than
    // trusting it). 720 rather than some obviously-small number: it is the
    // height this breakpoint used to be, and the one an eye reads as tall enough.
    await page.setViewportSize({ width: 1440, height: 720 });
    await expect(spread(page)).toHaveCount(0);
    // The reader keeps their page. Falling back to one leaf is a layout change,
    // not a navigation.
    await expect(pageSvg(page, 7)).toBeVisible();

    // Below on width alone.
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect(spread(page)).toHaveCount(0);

    // A phone. `toHaveCount(0)` rather than `not.toBeVisible()` throughout,
    // deliberately: a hidden second leaf would still have fetched its SVG and
    // built its Highlighter, and passing a visibility assertion is exactly how
    // that regression would hide.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(spread(page)).toHaveCount(0);

    // And it comes back. The gate is a subscription, not a first-render read —
    // a reader who maximises a window should not have to reload to get the book.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(spread(page)).toBeVisible();
  });

  test("never gives a leaf less scripture than the narrowest phone does", async ({ page }) => {
    // The criterion the breakpoint exists for (docs/design/desktop.md §3): a
    // spread that shrinks the scripture to fit two pages on screen has traded
    // away the only thing the reader came for.
    //
    // Both sides measured, and both sides the *SVG* — not the leaf's box and not
    // the stage's. The page host takes its border and its fore-edge stack out of
    // whatever box it is given before the scripture is laid out, so comparing a
    // leaf's box against a phone's page is comparing 14 px of furniture against
    // none. The old derivation did exactly that and came out 33 px optimistic,
    // which is how the corner ended up under the floor while the arithmetic in
    // the doc said it was over it.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    // The floor. 320 px is the narrowest window `e2e/chrome-fit.spec.ts` holds
    // the chrome inside, so it is the narrowest page this app promises.
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(spread(page)).toHaveCount(0);
    const phone = await boxOf(pageSvg(page, 7));

    // The tightest window the spread will claim. Nothing between here and the
    // breakpoint is worth testing — every larger window gives a taller stage and
    // therefore a wider leaf, so the corner is the whole of the risk.
    await page.setViewportSize({ width: 1024, height: 740 });
    await expect(spread(page)).toBeVisible();
    const corner = await boxOf(pageSvg(page, 7));

    expect(
      corner.width,
      `a leaf at the breakpoint corner gives ${Math.round(corner.width)}px of scripture, ` +
        `less than the ${Math.round(phone.width)}px a 320px phone gives`,
    ).toBeGreaterThanOrEqual(phone.width);
  });

  test("puts the lower page number on the right", async ({ page }) => {
    // The mus'haf reads right to left. Page 7 pairs with 8 — the print opens
    // each spread on the odd page — so 7 is the earlier leaf and sits on the
    // right and 8 sits to its *left*. Measured in viewport coordinates against
    // the real RTL flow, because that is the step DOM-order assertions cannot
    // make: the right leaf is written first in the DOM and only becomes the
    // right leaf once an RTL flow has run over it.
    //
    // Both sides are scripture now. Until 4b the left of this pair was the well
    // for the page we did not have, which measured the same and proved less —
    // an empty box is placed by the same flow whether or not the layout can
    // hold a real leaf.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();

    const live = await boxOf(pageSvg(page, 7));
    const facing = await boxOf(pageSvg(page, 8));

    expect(live.x, "the earlier page is not on the right").toBeGreaterThan(facing.x + facing.width);

    // And both leaves are inside the spread, side by side rather than stacked —
    // a wrap would satisfy the test above and still be two pages on top of each
    // other.
    const vertical = Math.abs(facing.y - live.y);
    expect(vertical, "the leaves are not on the same line").toBeLessThan(facing.height);
  });

  test("closes the book: equal leaves, paper meeting at the spine, nothing clipped", async ({
    page,
  }) => {
    // The three halves of one defect. Each leaf used to take half the *window*
    // while the page inside it was sized from the height the chrome left and then
    // centred in that half, so a 1440×900 window put ~131 px of empty field
    // between each page and the spine — a gap down the middle of a book, which is
    // the one place a book has no gap at all.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 7)).toBeVisible();

    const open = await boxOf(book(page));
    const live = await boxOf(pageSvg(page, 7));

    // The two leaf boxes and the gutter's centre, read in one pass off the book's
    // own children. The leaves are what has to be equal — measuring the page
    // inside one against the well inside the other would compare a box that
    // gives up 14 px to a border and a fore-edge stack against one that does not.
    const { leaves, centre } = await book(page).evaluate((el) => {
      const kids = Array.from(el.children);
      const g = kids[kids.length - 1]!.getBoundingClientRect();
      return {
        leaves: kids.slice(0, 2).map((k) => {
          const r = k.getBoundingClientRect();
          return { x: r.x, width: r.width };
        }),
        centre: g.x + g.width / 2,
      };
    });

    // Equal, and the seam is where the gutter is drawn. `flex: 1 1 0` floors the
    // *content* box at zero, so the absent leaf's padding was added on top of its
    // share and it came out 32 px wider than the live one — and the gutter, drawn
    // at the container's 50%, then missed the real seam by half of that.
    expect(leaves).toHaveLength(2);
    expect(leaves[1]!.width, "the two leaves are not the same width").toBeCloseTo(
      leaves[0]!.width,
      0,
    );
    // Right leaf first in DOM order, so the seam is where the second one ends.
    const seam = leaves[1]!.x + leaves[1]!.width;
    expect(centre, "the gutter is not drawn where the leaves meet").toBeCloseTo(seam, 0);

    // The scripture reaches the spine. Not `=== seam`: the page host carries a
    // border, so a page flush against the binding still starts a pixel or two
    // off it. The failure this guards against is a hundred, not a couple.
    expect(live.x - seam, "the page floats off the spine").toBeLessThan(4);

    // And the foot of the page is on the paper. `--spread-chrome: 220px` was an
    // estimate of the chrome above and below, the real figure is 252 px, and the
    // stage is `overflow: hidden` — so the cap drew a page 29 px taller than the
    // box holding it and cut the last line off every desktop page. There is
    // nothing to estimate: the browser knows the box's height.
    expect(live.y, "the page is clipped at the head").toBeGreaterThanOrEqual(open.y - 1);
    expect(live.y + live.height, "the page is clipped at the foot").toBeLessThanOrEqual(
      open.y + open.height + 1,
    );
  });

  test("the desk is one surface, painted once", async ({ page }) => {
    // The field used to be painted by each `PageStage`, and only the live leaf
    // has a stage — so the half of the desk under the page had the radial
    // gradient and the other half was flat `--paper`, with a seam down the
    // middle where they met. Two highlights on one desk is a picture of two
    // desks. The spread paints the same gradient once, across the whole width,
    // and `--stage-field` tells the stage inside to stop painting its own.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    const [deskField, stageField] = await page.evaluate(() => {
      const image = (sel: string) =>
        getComputedStyle(document.querySelector(sel)!).backgroundImage;
      return [image("[data-testid='page-spread']"), image("[data-leaf]")];
    });
    expect(deskField, "the desk has no field of its own").toContain("gradient");
    expect(stageField, "the leaf is still painting a second field").toBe("none");
  });

  test("announces the missing facing page instead of showing blank paper", async ({ browser }) => {
    // The one row here that runs against a corpus this build does not ship.
    //
    // 4b vendored all 604, so page 7 faces a real page 8 and there is no hole
    // left to photograph. The surface is not obsolete — it is what an edition
    // looks like on the day it arrives partial, which is what `hafs-kfqc` was
    // for six loops and what the next riwayah will be. Deleting the row because
    // today's corpus is complete would leave `desktop.md` §4 promising a
    // sentence with nothing behind it, so the scarcity is manufactured instead:
    // `contextWithout` trims page 8 out of the manifest on the wire, and the
    // app is told nothing.
    const { context, page } = await contextWithout(browser, [8]);
    try {
      await page.goto("/#/hafs-kfqc/p7");
      const absent = page.getByRole("region", { name: "الصفحة المقابلة" });
      await expect(absent).toBeVisible();

      // It says which page, and how much of the mus'haf is actually here — the
      // same sentence the page bar carries, from the same string. 603 of 604 is
      // the fixture's arithmetic, and asserting it is what proves the fixture
      // reached the app rather than being quietly bypassed.
      await expect(absent).toContainText("صفحة 8 ليست في هذه النسخة");
      await expect(absent).toContainText("المتوفّر ٦٠٣ من ٦٠٤ صفحة");

      // The claim that it is not blank paper, made against the pixels rather
      // than the markup: the hole is a recessed well, so its background must
      // differ from the raised paper the real leaf sits on. A future restyle
      // that quietly sets both to `--paper` fails here.
      //
      // Wait for the live leaf first. The hole is rendered by the spread and is
      // there immediately; the page beside it arrives over the network, and the
      // comparison below reads both. Without this the row flakes on a null SVG
      // — an error, not a failure, which is a worse thing for a comparison to
      // do.
      await expect(pageSvg(page, 7)).toBeVisible();
      const [wellBg, paperBg] = await page.evaluate(() => {
        const region = document.querySelector("section[aria-label]")!;
        const well = region.firstElementChild!;
        const host = document.querySelector("svg[aria-labelledby^='page-label-']")!.parentElement!;
        const bg = (el: Element) => getComputedStyle(el).backgroundColor;
        return [bg(well), bg(host)];
      });
      expect(wellBg, "the hole is painted like paper").not.toBe(paperBg);

      // And nothing was pushed through the live region for it. The announcer
      // already speaks on every page turn; appending "…and the facing page is
      // missing" to all of them is how a reader learns to stop listening. A
      // permanent condition belongs in the document, which is where it is.
      const live = page.locator("[aria-live]");
      if (await live.count()) {
        await expect(live.first()).not.toContainText("ليست في هذه النسخة");
      }
    } finally {
      await context.close();
    }
  });

  test("gives the header the controls the phone had to hide", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");

    // On a phone the language switch is two levels deep, inside the colophon
    // sheet behind the wordmark, because `chrome-fit.spec.ts` holds the header
    // inside 320px with seventeen pixels of slack and a sixth control does not
    // fit in seventeen pixels. Desktop has the room, so it stops hiding it.
    const langs = page.getByRole("radiogroup", { name: "اللغة" });
    await expect(langs).toBeVisible();
    await expect(langs.getByRole("radio")).toHaveCount(2);

    // And the keyboard legend, whose mobile constraint is stronger than room:
    // a phone has no keys to name. `aria-hidden`, so it is located by tag —
    // `kbd` appears nowhere else in the app. The tablet block below is the
    // other half of this claim and would be meaningless without it.
    await expect(page.locator("kbd")).toHaveCount(3);
    await expect(page.locator("kbd").first()).toBeVisible();

    // It is *added*, not moved: the sheet keeps its copy. A control that
    // relocates as the window resizes is a control the reader has to re-find.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(langs).toBeHidden();
    await page.getByRole("button", { name: /عن حِفظ/ }).click();
    await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(2);
  });

  test("still turns pages with the arrow keys the header advertises", async ({ page }) => {
    // The hint is a promise. ← is drawn first, on the right of the RTL row, and
    // it turns forward — the next page of a mus'haf is the one to the left.
    //
    // 7 → 8 stays inside one opening, which is the turn this project could not
    // make until 4b: the book does not move, and the only thing that changes is
    // which of the two leaves the reader is on. So the assertion is the
    // relationship — the earlier page is still the one on the right — which has
    // to hold from either leaf and is exactly what a `row-reverse` "fix" would
    // invert.
    //
    // It is also the pin on `desktop.md` §8 ①, settled at 4b: **a step is one
    // page, at every width.** The header reading `8` and not `9` after one press
    // is the whole of that decision, and this is the only row in the repo where
    // ±2 would fail — core's `step: 1 | -1` stops it typechecking, but a
    // component that decided to double the step on a spread would sail past the
    // type and land here. The reasoning lives in `packages/core/src/keymap.ts`.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    const before = await boxOf(pageSvg(page, 7));

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("8");
    await expect(spread(page)).toBeVisible();

    const after = await restingBox(page, 8);
    const earlier = await restingBox(page, 7);
    expect(earlier.x, "the earlier page stopped being on the right").toBeGreaterThan(
      after.x + after.width,
    );
    expect(after.width, "the leaf changed size on a page turn").toBeCloseTo(before.width, 0);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("a turn inside one opening draws no band", async ({ page }) => {
    // §3.5, and the row 4b made reachable. Both leaves of (7,8) are already on
    // screen and the crease between them is already drawn — permanently, by the
    // gutter — so sweeping a second crease across the book would be an
    // animation of something the reader is looking at. `PageStage` suppresses
    // it, and only on a spread: the same turn on a phone *must* draw the band,
    // which is what `page-turn.spec.ts` asserts from the other side.
    await watchFolds(page);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("8");
    expect(await foldsSeen(page), "a crease was swept across an open book").toEqual([]);

    // And it still committed. "No band" is a claim about the animation, not
    // about the turn — a spread that quietly stopped turning would satisfy the
    // line above and be a far worse bug.
    await expect(pageSvg(page, 8)).toBeVisible();
  });

  test("the fold crosses the whole open book, not the leaf that turned", async ({ page }) => {
    await watchFolds(page);
    // From 8, not 7 — the turn has to leave the opening for a band to exist at
    // all (the row above is the other half of that). 8 → 9 is a `gap`: the two
    // leaves are adjacent in the print and belong to different openings, so the
    // whole book is replaced and the band has the full width to cross.
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 8)).toBeVisible();

    const open = await boxOf(book(page));
    const leaf = await boxOf(pageSvg(page, 8));

    // Sample the band on every frame for the length of a sweep, armed before the
    // key rather than after: a band that never leaves the leaf is wrong from its
    // first frame, and by the time an `expect` resolves it has already landed.
    await page.evaluate(() => {
      const w = window as unknown as { __band: Array<[number, number]> };
      w.__band = [];
      const t0 = performance.now();
      const tick = (): void => {
        const el = document.querySelector("[data-fold]");
        if (el) {
          const r = el.getBoundingClientRect();
          w.__band.push([r.x, r.x + r.width]);
        }
        if (performance.now() - t0 < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("9");

    // It was put in the open book, not in the stage that owns the turn. The
    // stage carries `data-leaf` and no testid, so a band that failed to portal
    // reports `host: null` here instead of quietly measuring the same.
    const seen = await foldsSeen(page);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.host, "the band was not portalled into the open book").toBe("page-book");
    expect(seen[0]!.hostWidth, "the band's box is not the open book").toBeCloseTo(open.width, 0);

    // And it went the whole way across. The far end is the assertion that a leaf
    // -sized sweep fails: the live page is the right-hand leaf, so a band that
    // stopped at its own leaf's edge would never reach the left of the book.
    const band = await page.evaluate(
      () => (window as unknown as { __band: Array<[number, number]> }).__band,
    );
    expect(band.length, "the band was never sampled mid-sweep").toBeGreaterThan(3);
    const near = Math.min(...band.map((f) => f[0]));
    const far = Math.max(...band.map((f) => f[1]));
    expect(near, "the band never reached the near edge").toBeLessThan(open.x + 2);
    // Not the exact far edge. The band is removed the moment the turn ends, so
    // the last frame a sampler can catch is a frame or two inside the sweep, and
    // an eased transition spends its slowest frames there — pinning the final
    // pixel would be pinning frame timing, which is a flake, not a claim. 0.8 of
    // the book is far past the gutter and roughly twice as far as the failure
    // this row exists for: a band confined to the live leaf stops at 0.5.
    expect(far, "the band stopped short of the far leaf").toBeGreaterThan(
      open.x + open.width * 0.8,
    );
    expect(far - near, "the band swept one leaf, not the spread").toBeGreaterThan(leaf.width * 1.5);
  });

  test("no band is left resting beside the book", async ({ page }) => {
    await watchFolds(page);
    // From 8 again: this row is about where a band ends up once it has finished,
    // so it needs a turn that inserts one. 8 → 9 crosses openings.
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    // The wrapper is in the document before the leaf inside it has finished
    // arriving, and a key pressed in that window is a key the stage has nothing
    // to turn from. Wait for the page itself, as every other row here does.
    await expect(pageSvg(page, 8)).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("9");
    await expect(page.locator("[data-fold]")).toHaveCount(0);

    // A band at rest sits one width *outside* the book at each end of its
    // sweep, so the clip is the only thing between a finished turn and a strip
    // of fore-edge floating in the desktop field, attached to nothing. Asserted
    // against the computed style because it is a load-bearing declaration that
    // looks like tidiness, and the next person to simplify this stylesheet will
    // read it as tidiness.
    //
    // On the book and not the desk: the desk is the width of the window, so a
    // clip there would let a parked band sit out on the field and still pass.
    const clip = await book(page).evaluate((el) => getComputedStyle(el).overflow);
    expect(clip, "the open book stopped clipping the parked band").toBe("hidden");
  });
});

/*
 * The revision map on a wide window — `desktop.md` §8 ⑤.
 *
 * Every other sheet in the app narrows on a wide window: seven of them carry a
 * `@media (min-width: 900px)` rule that turns the phone's full-bleed bottom
 * sheet into a 420–440px card. The map shipped without one, and the question
 * "where does the revision map sit at desktop?" turned out to have the answer
 * "wherever a phone put it, because nobody wrote the rule".
 *
 * It is the one sheet where the convention cannot be copied verbatim, and that
 * is why it needs its own row rather than the missing at-rule. The other seven
 * hold a *column of controls*, which is unreadable at 1440px. This one holds a
 * grid whose entire job is to be a picture of the whole book — narrowing it to
 * a 440px column would be the same mistake pointing the other way.
 *
 * What actually breaks is the grid, not the card. `.grid` is
 * `repeat(auto-fill, minmax(min(--cell, 12vw), 1fr))`, so the wider the sheet
 * the more tracks it lays down — and at the coarse scopes there are not many
 * cells to lay. 30 juz across 1440px is *one row*. A single line of squares is
 * not a map: nothing about it says where in the book you are, which is the only
 * thing a hafiz opens it to see.
 */
test.describe("Hifth · the revision map at desktop", () => {
  test("stays a map instead of stretching into a strip", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();

    await page.getByRole("button", { name: /ما فتحتَه من المصحف/ }).click();
    const sheet = page.getByRole("dialog", { name: "ما فتحتَه من المصحف" });
    await expect(sheet).toBeVisible();

    // The card first. It is bounded and centred rather than full-bleed, which is
    // the half this shares with the other seven sheets.
    const card = await boxOf(sheet);
    const vw = page.viewportSize()!.width;
    expect(card.width, "the map is still full-bleed on a wide window").toBeLessThan(vw - 100);
    expect(
      Math.abs(card.x + card.width / 2 - vw / 2),
      "the map is bounded but not centred",
    ).toBeLessThan(2);

    // And the grid, which is what the width exists to serve. Rows are counted
    // off the cells' own `y` rather than from the column count, so the assertion
    // reads what the browser laid out instead of restating the CSS back at
    // itself — a `repeat(6, …)` that overflows its card is still a broken map.
    const rowsAt = async (): Promise<number> => {
      const ys = await sheet
        .getByRole("list", { name: "خريطة المصحف" })
        .getByRole("listitem")
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().y)));
      return new Set(ys).size;
    };

    // Juz is the scope that failed hardest — 30 cells is the fewest the map ever
    // draws, so it was the first to fit on one line. It was 1 row; it is now 5.
    await sheet.getByRole("radio", { name: "جزء" }).click();
    expect(await rowsAt(), "30 juz laid out as a strip").toBeGreaterThan(3);

    // Hizb is 60, and reached the same failure a little later: 2 rows, now 8.
    await sheet.getByRole("radio", { name: "حزب" }).click();
    expect(await rowsAt(), "60 hizb laid out in a line or two").toBeGreaterThan(5);

    // And the page scope, the one that always had rows to spare, to catch the
    // opposite regression — a card that got narrow enough to fix juz by making
    // the whole book unreadable.
    await sheet.getByRole("radio", { name: "صفحة" }).click();
    expect(await rowsAt(), "604 pages stacked too deep to read").toBeLessThan(32);

    // The card's width does not move as the scope does. This is the reason the
    // grid is centred inside a fixed card rather than the card being sized to
    // its contents: three scopes are three widths, and a sheet that resizes
    // under the cursor makes the radio you just pressed jump away from it.
    expect((await boxOf(sheet)).width, "the sheet resizes when the scope does").toBe(card.width);
  });
});

/*
 * A tablet in landscape — `desktop.md` §8 ③.
 *
 * The question that opened this was whether `min-width` is the right gate for
 * the keyboard hints, and it said to revisit "if anyone reports the hints on a
 * device that cannot use them". No report was needed. iPad Pro 11 landscape is
 * 1194×834 and iPad gen 7 landscape is 1080×810; both clear the 1024×740
 * breakpoint on *both* axes, so both were being shown a legend for keys they do
 * not have. This block is that device.
 *
 * `hasTouch` alone is what flips it, measured rather than assumed: under
 * Chromium emulation a touch context reports `any-hover: none` regardless of
 * viewport, so no `isMobile` is needed here — which is welcome, since
 * `isMobile` brings meta-viewport emulation and a layout viewport distinct from
 * the visual one, and this file measures boxes elsewhere.
 *
 * One honest limit, worth naming rather than discovering later: emulation
 * *replaces* the pointer instead of adding one, so a real touchscreen laptop —
 * trackpad and touchscreen together, `any-hover: hover`, hints correctly shown —
 * is not reachable from here. It reports exactly what this tablet does. So this
 * row proves the tablet is now silent; it cannot prove the laptop still speaks,
 * and the row above at 1440×900 is what carries that half.
 */
test.describe("Hifth · a tablet in landscape", () => {
  test.use({ viewport: { width: 1194, height: 834 }, hasTouch: true });

  test("has the room for the desktop chrome but is not offered a keyboard", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");

    // The premise: this viewport really is above the breakpoint. Without it the
    // test would pass on a phone-sized window for the wrong reason, which is the
    // failure mode a negative assertion is least able to notice.
    await expect(spread(page)).toBeVisible();
    const langs = page.getByRole("radiogroup", { name: "اللغة" });
    await expect(langs).toBeVisible();

    // The claim. Room and a keyboard are two different premises, and only the
    // legend needs the second one. It is still rendered — `display: none` is
    // enough, since these are three spans with no fetch behind them and the row
    // is already `aria-hidden` — so the assertion is about being seen, not about
    // being built.
    await expect(page.locator("kbd")).toHaveCount(3);
    await expect(page.locator("kbd").first()).toBeHidden();
  });
});

/*
 * The wheel — `page-turning.md` §7 ③.
 *
 * Here rather than on the phone projects because a wheel is a desktop input:
 * `desktop.md` §6 documents the keyboard and the pointer, and this is the third
 * thing that surface has. (Mobile WebKit cannot be sent a wheel at all —
 * `stage-fit.spec.ts` says so where it skips for the same reason.)
 *
 * Two claims, and they are separate on purpose. That a wheel *turns* is one line
 * of wiring; that it turns **once per gesture** is the rule, and the rule is
 * `nextWheelTurn` in @hifth/core, unit-tested there against flicks, tails and
 * notches. What these rows prove is the half a unit test cannot: that the
 * listener is on the stage, that its verdict reaches the same `stepPage` the
 * arrow keys end in, and that `ctrl` still means zoom.
 */
test.describe("Hifth · the wheel", () => {
  /** The zoom the stage is actually at, read off the host's own matrix. */
  const scaleOf = (page: Page, pageNo: number): Promise<number> =>
    pageSvg(page, pageNo)
      .locator("xpath=..")
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

  /** Open on page 7 with the pointer resting on the leaf, where a wheel lands. */
  async function overTheLeaf(page: Page): Promise<void> {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    const leaf = await boxOf(pageSvg(page, 7));
    await page.mouse.move(leaf.x + leaf.width / 2, leaf.y + leaf.height / 2);
  }

  test("scrolling turns the page, and down is forward", async ({ page }) => {
    await overTheLeaf(page);

    // Down goes onward — the direction a reader's hand means by it on every
    // other surface. Note this is *not* the RTL question the arrow keys had to
    // settle: down is down in both directions of script, which is much of why
    // the vertical axis is the one bound here.
    await page.mouse.wheel(0, 120);
    await expect(page.locator(NUM)).toHaveText("8");

    // A pause, then the other way. The pause is the gesture boundary — 100 ms of
    // quiet is what tells a mouse's second notch from a trackpad's next frame,
    // and there is no other signal in a wheel event that could.
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, -120);
    await expect(page.locator(NUM)).toHaveText("7");

    // Drift is not a gesture. A hand resting on a trackpad emits a few pixels;
    // a page that turned on them would turn while nobody was asking.
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, 10);
    await page.waitForTimeout(300);
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("a flick and its momentum tail turn exactly one page", async ({ page }) => {
    await overTheLeaf(page);

    // Dispatched in the page rather than through `mouse.wheel`, and the reason
    // is the thing under test. A trackpad flick is ~50 events a few milliseconds
    // apart, including the tail the OS keeps sending after the fingers have
    // lifted; driving that over CDP would put a round-trip between each event
    // and turn one gesture into fifty, which is precisely the bug this asserts
    // the absence of. The trade is that these events are untrusted — the
    // listener does not care, and the real-input path is covered by the row
    // above.
    await page.evaluate(() => {
      const stage = document
        .querySelector('svg[aria-labelledby="page-label-7"]')
        ?.closest("[data-leaf]");
      if (!stage) throw new Error("no stage under the visible page");
      // 15 frames of a push, then a decaying tail — 40 more events that the
      // hand is no longer driving. Total travel is over 400 px: eleven turns if
      // the rule were per-event, one if it is per gesture. Eleven turns is now
      // a page eleven leaves on rather than a run off the end of the inventory,
      // which is a *weaker* failure to see — hence the second read below.
      for (let i = 0; i < 15; i += 1) {
        stage.dispatchEvent(new WheelEvent("wheel", { deltaY: 12, bubbles: true, cancelable: true }));
      }
      for (let i = 0; i < 40; i += 1) {
        stage.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 12 * Math.exp(-i / 12), bubbles: true, cancelable: true }),
        );
      }
    });

    await expect(page.locator(NUM)).toHaveText("8");
    // …and it stays there. A tail that spent a second turn would land on 9.
    await page.waitForTimeout(400);
    await expect(page.locator(NUM)).toHaveText("8");
  });

  test("ctrl+wheel zooms by a step rather than a leap, and turns nothing", async ({ page }) => {
    await overTheLeaf(page);
    expect(await scaleOf(page, 7)).toBeCloseTo(1, 2);

    // One notch, which in pixel mode is 100 px. @use-gesture's own wheel-to-pinch
    // bridge made this `1 + 100/100` × the current zoom — 2.0× from one notch,
    // and MAX_ZOOM saturated in three. The reader aiming for a comfortable read
    // got a wall of ink before their hand stopped moving.
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await expect.poll(() => scaleOf(page, 7)).toBeGreaterThan(1.15);
    expect(await scaleOf(page, 7), "one notch is not one step").toBeLessThan(1.25);

    // Three more. Multiplicative, so this is 1.2⁴ ≈ 2.07 — the same proportion
    // of a change each time, which is what makes the gesture learnable at either
    // end of the range. The old bridge was at the 5× ceiling by now.
    for (let i = 0; i < 3; i += 1) await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect.poll(() => scaleOf(page, 7)).toBeGreaterThan(1.9);
    expect(await scaleOf(page, 7), "four notches saturated the zoom").toBeLessThan(2.3);

    // And the modifier is the whole difference: not one of those five events
    // turned a leaf.
    await expect(page.locator(NUM)).toHaveText("7");
  });
});

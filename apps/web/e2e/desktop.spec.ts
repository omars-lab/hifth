import { test, expect, type Locator, type Page } from "@playwright/test";
import { watchFolds, foldsSeen } from "./fold";
import { contextWithout } from "./inventory";
import { ayahTarget } from "./ayah";
import { lum, pixelsAt } from "./ink";
import { pageNumber, readPageNumber } from "./page-number";

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

/**
 * The zoom the stage is actually at, read off the host's own matrix.
 *
 * The matrix rather than the chrome's readout, deliberately, because the two are
 * exactly what a desync is *between* — the readout is a React mirror of a value
 * that lives in a ref on the stage. The rows below assert both, side by side,
 * for that reason.
 */
const scaleOf = (page: Page, pageNo: number): Promise<number> =>
  pageSvg(page, pageNo)
    .locator("xpath=..")
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

/** The chrome's page-mode radios. Desktop only — that is where the second leaf is. */
const modeBtn = (page: Page, which: "one" | "two"): Locator =>
  page.getByRole("radio", { name: which === "one" ? "صفحة واحدة" : "صفحتان" });

/** The stepper's two buttons. */
const zoomBtn = (page: Page, dir: "in" | "out"): Locator =>
  page.getByRole("button", { name: dir === "in" ? "تكبير" : "تصغير" });

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
    await page.setViewportSize({ width: 1024, height: 775 });
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

    // The two leaf boxes, read in one pass off the book's own children. The
    // leaves are what has to be equal — measuring the page inside one against
    // the well inside the other would compare a box that gives up 14 px to a
    // border and a fore-edge stack against one that does not.
    const leaves = await book(page).evaluate((el) =>
      Array.from(el.children)
        .slice(0, 2)
        .map((k) => {
          const r = k.getBoundingClientRect();
          return { x: r.x, width: r.width };
        }),
    );

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
    // The gutter is drawn on the paper, a half on each leaf, so its darkest
    // column is read off the screen: one row across the band, a third of the
    // way down the page.
    const row = await pixelsAt(page, { x: Math.round(seam) - 20, y: Math.round(live.y + live.height / 3), width: 40, height: 1 });
    const darkest = row.reduce((best, px, i) => (lum(px) < lum(row[best]!) ? i : best), 0);
    expect(Math.abs(Math.round(seam) - 20 + darkest - seam), "the gutter is not drawn where the leaves meet").toBeLessThanOrEqual(3);

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
      await expect(absent).toContainText("صفحة ٨ ليست في هذه النسخة");
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
    // The language pair only: the sheet has other radio groups (the turn style).
    await expect(
      page.getByRole("dialog").locator('[aria-labelledby="colophon-lang"]').getByRole("radio"),
    ).toHaveCount(2);
  });

  test("still turns pages with the arrow keys the header advertises", async ({ page }) => {
    // The hint is a promise. ← is drawn first, on the right of the RTL row, and
    // it turns forward — the next page of a mus'haf is the one to the left.
    //
    // With two pages open one press turns the opening: 7 → 9, never 8, which
    // is already open beside it (owner, 2026-09-28 — the press that moved to 8
    // looked dead; `desktop.md` §8 ①, reversed). The earlier page of the new
    // opening is still the one on the right, which is exactly what a
    // `row-reverse` "fix" would invert.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    const before = await boxOf(pageSvg(page, 7));

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
    await expect(spread(page)).toBeVisible();

    const after = await restingBox(page, 10);
    const earlier = await restingBox(page, 9);
    expect(earlier.x, "the earlier page stopped being on the right").toBeGreaterThan(
      after.x + after.width,
    );
    expect(after.width, "the leaf changed size on a page turn").toBeCloseTo(before.width, 0);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));
  });

  test("a turn moves your place: the URL follows the page, and the highlight lets go", async ({
    page,
  }) => {
    // Turning a leaf is moving your place, not browsing away from it (settled
    // with the owner, against the older "paging does not touch the selection").
    // So a landed turn drops the highlighted ayah, empties the hop trail, and
    // lets the address fall back from the ayah form to the page's own anchor —
    // the whole point being that a link copied after a turn points at the page
    // the reader is looking at, not the ayah they left three leaves ago.
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    // The place is held: the current-ayah bead is up and the URL is the ayah.
    await expect(page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ })).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe("#/hafs-kfqc/2:48");

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));

    // The leaf landed, so the place let go: no bead, and the address is the page.
    await expect(page.getByRole("button", { name: /الآية الحالية/ })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).hash).toBe("#/hafs-kfqc/p9");
  });

  test("no band is left resting beside the book", async ({ page }) => {
    await watchFolds(page);
    // From 8: this row is about what is left once a turn has finished. An arrow
    // on the open book now plays the corner peel; the band plays only where no
    // page can be shown beneath, and the clip below still keeps it in.
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    // The wrapper is in the document before the leaf inside it has finished
    // arriving, and a key pressed in that window is a key the stage has nothing
    // to turn from. Wait for the page itself, as every other row here does.
    await expect(pageSvg(page, 8)).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
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

  /*
   * The fore-edge grab — turning the page the way a hand does.
   *
   * On the spread the swipe-across-the-middle turn is gone (a desktop reader
   * pans and selects through the text), and the page turns by its outer edge
   * instead. Three claims, and they are exactly the sentence the reader wrote:
   * hovering the edge shows a hand; a drag that begins on it turns the page; a
   * drag that begins anywhere else does not. While held, the corner lifts with
   * the hand and the next opening shows beneath (#189); let go past the
   * threshold and it goes over, short of it and it falls back. The left edge
   * pulls forward into the book, so it is driven from page 8, where forward
   * (8 → 9) leaves the opening.
   */
  const grabRail = (page: Page, side: "left" | "right"): Locator =>
    page.getByTestId(`edge-grab-${side}`);

  test("a verse wears the plain pointing hand, not a target", async ({ page }) => {
    // Owner, 2026-09-28: the brackets-and-dot pointer read as a target sight.
    await page.goto("/#/hafs-kfqc/p8");
    await expect(pageSvg(page, 8)).toBeVisible();
    const verse = pageSvg(page, 8).locator('[id^="verse-"]').first();
    expect(await verse.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
  });

  test("the fore-edge wears a hand, and a grab from it turns the page", async ({ page }) => {
    await watchFolds(page);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 8)).toBeVisible();

    // The affordance the reader was promised: the outer edge is a thing you can
    // pick up. Asserted on the computed cursor, because that *is* the promise —
    // there is nothing else on screen that says "grab here".
    const cursor = await grabRail(page, "left").evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor, "the fore-edge did not offer a hand").toBe("grab");

    // Grab the left edge near its top corner — the widest part of the strip, and
    // the corner a hand reaches for — and sweep it across into the book. The
    // press is close to the outer edge, where the grab region exists at every
    // height; the middle of the fore-edge is deliberately left to the page.
    const rail = await boxOf(grabRail(page, "left"));
    const y = rail.y + rail.height * 0.2;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    // Past a quarter of the leaf, so the commit rule keeps the turn. Several
    // steps because it is a drag, not a teleport; the corner follows the hand
    // the whole way (the test below owns what it shows).
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(rail.x + 6 + i * 45, y);
    await page.mouse.up();

    // It turned — through the one stage that owns turning — and no band swept
    // the book after it: the reader has just watched the leaf go over by hand,
    // and a second sweep would play the same turn twice. The lifted leaf is
    // gone once the new opening is down.
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
    expect(await foldsSeen(page), "a band played the turn again after the peel").toEqual([]);
    await expect(page.getByTestId("edge-peel")).toHaveCount(0);
  });

  test("a grab that stops short of the threshold turns nothing, and creeps no band", async ({
    page,
  }) => {
    await watchFolds(page);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 8)).toBeVisible();

    // Grab the left fore-edge and pull it a little — past the few pixels of slop
    // that tell a click from a drag, but nowhere near the quarter-leaf the commit
    // rule wants. This is the reader who picks the edge up, thinks better of it,
    // and puts it down.
    const rail = await boxOf(grabRail(page, "left"));
    const y = rail.y + rail.height * 0.2;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) await page.mouse.move(rail.x + 6 + i * 12, y);

    // Mid-drag, the corner is up a little — and no band creeps across the book.
    // A band here would sit part-way over a spread whose pages have not changed,
    // the "vertical bar on the same page" the peel replaced.
    await expect(page.getByTestId("edge-peel")).toBeVisible();
    expect(await foldsSeen(page), "a band crept across the book during the drag").toEqual([]);

    await page.mouse.up();

    // And releasing short commits nothing: the corner falls back, still on 8,
    // and no band ever drawn.
    await expect(page.getByTestId("edge-peel")).toHaveCount(0);
    await expect(page.locator(NUM)).toHaveText(pageNumber(8));
    expect(await foldsSeen(page), "a short grab still turned the page").toEqual([]);
  });

  test("a drag that does not start at the fore-edge does not turn the page", async ({ page }) => {
    await watchFolds(page);
    await page.goto("/#/hafs-kfqc/p8");
    await expect(spread(page)).toBeVisible();
    await expect(pageSvg(page, 8)).toBeVisible();

    // The same long horizontal sweep, but begun in the middle of the page rather
    // than on its edge. This is the half of the reader's sentence that the old
    // swipe-to-turn would have failed: it turned from anywhere, and the point of
    // the edge grab is that the text is now free to be dragged without turning.
    const leaf = await boxOf(pageSvg(page, 8));
    const cy = leaf.y + leaf.height / 2;
    await page.mouse.move(leaf.x + leaf.width / 2, cy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(leaf.x + leaf.width / 2 + i * 40, cy);
    await page.mouse.up();

    // Still on 8, and no band was ever inserted — the drag through the text was
    // not a turn at all.
    await expect(page.locator(NUM)).toHaveText(pageNumber(8));
    expect(await foldsSeen(page), "a mid-page drag turned the page").toEqual([]);
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
 * The page bar on a wide window — `desktop.md` §8 ⑤, the same shape of defect the
 * revision map had and one row up.
 *
 * The bar is the app's bottom chrome, so its hairline and paper are meant to run
 * the full width of the window — that is what says "this is the floor of the app"
 * rather than "this is a widget floating in a field". But the control inside it is
 * a native `<input type=range>`, and a native range track takes every pixel its
 * box is given: with the bar full-bleed and nothing holding the track in, a
 * 1440px window drew the slider as a hairline the whole width of the screen, a
 * thumb travelling four feet to cross seven pages. The fix holds the *controls* to
 * `--controls-max` (60rem, the width the desktop mocks drew the book at) by
 * growing the bar's side padding, and leaves the border and background full-bleed.
 *
 * So the claim is two-sided and both sides matter: the bar spans the window, and
 * the track does not. A cap on the whole bar would pass the second half and lose
 * the first — a centred pill with a moat of desk on either side, which is the
 * opposite mistake and the reason the padding grows instead of a max-width being
 * set. Measured against the real layout engine because the native track's
 * greediness is exactly what jsdom does not model.
 */
test.describe("Hifth · the page bar at desktop", () => {
  test("holds the slider to the book's width while the bar stays full-bleed", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();

    const bar = page.getByRole("navigation", { name: "شريط الصفحات" });
    await expect(bar).toBeVisible();
    const barBox = await boxOf(bar);
    const slider = await boxOf(page.getByRole("slider"));
    const vw = page.viewportSize()!.width;

    // The bar is the floor: its box runs the whole window. Not `=== vw` — a
    // scrollbar or a sub-pixel rounding is not the regression. A bar capped to
    // the controls would come back ~960 here, less than two-thirds of the window.
    expect(barBox.width, "the bar stopped spanning the window").toBeGreaterThan(vw - 20);

    // The track does not. 60rem is 960px; the slider is the middle column inside
    // that, minus the two edge buttons, so it lands comfortably under the cap and
    // nowhere near the window. The failure this guards — a full-width native
    // track — comes back ~1400 here, so the threshold has a wide margin either
    // side of both the pass (~860) and the fail (~1400).
    expect(slider.width, "the slider stretched to the full window width").toBeLessThan(960);
    expect(
      slider.width,
      `the slider is ${Math.round(slider.width)}px of a ${vw}px window — the track was not held in`,
    ).toBeLessThan(vw * 0.75);

    // And it is centred in the window, not shoved to one side — the padding grows
    // equally on both edges, so the book above and the controls below share an
    // axis. A one-sided cap would satisfy the width assertions and still sit the
    // slider against the left of the desk.
    expect(
      Math.abs(slider.x + slider.width / 2 - vw / 2),
      "the slider is bounded but not centred under the book",
    ).toBeLessThan(barBox.width * 0.1);
  });

  test("the knob moves with the magnifier, and holds still under the mouse", async ({ page }) => {
    // The magnifier spreads the marks near the mouse; the knob and the page mark
    // used to stay put, so near the knob they sat off the marks around them.
    await page.goto("/#/hafs-kfqc/p106");
    await expect(spread(page)).toBeVisible();
    const knob = page.getByTestId("page-handle");
    const here = page.getByTestId("page-here");
    const centre = async (l: typeof knob) => {
      const b = await boxOf(l);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const rest = await centre(knob);
    const restHere = (await centre(here)).x;

    // Right on the knob: the magnifier leaves the point under the mouse alone.
    await page.mouse.move(rest.x, rest.y);
    expect(Math.abs((await centre(knob)).x - rest.x), "the knob ran from the mouse").toBeLessThan(1);

    // Beside it: the knob is pushed away, and the page mark goes with it.
    await page.mouse.move(rest.x + 6, rest.y);
    const moved = (await centre(knob)).x - rest.x;
    expect(moved, "the knob stayed put while the marks around it spread").toBeLessThan(-10);
    expect(Math.abs((await centre(here)).x - restHere - moved), "the knob left its page mark").toBeLessThan(1);
  });

  test("the juz under the mouse is drawn thicker, and only while the mouse is there", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p106");
    await expect(spread(page)).toBeVisible();
    const band = page.getByTestId("juz-hover");
    await expect(band, "the juz was thick before the mouse came").toBeHidden();

    // Midway along the bar is juz 14 at this width (page 272, as the page tag says).
    const track = await boxOf(page.getByRole("slider"));
    const x = track.x + track.width * 0.55;
    const y = track.y + track.height / 2;
    await page.mouse.move(x, y);
    await expect(band).toBeVisible();
    const juz = Number(await band.getAttribute("data-juz"));
    const b = await boxOf(band);
    expect(b.height, "the hovered juz is no thicker than the track").toBeGreaterThan(6);

    // That juz only: it runs from its own opening cut to the next juz's, and the
    // mouse is inside it.
    expect(x).toBeGreaterThan(b.x);
    expect(x).toBeLessThan(b.x + b.width);
    const cuts = page.getByTestId("juz-cut");
    const cutXs: number[] = [];
    for (let i = 0; i < (await cuts.count()); i++) {
      const c = await boxOf(cuts.nth(i));
      cutXs.push(c.x + c.width / 2);
    }
    const nearEdge = (edge: number) => cutXs.some((cx) => Math.abs(cx - edge) < 2);
    expect(nearEdge(b.x) && nearEdge(b.x + b.width), `juz ${juz} is not bounded by its own two cuts`).toBe(true);

    // Leaving puts it back.
    await page.mouse.move(x, track.y - 200);
    await expect(band, "the juz stayed thick after the mouse left").toBeHidden();

    // And a drag never meets it: pressing the knob clears it.
    const knob = await boxOf(page.getByTestId("page-handle"));
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    await expect(band, "the juz stayed thick under a drag").toBeHidden();
    await page.mouse.up();
  });
});

/*
 * A tablet in landscape — `desktop.md` §8 ③.
 *
 * The question that opened this was whether `min-width` is the right gate for
 * the keyboard hints, and it said to revisit "if anyone reports the hints on a
 * device that cannot use them". No report was needed. iPad Pro 11 landscape is
 * 1194×834 and iPad gen 7 landscape is 1080×810; both clear the 1024×775
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
 * listener is on the stage, and that its verdict reaches the same `stepPage` the
 * arrow keys end in.
 *
 * The wheel navigates and nothing else now. It used to zoom under `ctrl`, and
 * that binding is gone rather than moved: on macOS a trackpad **pinch is encoded
 * as `ctrl`+wheel** by the OS, so anything bound there fires on a gesture the
 * reader believes is a pinch. Magnification is a stepper in the chrome, and the
 * modifier a wheel does answer to is `Shift`, which jumps a juz.
 */
test.describe("Hifth · the wheel", () => {
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
    // With the book open a turn is a whole opening, 7 → 9.
    await page.mouse.wheel(0, 120);
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));

    // A pause, then the other way. The pause is the gesture boundary — 100 ms of
    // quiet is what tells a mouse's second notch from a trackpad's next frame,
    // and there is no other signal in a wheel event that could.
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, -120);
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));

    // Drift is not a gesture. A hand resting on a trackpad emits a few pixels;
    // a page that turned on them would turn while nobody was asking.
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, 10);
    await page.waitForTimeout(300);
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));
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

    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
    // …and it stays there. A tail that spent a second turn would land on 11.
    await page.waitForTimeout(400);
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
  });

  test("ctrl+wheel does nothing at all — it is somebody else's pinch", async ({ page }) => {
    // The row this replaces asserted that ctrl+wheel zoomed by a calibrated
    // step. It did, correctly, and the binding was still wrong: **a macOS
    // trackpad pinch arrives as a ctrl+wheel**, synthesised by the OS, and no
    // browser exposes the difference. So every two-finger pinch on a laptop was
    // firing a binding the reader had not chosen, and — once ctrl+wheel was
    // proposed for the juz jump — would have teleported them twenty pages.
    //
    // Swallowed rather than passed through: `preventDefault` and no action. The
    // alternative is the browser's own page zoom, which changes CSS pixels and
    // would bounce the desktop breakpoint under the reader's hands. "I don't
    // want zoom driven by scrolling" covers the browser's zoom too.
    await overTheLeaf(page);
    expect(await scaleOf(page, 7)).toBeCloseTo(1, 2);

    await page.keyboard.down("Control");
    for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");

    // Nothing moved, and both halves are asserted because the two ways to get
    // this wrong are opposite: leave the zoom wired and the paper grows; drop
    // the modifier check and four notches turn four pages.
    await page.waitForTimeout(300);
    expect(await scaleOf(page, 7), "ctrl+wheel still zooms").toBeCloseTo(1, 2);
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));
  });

  test("shift+wheel jumps a juz, and says which one", async ({ page }) => {
    // The modifier a wheel *does* answer to. Asked in pages rather than in juz
    // numbers — the nearest juz *opening* strictly past the current page in the
    // direction of travel — which disposes of three special cases at once: a
    // straddling leaf (page 22 is juz 1's last and juz 2's first), a juz absent
    // from a partial build, and "back" from the middle of a juz, which lands on
    // that juz's own opening the way a media player's ⏮ does.
    await overTheLeaf(page);
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));

    // Down is forward here for the same reason it is forward unmodified: down
    // is down in both directions of script.
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 120);
    await page.keyboard.up("Shift");

    // Juz 2 opens on 22 — not 8, which is what a plain wheel would have done.
    await expect(page.locator(NUM)).toHaveText(pageNumber(22));
    await expect(page.locator("[aria-live='polite']")).toHaveText("الجزء ٢ · صفحة ٢٢");

    // And back, over the boundary rather than to the top of the leaf we are on.
    await page.waitForTimeout(200);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Shift");
    await expect(page.locator(NUM)).toHaveText(pageNumber(1));
  });

  test("the juz axis and the page axis do not spend each other's travel", async ({ page }) => {
    // Two independent `WheelTurnState` refs, and this is what one shared ref
    // would break: travel accumulated toward a page turn must not arrive as a
    // juz jump when the reader presses Shift halfway through, or the other way
    // round. Sub-threshold on each axis, so a shared accumulator would cross.
    await overTheLeaf(page);

    await page.mouse.wheel(0, 30);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 30);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(300);

    // Neither threshold reached, so nothing moved at all.
    await expect(page.locator(NUM)).toHaveText(pageNumber(7));
  });
});

/*
 * The book closes when the reader says so — `desktop.md` §8 ②, second answer.
 *
 * The toggle stands on its own: a reader who wants one page and the whole desk
 * for it says so, and the facing leaf goes to zero. What is gone is the
 * *mechanism* that used to decide the mode *for* them — zoom past fit and the
 * book closed itself — and three separate desyncs came out of that one
 * derivation:
 *
 *   ① the facing leaf had its own wheel listener and could be zoomed alone, so
 *      the two leaves sat at different scales with the book still open;
 *   ② the mode survived a breakpoint crossing and the zoom did not, leaving a
 *      book closed onto one leaf that was sitting at fit with nothing to explain
 *      it — unrecoverable without zooming in and back out;
 *   ③ `atFit` was `z <= 1` and MIN_ZOOM is 0.8, so zooming *out* re-opened the
 *      book at a size it had never been closed at.
 *
 * A state with no gesture behind it cannot drift from a gesture. So the reader
 * is asked: a radiogroup in the chrome, and the zoom is a stepper beside it.
 * These rows are the same three claims, re-put to the controls that replaced the
 * derivation — ② by construction, and it has its own row because a resize is the
 * one input nothing in the stage reports.
 *
 * The stepper works with the book open now, and grows both leaves together — a
 * later reversal of §8 ②'s finding, made on the reader's own call. The two
 * leaves are kept at one magnification by construction, not by a shared view:
 * the live stage owns the level, and the facing leaf is told to match whatever
 * the live one lands at, so there is still only one number and nothing to desync.
 */
test.describe("Hifth · one page or two, and how big", () => {
  const soloOf = (page: Page): Promise<string | null> => book(page).getAttribute("data-solo");

  /**
   * The level as the eye reads it, scoped to the stepper rather than to the page.
   *
   * A bare `getByText("١٢٥٪")` matches twice, and the second match is the point:
   * the announcer says «التكبير ١٢٥٪», so the readout and the announcement carry
   * the same digits by design — one for the eye and one for the ear. Scoping to
   * the group says which of the two each assertion is about, and keeps this file
   * from being the thing that breaks when the announcement is reworded.
   */
  const readout = (page: Page): Locator =>
    page.getByRole("group", { name: "التكبير" }).locator("span");

  test("the toggle closes the book and opens it again", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });

    // At rest the book is open and both pages are readable.
    expect(await soloOf(page)).toBeNull();
    await expect(pageSvg(page, 8)).toBeVisible();

    await modeBtn(page, "one").click();
    await expect.poll(() => soloOf(page)).toBe("true");

    // Gone from the eye *and* from the reading order. A zero-width leaf a screen
    // reader still walks into is a page the reader was told is not on screen,
    // read out anyway.
    await expect(pageSvg(page, 8)).toBeHidden();
    await expect(book(page).locator('[data-live="false"]')).toHaveAttribute("aria-hidden", "true");

    // The gain, and it is the viewport rather than the page: the live leaf now
    // has the whole book to be seen through instead of half of it.
    const leafBox = await boxOf(book(page).locator('[data-live="true"]'));
    const bookBox = await boxOf(book(page));
    expect(leafBox.width, "the live leaf takes the desk").toBeGreaterThan(bookBox.width * 0.9);

    // And back. No tween in the way now — this is what defect ③ was: the old
    // reopen was a comparison against a scale still settling through a RAF tween,
    // and 0.8 was on the wrong side of it.
    await modeBtn(page, "two").click();
    await expect.poll(() => soloOf(page)).toBeNull();
    await expect(pageSvg(page, 8)).toBeVisible();
  });

  test("the stepper magnifies one leaf alone, and both leaves of a spread together", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });

    // Two pages open, and the stepper is live: the reader magnifies the whole
    // opening, so one press grows *both* leaves to the same rung. This reverses
    // the older finding that two enlarged pages read as one column — the reader
    // asked for them to grow together, and the record that reversed it says why.
    await expect(spread(page)).toBeVisible();
    await expect(zoomBtn(page, "in")).toBeEnabled();
    const liveFit = await restingBox(page, 7);
    const faceFit = await restingBox(page, 8);

    await zoomBtn(page, "in").click();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1.25, 2);
    await expect.poll(() => scaleOf(page, 8), "the facing leaf grew with the live one").toBeCloseTo(
      1.25,
      2,
    );
    await expect(readout(page)).toHaveText("١٢٥٪");
    await expect(page.locator("[aria-live='polite']")).toHaveText("التكبير ١٢٥٪");

    // Both leaves grew, and each by about the rung rather than to the desk.
    const liveBig = await restingBox(page, 7);
    const faceBig = await restingBox(page, 8);
    expect(liveBig.width, "the live leaf stretched past its step").toBeGreaterThan(
      liveFit.width * 1.15,
    );
    expect(faceBig.width, "the facing leaf stretched past its step").toBeGreaterThan(
      faceFit.width * 1.15,
    );

    // The opening grew as one sheet, not two swelling blobs: the fold held and the
    // pages opened *outward* into the desk. This is the reader's report — a magnify
    // that used to crush the middle and run the outer margins off the screen,
    // because each leaf grew from its own centre. Now each leaf is pinned at its
    // gutter edge, so the two inner edges that meet at the fold stay put while the
    // two outer edges move apart. The live leaf is the right-hand page: its left
    // edge is the fold, its right edge is the outer margin.
    const fold = (b: { x: number; width: number }) => b.x; // right leaf: inner edge is its left
    const faceFold = (b: { x: number; width: number }) => b.x + b.width; // left leaf: inner is its right
    // Held to within a couple of pixels — the anchor is exact, the slack is
    // sub-pixel rounding in the rendered box, not the leaf drifting off the fold.
    expect(
      Math.abs(fold(liveBig) - fold(liveFit)),
      "the fold under the live leaf held",
    ).toBeLessThan(3);
    expect(
      Math.abs(faceFold(faceBig) - faceFold(faceFit)),
      "the fold under the facing leaf held",
    ).toBeLessThan(3);
    expect(liveBig.x + liveBig.width, "the live leaf grew outward, away from the fold").toBeGreaterThan(
      liveFit.x + liveFit.width,
    );
    expect(faceBig.x, "the facing leaf grew outward, away from the fold").toBeLessThan(faceFit.x);
    // And at this rung the outward growth is still inside the desk — nothing is
    // clipped by the viewport. (The desk margin is ~325 px a side at fit; a step to
    // 125% spends ~100 of it.) The two leaves stay level about the fold, so the
    // opening reads as one book and not a torn one.
    const vw = page.viewportSize()!.width;
    expect(liveBig.x + liveBig.width, "the live leaf's outer margin is still on screen").toBeLessThan(
      vw,
    );
    expect(faceBig.x, "the facing leaf's outer margin is still on screen").toBeGreaterThan(0);

    // Close to one leaf. The live page takes the whole desk and keeps the level
    // it had in the spread — closing changes how much of the book is shown, not
    // how big it is — and the stepper keeps working on the one page that is left.
    await modeBtn(page, "one").click();
    await expect.poll(() => soloOf(page)).toBe("true");
    await expect(readout(page)).toHaveText("١٢٥٪");
    await zoomBtn(page, "in").click();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1.5, 2);
    await expect(readout(page)).toHaveText("١٥٠٪");

    // Re-open the book: it starts at fit, so the two leaves agree from the first
    // frame rather than opening at two different sizes.
    await modeBtn(page, "two").click();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1, 2);
    await expect.poll(() => scaleOf(page, 8)).toBeCloseTo(1, 2);
    await expect(readout(page)).toHaveText("١٠٠٪");
  });

  /*
   * #148: at 150% the two pages of an opening were drawn over each other. The
   * row above only ever opened at page 7, where the live leaf is the right-hand
   * page — and the stage was told "the live leaf pins at its left edge", which is
   * only true there. On an even page the live leaf is the left-hand one, so both
   * leaves grew *into* the fold and each was cut off at it: the reader saw the
   * inner halves of two pages side by side, reading as one garbled line. Both
   * parities, then, and a zoom past the point where a leaf is wider than its box.
   */
  for (const at of [106, 105]) {
    test(`at 150% the two pages meet at the fold and do not overlap (opened at ${at})`, async ({
      page,
    }) => {
      await page.goto(`/#/hafs-kfqc/p${at}`);
      await expect(pageSvg(page, 105)).toBeVisible({ timeout: 20_000 });
      await expect(pageSvg(page, 106)).toBeVisible();
      // Each page's inner edge at fit is its side of the fold (the two sit a few
      // pixels apart there, across the gutter's core).
      const rightFold = (await restingBox(page, 105)).x;
      const leftFit = await restingBox(page, 106);
      const leftFold = leftFit.x + leftFit.width;

      await zoomBtn(page, "in").click();
      await zoomBtn(page, "in").click();
      await expect.poll(() => scaleOf(page, 105)).toBeCloseTo(1.5, 2);
      await expect.poll(() => scaleOf(page, 106)).toBeCloseTo(1.5, 2);

      const right = await restingBox(page, 105);
      const left = await restingBox(page, 106);
      expect(Math.abs(right.x - rightFold), "the right-hand page starts at the fold").toBeLessThan(3);
      expect(Math.abs(left.x + left.width - leftFold), "the left-hand page ends at the fold").toBeLessThan(3);

      // And the part hanging over the desk is drawn, not cut at the leaf's box:
      // a point just inside each page's outer edge is that page.
      const hits = await page.evaluate(
        ([rx, lx, y]) =>
          [rx, lx].map((x) => document.elementFromPoint(x, y)?.closest("svg")?.getAttribute("aria-labelledby")),
        [right.x + right.width - 20, left.x + 20, right.y + right.height / 2] as const,
      );
      expect(hits).toEqual(["page-label-105", "page-label-106"]);
      // The desk stops the page at the window, with no sideways scroll.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
    });
  }

  test("the ends of the ladder are stated, not discovered by clicking", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await modeBtn(page, "one").click();

    // MIN_ZOOM is 0.8 and fit is 1, so exactly one press is available downward.
    await zoomBtn(page, "out").click();
    await expect(readout(page)).toHaveText("٨٠٪");
    await expect(zoomBtn(page, "out")).toBeDisabled();
    await expect(zoomBtn(page, "in")).toBeEnabled();
  });

  test("crossing the breakpoint leaves the two leaves agreeing", async ({ page }) => {
    // Defect ②, and the only one of the three that needs a resize to reproduce.
    // The mode is React state and survives; the stage's `view` is a ref on a
    // component the breakpoint unmounts, so the zoom did not. The old build came
    // back to 1440 with `data-solo="true"` over a leaf at scale(1) — a closed
    // book with nothing to explain why — and no gesture could undo it except
    // zooming in and back out.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await modeBtn(page, "one").click();
    await zoomBtn(page, "in").click();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1.25, 2);

    // Down below the breakpoint: one leaf, no spread, no chrome.
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(spread(page)).toHaveCount(0);
    await expect(pageSvg(page, 7)).toBeVisible();

    // …and back up. Both halves of the question are asserted, because the bug
    // was precisely that they disagreed: the paper is at fit, and the readout
    // says so too.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(spread(page)).toBeVisible();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1, 2);
    await expect(readout(page)).toHaveText("١٠٠٪");
  });

  test("a hop link lands on the ayah without magnifying one half of the book", async ({ page }) => {
    // A hop frames its target at DEFAULT_HOP_ZOOM — 1.55. Under the old rule
    // that counted as "past fit", so a shared link closed the book on arrival.
    // Page mode is the reader's now, so the book stays open — and *because* it
    // stays open, the framing drops to fit: 1.55 on the live leaf beside 1 on the
    // facing one is two pages at different scales with the book open, which is
    // the original complaint reached down a different path.
    //
    // The landing itself is unaffected. `frameBboxToView` still centres the ayah;
    // only the magnification is withheld.
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    expect(await soloOf(page)).toBeNull();
    await expect(pageSvg(page, 8)).toBeVisible();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1, 2);
    await expect(readout(page)).toHaveText("١٠٠٪");

    // Close the book and the same link's magnification is available again — the
    // toggle is the gateway, exactly as it is for the stepper.
    await modeBtn(page, "one").click();
    await zoomBtn(page, "in").click();
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(1.25, 2);
  });

  test("a turn keeps the reader's magnification; a hop reframes it", async ({ page }) => {
    // §4.5 of the page-turning design: turning a page is continuing to read the
    // same book, so a reader who has magnified to study one line lands on the next
    // page at the same size — the pages are the same shape, so the line is waiting
    // where the eye already is. A hop is the opposite: it is asking to be taken
    // somewhere else, so it frames its target afresh. This test holds the two
    // apart, because the easy mistake is to make everything reset (the old turn) or
    // to make everything carry (a refactor that forgets the hop still frames).
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });

    // One leaf, so the turn is a real leaf turn rather than a within-opening flip.
    await modeBtn(page, "one").click();
    await expect.poll(() => soloOf(page)).toBe("true");

    // Magnify to 200% — a rung well clear of the 155% a hop would frame at, so a
    // later reading of the scale says "carried" or "reframed" with no ambiguity.
    await zoomBtn(page, "in").click(); // 125
    await zoomBtn(page, "in").click(); // 150
    await zoomBtn(page, "in").click(); // 200
    await expect.poll(() => scaleOf(page, 7)).toBeCloseTo(2, 2);
    await expect(readout(page)).toHaveText("٢٠٠٪");

    // Turn to the next page. The magnification comes with the reader.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText(pageNumber(8));
    await expect.poll(
      () => scaleOf(page, 8),
      "the turn reset the zoom instead of carrying it",
    ).toBeCloseTo(2, 2);
    await expect(readout(page)).toHaveText("٢٠٠٪");

    // And it keeps carrying, turn after turn — this is reading, not one lucky hop.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText(pageNumber(9));
    await expect.poll(() => scaleOf(page, 9)).toBeCloseTo(2, 2);

    // Now a hop — the jumper, to an ayah on another page. This is not reading on;
    // it is being taken somewhere, so the magnification is dropped and the target
    // is framed afresh, well below the 200% we were carrying.
    await page.keyboard.press("/");
    const jumper = page.getByRole("dialog", { name: "اذهب إلى" });
    await expect(jumper).toBeVisible();
    await jumper.getByRole("combobox").fill("2:120");
    await expect(jumper.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(jumper).toHaveCount(0);

    const landedPage = readPageNumber(await page.locator(NUM).textContent());
    await expect.poll(
      () => scaleOf(page, landedPage),
      "the hop carried the turn's magnification instead of reframing its target",
    ).toBeLessThan(1.9);
  });
});

/*
 * The trail bar holds its height — selecting an ayah must not move the page.
 *
 * The bar at the foot of the app is quiet until you pick an ayah, and then it
 * fills with a row of touch-sized controls: the bead you are on, the roots
 * trigger, the share button. Each is `--touch-min` tall, and a bar sized only
 * to `min-height: --touch-min` was 44px empty and 61px full — the controls, the
 * bar's own block padding and its top hairline outgrew the box the moment they
 * appeared. The stage above is `flex: 1` and centres the page in whatever height
 * is left, so those 17px came straight off the stage and the whole mus'haf
 * jumped upward on the first tap of a reading session. A reader aiming at a
 * second ayah found the page had walked out from under the finger.
 *
 * This is the single-page layout's claim, so the window is sized below the
 * spread's gate before it is made — on the spread the ayah's controls move onto
 * the facing leaf instead (see the scripture-floor test above, which is the
 * reason the bar is *not* padded taller when two leaves are open). 390×844 is a
 * phone-shaped window; the desktop project reaches it by resizing, because it is
 * the one project with a mouse to click an ayah where a phone would tap.
 *
 * So the claim is two heights, read before and after a selection, each the same
 * number: the bar itself, and the stage above it. The stage is the outcome — it
 * is the height the growing bar used to eat — while the bar is the mechanism, so
 * a future layout that holds the stage still by some other means still passes.
 * The page's own position is deliberately *not* asserted: selecting an ayah pans
 * the view to centre it, which moves the page on purpose, and that pan is a
 * different thing from the bar shoving the whole stage upward.
 */
test.describe("Hifth · the trail bar holds its height", () => {
  test("selecting an ayah does not resize the bar or shove the page up", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toHaveCount(0);
    await expect(pageSvg(page, 7)).toBeVisible();

    const bar = page.getByRole("contentinfo");
    const stage = page.getByRole("main");
    await expect(bar).toBeVisible();

    // Nothing is selected yet: the bar shows only its hint, and no bead exists.
    const bead = page.getByRole("button", { name: /الآية الحالية/ });
    await expect(bead).toHaveCount(0);

    const barEmpty = await boxOf(bar);
    const stageEmpty = await boxOf(stage);

    // Pick an ayah with a plain click where a finger would land (see ./ayah).
    const { x, y } = await ayahTarget(page, "#verse-55");
    await page.mouse.click(x, y);

    // The selection landed — the bar is now populated with the current bead.
    await expect(bead).toBeVisible();

    const barFull = await boxOf(bar);
    expect(barFull.height, "the trail bar grew when an ayah was selected").toBe(barEmpty.height);
    expect(
      (await boxOf(stage)).height,
      "the growing bar ate into the stage the page reads on",
    ).toBe(stageEmpty.height);
  });
});

/*
 * The ayah's sheets rise over the facing leaf.
 *
 * All three sheets an ayah can raise — the hop list a rail chip opens, the
 * highlighted passage's menu, the root lens — are *about* one ayah, and on a
 * wide screen each is a card pinned to a bottom corner. Which corner used to
 * follow the chrome's direction (inline-end: the right in English, the left in
 * Arabic). On a spread that is the wrong axis: the ayah sits on a physical side
 * of the gutter whatever language the chrome reads in, so a corner chosen by
 * language could land the card on top of the verse it is about. So the app names
 * the side — and the drawer decision (docs/design/ayah-drawer.md, decided D)
 * puts it on the *facing* leaf, opposite the ayah, so the pressed verse stays
 * fully visible with its tools across the gutter. (The same-leaf placement,
 * Option C, was tried live and covered a leaf-filling surah's own lines.)
 *
 * Asserted in both languages, because the corner used to be chosen by the
 * chrome's direction and the side must not be; and on geometry against the open
 * book rather than on the attribute alone, since the attribute is only a claim
 * about where the stylesheet will put the card.
 */
test.describe("Hifth · the ayah's sheets rise over the facing leaf", () => {
  /** Any rail chip; the hop list it opens is the sheet under test. */
  const chip = (page: Page): Locator => page.locator("button[data-direction]").first();
  const sheet = (page: Page): Locator => page.getByRole("dialog");

  /** Which side of the gutter a box's centre falls on. */
  async function sideOf(page: Page, target: Locator): Promise<"left" | "right"> {
    const open = await boxOf(book(page));
    const box = await boxOf(target);
    return box.x + box.width / 2 < open.x + open.width / 2 ? "left" : "right";
  }

  for (const lang of ["ar", "en"] as const) {
    test(`the hop list lands opposite the ayah, with the chrome in ${lang}`, async ({ page }) => {
      // 2:48 is the last ayah of page 7 — the right-hand leaf of the opening (7, 8).
      // `?lang=` sets the chrome for this visit; the test is about the sheet, not the switch.
      await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
      await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
      await chip(page).click();
      await expect(sheet(page)).toBeVisible();
      expect(
        await sideOf(page, sheet(page)),
        "an ayah on the right leaf raises its sheet over the facing (left) leaf",
      ).toBe("left");
      expect(await sheet(page).getAttribute("data-side")).toBe("left");
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);

      // 2:49 opens page 8 — the left-hand leaf of the same opening.
      await page.goto("/#/hafs-kfqc/2:49");
      await expect(pageSvg(page, 8)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(NUM)).toHaveText(pageNumber(8));
      await chip(page).click();
      await expect(sheet(page)).toBeVisible();
      expect(
        await sideOf(page, sheet(page)),
        "an ayah on the left leaf raises its sheet over the facing (right) leaf",
      ).toBe("right");
      expect(await sheet(page).getAttribute("data-side")).toBe("right");
    });

    test(`the passage's menu lands opposite the passage, with the chrome in ${lang}`, async ({
      page,
    }) => {
      // A range link opens the menu on arrival (range.spec.ts), so no drag is needed.
      await page.goto(`/?lang=${lang}#/hafs-kfqc/2:47-2:48`);
      await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
      await expect(sheet(page)).toBeVisible();
      expect(await sideOf(page, sheet(page)), "a passage on the right leaf").toBe("left");

      await page.goto("/#/hafs-kfqc/2:52-2:53");
      await expect(page.locator(NUM)).toHaveText(pageNumber(8));
      await expect(sheet(page)).toBeVisible();
      expect(await sideOf(page, sheet(page)), "a passage on the left leaf").toBe("right");
    });
  }

  test("raising a sheet moves neither leaf", async ({ page }) => {
    // The card is fixed, not in flow, so the paper under it must not shift by a
    // pixel when it rises — on either leaf, since the facing stage is a second
    // layout the card could just as well have pushed.
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    const live = await restingBox(page, 7);
    const facing = await restingBox(page, 8);
    await chip(page).click();
    await expect(sheet(page)).toBeVisible();
    // "Not by a pixel", measured as that: a sub-pixel rounding change in layout
    // (seen at 0.0025px) is not a leaf moving.
    const within = (b: { x: number; y: number; width: number; height: number }) => ({
      x: expect.closeTo(b.x, 1),
      y: expect.closeTo(b.y, 1),
      width: expect.closeTo(b.width, 1),
      height: expect.closeTo(b.height, 1),
    });
    expect(await restingBox(page, 7), "the live leaf moved when the sheet rose").toEqual(within(live));
    expect(await restingBox(page, 8), "the facing leaf moved when the sheet rose").toEqual(within(facing));
  });

  test("with one leaf, or on a phone, no side is named and the default stands", async ({
    page,
  }) => {
    // Closed to one leaf there is no other leaf to land on; the card keeps the
    // chrome-direction corner it always had (Arabic chrome here: the left).
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await modeBtn(page, "one").click();
    await expect(pageSvg(page, 8)).toHaveCount(0);
    await chip(page).click();
    await expect(sheet(page)).toBeVisible();
    expect(await sheet(page).getAttribute("data-side")).toBeNull();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);

    // Below the breakpoint the sheet is the phone's full-bleed bottom sheet,
    // and a side would be a claim about a book that is not there.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(spread(page)).toHaveCount(0);
    await chip(page).click();
    await expect(sheet(page)).toBeVisible();
    expect(await sheet(page).getAttribute("data-side")).toBeNull();
    const box = await boxOf(sheet(page));
    expect(box.x, "the phone sheet is full-bleed").toBe(0);
    expect(box.width).toBe(390);
  });

  /*
   * A sheet on the facing leaf leaves the verse's own leaf clear and live — no
   * dimming over the page it is about, and the same card size for every sheet.
   * The note already stood this way; the look-alike list, the roots and the
   * passage menu still dimmed the whole screen and stood narrower (380 against
   * 460), so opening one after the other made the page flicker dark and the card
   * jump size. Checked by what is actually on top at the middle of the verse's
   * leaf, not by the absence of a class name.
   */
  test("a sheet on the facing leaf leaves the verse's leaf clear, at one card size", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    const leaf = await boxOf(pageSvg(page, 7));
    const onTop = (): Promise<boolean> =>
      page.evaluate(
        (p) => !!document.elementFromPoint(p.x, p.y)?.closest('[data-testid="page-book"]'),
        { x: leaf.x + leaf.width / 2, y: leaf.y + leaf.height / 2 },
      );
    const opens: Array<[string, () => Promise<void>]> = [
      ["the look-alike list", () => chip(page).click()],
      ["the roots", () => page.getByRole("button", { name: /الجذور · / }).click()],
    ];
    for (const [name, open] of opens) {
      await open();
      await expect(sheet(page)).toBeVisible();
      expect(await onTop(), `${name} dims or covers the verse's own leaf`).toBe(true);
      expect((await boxOf(sheet(page))).width, `${name} is not the note's width`).toBeCloseTo(460, 0);
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);
    }

    // A range link opens the passage menu on arrival.
    await page.goto("/#/hafs-kfqc/2:47-2:48");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    expect(await onTop(), "the passage menu dims the passage's own leaf").toBe(true);
    // Opened by the link, nobody reached for a control: focus sits in the menu
    // but no ring is drawn round its first button.
    const ringed = await page.evaluate(() => {
      const el = document.activeElement;
      return el && getComputedStyle(el).outlineStyle !== "none" ? el.outerHTML.slice(0, 80) : null;
    });
    expect(ringed, "a menu opened by a link wears a focus ring").toBeNull();
    expect(await sheet(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    expect((await boxOf(sheet(page))).width, "the passage menu is not the note's width").toBeCloseTo(460, 0);
  });
});

/*
 * A juz jump lands the two leaves level — with no flash of one sitting high.
 *
 * A jump to another juz is not a page turn: the live leaf relocates across many
 * openings at once, and the facing leaf remounts to the new opening's other
 * page. The live leaf's relocation reveals its incoming page and *then* frames
 * it, and the framing runs a frame later — so for one paint the incoming page
 * wore no position and sat at the top-left of its leaf, one centring-offset
 * above the facing page beside it. On a fast machine that is a single frame; on
 * a real one the incoming ~170 KB page's parse stalls the correcting frame long
 * enough to see and screenshot, which is how this arrived — "sometimes things
 * aren't aligned after a juz jump", with a picture of two leaves at different
 * heights.
 *
 * So the claim is not a resting measurement — both leaves settle level with or
 * without the fix — but that they are level *at every frame* of the jump. This
 * watches the two visible pages across the settle and fails if any single frame
 * caught them more than a pixel apart. The offset it guards against is a whole
 * centring gap (~9px), so the threshold is loose enough to ignore the sub-pixel
 * rounding a live layout carries and still catch the flash.
 */
test("a juz jump keeps the two leaves level through every frame", async ({ page }) => {
  await watchFolds(page);
  await page.goto("/#/hafs-kfqc/p8");
  await expect(pageSvg(page, 8)).toBeVisible();
  await expect(spread(page)).toBeVisible();
  // A cursor over the book, so the wheel's juz jump has somewhere to land.
  await page.mouse.move(400, 450);

  // Sample both visible leaves' top edges every frame while the jump settles.
  const poll = page.evaluate<{ pair: boolean; gap: number }[]>(
    () =>
      new Promise((resolve) => {
        const frames: { pair: boolean; gap: number }[] = [];
        const start = performance.now();
        const tick = () => {
          const ys = Array.from(
            document.querySelectorAll('svg[aria-labelledby^="page-label-"]'),
          )
            .filter((n) => (n as SVGElement).getClientRects().length > 0)
            .map((n) => n.getBoundingClientRect().top);
          frames.push({
            pair: ys.length === 2,
            gap: ys.length === 2 ? Math.abs(ys[0]! - ys[1]!) : 0,
          });
          if (performance.now() - start < 700) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
  );

  // Jump forward one juz (Shift + wheel is the desktop juz control).
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 120);
  await page.keyboard.up("Shift");

  const frames = await poll;
  // The jump actually happened — a second leaf was on screen at some point.
  expect(frames.some((f) => f.pair), "the jump never drew a second leaf").toBe(true);
  const worst = Math.max(...frames.filter((f) => f.pair).map((f) => f.gap));
  expect(worst, "the two leaves flashed misaligned during the juz jump").toBeLessThan(1.5);
  // And the jump was a relocation, not a turn: no fold band crosses on a hop.
  expect((await foldsSeen(page)).length, "a juz jump drew a fold band").toBe(0);
});

/*
 * A page turn lands the two leaves level too — the jump's sibling claim.
 *
 * Turning a leaf crosses into the next opening and remounts the facing page, the
 * same remount the juz jump above watches: the incoming leaf could paint for one
 * frame at its layer's top-left, one centring-offset above the page beside it,
 * before the landing frame corrects it. The centring on the turn's landing is
 * what forecloses that, and this is the guard on it — reported against the back
 * of the book ("misalignment after flipping pages", a picture of At-Takwir riding
 * high over Abasa), so the turn is taken there rather than in Al-Baqarah where a
 * cold page's parse cost is a different number.
 *
 * Same shape as the jump's guard: not a resting measurement — both leaves settle
 * level regardless — but every frame of the turn, failing if any single one
 * caught them more than a pixel apart. Unlike the jump, a turn *does* draw a fold,
 * so that is asserted rather than its absence — the two claims are otherwise the
 * same claim from the two verbs.
 */
test("a page turn keeps the two leaves level through every frame", async ({ page }) => {
  await watchFolds(page);
  // Start one opening back, so the forward turn crosses *into* At-Takwir facing
  // Abasa (the opening the report pictured). The arrow plays the corner peel
  // over the open book, and both leaves must sit level once it lands.
  await page.goto("/#/hafs-kfqc/p584");
  await expect(pageSvg(page, 584)).toBeVisible({ timeout: 20_000 });
  await expect(spread(page)).toBeVisible();
  // A cursor over the book, so a wheel would have somewhere to land — the arrow
  // does not need it, but it keeps the rig identical to the jump's above.
  await page.mouse.move(400, 450);

  const poll = page.evaluate<{ pair: boolean; gap: number; peel: boolean }[]>(
    () =>
      new Promise((resolve) => {
        const frames: { pair: boolean; gap: number; peel: boolean }[] = [];
        const start = performance.now();
        const tick = () => {
          const ys = Array.from(
            document.querySelectorAll('svg[aria-labelledby^="page-label-"]'),
          )
            .filter((n) => (n as SVGElement).getClientRects().length > 0)
            .map((n) => n.getBoundingClientRect().top);
          frames.push({
            pair: ys.length === 2,
            gap: ys.length === 2 ? Math.abs(ys[0]! - ys[1]!) : 0,
            peel: document.querySelector('[data-testid="edge-peel"]') !== null,
          });
          if (performance.now() - start < 700) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
  );

  // ← turns forward, into the next opening.
  await page.keyboard.press("ArrowLeft");

  const frames = await poll;
  expect(frames.some((f) => f.pair), "the turn never drew a second leaf").toBe(true);
  const worst = Math.max(...frames.filter((f) => f.pair).map((f) => f.gap));
  expect(worst, "the two leaves flashed misaligned during the page turn").toBeLessThan(1.5);
  // And this one *is* a turn: the leaf went over.
  expect(frames.some((f) => f.peel), "the arrow turn never lifted the leaf").toBe(true);
});

/*
 * The live bead in the trail bar hides the string it hangs on.
 *
 * The footer's beads thread along a hairline "string" drawn behind them, and the
 * live bead — the ayah you are on — glows amber to echo the on-page selection.
 * That amber is deliberately translucent, the same wash the selection multiplies
 * over scripture; drawn as the bead's only fill it let the string show straight
 * through the label, a hairline struck through the current ayah's text. Every
 * other bead hides the string because its paper is opaque, so the fix composites
 * the wash over that same opaque paper.
 *
 * Occlusion is a fact about paint, which jsdom cannot see and a screenshot would
 * assert too bluntly. What a real layout engine *can* answer, and what the fix
 * turns on, is whether the bead carries an opaque layer at all: the wash alone
 * computes to a see-through fill colour with no image behind it, while the fix
 * leaves a fully opaque paper colour under a gradient. So the claim is the live
 * bead's own background is opaque — the string cannot reach the glyph through it.
 *
 * Phone-shaped window and a mouse, the same rig as the trail-bar test above: the
 * bead only appears once an ayah is picked, and the desktop project is the one
 * with a pointer to pick it.
 */
test("the live trail bead is opaque, so the string cannot show through its label", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/hafs-kfqc/p7");
  await expect(spread(page)).toHaveCount(0);
  await expect(pageSvg(page, 7)).toBeVisible();

  const { x, y } = await ayahTarget(page, "#verse-55");
  await page.mouse.click(x, y);

  const bead = page.locator('[class*="beadCurrent"]');
  await expect(bead).toBeVisible();

  // The alpha of the bead's own resting background colour. The wash-only bug left
  // this translucent; the fix's opaque paper layer computes to alpha 1.
  const alpha = await bead.evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor; // rgb(...) or rgba(...)
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    const parts = m[1]!.split(",").map((s) => parseFloat(s.trim()));
    return parts.length < 4 ? 1 : parts[3]!;
  });
  expect(alpha, "the live bead's background is translucent — the string shows through it").toBe(1);
});

/*
 * Every road onto a page lands the two leaves level — the invariant, not a verb.
 *
 * The jump's guard and the turn's guard above each watch one road, and that is
 * how the thread they came from went: four leaf-placement defects (a juz jump, a
 * turn, a tap, a zoom), each one road that had dropped or reordered the same
 * settle step, each found by eye and fixed on its own road, none of the fixes
 * reaching the next. The stage now runs every road through one step, and this
 * is the guard on *that*: every road there is, driven through one measurement —
 * through every frame the two leaves on screen sit at the same height, and at
 * rest they meet at the spine — so the day a road stops settling, the row for
 * that road fails, not a reader.
 *
 * Taken at the back of the book, where the report that started the thread was
 * pictured (At-Takwir riding high over Abasa).
 */
test.describe("every road onto a page lands the leaves level", () => {
  type Road = { name: string; drive: (page: Page) => Promise<void>; lands: number };
  const roads: Road[] = [
    // The cold mount. Nothing to drive: its frames are the resting frames.
    { name: "a cold open", lands: 584, drive: async () => {} },
    {
      name: "a deep link to another page",
      lands: 300,
      drive: (page) =>
        page.evaluate(() => {
          location.hash = "#/hafs-kfqc/p300";
        }),
    },
    {
      name: "the page bar",
      lands: 300,
      drive: (page) => page.getByRole("slider").fill("300"),
    },
    {
      name: "a page turn",
      lands: 585,
      drive: (page) => page.keyboard.press("ArrowLeft"),
    },
    {
      // Back from the middle of juz 30 lands on its own opening, 582 — the ⏮ rule.
      name: "a juz jump",
      lands: 582,
      drive: async (page) => {
        await page.keyboard.down("Shift");
        await page.mouse.wheel(0, -120);
        await page.keyboard.up("Shift");
      },
    },
    {
      name: "a zoom step in and back out",
      lands: 584,
      drive: async (page) => {
        await zoomBtn(page, "in").click();
        await expect.poll(() => scaleOf(page, 584)).toBeCloseTo(1.25, 2);
        await zoomBtn(page, "out").click();
        await expect.poll(() => scaleOf(page, 584)).toBeCloseTo(1, 2);
      },
    },
    {
      name: "closing the book and opening it again",
      lands: 584,
      drive: async (page) => {
        await modeBtn(page, "one").click();
        await expect(pageSvg(page, 583)).toHaveCount(0);
        await modeBtn(page, "two").click();
      },
    },
    {
      name: "a resize across the breakpoint and back",
      lands: 584,
      drive: async (page) => {
        await page.setViewportSize({ width: 800, height: 900 });
        await expect(spread(page)).toHaveCount(0);
        await page.setViewportSize({ width: 1440, height: 900 });
      },
    },
  ];

  /**
   * Both painted leaves, every frame for `ms`: are there two, and how far apart
   * are their heads.
   *
   * Read *after* each paint, not inside the animation frame the way the two
   * guards above do. Reopening the book taught the difference: the frame in
   * which the spread's layout comes back has both leaves still wearing their
   * one-leaf transforms when an animation-frame callback measures them, 313 px
   * apart — and the stage's resize observer then corrects both before that
   * frame is ever painted. A reader never sees it. A rig that read there would
   * fail a road that is right, so it reads in the task after the frame, which
   * is the first moment a reader could have. A flash that survives a paint (the
   * jump's and the turn's, before their fixes) is still a painted frame, and is
   * still caught. Zero-sized leaves are not leaves: the closed book keeps the
   * facing host in the tree at no width.
   */
  const framesOf = (page: Page, ms: number) =>
    page.evaluate<{ pair: boolean; gap: number }[], number>(
      (ms) =>
        new Promise((resolve) => {
          const frames: { pair: boolean; gap: number }[] = [];
          const start = performance.now();
          const tick = () =>
            requestAnimationFrame(() =>
              setTimeout(() => {
                const ys = Array.from(
                  document.querySelectorAll('svg[aria-labelledby^="page-label-"]'),
                )
                  .map((n) => n.getBoundingClientRect())
                  .filter((r) => r.width > 0 && r.height > 0)
                  .map((r) => r.top);
                frames.push({
                  pair: ys.length === 2,
                  gap: ys.length === 2 ? Math.abs(ys[0]! - ys[1]!) : 0,
                });
                if (performance.now() - start < ms) tick();
                else resolve(frames);
              }, 0),
            );
          tick();
        }),
      ms,
    );

  /** The opening at rest: how many leaves, how level, and the width of the seam between them. */
  const atRest = (page: Page) =>
    page.evaluate(() => {
      const rs = Array.from(document.querySelectorAll('svg[aria-labelledby^="page-label-"]'))
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .sort((a, b) => a.x - b.x);
      const two = rs.length === 2;
      return {
        leaves: rs.length,
        gap: two ? Math.abs(rs[0]!.top - rs[1]!.top) : NaN,
        seam: two ? rs[1]!.left - rs[0]!.right : NaN,
        height: two ? Math.abs(rs[0]!.height - rs[1]!.height) : NaN,
      };
    });

  for (const road of roads) {
    test(road.name, async ({ page }) => {
      await page.goto("/#/hafs-kfqc/p584");
      await expect(pageSvg(page, 584)).toBeVisible({ timeout: 20_000 });
      await expect(spread(page)).toBeVisible();
      await page.mouse.move(400, 450);

      const poll = framesOf(page, 700);
      await road.drive(page);
      const frames = await poll;

      expect(frames.some((f) => f.pair), `${road.name} never showed two leaves`).toBe(true);
      const worst = Math.max(...frames.filter((f) => f.pair).map((f) => f.gap));
      expect(worst, `${road.name}: the two leaves flashed misaligned`).toBeLessThan(1.5);

      // And at rest, once the road has landed where it said it would.
      await expect(pageSvg(page, road.lands)).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await atRest(page)).leaves).toBe(2);
      const rest = await atRest(page);
      expect(rest.gap, `${road.name}: the leaves came to rest at different heights`).toBeLessThan(1.5);
      expect(rest.height, `${road.name}: the leaves came to rest at different sizes`).toBeLessThan(
        1.5,
      );
      // Two 1px leaf borders sit between the papers; a hundred did, once.
      expect(rest.seam, `${road.name}: the leaves came to rest apart at the spine`).toBeLessThan(8);
    });
  }
});

/*
 * The page tools bar, step 1 of docs/design/page-toolbar-plan.md: select,
 * highlight and bookmark on a bar above the book, with V, H and B, and Escape
 * to put a tool down. English, so the names read as the plan writes them.
 */
test.describe("Hifth · the page tools bar", () => {
  test.use({ locale: "en-US" });

  const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
  const toolBtn = (page: Page, name: string): Locator =>
    bar(page).getByRole("radio", { name, exact: true });

  test("the letters pick a tool, the bar names it, and Escape puts it down", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p8");
    await expect(pageSvg(page, 8)).toBeVisible();
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Select tool");

    await page.keyboard.press("KeyH");
    await expect(toolBtn(page, "Highlight")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Highlight tool");
    // The pointer says it too, on the page itself.
    const cursor = await page
      .locator('[data-tool="highlight"][data-page="8"]')
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toContain("cell");

    await page.keyboard.press("Escape");
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");

    // Clicking the tool that is on puts it down, too.
    await toolBtn(page, "Highlight").click();
    await toolBtn(page, "Highlight").click();
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
  });

  // selection-drawer = D: a Read mode where a stray tap opens nothing, and the
  // verse and word modes each wear their own pointer.
  test("in Read mode a tap selects nothing; Verse and Word each have their own pointer", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");

    await page.keyboard.press("KeyR");
    await expect(toolBtn(page, "Read")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Taps do nothing");
    // The line under the page must not still invite a tap.
    await expect(page.getByText("Tap an ayah on the page to select it")).toHaveCount(0);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);

    // Measured on the verse itself, where the pointer is when a tap lands.
    const cursorOn = async (tool: string) =>
      page
        .locator(`[data-tool="${tool}"][data-page="7"] #verse-46`)
        .first()
        .evaluate((el) => getComputedStyle(el).cursor);
    expect(await cursorOn("read")).toBe("default");
    await page.keyboard.press("KeyW");
    expect(await cursorOn("word")).toContain("data:image/svg+xml");
    // The default tool is the verse tool: the plain pointing hand, and a tap selects the verse.
    await page.keyboard.press("Escape");
    expect(await cursorOn("select")).toBe("pointer");
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("#hifth-overlay .hl-sel")).not.toHaveCount(0);
  });

  // selection-drawer = D: a verse tap opens one drawer of the verse's tools,
  // each named in words. 2:48 (#verse-55, counted from the book's start) is
  // the last verse on the page, so a drawer that rose over the page would
  // cover the very verse it is about.
  test("a verse tap opens the verse's drawer below the page; Escape closes it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const at = await ayahTarget(page, "#verse-55");
    await page.mouse.click(at.x, at.y);

    const drawer = page.getByRole("region", { name: /2:48/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: /^Play / })).toContainText("Listen");
    await expect(drawer.getByRole("button", { name: /Share/ })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Bookmark/ })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /on QUL/ })).toBeVisible();
    // The tools live in the drawer, not also in the bar under the page.
    await expect(page.locator("footer").getByRole("button", { name: /^Play / })).toHaveCount(0);

    const box = (await drawer.boundingBox())!;
    const lit = await page.locator("#hifth-overlay .hl-sel").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().bottom),
    );
    expect(lit.length).toBeGreaterThan(0);
    for (const bottom of lit) expect(bottom, "the drawer covers the verse").toBeLessThanOrEqual(box.y + 1);

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    // Closing the drawer keeps the verse lit; only its tools step away.
    await expect(page.locator("#hifth-overlay .hl-sel")).not.toHaveCount(0);
  });

  test("one stop on the keyboard, and the arrows walk along it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p8");
    await expect(pageSvg(page, 8)).toBeVisible();
    await toolBtn(page, "Select").focus();
    // Only the tool that is on takes a tab stop.
    await expect(bar(page).locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("ArrowRight");
    await expect(toolBtn(page, "Highlight")).toBeFocused();
    await expect(toolBtn(page, "Highlight")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("End");
    await expect(toolBtn(page, "Jump")).toHaveAttribute("aria-checked", "true");
  });

  test("with the highlighter, a plain drag paints — no hold first", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const first = await ayahTarget(page, "#verse-46");
    const second = await ayahTarget(page, "#verse-47");

    await page.keyboard.press("KeyH");
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 10 });
    await expect(page.locator("#hifth-overlay rect.hl-marquee")).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator("#hifth-overlay .hl-hlt")).not.toHaveCount(0);
    // It stays on for the next stroke.
    await expect(toolBtn(page, "Highlight")).toHaveAttribute("aria-checked", "true");
  });

  test("with the bookmark tool, a tap drops a ribbon there, and the tool goes back", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyB");
    await expect(bar(page)).toContainText("Tap a page to drop a bookmark");
    await tapAyahAt(page, "#verse-46");

    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await expect(drawer).toBeVisible();
    await expect(toolBtn(page, "Select")).toHaveAttribute("aria-checked", "true");
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: /^Bookmark:/ })).toHaveCount(1);
  });
});

test.describe("Hifth · the red seam lies on the fold", () => {
  test.use({ locale: "en-US" });

  test("on an open book the seam is centred on the crease, half on each page", async ({ page }) => {
    // Drawn inside one leaf, it once sat wholly on that leaf, flush with its
    // inner edge: a ribbon beside the fold rather than down it.
    test.slow();
    await page.goto("/#/hafs-kfqc/p106");
    const seam = page.getByRole("img", { name: "Where you left off" });
    await expect(seam).toHaveCount(1, { timeout: 12_000 });
    const at = await page.evaluate(() => {
      const s = document.querySelector("[data-bookmark-seam]")!.getBoundingClientRect();
      const leaves = [...document.querySelectorAll<HTMLElement>("[data-bound][data-page]")].map((e) =>
        e.getBoundingClientRect(),
      );
      return { centre: (s.left + s.right) / 2, width: s.width, leaves: leaves.length, crease: Math.min(...leaves.map((r) => r.right)) };
    });
    expect(at.leaves, "not an open book").toBe(2);
    expect(Math.abs(at.centre - at.crease), "the seam is off the crease").toBeLessThan(1.5);
    expect(at.width).toBeGreaterThan(4);
  });

  test("the page bar keeps the plain drag and its magnifier: no thumb pad, no strip of marks", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    const slider = page.getByRole("slider");
    await expect(slider).toBeVisible();
    await expect(page.getByTestId("scrub-pad")).toHaveCount(0);
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y - 160, { steps: 6 });
    await expect(page.getByTestId("scrub-strip")).toHaveCount(0);
    await page.mouse.up();
  });
});

async function tapAyahAt(page: Page, selector: string): Promise<void> {
  const at = await ayahTarget(page, selector);
  await page.mouse.click(at.x, at.y);
}

test.describe("Hifth · the look-alike chips sit beside their page", () => {
  /*
   * The chips that lead to similar verses used to float in the window's top
   * corner. On a phone that corner is the page's corner; on a wide screen it is
   * out on the desk, ~270 px from the book, so the buttons for a verse sat a
   * long way from the verse. They now sit in the desk just outside the outer
   * edge of the page the verse is on — on the right of the book for a
   * right-hand page, on the left for a left-hand one.
   */
  // Found by what is in it, not by its name: these runs read in either language.
  const rail = (page: Page): Locator =>
    page.getByRole("group").filter({ has: page.locator("button[data-direction]") });

  for (const { at, pageNo, side } of [
    { at: "2:48", pageNo: 7, side: "right" },
    { at: "2:49", pageNo: 8, side: "left" },
  ] as const) {
    test(`a verse on the ${side} page has its chips just outside that page's edge`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/${at}`);
      await expect(pageSvg(page, pageNo)).toBeVisible({ timeout: 20_000 });
      await expect(rail(page)).toBeVisible();
      const open = await boxOf(book(page));
      const chips = await boxOf(rail(page));
      const gap = side === "right" ? chips.x - (open.x + open.width) : open.x - (chips.x + chips.width);
      expect(gap, `the chips ${JSON.stringify(chips)} beside the book ${JSON.stringify(open)}`).toBeGreaterThanOrEqual(4);
      expect(gap).toBeLessThanOrEqual(32);
      // Level with the top of the page, not floating off above it.
      expect(Math.abs(chips.y - open.y)).toBeLessThanOrEqual(32);
    });
  }

  test("with no desk either side of the book, the chips stay on the screen", async ({ page }) => {
    // Tall and narrow: the two pages fill the width, so there is no desk to sit
    // in. The chips fall back to the page's own top corner, all of them visible.
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto("/#/hafs-kfqc/2:49");
    await expect(pageSvg(page, 8)).toBeVisible({ timeout: 20_000 });
    await expect(rail(page)).toBeVisible();
    const chips = await boxOf(rail(page));
    const open = await boxOf(book(page));
    expect(chips.x).toBeGreaterThanOrEqual(0);
    expect(chips.x + chips.width).toBeLessThanOrEqual(1024);
    expect(chips.x).toBeGreaterThanOrEqual(open.x);
    expect(chips.x + chips.width).toBeLessThanOrEqual(open.x + open.width);
  });
});

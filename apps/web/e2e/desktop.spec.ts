import { test, expect, type Locator, type Page } from "@playwright/test";
import { watchFolds, foldsSeen } from "./fold";

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
 * Page 7 throughout. This build vendors 7, 9 and 19, none adjacent, so every one
 * of them is half a spread — 7 pairs with the missing 8. Once Loop 4b vendors
 * the rest, `renders a vendored facing leaf` in the component test is the one
 * that starts mattering and the hole assertions here become a statement about
 * whatever is still missing; see docs/design/desktop.md §4.
 *
 * The last two rows are about the fold. Everything the band *says* is asserted on
 * the phone projects in `page-turn.spec.ts`; what belongs here is the one claim
 * that needs a second leaf to be false — a page turn crosses the whole open book
 * (docs/design/page-transition.md §3.5), so the band is a child of the book and
 * sweeps its full width. A band confined to the live leaf would look correct in
 * every screenshot and would stop dead at the gutter.
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

/** A bounding box that is definitely there. */
async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "element has no box").not.toBeNull();
  return box!;
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
    // right, and the hole where 8 would be must sit to its *left*. Measured in
    // viewport coordinates against the real RTL flow, because that is the step
    // DOM-order assertions cannot make.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();

    const live = await boxOf(pageSvg(page, 7));
    const absent = await boxOf(page.getByRole("region", { name: "الصفحة المقابلة" }));

    expect(live.x, "the earlier page is not on the right").toBeGreaterThan(absent.x + absent.width);

    // And both leaves are inside the spread, side by side rather than stacked —
    // a wrap would satisfy the test above and still be two pages on top of each
    // other.
    const vertical = Math.abs(absent.y - live.y);
    expect(vertical, "the leaves are not on the same line").toBeLessThan(absent.height);
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

  test("announces the missing facing page instead of showing blank paper", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    const absent = page.getByRole("region", { name: "الصفحة المقابلة" });
    await expect(absent).toBeVisible();

    // It says which page, and how much of the mus'haf is actually here — the
    // same sentence the page bar carries, from the same string.
    await expect(absent).toContainText("صفحة 8 ليست في هذه النسخة");
    await expect(absent).toContainText("المتوفّر ٣ من ٦٠٤ صفحة");

    // The claim that it is not blank paper, made against the pixels rather than
    // the markup: the hole is a recessed well, so its background must differ
    // from the raised paper the real leaf sits on. A future restyle that quietly
    // sets both to `--paper` fails here.
    //
    // Wait for the live leaf first. The hole is rendered by the spread and is
    // there immediately; the page beside it arrives over the network, and the
    // comparison below reads both. Without this the row flakes on a null SVG —
    // an error, not a failure, which is a worse thing for a comparison to do.
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
    // The spread must follow: 7 → 9 is the next *vendored* page, and 9 belongs
    // to a different opening, so the wrapper must redraw around it rather than
    // staying put on (7,8).
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    const before = await boxOf(pageSvg(page, 7));

    await page.keyboard.press("ArrowLeft");
    await expect(pageSvg(page, 9)).toBeVisible();
    await expect(spread(page)).toBeVisible();

    // Page 9 is also odd, so it too opens its spread and sits on the right,
    // with the hole for 10 on its left. All three vendored pages being odd is
    // an accident of this build, so what is asserted is the relationship —
    // earlier leaf on the right — not the side the live page happens to land on.
    const after = await boxOf(pageSvg(page, 9));
    const hole = await boxOf(page.getByRole("region", { name: "الصفحة المقابلة" }));
    expect(after.x, "the earlier page stopped being on the right").toBeGreaterThan(
      hole.x + hole.width,
    );
    expect(after.width, "the leaf changed size on a page turn").toBeCloseTo(before.width, 0);

    await page.keyboard.press("ArrowRight");
    await expect(pageSvg(page, 7)).toBeVisible();
  });

  test("the fold crosses the whole open book, not the leaf that turned", async ({ page }) => {
    await watchFolds(page);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();

    const open = await boxOf(book(page));
    const leaf = await boxOf(pageSvg(page, 7));

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
    await expect(pageSvg(page, 9)).toBeVisible();

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
    await page.goto("/#/hafs-kfqc/p7");
    await expect(spread(page)).toBeVisible();
    // The wrapper is in the document before the leaf inside it has finished
    // arriving, and a key pressed in that window is a key the stage has nothing
    // to turn from. Wait for the page itself, as every other row here does.
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(pageSvg(page, 9)).toBeVisible();
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

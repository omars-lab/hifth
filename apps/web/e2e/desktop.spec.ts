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
 * (docs/design/page-transition.md §3.5), so the band is a child of the spread and
 * sweeps its full width. A band confined to the live leaf would look correct in
 * every screenshot and would stop dead at the gutter.
 */

/** The spread wrapper. Only exists above the breakpoint — that is the point. */
const spread = (page: Page): Locator => page.getByTestId("page-spread");

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
    // that matters: a mus'haf leaf is portrait, so in a 1440×700 window each
    // leaf would be handed less page than a 320px phone gives (the arithmetic is
    // in docs/design/desktop.md §3).
    await page.setViewportSize({ width: 1440, height: 700 });
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

    const book = await boxOf(spread(page));
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
    expect(seen[0]!.host, "the band was not portalled into the spread").toBe("page-spread");
    expect(seen[0]!.hostWidth, "the band's box is not the open book").toBeCloseTo(book.width, 0);

    // And it went the whole way across. The far end is the assertion that a leaf
    // -sized sweep fails: the live page is the right-hand leaf, so a band that
    // stopped at its own leaf's edge would never reach the left of the book.
    const band = await page.evaluate(
      () => (window as unknown as { __band: Array<[number, number]> }).__band,
    );
    expect(band.length, "the band was never sampled mid-sweep").toBeGreaterThan(3);
    const near = Math.min(...band.map((f) => f[0]));
    const far = Math.max(...band.map((f) => f[1]));
    expect(near, "the band never reached the near edge").toBeLessThan(book.x + 2);
    // Not the exact far edge. The band is removed the moment the turn ends, so
    // the last frame a sampler can catch is a frame or two inside the sweep, and
    // an eased transition spends its slowest frames there — pinning the final
    // pixel would be pinning frame timing, which is a flake, not a claim. 0.8 of
    // the book is far past the gutter and roughly twice as far as the failure
    // this row exists for: a band confined to the live leaf stops at 0.5.
    expect(far, "the band stopped short of the far leaf").toBeGreaterThan(
      book.x + book.width * 0.8,
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

    // A band at rest sits one width *outside* the spread at each end of its
    // sweep, so the clip is the only thing between a finished turn and a strip
    // of fore-edge floating in the desktop field, attached to nothing. Asserted
    // against the computed style because it is a load-bearing declaration that
    // looks like tidiness, and the next person to simplify this stylesheet will
    // read it as tidiness.
    const clip = await spread(page).evaluate((el) => getComputedStyle(el).overflow);
    expect(clip, "the open book stopped clipping the parked band").toBe("hidden");
  });
});

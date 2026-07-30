import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The stage always holds page, never blank paper.
 *
 * The defect this file exists for: `frameBboxToView` centred the target ayah
 * unconditionally, and an ayah near the foot of a page cannot be centred without
 * dragging the page a long way past its own bottom edge. Hopping to 2:47 —
 * second-to-last ayah on page 7 — left roughly a fifth of the stage empty
 * between the last line of scripture and the trail. Nothing else in the suite
 * could see it: the ayah *was* selected, its marks *were* in the overlay, the
 * header and the trail all agreed. Only the geometry of the page against the
 * geometry of the stage tells you the reader is looking at a margin.
 *
 * The second defect, found in the same measurement: `centerCurrent` translated
 * the host by `(stageWidth - contentWidth) / 2` while reading the *stage* rect,
 * padding and all — so it re-centred a host the stage had already centred and
 * the page sat one padding to the right, far edge flush against the screen.
 *
 * Both are now one rule — `clampView` in @hifth/core, applied on every write to
 * the transform — so these assertions are the end-to-end half of the unit tests
 * in `packages/core/src/view.test.ts`. They are here rather than in the golden
 * suite on purpose: a golden shot of the SVG element cannot see the *stage*
 * around it, which is precisely the relationship that broke.
 */

/** The visible page's SVG — the only host not `display: none` (PageStage). */
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);

/**
 * The two frames this file measures against, and why they are different.
 *
 * `layerOf` is the box the host is laid out in, so `translate3d(0,0)` puts the
 * page at its top-left and it is the coordinate space `clampView` reasons in.
 * Measured: it is exactly host-sized (358×570.7 on the iPhone project) because
 * it is shrink-to-fit around its one visible child. So "the page covers the
 * layer" is the honest reading of "no blank stage shows through where page
 * should be" — the band this file was written against is precisely layer
 * showing through.
 *
 * `stageOf` is that layer's parent: the scrollport the reader actually sees,
 * one `var(--space-4)` of padding larger on every side. That padding is a
 * gutter by design and the clamp must never eat it, which is why coverage is
 * asserted against the layer and not against this. Centring, though, is only
 * meaningful here — the layer being host-sized makes "centred in the layer"
 * true of every possible page position, including the broken one.
 *
 * `aria-busy` is the layer's own attribute (PageStage.tsx) and nothing else in
 * the app carries it; the stage has only a hashed CSS-module class, so it is
 * reached as the parent rather than named.
 */
const layerOf = (page: Page): Locator => page.locator("[aria-busy]");
const stageOf = (page: Page): Locator => layerOf(page).locator("xpath=..");

/** A bounding box that is definitely there. */
async function boxOf(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await target.boundingBox();
  expect(box, "element has no box").not.toBeNull();
  return box!;
}

/**
 * Wait until the stage stops moving — same definition as the golden harness:
 * two consecutive identical boxes. Mounting a page is followed by a centring
 * pass and a hop adds a tween on top of it, so "visible" and "still" are
 * different questions and only the second one can be measured against.
 */
async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await target.boundingBox());
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
}

async function open(page: Page, hash: string, pageNo: number): Promise<Locator> {
  await page.goto(`/#/hafs-kfqc/${hash}`);
  const svg = pageSvg(page, pageNo);
  await expect(svg).toBeVisible({ timeout: 20_000 });
  await settle(svg);
  return svg;
}

/**
 * The page covers the stage on both axes.
 *
 * A pixel of tolerance, and only one: the transform is fractional and
 * `boundingBox` reports device-rounded CSS px, so an exact `<=` would be a test
 * of the rounding rather than of the clamp. The band this was written against
 * was ~170 px — nothing this tolerance could hide.
 */
function expectCovers(
  pageBox: { x: number; y: number; width: number; height: number },
  layer: { x: number; y: number; width: number; height: number },
): void {
  expect(pageBox.y, "blank stage above the page").toBeLessThanOrEqual(layer.y + 1);
  expect(pageBox.y + pageBox.height, "blank stage below the page").toBeGreaterThanOrEqual(
    layer.y + layer.height - 1,
  );
  expect(pageBox.x, "blank stage beside the page").toBeLessThanOrEqual(layer.x + 1);
  expect(pageBox.x + pageBox.width, "blank stage beside the page").toBeGreaterThanOrEqual(
    layer.x + layer.width - 1,
  );
}

test.describe("Hifth · the stage holds page, not paper", () => {
  test("a hop to the foot of a page lands on scripture, not on a margin", async ({ page }) => {
    // 2:47 is the second-to-last ayah on page 7. Centring it is exactly the
    // request the page cannot grant, which is why it is the one linked here.
    const svg = await open(page, "2:47", 7);
    const box = await boxOf(svg);
    const layer = await boxOf(layerOf(page));

    // The premise, asserted rather than assumed: at the hop zoom the page is
    // bigger than the stage on both axes, so "cover it" is a demand the page can
    // actually meet. If a future viewport made the page smaller than the stage,
    // covering would be impossible and the check below would be nonsense.
    expect(box.height).toBeGreaterThan(layer.height);
    expect(box.width).toBeGreaterThan(layer.width);
    expectCovers(box, layer);
  });

  test("the same at the head of a page", async ({ page }) => {
    // 2:38 opens page 7. The clamp has to hold the other end too — the failure
    // there is a band of blank *above* the first line, under the header.
    const svg = await open(page, "2:38", 7);
    expectCovers(await boxOf(svg), await boxOf(layerOf(page)));
  });

  test("no drag can shove the page off the stage", async ({ page }) => {
    // The hop's own target being legal is not enough: the tween's intermediate
    // frames and every later pan write the transform too, so the clamp lives on
    // the write and not on the target. A drag is how a reader reaches it.
    const svg = await open(page, "2:47", 7);
    const before = await boxOf(svg);
    const layer = await boxOf(layerOf(page));

    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Four steps, not forty: the first one already clears the tap slop, so the
    // stroke latches as a pan while `elapsedTime` is still nowhere near
    // LONG_PRESS_MS. A slower sweep would latch as a marquee and this test would
    // pass by never having moved the page at all.
    await page.mouse.move(cx + 600, cy + 900, { steps: 4 });
    await page.mouse.up();
    await settle(svg);

    const after = await boxOf(svg);
    // The drag must have done something, or the coverage assertion below is
    // vacuous — it would be re-checking the hop's own landing.
    expect(after.y, "the drag never moved the page").not.toBe(before.y);
    expectCovers(after, layer);
  });

  test("at rest the page sits in the middle, not flush against an edge", async ({ page }) => {
    // A bare page link is the reset view: z=1, where the page is narrower than
    // the stage and the only honest place for it is the middle. Against the
    // *stage*, deliberately — see `stageOf`. The old reset translated by
    // `(stageWidth - contentWidth) / 2` on top of a host the stage had already
    // centred, which put the whole padding on one side: page at x = 2×16 with
    // its right edge exactly on the screen's.
    const svg = await open(page, "p7", 7);
    const box = await boxOf(svg);
    const stage = await boxOf(stageOf(page));

    expect(box.width).toBeLessThanOrEqual(stage.width + 1);
    const left = box.x - stage.x;
    const right = stage.x + stage.width - (box.x + box.width);
    expect(Math.abs(left - right), "the page is not centred in the stage").toBeLessThanOrEqual(1);
  });
});

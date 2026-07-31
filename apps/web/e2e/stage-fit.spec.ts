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
 *
 * The third and fourth defects came from the same place and are the reason this
 * file now runs on every project instead of on two phones
 * (`docs/design/page-turning.md` §7 ①②). `.layer` carried `place-items: center`
 * while `holdAxis` was already returning a centring offset, so the offset landed
 * twice and at 1440 × 900 the leaf sat 245.8 px from the left of its layer and
 * −0.2 from the right — flush against the spine. And `.layer` had no
 * `min-block-size: 0`, so on a short screen the grid row's automatic minimum size
 * grew the layer to its content: `measureFit` reads the layer, so a page taller
 * than the stage measured as a page that fits, and the overhang was cut by
 * `overflow: hidden` with no gesture that could bring it back.
 *
 * Neither was reachable from here as this file was written, and §7 ② is the list
 * of reasons. The two that were fixed in the tests rather than in the CSS: the
 * `desktop` project did not run this file at all, and the coverage assertion was
 * one-sided — over-covering satisfies "covers", so a page hanging a hundred px
 * below the fold passed it. `expectHeld` replaced it, and asserts both of
 * `holdAxis`'s regimes rather than only the one a phone happens to be in.
 *
 * The fifth thing this file watches is newer and is not a defect that shipped —
 * it is the one the edge vocabulary could introduce. The leaf now carries a 2 px
 * border and, on its free side, a 10 px fore-edge stack, and every one of those
 * marks must sit **beside** the paper and never over it
 * (`docs/design/page-transition.md` §2.2). Drawing the stack inside the host's
 * padding box instead of in the padding looks identical in a screenshot and puts
 * ten pixels of the page block on top of ten pixels of scripture, so the SVG's
 * inset inside its host is asserted directly rather than inferred from coverage.
 */

/** The visible page's SVG — the only host not `display: none` (PageStage). */
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);

/**
 * The leaf itself: the host div the SVG is mounted in.
 *
 * This, not the SVG, is what `clampView` positions and what `measureFit` reads
 * (`host.offsetWidth`), so it is what the two regimes below are claims about.
 * They were claims about the SVG until the leaf grew edges, and the two boxes
 * were the same box exactly as long as the host was a bare wrapper with no
 * border and no padding.
 */
const hostOf = (svg: Locator): Locator => svg.locator("xpath=..");

/**
 * The two frames this file measures against, and why they are different.
 *
 * `layerOf` is the box the host is laid out in, so `translate3d(0,0)` puts the
 * page at its top-left and it is the coordinate space `clampView` reasons in —
 * `measureFit` (PageStage.tsx) reads this element and nothing else for
 * `stageWidth`/`stageHeight`.
 *
 * It is **stage-sized**: `.layer` is `inline-size: 100%; block-size: 100%;
 * min-block-size: 0`, so it is the stage's content box on both axes at every
 * viewport. This comment used to say the opposite — that it was "exactly
 * host-sized (358×570.7 on the iPhone project) because it is shrink-to-fit
 * around its one visible child" — and that sentence is why two defects lived in
 * this file's blind spot for six loops. The measurement was real; the
 * explanation was not. The layer *was* host-width, because the host is
 * `width: min(100%, …)` and on a 390 px screen that minimum is the layer itself;
 * and it *was* host-height, because before `min-block-size: 0` the grid row's
 * automatic minimum size grew it to its content. One viewport's two coincidences
 * were written down as the definition of the box.
 *
 * What believing it cost: "the page covers the layer" only reads as "no blank
 * stage shows through" if the layer is the stage, which it was on a phone by
 * accident; and "centred in the layer" was true of *every* page position,
 * including a leaf jammed against the gutter at 1440 × 900, because the layer
 * was being grown to fit whatever the page did. A false explanation in a test is
 * worse than no comment: it tells the next reader the invariant is proved.
 *
 * `stageOf` is that layer's parent: the scrollport the reader actually sees, one
 * `var(--space-4)` of padding larger on three sides. That padding is a gutter by
 * design and the clamp must never eat it, which is why the *overflow* regime is
 * asserted against the layer and not against this. Centring is asserted against
 * the stage minus its own padding, which additionally catches a layer that is
 * not itself where its stage's padding says it should be.
 *
 * **Three sides, not four.** The stage drops its padding on the leaf's *bound*
 * side so the page runs off the screen into its binding (`page-transition.md`
 * §2.4) — air on all four sides is the strongest "card on a desk" cue there is.
 * So the padding is no longer symmetric and "centred in the stage rect" is no
 * longer the same claim as "centred in the box the clamp works in". `padsOf`
 * reads the padding back off the element rather than hard-coding 16, so this
 * file states the relationship and `PageStage.module.css` states the number.
 *
 * Both are reached from the visible page's SVG rather than from the document.
 * `aria-busy` is the layer's own attribute (PageStage.tsx) and nothing else in
 * the app carries it, but on desktop the spread mounts one `PageStage` per
 * vendored leaf, so a bare `[aria-busy]` becomes ambiguous the day Loop 4b
 * vendors a facing pair. The stage has only a hashed CSS-module class, so it is
 * reached as the layer's parent rather than named.
 */
const layerOf = (svg: Locator): Locator => svg.locator("xpath=ancestor::*[@aria-busy][1]");
const stageOf = (svg: Locator): Locator => layerOf(svg).locator("xpath=..");

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Pads {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A bounding box that is definitely there. */
async function boxOf(target: Locator): Promise<Box> {
  const box = await target.boundingBox();
  expect(box, "element has no box").not.toBeNull();
  return box!;
}

/** An element's own padding, read back rather than assumed. */
async function padsOf(target: Locator): Promise<Pads> {
  return target.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      left: parseFloat(s.paddingLeft),
      right: parseFloat(s.paddingRight),
      top: parseFloat(s.paddingTop),
      bottom: parseFloat(s.paddingBottom),
    };
  });
}

interface Frames {
  /** The leaf — border, paper and fore-edge stack. What the clamp positions. */
  box: Box;
  /** The paper alone: the SVG, inset inside the leaf by the marks around it. */
  paper: Box;
  layer: Box;
  stage: Box;
  pads: Pads;
}

/** The leaf, the paper inside it, the frame the clamp works in, and the frame the reader sees. */
async function framesOf(svg: Locator): Promise<Frames> {
  return {
    box: await boxOf(hostOf(svg)),
    paper: await boxOf(svg),
    layer: await boxOf(layerOf(svg)),
    stage: await boxOf(stageOf(svg)),
    pads: await padsOf(stageOf(svg)),
  };
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
 * One axis is held where `holdAxis` (packages/core/src/view.ts) says it is.
 *
 * Two regimes, and asserting only one of them is how the double centring hid.
 * An axis the page **overflows** may roam over its overhang but never past it,
 * so the stage stays full of page: assert coverage. An axis the page **fits**
 * has no roaming to do and exactly one honest position, the middle: assert
 * centring. Which regime a viewport is in is not a constant — it depends on the
 * leaf's aspect against the height the chrome leaves — so it is measured here
 * rather than assumed, and every test in this file gets both halves.
 *
 * Coverage alone was the old assertion, and it is one-sided: over-covering
 * satisfies it, which is why a page hanging 108 px below the fold passed.
 *
 * A pixel of tolerance, and only one: the transform is fractional and
 * `boundingBox` reports device-rounded CSS px, so an exact comparison would be a
 * test of the rounding rather than of the clamp. The bands this file was written
 * against are 108–272 px vertically and ~246 px horizontally — nothing this
 * tolerance could hide.
 */
function expectHeldOnAxis(
  axis: "horizontally" | "vertically",
  page: { start: number; size: number },
  layer: { start: number; size: number },
  stage: { start: number; size: number; padStart: number; padEnd: number },
): void {
  if (page.size <= layer.size + 1) {
    // The stage's own padding comes out of the expectation rather than out of
    // the measurement: it is asymmetric now (zero on the bound side), so the
    // gutter the clamp must never eat is not the same number on both sides and
    // "equal air either side of the stage rect" would be a false claim.
    const before = page.start - (stage.start + stage.padStart);
    const after = stage.start + stage.size - stage.padEnd - (page.start + page.size);
    expect(
      Math.abs(before - after),
      `the leaf is not centred ${axis} in its stage's content box (${before.toFixed(1)} before, ${after.toFixed(1)} after)`,
    ).toBeLessThanOrEqual(1);
    return;
  }
  expect(page.start, `blank stage before the page, ${axis}`).toBeLessThanOrEqual(layer.start + 1);
  expect(page.start + page.size, `blank stage after the page, ${axis}`).toBeGreaterThanOrEqual(
    layer.start + layer.size - 1,
  );
}

/** The leaf is held on both axes: centred where it fits, covering where it does not. */
function expectHeld(box: Box, layer: Box, stage: Box, pads: Pads): void {
  expectHeldOnAxis(
    "horizontally",
    { start: box.x, size: box.width },
    { start: layer.x, size: layer.width },
    { start: stage.x, size: stage.width, padStart: pads.left, padEnd: pads.right },
  );
  expectHeldOnAxis(
    "vertically",
    { start: box.y, size: box.height },
    { start: layer.y, size: layer.height },
    { start: stage.y, size: stage.height, padStart: pads.top, padEnd: pads.bottom },
  );
}

/**
 * Every mark the leaf wears is beside the paper, and none of it is over it.
 *
 * This is the failure the edge vocabulary introduces and that nothing else could
 * see: draw the fore-edge stack inside the host's padding box instead of in its
 * padding and the leaf looks correct, coverage still passes, and ten pixels of
 * the page block sit on top of ten pixels of scripture. Screenshots cannot catch
 * it either — the golden suite photographs the SVG element, and the SVG is the
 * thing that would be covered.
 *
 * The numbers come from `tokens.css`, and the *sides* come from
 * `leafSideOf` — which is why the leaf is asked which one it is rather than
 * being told. All three vendored pages are odd, so `"right"` is the only branch
 * this build can reach (`page-transition.md` §2.3); `"left"` is asserted the same
 * way so the day Loop 4b vendors an even page, the mirror is already under test.
 */
const LEAF_EDGE = 2;
const FORE_EDGE_STACK = 10;

async function expectMarksBesideThePaper(svg: Locator, leaf: Box, paper: Box): Promise<void> {
  const host = hostOf(svg);
  const side = await host.getAttribute("data-leaf");
  expect(side, "the leaf never said which of its edges is free").not.toBeNull();

  // The marks are inside the transform, so they scale with the page and the
  // relationship is a ratio rather than a constant. `offsetWidth` is the leaf's
  // laid-out width — the same number `measureFit` feeds the clamp — so dividing
  // the painted box by it recovers the zoom without reparsing the matrix.
  const laidOut = await host.evaluate((el) => (el as HTMLElement).offsetWidth);
  const scale = leaf.width / laidOut;
  const free = side === "right" ? leaf.x + leaf.width - (paper.x + paper.width) : paper.x - leaf.x;
  const bound = side === "right" ? paper.x - leaf.x : leaf.x + leaf.width - (paper.x + paper.width);

  expect(
    free / scale,
    "the fore-edge stack is drawn over the scripture, not beside it",
  ).toBeCloseTo(LEAF_EDGE + FORE_EDGE_STACK, 0);
  expect(
    bound / scale,
    "the bound edge grew a fore-edge it has no business having",
  ).toBeCloseTo(LEAF_EDGE, 0);
  // No stack on the block axis — a leaf's head and foot are cut, not bound.
  expect((paper.y - leaf.y) / scale, "the head of the leaf grew a stack").toBeCloseTo(LEAF_EDGE, 0);
}

test.describe("Hifth · the stage holds page, not paper", () => {
  test("a hop to the foot of a page lands on scripture, not on a margin", async ({ page }) => {
    // 2:47 is the second-to-last ayah on page 7. Centring it is exactly the
    // request the page cannot grant, which is why it is the one linked here.
    const svg = await open(page, "2:47", 7);
    const { box, paper, layer, stage, pads } = await framesOf(svg);

    // Every mark the leaf wears is beside the scripture, at the hop zoom as much
    // as at rest — the stack is inside the transform, so it scales with the page
    // and the relationship is a ratio, not a constant. Asserted where the leaf is
    // biggest, because that is where an overlap would eat the most.
    await expectMarksBesideThePaper(svg, box, paper);

    // The premise, asserted rather than assumed: at the hop zoom the page is
    // taller than the stage, so "cover it" is a demand the page can actually
    // meet on the axis the defect was on. Only the vertical axis is claimed —
    // the desktop leaf is capped by height and can still be narrower than its
    // layer at 1.55×, and `expectHeld` is the half that knows which regime it is
    // looking at.
    expect(box.height, "the hop zoom no longer overflows the stage").toBeGreaterThan(layer.height);
    expectHeld(box, layer, stage, pads);
  });

  test("the same at the head of a page", async ({ page }) => {
    // 2:38 opens page 7. The clamp has to hold the other end too — the failure
    // there is a band of blank *above* the first line, under the header.
    const svg = await open(page, "2:38", 7);
    const { box, layer, stage, pads } = await framesOf(svg);
    expectHeld(box, layer, stage, pads);
  });

  test("no drag can shove the page off the stage", async ({ page }) => {
    // The hop's own target being legal is not enough: the tween's intermediate
    // frames and every later pan write the transform too, so the clamp lives on
    // the write and not on the target. A drag is how a reader reaches it.
    const svg = await open(page, "2:47", 7);
    const before = await boxOf(hostOf(svg));
    const { layer, stage, pads } = await framesOf(svg);

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

    const after = await boxOf(hostOf(svg));
    // The drag must have done something, or the coverage assertion below is
    // vacuous — it would be re-checking the hop's own landing.
    expect(after.y, "the drag never moved the page").not.toBe(before.y);
    expectHeld(after, layer, stage, pads);
  });

  test("at rest the page sits in the middle, not flush against an edge", async ({ page }) => {
    // A bare page link is the reset view: z=1, where the page is narrower than
    // the stage and the only honest place for it is the middle. Against the
    // *stage*, deliberately — see `stageOf`. The old reset translated by
    // `(stageWidth - contentWidth) / 2` on top of a host the stage had already
    // centred, which put the whole padding on one side: page at x = 2×16 with
    // its right edge exactly on the screen's.
    //
    // The same assertion is what catches the double centring, and only because
    // this file now runs on the `desktop` project too: on a phone the host is
    // `width: min(100%, …)` and fills its layer, so the horizontal offset is
    // added twice to a slack of zero and nothing shows. At 1440 × 900 the slack
    // is real and the leaf lands 245.8 px from the left of an otherwise empty
    // field, hard against the spine of the spread.
    const svg = await open(page, "p7", 7);
    const { box, paper, layer, stage, pads } = await framesOf(svg);

    expect(box.width, "the leaf no longer fits its stage horizontally").toBeLessThanOrEqual(
      layer.width + 1,
    );
    expectHeld(box, layer, stage, pads);
    await expectMarksBesideThePaper(svg, box, paper);

    // The bound side runs into the binding. Asserted through the stage's own
    // padding rather than through the leaf's position, because this is a claim
    // about the *stage*: the leaf is centred in whatever content box it is
    // given, so restoring symmetric padding would leave every other assertion in
    // this file green.
    const side = await hostOf(svg).getAttribute("data-leaf");
    const boundPad = side === "right" ? pads.left : pads.right;
    expect(boundPad, "the leaf is floating on air on its bound side").toBe(0);

    // And the free side is not the edge of the screen — a fore-edge with nothing
    // beyond it is a page that has been cropped rather than laid down.
    //
    // Measured against the viewport rather than through `pads`, because the two
    // layouts provide that room from different places and both are right. On a
    // phone the stage is the whole window and its own padding is the only thing
    // there. In a spread `--stage-pad` is zero and the room is the desk: the
    // leaf's box is already the page's shape, so an inset *here* would come out
    // of the page — squeezing it out of proportion or clipping its foot — while
    // the field either side of the book is unlimited.
    const width = page.viewportSize()!.width;
    const free = side === "right" ? width - (box.x + box.width) : box.x;
    expect(free, "the page's fore-edge is hard against the screen").toBeGreaterThan(0);
  });

  test("at 320 × 568 the foot of the page can be reached, not just cut off", async ({ page }) => {
    // The narrowest and shortest screen this app supports, and the one where the
    // leaf most exceeds the height the chrome leaves. It sets its own viewport,
    // so it asserts the same thing on every project rather than only on the two
    // the file used to run on.
    await page.setViewportSize({ width: 320, height: 568 });
    const svg = await open(page, "p7", 7);
    const { box, layer, stage, pads } = await framesOf(svg);

    // The mechanism, asserted directly rather than through its symptom. Without
    // `min-block-size: 0` the grid row's automatic minimum size grows the layer
    // to its content, and `measureFit` reads the layer for `stageHeight` — so a
    // page taller than the stage reported as a page that fits, `holdAxis` gave
    // back the centre of an axis with no slack, and the overhang was cut by the
    // stage's `overflow: hidden` with no gesture that could bring it back.
    expect(layer.height, "the layer grew past the stage").toBeLessThanOrEqual(stage.height + 1);

    // The premise: at this viewport the leaf genuinely does overflow, so there
    // is something below the fold to go and get. If it did not, "reachable"
    // would be vacuously true and the drag below would prove nothing.
    const overhang = box.height - layer.height;
    expect(overhang, "the leaf no longer overflows at 320 × 568").toBeGreaterThan(1);
    expectHeld(box, layer, stage, pads);

    // 400 px is more than the overhang has ever measured (108–272 depending on
    // how much chrome is up), so the clamp — not the gesture — is what stops the
    // page, and the last line of scripture lands exactly on the fold.
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 400, { steps: 4 });
    await page.mouse.up();
    await settle(svg);

    const after = await boxOf(hostOf(svg));
    expect(
      box.y - after.y,
      "the page did not move — the foot of it is unreachable",
    ).toBeGreaterThan(1);
    expect(after.y + after.height, "the foot of the page never came into view").toBeLessThanOrEqual(
      layer.y + layer.height + 1,
    );
    expectHeld(after, layer, stage, pads);
  });
});

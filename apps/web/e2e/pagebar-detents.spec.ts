import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The juz detents on the *app* bar — option C, graduated from the decision page
 * into the real chrome (`docs/decisions/page-bar.md`, both questions settled to
 * C on 2026-09-02).
 *
 * `detent-live.spec.ts` proves the felt interaction on the decision page, where
 * the markers sit over a mock track and grow under a mock rule switch. This is
 * the same behaviour once it is wired to the real corpus and the real stage: a
 * tap on a marker turns the book to that juz's opening, and — because the growth
 * is a *pointer* affordance the owner added so a 2px tick is easy to reach — a
 * hover swells the marker under the cursor while a drag never does.
 *
 * Two reasons it runs on the desktop project and nowhere else. The growth is
 * gated on `(hover: hover) and (pointer: fine)`, so on the phone projects the
 * markers are plain tap targets with nothing to assert about swelling; and a
 * hover-near-without-dragging is a gesture only a device with a pointer has. The
 * tap-to-navigate half would read on a phone too, but keeping the whole file on
 * one project avoids owning a second aria tree for a claim already covered by
 * the component test (`PageSlider.test.tsx` · "opens a juz when its marker is
 * tapped").
 */

const NUM = "header .numeric";

/** Read the scale a marker is currently drawn at from its inline transform. */
const scaleOf = (mark: Locator): Promise<number> =>
  mark.evaluate((el) => {
    const m = ((el as HTMLElement).style.transform || "").match(/scale\(([-\d.]+)\)/);
    return m && m[1] ? parseFloat(m[1]) : 1;
  });

/** Move the mouse to the centre of a marker (a hover, no button down). */
async function hoverCentre(page: Page, mark: Locator) {
  const box = await mark.boundingBox();
  if (!box) throw new Error("marker has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Put the thumb mid-drag over a page and leave it there. The bubble is drawn
 * only while a drag is under way (`scrub !== null`), and `fill` fires both the
 * `input` a drag fires and the `change` a release fires — the second clears the
 * scrub. So set the value and dispatch `input` alone, the event React's
 * `onChange` maps to on a range control, which is exactly what a moving thumb
 * sends and what drives the readout.
 */
async function scrubTo(page: Page, value: number) {
  const slider = page.getByRole("slider");
  await slider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

test.describe("Hifth · the app bar's juz detents (option C)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    // The rail only draws once the manifest has placed the juz, so the detents
    // are the signal the bar is fully wired — not the stage being painted.
    await expect(page.locator("[data-testid='juz-detent']").first()).toBeVisible();
  });

  test("draws a marker for every juz the corpus can place", async ({ page }) => {
    // The full 604-page print carries all thirty; a gap in the inventory would
    // drop a marker without renumbering the rest, which is the component test's
    // job — here the claim is simply that the graduated rail reaches the corpus.
    await expect(page.locator("[data-testid='juz-detent']")).toHaveCount(30);
  });

  test("names both juz in the bubble on a page a seam cuts", async ({ page }) => {
    // The other decided question (boundary-juz C), against the real corpus: page
    // 62 is a seam page — juz 3 runs onto it and juz 4 begins partway down — so
    // the thumb bubble names both, shown as a hand-off with the arrow flipped
    // leftward for Arabic. The bubble only exists mid-drag, so dispatch the
    // native `input` the drag fires (React's onChange, the scrub) without the
    // `change` that release fires and would clear it. Arabic-Indic ٣/٤ are the
    // juz label; the page number on the line above is Latin, so they cannot be
    // it.
    await scrubTo(page, 62);
    const bubble = page.locator("output");
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("٣");
    await expect(bubble).toContainText("٤");
    await expect(bubble).toContainText("←");
  });

  test("names a single juz in the bubble on a clean page", async ({ page }) => {
    // Page 50 sits wholly inside juz 3 — nothing begins on it — so "both" must
    // not fire and the bubble names one juz with no hand-off. The row that keeps
    // the seam label scoped to seam pages rather than every page it can place.
    await scrubTo(page, 50);
    const bubble = page.locator("output");
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("٣");
    await expect(bubble).not.toContainText("←");
  });

  test("tapping a marker turns the book to that juz's opening", async ({ page }) => {
    // Start is page 7. Juz 3 opens at 42 and juz 30 at 582 in this edition —
    // the two ends of a tap, so a marker that navigated by its DOM index rather
    // than its juz would land wrong on at least one.
    await expect(page.locator(NUM)).toHaveText("7");

    await page.locator("[data-testid='juz-detent'][data-juz='3']").click();
    await expect(page.locator(NUM)).toHaveText("42");

    await page.locator("[data-testid='juz-detent'][data-juz='30']").click();
    await expect(page.locator(NUM)).toHaveText("582");
  });

  test("the marker under the pointer grows and a far one stays put", async ({ page }) => {
    const marks = page.locator("[data-testid='juz-detent']");
    const near = marks.nth(14); // juz 15, mid-track
    const far = marks.nth(0); // juz 1, at the far right edge in RTL
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5); // swells toward the ~2.4 peak
    expect(await scaleOf(far)).toBeLessThan(1.05); // eased away — barely moves
  });

  test("letting the pointer leave the bar settles the markers back", async ({ page }) => {
    const near = page.locator("[data-testid='juz-detent']").nth(14);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5);
    // Off the whole bar: the track's pointerleave clears every transform.
    await page.mouse.move(5, 5);
    const track = page.locator("[data-testid='juz-detent']").first();
    await track.evaluate((el) =>
      el.closest("[class*='track']")?.dispatchEvent(new PointerEvent("pointerleave")),
    );
    expect(await scaleOf(near)).toBeLessThanOrEqual(1.001);
  });

  test("a marker does not grow while a drag is under way", async ({ page }) => {
    // The whole promise of the refinement: the growth must never put a swollen
    // button under a drag that was aimed at the thumb. Hover a marker to grow
    // it, then grab the page handle and drag — every marker must be back to its
    // plain size for the length of the drag.
    const near = page.locator("[data-testid='juz-detent']").nth(14);
    await hoverCentre(page, near);
    expect(await scaleOf(near)).toBeGreaterThan(1.5);

    const handle = page.locator("[data-testid='page-handle']");
    const hb = await handle.boundingBox();
    if (!hb) throw new Error("handle has no box");
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 120, hb.y + hb.height / 2, { steps: 6 });
    expect(await scaleOf(near)).toBeLessThanOrEqual(1.001);
    await page.mouse.up();
  });
});

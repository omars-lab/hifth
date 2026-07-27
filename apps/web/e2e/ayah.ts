import { expect, type Page } from "@playwright/test";

/**
 * Tapping an ayah, the way a finger does it.
 *
 * Playwright aims at the centre of an element's bounding box (clipped to the
 * viewport). For most elements that is the element. An ayah is not most
 * elements: it is a run of text, so an ayah that wraps a line is a path of two
 * disjoint rectangles — the tail of one line and the head of the next — and the
 * centre of the box that contains them both falls in the gap between, which
 * belongs to the *neighbouring* ayah. `#verse-54` (2:47) is exactly that shape,
 * and a tap at its centre lands on `#verse-55`.
 *
 * That bug is invisible until it isn't. The viewport clipping means the aim
 * point moves when the stage's height changes, so the same tap can be correct
 * on a phone and wrong on a tablet, or correct until a banner above the stage
 * stops rendering. One such tap passed for a whole loop for that reason.
 *
 * So the point is *found*, not assumed: sample the box and keep the first place
 * `document.elementFromPoint` actually answers with this ayah. That is the same
 * question the browser asks on a real touch, which makes a pass here mean the
 * gesture reached its target rather than merely that some pixel was pressed.
 */
async function ayahPoint(page: Page, selector: string): Promise<{ x: number; y: number }> {
  // Resolved through the locator, not `querySelector`: `:visible` is
  // Playwright's own pseudo-class rather than CSS, and several pages are
  // mounted at once (PLAN §4 DOM budget), so `#verse-55` exists more than once
  // in the document. The locator picks the element the test means — and its
  // strictness still fires if the test was ambiguous about which.
  const handle = await page.locator(selector).elementHandle({ timeout: 10_000 });
  expect(handle, `${selector} matched no element`).not.toBeNull();

  // Bring it on screen first, exactly as `locator.tap()` does. The mushaf page
  // is taller than any phone by design, so page 7's last ayahs start below the
  // fold on the smaller device; without this the search below would be looking
  // for a point in a box that is not on the screen yet.
  await handle!.scrollIntoViewIfNeeded({ timeout: 10_000 });

  const at = await page.evaluate((el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { error: "zero-sized" as const };

    // Spiral out from the centre so the chosen point is as close to the middle
    // of the ayah as its shape allows — a hit at the very edge would be a
    // pixel-perfect test, and pixel-perfect tests are the flaky kind.
    const steps = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
    for (const fy of steps) {
      for (const fx of steps) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
    }
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      error:
        `box ${JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })} in ` +
        `${window.innerWidth}×${window.innerHeight}; its centre hits ` +
        `<${hit?.tagName.toLowerCase() ?? "nothing"}#${hit?.id ?? ""}>`,
    };
  }, handle!);

  expect("error" in at ? at.error : "", `${selector} has no point a finger can hit`).toBe("");
  return at as { x: number; y: number };
}

/** Tap an ayah where a finger would actually reach it. See `ayahPoint`. */
export async function tapAyah(page: Page, selector: string): Promise<void> {
  const { x, y } = await ayahPoint(page, selector);
  await page.touchscreen.tap(x, y);
}

/**
 * The point a drag should start or end on, proven to be over `selector`.
 *
 * Same guarantee as `tapAyah`, exposed for the gestures that need coordinates
 * rather than a tap — a marquee drag between two ayahs, in particular, where a
 * mis-aimed endpoint silently selects the wrong range instead of failing.
 */
export async function ayahTarget(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return ayahPoint(page, selector);
}

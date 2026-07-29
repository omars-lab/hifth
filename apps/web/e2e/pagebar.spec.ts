import { test, expect } from "@playwright/test";

/*
 * The page bar — the second way through the book, after the jumper.
 *
 * What the unit tests cannot reach is the part that only exists once a browser
 * has laid the thing out: that the two page turns are on the edges the mus'haf
 * puts them on, that the bar clears the home indicator rather than sitting
 * under it, and above all that a scrub into the un-vendored gap moves the
 * *stage* to a page we actually have and says so out loud. Three of 604 pages
 * are in this build; a bar spanning all of them is only honest if letting go in
 * the empty 99.5% is honest, and that is a whole-app behaviour.
 */

const NUM = "header .numeric";

test.describe("Hifth · the page bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
  });

  test("spans the printed mus'haf and says how little of it is here", async ({ page }) => {
    const slider = page.getByRole("slider");
    // The track is the *book*: 604 pages, the length of the thing in a hafiz's
    // hands. A track that stopped at 19 would redefine the mus'haf as whatever
    // was vendored this week.
    await expect(slider).toHaveAttribute("max", "604");
    await expect(slider).toHaveAttribute("min", "1");
    // And the count is the *build*. It is visible, permanent and not behind a
    // tap, because a full-width slider over three pages implies a book that is
    // not there.
    await expect(page.getByText("المتوفّر ٣ من ٦٠٤ صفحة")).toBeVisible();
  });

  test("speaks its value as a page, and describes itself with the count", async ({ page }) => {
    // A slider is the widget where a silent regression is total: strip
    // `aria-valuetext` and it looks and drags identically while announcing a
    // bare "7" — a number with no unit, in a bar made of numbers. Asserted here
    // rather than in the aria snapshot because Playwright serialises a slider as
    // its raw `value`, so the tree would go on passing with the attribute gone.
    const slider = page.getByRole("slider");
    await expect(slider).toHaveAttribute("aria-valuetext", "صفحة 7 من 604");

    // And the description is the wiring that carries the vendored count to a
    // listener who will never see the ticks: the id must actually resolve.
    const describes = await slider.evaluate((el) => {
      const id = el.getAttribute("aria-describedby");
      return id ? document.getElementById(id)?.textContent : null;
    });
    expect(describes).toBe("المتوفّر ٣ من ٦٠٤ صفحة");
  });

  test("puts the previous page on the right edge and the next on the left", async ({ page }) => {
    // Loop 1's convention, as geometry rather than as an attribute: the next
    // page of a mus'haf lies to the left, which is why ArrowLeft turns forward.
    const prev = await page.getByRole("button", { name: "الصفحة السابقة" }).boundingBox();
    const next = await page.getByRole("button", { name: "الصفحة التالية" }).boundingBox();
    expect(prev, "the previous-page button must be laid out").not.toBeNull();
    expect(next, "the next-page button must be laid out").not.toBeNull();
    expect(prev!.x).toBeGreaterThan(next!.x);

    // Both are real touch targets at the screen's edge, where a miss costs a
    // page. 44 CSS px is the floor the whole chrome is held to.
    for (const box of [prev!, next!]) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("the edge buttons turn the page the way the book does", async ({ page }) => {
    await expect(page.locator(NUM)).toHaveText("7");
    await page.getByRole("button", { name: "الصفحة التالية" }).tap();
    await expect(page.locator(NUM)).toHaveText("9");
    await page.getByRole("button", { name: "الصفحة السابقة" }).tap();
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("letting go in the gap lands on the nearest page we have, and says so", async ({
    page,
  }) => {
    const slider = page.getByRole("slider");
    // `fill` on a range input sets the value and fires both `input` and
    // `change` — the same pair a released thumb produces, which is the event
    // the bar commits on.
    await slider.fill("300");

    // The stage moved to a page that exists, not to the one that was asked for.
    await expect(page.locator(NUM)).toHaveText("19");
    // …and the app said which, because a landing the reader did not ask for is
    // the one thing the un-vendored corpus must never do silently.
    await expect(page.locator("[aria-live='polite']")).toContainText("أقرب صفحة متوفّرة");
  });

  test("a page we do hold is reached without a word about snapping", async ({ page }) => {
    await page.getByRole("slider").fill("19");
    await expect(page.locator(NUM)).toHaveText("19");
    await expect(page.locator("[aria-live='polite']")).toHaveText("صفحة 19");
  });

  test("the arrow keys step between vendored pages, not by one of 604", async ({ page }) => {
    // A range input's own arrows move by `step`. Inside a three-page inventory
    // that snaps straight back every time, so the bar takes the arrows and
    // steps between the pages that exist. `appKeyAction` stands down on its own
    // while the input has focus, so nothing turns two pages at once.
    const slider = page.getByRole("slider");
    await slider.focus();
    await expect(page.locator(NUM)).toHaveText("7");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("9");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("19");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(NUM)).toHaveText("9");
  });

  test("End and Home reach the ends of what exists", async ({ page }) => {
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(page.locator(NUM)).toHaveText("19");
    await page.keyboard.press("Home");
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("the bar is the bottom-most chrome and clears the safe area", async ({ page }) => {
    // It took the inset over from the trail when it was inserted beneath it.
    // Two elements both padding for the home indicator is a doubled gap, and
    // neither padding for it is a control under the indicator.
    const bar = page.getByRole("navigation", { name: "شريط الصفحات" });
    const trail = page.locator("footer");
    const barBox = await bar.boundingBox();
    const trailBox = await trail.boundingBox();
    expect(barBox!.y).toBeGreaterThan(trailBox!.y);

    const inset = await trail.evaluate((el) => getComputedStyle(el).paddingBottom);
    const barInset = await bar.evaluate((el) => getComputedStyle(el).paddingBottom);
    expect(inset).not.toBe(barInset);
  });

  test("the bar reads right to left, like the book it moves through", async ({ page }) => {
    // Computed, not the attribute: the whole stylesheet is logical properties,
    // so an inherited flip is a defect no screenshot catches. Page 1 sits at
    // the right end of the track because of this one value.
    const dir = await page
      .getByRole("navigation", { name: "شريط الصفحات" })
      .evaluate((el) => getComputedStyle(el).direction);
    expect(dir).toBe("rtl");
  });
});

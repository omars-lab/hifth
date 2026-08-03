import { test, expect } from "@playwright/test";
import { contextWithout } from "./inventory";

/*
 * The page bar — the second way through the book, after the jumper.
 *
 * What the unit tests cannot reach is the part that only exists once a browser
 * has laid the thing out: that the two page turns are on the edges the mus'haf
 * puts them on, that the bar clears the home indicator rather than sitting
 * under it, and that a scrub into a page the edition does not carry moves the
 * *stage* to one it does and says so out loud.
 *
 * This bar was designed against three vendored pages of 604, where the track
 * spanned a book that was 99.5% absent and the snap fired on nearly every drag.
 * Loop 4b filled it in, and the honest reading of that is not "the snap is over"
 * — it is that the snap became the exception it always should have been. So the
 * rows below split: the ones about the bar's *span* run against the real corpus
 * and now assert the two numbers meeting (`٦٠٤ من ٦٠٤`), and the ones about
 * *snapping* take a page away first (`./inventory`) so they keep testing the
 * branch rather than testing that it never runs.
 */

const NUM = "header .numeric";

test.describe("Hifth · the page bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
  });

  test("spans the printed mus'haf and says how much of it is here", async ({ page }) => {
    const slider = page.getByRole("slider");
    // The track is the *book*: 604 pages, the length of the thing in a hafiz's
    // hands. It was 604 when 3 pages were vendored, for the same reason it is
    // 604 now — a track that stopped at the inventory would redefine the mus'haf
    // as whatever was vendored this week.
    await expect(slider).toHaveAttribute("max", "604");
    await expect(slider).toHaveAttribute("min", "1");
    // And the count is the *build*. It stays visible and permanent even now that
    // it says the two numbers are equal: it is not a warning that disappears
    // when the news is good, it is the bar telling a reader what is behind it.
    // Read the same way on the day an edition arrives half-vendored.
    await expect(page.getByText("المتوفّر ٦٠٤ من ٦٠٤ صفحة")).toBeVisible();
  });

  test("the count follows the inventory rather than the print", async ({ browser }) => {
    // The other half of the row above, and the one that proves the number is
    // counted rather than printed. `٦٠٤ من ٦٠٤` is exactly the string a bar that
    // rendered `total` twice would produce, and it would go on producing it
    // through a vendoring run that silently dropped a hundred pages.
    const { context, page } = await contextWithout(browser, [8, 300]);
    try {
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await expect(page.getByText("المتوفّر ٦٠٢ من ٦٠٤ صفحة")).toBeVisible();
      await expect(page.getByRole("slider")).toHaveAttribute("max", "604");
    } finally {
      await context.close();
    }
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
    expect(describes).toBe("المتوفّر ٦٠٤ من ٦٠٤ صفحة");
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
    await expect(page.locator(NUM)).toHaveText("8");
    await page.getByRole("button", { name: "الصفحة السابقة" }).tap();
    await expect(page.locator(NUM)).toHaveText("7");
  });

  test("letting go in the gap lands on the nearest page we have, and says so", async ({
    browser,
  }) => {
    // One page taken away, which is now the whole gap there is. That is a
    // sharper test than the 601-page gap this row used to scrub into: page 300
    // is missing and 299 and 301 are both one away, so the landing also pins
    // `nearestPage`'s documented tie-break — the lower page wins, explicitly,
    // rather than by whichever way the loop happened to iterate.
    const { context, page } = await contextWithout(browser, [300]);
    try {
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();

      const slider = page.getByRole("slider");
      // `fill` on a range input sets the value and fires both `input` and
      // `change` — the same pair a released thumb produces, which is the event
      // the bar commits on.
      await slider.fill("300");

      // The stage moved to a page that exists, not to the one that was asked for.
      await expect(page.locator(NUM)).toHaveText("299");
      // …and the app said which, because a landing the reader did not ask for is
      // the one thing a partial corpus must never do silently.
      await expect(page.locator("[aria-live='polite']")).toContainText("أقرب صفحة متوفّرة");
    } finally {
      await context.close();
    }
  });

  test("a scrub across a complete corpus never snaps and never explains", async ({ page }) => {
    // The row above proves the snap fires; this proves it does not fire when it
    // has no reason to. Before Loop 4b the snap ran on essentially every drag,
    // so "أقرب صفحة متوفّرة" was ambient and a bar that announced it
    // unconditionally would have passed every test in this file.
    await page.getByRole("slider").fill("300");
    await expect(page.locator(NUM)).toHaveText("300");
    await expect(page.locator("[aria-live='polite']")).toHaveText("صفحة 300");
  });

  test("a page we do hold is reached without a word about snapping", async ({ page }) => {
    await page.getByRole("slider").fill("19");
    await expect(page.locator(NUM)).toHaveText("19");
    await expect(page.locator("[aria-live='polite']")).toHaveText("صفحة 19");
  });

  test("the arrow keys step between the pages that exist, not by one of 604", async ({
    browser,
  }) => {
    // A range input's own arrows move by `step`, so on a complete corpus the two
    // rules are indistinguishable — every step of 1 lands on a page we have.
    // Take page 8 away and they separate: stepping by `step` would land on 8 and
    // snap back to 7 or forward to 9 with an announcement, and stepping by the
    // inventory goes straight to 9 as one press of one key.
    //
    // The same four presses also carry the claim that `appKeyAction` stands down
    // while the input has focus. If it did not, the second press would move two
    // pages and land on 11 rather than 10.
    const { context, page } = await contextWithout(browser, [8]);
    try {
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();

      const slider = page.getByRole("slider");
      await slider.focus();
      await expect(page.locator(NUM)).toHaveText("7");
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator(NUM)).toHaveText("9");
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator(NUM)).toHaveText("10");
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(NUM)).toHaveText("9");
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(NUM)).toHaveText("7");
    } finally {
      await context.close();
    }
  });

  test("End and Home reach the ends of what exists", async ({ page }) => {
    // Which are the ends of the *book* now — 604 and 1. Loop 4b is what made
    // this row's two numbers worth reading: they were 19 and 7, the ends of an
    // inventory, and a keyboard user pressing End expects the last page of the
    // mus'haf rather than the last page anybody happened to vendor.
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(page.locator(NUM)).toHaveText("604");
    await page.keyboard.press("Home");
    await expect(page.locator(NUM)).toHaveText("1");
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

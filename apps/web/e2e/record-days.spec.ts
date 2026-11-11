import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget, tapAyah } from "./ayah";

/*
 * The record, day by day (docs/design/revision-record.md ⑤): what was opened
 * and which mistakes were marked on each day, as a month and as a list of
 * days. The days here are made up, set on the browser's own clock, and the
 * looks are made the way a reader makes them, by touching the page, so the
 * test goes through the same store the app writes to.
 */
test.use({ locale: "en-US" });

const DAY_ONE = new Date(2026, 2, 9, 10, 0, 0);
const DAY_TWO = new Date(2026, 2, 10, 10, 0, 0);

const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^What went wrong in / });

/** How many looks, and how many of them mistakes, the device's record holds. */
function saved(page: Page): Promise<{ looks: number; mistakes: number }> {
  return page.evaluate(
    () =>
      new Promise<{ looks: number; mistakes: number }>((resolve) => {
        const none = { looks: 0, mistakes: 0 };
        const req = indexedDB.open("hifth.revision.v1");
        // No store yet: roll the creation back, or the app could never write.
        req.onupgradeneeded = () => req.transaction?.abort();
        req.onerror = () => resolve(none);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("days")) {
            db.close();
            return resolve(none);
          }
          const all = db.transaction("days").objectStore("days").getAll();
          all.onerror = () => {
            db.close();
            resolve(none);
          };
          all.onsuccess = () => {
            const events = (all.result as { events: { slip?: boolean }[] }[]).flatMap((d) => d.events);
            db.close();
            resolve({ looks: events.length, mistakes: events.filter((e) => e.slip).length });
          };
        };
      }),
  );
}

async function openRecord(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /what you have opened$/ }).click();
  const sheet = page.getByRole("dialog", { name: "What you have opened" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/**
 * Put made-up looks straight into the device's record, for a day no touch on
 * the page could make (a verse the book cannot place). Done once the app has
 * made its own stores, so nothing here creates them.
 */
function seed(page: Page, day: string, events: { key: string; page: number; at: number; tz: number }[]): Promise<void> {
  return page.evaluate(
    ({ day, events }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("hifth.revision.v1");
        req.onupgradeneeded = () => req.transaction?.abort();
        req.onerror = () => reject(new Error("the record has no store yet"));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["days", "meta"], "readwrite");
          tx.objectStore("days").put({ day, events });
          tx.objectStore("meta").put({ id: "since", day });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { day, events },
  );
}

test.describe("Hifth · the record, day by day", () => {
  test("a verse opened today is counted under today, as a month and as a list", async ({ page, hasTouch }) => {
    await page.clock.setFixedTime(DAY_TWO);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    if (hasTouch) await tapAyah(page, "#verse-55");
    else {
      const at = await ayahTarget(page, "#verse-55");
      await page.mouse.click(at.x, at.y);
    }
    await expect.poll(() => saved(page)).toEqual({ looks: 1, mistakes: 0 });

    const sheet = await openRecord(page);
    await sheet.getByRole("radio", { name: "Days", exact: true }).click();
    const days = sheet.getByRole("list", { name: "Days" }).getByRole("listitem");
    await expect(days).toHaveCount(1);
    await expect(days.first()).toContainText("Mar 10th, 2026");
    await expect(days.first()).toContainText("1 verse");
    await expect(days.first()).toContainText("1 page");
    await expect(days.first()).toContainText("Juz 1");

    await sheet.getByRole("radio", { name: "Month", exact: true }).click();
    const month = sheet.getByRole("group", { name: "Mar 2026" });
    await expect(month.locator("[data-day]")).toHaveCount(31);
    await expect(month.locator('[data-day="2026-03-10"]')).toHaveAttribute("data-state", "worked");
    // The record began today: the 9th is before it, the 11th has not come.
    await expect(month.locator('[data-day="2026-03-09"]')).toHaveAttribute("data-state", "outside");
    await expect(month.locator('[data-day="2026-03-11"]')).toHaveAttribute("data-state", "outside");
    // The month fits the sheet, with no square pushed past its edge.
    const edge = (await sheet.boundingBox())!;
    for (const stamp of ["2026-03-01", "2026-03-31"]) {
      const box = (await month.locator(`[data-day="${stamp}"]`).boundingBox())!;
      expect(box.x, stamp).toBeGreaterThanOrEqual(edge.x);
      expect(box.x + box.width, stamp).toBeLessThanOrEqual(edge.x + edge.width);
    }

    // The choice is remembered: the sheet opens on the month next time.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await openRecord(page);
    await expect(sheet.getByRole("radio", { name: "Month", exact: true })).toHaveAttribute("aria-checked", "true");
  });

  test("a day whose only look the book cannot place says it was opened, with no line of noughts", async ({ page, hasTouch }) => {
    await page.clock.setFixedTime(DAY_TWO);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    // A real look first, so the app has made its stores.
    if (hasTouch) await tapAyah(page, "#verse-55");
    else {
      const at = await ayahTarget(page, "#verse-55");
      await page.mouse.click(at.x, at.y);
    }
    await expect.poll(() => saved(page)).toEqual({ looks: 1, mistakes: 0 });
    // The day before: one look at a verse no print has.
    await seed(page, "2026-03-09", [{ key: "quran/hafs-kfqc/200:1", page: 7, at: DAY_ONE.getTime(), tz: -DAY_ONE.getTimezoneOffset() }]);
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    const sheet = await openRecord(page);
    await sheet.getByRole("radio", { name: "Days", exact: true }).click();
    const days = sheet.getByRole("list", { name: "Days" }).locator("> li");
    await expect(days).toHaveCount(2);
    await expect(days.nth(1)).toContainText("Mar 9th, 2026");
    // The heading and nothing under it: no "0 pages", no "no verses yet".
    await expect(days.nth(1).locator("p")).toHaveCount(0);
    await expect(days.nth(0).locator("p")).toHaveCount(1);
  });

  test("in Arabic the arrow to the earlier month is on the right and points right", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "ar"));
    await page.addInitScript(() => localStorage.setItem("hifth.record.view.v1", "month"));
    await page.clock.setFixedTime(DAY_TWO);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await page.getByRole("button", { name: /ما فتحتَه من المصحف$/ }).click();
    const month = page.locator("[role=dialog]").filter({ has: page.locator("[data-day]") });
    await expect(month.locator("[data-day]")).toHaveCount(31);
    // The week starts on Saturday in Arabic, and March 2026 starts on a Sunday: second column.
    await expect(month.locator('[data-day="2026-03-01"]')).toHaveCSS("grid-column-start", "2");

    const steps = month.locator("button").filter({ hasText: /^[‹›]$/ });
    await expect(steps).toHaveCount(2);
    const earlier = (await steps.nth(0).boundingBox())!;
    const later = (await steps.nth(1).boundingBox())!;
    expect(earlier.x).toBeGreaterThan(later.x);
    // The browser turns these two characters round by itself in a right-to-left
    // page. A turn of our own on top would point each one the wrong way again.
    for (const i of [0, 1]) await expect(steps.nth(i)).toHaveCSS("transform", "none");
  });

  test("mistakes marked on two days are counted on each, by kind, and each opens its verse", async ({ page, isMobile }) => {
    test.skip(isMobile, "the Mistake pen is on the page's toolbar, which a phone does not have");
    await page.clock.setFixedTime(DAY_ONE);
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toBeVisible();

    // Day one: one whole word.
    let at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "The whole word" }).click();
    await expect.poll(() => saved(page)).toEqual({ looks: 1, mistakes: 1 });

    // Day two: a wrong harakat, and a whole word.
    await page.clock.setFixedTime(DAY_TWO);
    at = await ayahTarget(page, "#verse-47");
    await page.mouse.click(at.x, at.y);
    await picker(page).locator("[data-sign]").first().click();
    await expect.poll(() => saved(page)).toEqual({ looks: 2, mistakes: 2 });
    at = await ayahTarget(page, "#verse-48");
    await page.mouse.click(at.x, at.y);
    await picker(page).getByRole("button", { name: "The whole word" }).click();
    await expect.poll(() => saved(page)).toEqual({ looks: 3, mistakes: 3 });

    const sheet = await openRecord(page);
    await sheet.getByRole("radio", { name: "Days", exact: true }).click();
    const days = sheet.getByRole("list", { name: "Days" }).locator("> li");
    await expect(days).toHaveCount(2);
    // Newest first.
    await expect(days.nth(0)).toContainText("Mar 10th, 2026 · 2 mistakes marked");
    await expect(days.nth(0)).toContainText("The whole word 1");
    await expect(days.nth(0)).toContainText("Harakat 1");
    await expect(days.nth(0).locator("[data-mistake]")).toHaveCount(2);
    await expect(days.nth(1)).toContainText("Mar 9th, 2026 · 1 mistake marked");
    await expect(days.nth(1).locator("[data-mistake]")).toHaveCount(1);

    // The month says the same, and a day pressed shows that day's mistakes.
    await sheet.getByRole("radio", { name: "Month", exact: true }).click();
    const month = sheet.getByRole("group", { name: "Mar 2026" });
    await expect(month.locator('[data-day="2026-03-09"]')).toHaveAttribute("data-mistakes", "1");
    await expect(month.locator('[data-day="2026-03-10"]')).toHaveAttribute("data-mistakes", "2");
    await expect(month.locator('[data-day="2026-03-09"]')).toHaveAccessibleName("Mar 9th, 2026 · 1 mistake marked");
    await month.locator('[data-day="2026-03-09"]').click();
    await expect(month.locator('[data-day="2026-03-09"]')).toHaveAttribute("aria-pressed", "true");
    const shown = sheet.locator("[data-mistake]");
    await expect(shown).toHaveCount(1);

    // A mistake opens its verse: the sheet closes and the verse is the one chosen.
    await shown.first().click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText(/^Hopped to .* page 7$/);
  });
});

import { test, expect } from "@playwright/test";

// Loop 5, the range half of the exit criterion (PLAN §Loop 5):
//   highlight 2:47–2:48 → merged, deduped hop list → leap, with the URL in the
//   spec §7 range form (`#/hafs-kfqc/2:47-2:48`).
//
// The highlight is driven here through that very link rather than through the
// drag gesture: opening a range link and releasing a marquee land on the same
// `selectedRange` state (spec §7 — no separate deep-link path), so this covers
// the menu without depending on gesture timing.
//
// Page vendoring today is 7 / 9 / 19 only (Loop 4b vendors the rest), which is
// what makes the disabled rows below real rather than contrived.
const RANGE_LINK = "/#/hafs-kfqc/2:47-2:48";

test.describe("Hifth · the highlighted range", () => {
  test("a range surfaces the merged menu, and the URL keeps the range form", async ({ page }) => {
    await page.goto(RANGE_LINK);
    // A range keeps its hop targets' pages warm, so more than one page SVG is
    // mounted — assert on the first, as the share/a11y tour already does.
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // The menu is a modal dialog titled with the range in Arabic-Indic digits.
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("heading")).toHaveText("البقرة · ٢:٤٧–٢:٤٨");

    // Merged: rows from BOTH members of the range, each naming its source.
    // 2:47 → 2:40 / 2:121 / 2:122 (+ shared root); 2:48 → 2:123 / 7:140 / 14:5 / 82:19.
    await expect(menu.getByText("من ٢:٤٧").first()).toBeVisible();
    await expect(menu.getByText("من ٢:٤٨").first()).toBeVisible();
    await expect(menu.getByRole("button", { name: /انتقل إلى البقرة · ٢:٤٠/ }).first()).toBeVisible();
    await expect(menu.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ })).toBeVisible();

    // Hifz order holds across the merge: the same-page hop (2:40) comes first.
    const first = menu.getByRole("button", { name: /انتقل إلى/ }).first();
    await expect(first).toHaveAttribute("aria-label", /٢:٤٠/);

    // The address bar holds the shareable §7 range form, not a single ayah.
    expect(page.url()).toContain("#/hafs-kfqc/2:47-2:48");
  });

  test("un-vendored targets stay visible but disabled, with an honest reason", async ({ page }) => {
    await page.goto(RANGE_LINK);
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();

    // 14:5 (page 255) and 82:19 (page 587) are not vendored yet (Loop 4b).
    await expect(menu.getByRole("button", { name: /انتقل إلى إبراهيم · ١٤:٥/ })).toBeDisabled();
    await expect(menu.getByText(/هذه الصفحة غير متوفّرة بعد/).first()).toBeVisible();
    // …while the shared-root row anchored to a word (2:122#w3) blames the right
    // thing: its page IS vendored; word granularity is what is missing.
    await expect(menu.getByText(/الربط على مستوى الكلمة/).first()).toBeVisible();
  });

  test("a merged row hops from the range member that produced it", async ({ page }) => {
    await page.goto(RANGE_LINK);
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await expect(page.locator("header .numeric")).toHaveText("7");

    // 2:123 was contributed by 2:48 — so that is the ayah the trail remembers.
    await menu.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ }).tap();

    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ })).toBeVisible();
    // The highlight is gone with the leap: one hop list at a time.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("tapping an ayah replaces the highlight (never both selections at once)", async ({ page }) => {
    await page.goto(RANGE_LINK);
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();

    // Dismiss the menu, then tap 2:48 (verse-55 on page 7).
    await menu.getByRole("button", { name: "إغلاق" }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Scope to the visible page: hop targets keep page 19 warm, and its SVG
    // carries an element id of its own (ids are per-page, not global).
    await page.locator("#verse-55:visible").tap();
    await expect(page.getByRole("group", { name: "روابط الآية" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toContain("#/hafs-kfqc/2:48");
  });
});

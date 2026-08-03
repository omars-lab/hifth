import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";
import { contextWithout } from "./inventory";

// Loop 5, the range half of the exit criterion (PLAN §Loop 5):
//   highlight 2:47–2:48 → merged, deduped hop list → leap, with the URL in the
//   spec §7 range form (`#/hafs-kfqc/2:47-2:48`).
//
// The highlight is driven here through that very link rather than through the
// drag gesture: opening a range link and releasing a marquee land on the same
// `selectedRange` state (spec §7 — no separate deep-link path), so this covers
// the menu without depending on gesture timing.
//
// A disabled row in this menu has two possible reasons, and Loop 4b separated
// them. «هذه الصفحة غير متوفّرة بعد» — the target's page is not in this edition —
// used to be free, because 82:19 lives on page 587 and the build carried three
// pages; it is now arranged (`./inventory`), because the build carries all 604.
// «الربط على مستوى الكلمة» — the edge is anchored to a *word* and the corpus has
// no word geometry — is unarranged and still true: Loop 4b vendored pages, not
// words. Keeping both in one row is deliberate. A menu that collapsed the two
// reasons into one sentence would still pass every other assertion here.
const RANGE_LINK = "/#/hafs-kfqc/2:47-2:48";

test.describe("Hifth · the highlighted range", () => {
  test("a range surfaces the merged menu, and the URL keeps the range form", async ({ page }) => {
    await page.goto(RANGE_LINK);
    // A range keeps its hop targets' pages warm, so more than one page SVG is
    // mounted — assert on the first, as the share/a11y tour already does.
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // ...but each page must be mounted exactly once. A cold range link races the
    // initial mount against navigateTo's, and both used to append their own
    // <svg>, leaving two regions sharing one label (a duplicated landmark, and
    // the reason this spec was flaky). PageStage now de-duplicates in-flight
    // mounts; this is the guard.
    await expect(page.locator('svg[aria-labelledby="page-label-7"]')).toHaveCount(1);

    // The menu is a modal dialog titled with the range in Arabic-Indic digits.
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("heading")).toHaveText("البقرة · ٢:٤٧–٢:٤٨");

    // Merged: rows from BOTH members of the range, each naming its source.
    // 2:47 → 2:40 / 2:122 / 2:123 (+ shared roots); 2:48 → 2:122 / 2:123 / 82:19.
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

  test("un-vendored targets stay visible but disabled, with an honest reason", async ({
    browser,
  }) => {
    // 82:19 sits on page 587, which this edition now carries — so the row is
    // enabled unless page 587 is taken away. Taking it away is the point: the
    // rail's promise is to show an edge it cannot follow rather than hide it,
    // and hiding it is what a menu built from "what we have" would do.
    const { context, page } = await contextWithout(browser, [587]);
    try {
      await page.goto(RANGE_LINK);
      const menu = page.getByRole("dialog");
      await expect(menu).toBeVisible();

      await expect(menu.getByRole("button", { name: /انتقل إلى الانفطار · ٨٢:١٩/ })).toBeDisabled();
      await expect(menu.getByText(/هذه الصفحة غير متوفّرة بعد/).first()).toBeVisible();
      // …while the shared-root row anchored to a word (2:122#w3) blames the right
      // thing, and blames it in a build where the page reason is also on screen:
      // its page IS vendored; word granularity is what is missing.
      await expect(menu.getByText(/الربط على مستوى الكلمة/).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("a merged row hops from the range member that produced it", async ({ page }) => {
    await page.goto(RANGE_LINK);
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await expect(page.locator("header .numeric")).toHaveText("7");

    // 2:123 is an edge of BOTH members, so the row names both — and the leap
    // still has to depart from exactly one ayah. It departs from the member
    // whose edge survived the merge (mergeRangeEdges rule 2): 2:47's carries a
    // bare `ctx` flag, 2:48's the curated «شفاعة ↔ عدل», and a note outranks any
    // amount of derived flagging. So the row reads as 2:48's and leaps from it.
    await expect(menu.getByRole("button", { name: "البقرة · ٢:١٢٣ من ٢:٤٧، ٢:٤٨" })).toBeVisible();
    await expect(menu.getByText("شفاعة ↔ عدل")).toBeVisible();
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
    await tapAyah(page, "#verse-55:visible");
    await expect(page.getByRole("group", { name: "روابط الآية" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toContain("#/hafs-kfqc/2:48");
  });
});

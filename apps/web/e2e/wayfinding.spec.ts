import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";
import { contextWithout } from "./inventory";

/*
 * Loop 6a — wayfinding: getting anywhere, and knowing where you are.
 *
 * Written when three pages were vendored (7, 9, 19 — all in البقرة), which made
 * every claim here cheap to prove and none of them true about the book: the ends
 * of the "mus'haf" were page 7 and page 19, and every arrow press stepped over
 * something. Loop 4b vendored all 604, and the rows split in two along the seam
 * that scarcity had hidden.
 *
 * What the corpus now proves for real: paging walks consecutive leaves, and the
 * arrows stop at page 1 and page 604 — the actual ends of the Madani print,
 * which no test could reach before.
 *
 * What must be manufactured to stay proven: refusing a target we do not have,
 * and naming the page a turn stepped over. Those rows trim a page out of the
 * inventory (`./inventory`) instead of relying on one being absent by accident.
 * The behaviour is not hypothetical — it is what every partial edition in
 * `EditionPicker` will look like on the day it is added, and what an interrupted
 * vendoring run would look like tomorrow.
 */
test.describe("Hifth · wayfinding", () => {
  const pageNum = "header .numeric";

  test("the coach marks teach three verbs once, then never again", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: "كيف تتنقّل" });
    await expect(strip).toBeVisible();
    await expect(strip.getByText("المس آية")).toBeVisible();

    // The strip is in the layout, not over it: the ayah it talks about is
    // tappable while it is still on screen.
    await tapAyah(page, "#verse-55");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();

    await strip.getByText("التالي").tap();
    await expect(strip.getByText("اضغط واسحب")).toBeVisible();
    await strip.getByText("التالي").tap();
    await expect(strip.getByText("المس رقاقة")).toBeVisible();
    await strip.getByText("تمّ").tap();
    await expect(strip).toHaveCount(0);

    // Dismissed for good — a reload does not teach it again. (The reload
    // restores the selection from the hash, so its hop target's page is mounted
    // too: two page <svg>s, hence `.first()`.)
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "كيف تتنقّل" })).toHaveCount(0);
  });

  test("`/` opens the jumper and a jump lands like a link", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await expect(page.locator(pageNum)).toHaveText("7");

    await page.keyboard.press("/");
    const jumper = page.getByRole("dialog", { name: "اذهب إلى" });
    await expect(jumper).toBeVisible();

    // An empty field offers the thirty juz — "pick" works as well as "type".
    await expect(jumper.getByRole("button", { name: "الجزء ٩" })).toBeVisible();

    // 2:58 sits on page 9 (vendored). Enter takes the first reading.
    await jumper.getByRole("combobox").fill("2:58");
    await expect(jumper.getByRole("option").first()).toContainText("٢:٥٨");
    await page.keyboard.press("Enter");

    await expect(jumper).toHaveCount(0);
    await expect(page.locator(pageNum)).toHaveText("9");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٥٨/ }),
    ).toBeVisible();
    // The URL carries the new place — the jump went through the §7 state, not
    // around it.
    await expect(page).toHaveURL(/2:58/);
  });

  test("a jump to an un-vendored ayah is refused, not faked", async ({ browser }) => {
    // الفاتحة is on page 1, and page 1 arrived with Loop 4b — so the refusal it
    // used to demonstrate has to be manufactured now. Trimming page 1 out of the
    // manifest (`./inventory`) puts the jumper in front of an ayah the edition
    // does not carry, which is the only state this branch was ever for.
    //
    // Deleting the row instead would have been the tempting move and the wrong
    // one: an edition that carries part of the mus'haf is the *normal* case for
    // everything in `EditionPicker` that is not `hafs-kfqc`, and the promise the
    // app makes there — refuse out loud, never land on paper we do not have — is
    // exactly what would rot unwatched.
    const { context, page } = await contextWithout(browser, [1]);
    try {
      await page.goto("/");
      await expect(page.locator("svg[role='group']")).toBeVisible();

      await page.getByRole("button", { name: /اذهب إلى/ }).first().tap();
      const jumper = page.getByRole("dialog", { name: "اذهب إلى" });
      await jumper.getByRole("combobox").fill("الفاتحة");
      await jumper.getByRole("option").first().tap();

      await expect(jumper).toHaveCount(0);
      // We stay put and say so — no ghost page, no silent nearest-page landing.
      await expect(page.locator(pageNum)).toHaveText("7");
      await expect(page.locator("[aria-live='polite']")).toContainText(
        "الآية المطلوبة غير متوفّرة بعد",
      );
    } finally {
      await context.close();
    }
  });

  test("arrows turn pages, and stop honestly at the ends of the book", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // RTL: ArrowLeft goes forward, the way the pages turn. Consecutive leaves,
    // which is a thing this row could not say when the inventory was 7, 9, 19.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("8");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("9");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(pageNum)).toHaveText("8");

    // The ends are the *book's* ends now, not the inventory's. 604 is the last
    // leaf of the Madani print and 1 is the first, and a stepper that ran off
    // either would be asking for a page that does not exist in any edition —
    // the clamp that used to be tested against page 19 by accident.
    await page.getByRole("slider").fill("604");
    await expect(page.locator(pageNum)).toHaveText("604");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("604"); // no ghost page 605

    await page.getByRole("slider").fill("1");
    await expect(page.locator(pageNum)).toHaveText("1");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(pageNum)).toHaveText("1"); // no ghost page 0
  });

  test("a turn that steps over a page we do not have says where it landed", async ({ browser }) => {
    // `page-turning.md` §7 ④. Every turn in the three-page build crossed a gap,
    // so this row used to hold without arranging anything — and that was its
    // weakness as much as its convenience: it could not tell "the stepper names
    // the page it skipped" apart from "the stepper always says أقرب".
    //
    // Now the skip is the arranged thing and the plain turn is the default. With
    // page 8 trimmed out (`./inventory`), ArrowLeft from 7 must land on 9 *and*
    // say so; the row above, on the same key against a complete corpus, lands on
    // 8 saying nothing of the sort. Neither sentence can be produced by an
    // announcer that ignores the inventory.
    const { context, page } = await contextWithout(browser, [8]);
    try {
      await page.goto("/");
      await expect(page.locator("svg[role='group']")).toBeVisible();
      const said = page.locator("[aria-live='polite']");

      await page.keyboard.press("ArrowLeft");
      await expect(page.locator(pageNum)).toHaveText("9");
      await expect(said).toContainText("أقرب صفحة متوفّرة · صفحة 9");

      // The far end, where nothing moves at all. "Last available page" on its own
      // would tell a reader their arrow did nothing and leave them to guess where
      // they are, so it names the page too.
      await page.getByRole("slider").fill("604");
      await expect(page.locator(pageNum)).toHaveText("604");
      await page.keyboard.press("ArrowLeft");
      await expect(said).toContainText("آخر صفحة متوفّرة · صفحة 604");
      await expect(page.locator(pageNum)).toHaveText("604");

      // …and the near end, which is a different sentence for the same reason.
      await page.getByRole("slider").fill("1");
      await page.keyboard.press("ArrowRight");
      await expect(said).toContainText("أول صفحة متوفّرة · صفحة 1");
      await expect(page.locator(pageNum)).toHaveText("1");
    } finally {
      await context.close();
    }
  });

  test("the page keys turn from anywhere, and Escape lets go of the ayah", async ({ page }) => {
    // `page-turning.md` §7 ⑤. Rule 5 is right — a focused ayah keeps the arrows
    // for the ayah stepper — but tapping an ayah is this app's central gesture,
    // so a reader spends most of their time in a state that used to have no key
    // that turned a page and no key that got them out. Two exits, and this row
    // is both of them.
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await page.locator("#verse-55").focus();

    // The arrows still belong to the stepper: the premise, restated here so a
    // regression that handed them to the page turn fails on the next line
    // rather than passing by turning the page twice.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("7");

    // PageDown/PageUp are nobody else's. They name no direction either, so
    // unlike the arrows they need no RTL convention to be read correctly.
    await page.keyboard.press("PageDown");
    await expect(page.locator(pageNum)).toHaveText("8");
    await page.keyboard.press("PageUp");
    await expect(page.locator(pageNum)).toHaveText("7");

    // The other exit. Escape blurs the ayah, and the proof it worked is that
    // the *arrow* turns the page on the very next press — rule 6, reached
    // because `onAyah` is false again.
    await page.locator("#verse-55").focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("8");
  });

  test("an open sheet keeps the page keys, and Escape closes it rather than blurring", async ({
    page,
  }) => {
    // Rule 3 over rule 5 (`keymap.ts`). A page turn under an open sheet moves
    // the ground the reader is standing on, and Escape with something in front
    // of you means "close this" — a reader who pressed it twice would expect to
    // close the sheet and then let go of the ayah, in that order.
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await page.locator("#verse-55").focus();
    await page.keyboard.press("/");
    const jumper = page.getByRole("dialog", { name: "اذهب إلى" });
    await expect(jumper).toBeVisible();

    await page.keyboard.press("PageDown");
    await expect(page.locator(pageNum)).toHaveText("7");
    await expect(jumper).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(jumper).toHaveCount(0);
    await expect(page.locator(pageNum)).toHaveText("7");
  });

  test("an ayah with focus keeps the arrows; `/` still opens the jumper", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // Loop 3 gives a focused polygon the arrows (ayah-to-ayah). The page-turn
    // map must not steal them — precedence, not a race.
    await page.locator("#verse-55").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("7");

    // …but the jumper is reachable from anywhere, which is the point of `/`.
    await page.keyboard.press("/");
    await expect(page.getByRole("dialog", { name: "اذهب إلى" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "اذهب إلى" })).toHaveCount(0);
  });

  test("the mushaf picker shows what exists and why the rest does not", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // `exact`, because a role name match is a substring match by default and the
    // page chip beside this button is now «صفحة 7 · ما فتحتَه من المصحف» — which
    // contains this whole name. Two controls in one row can share a word.
    await page.getByRole("button", { name: "المصحف", exact: true }).tap();
    const sheet = page.getByRole("dialog", { name: "المصحف", exact: true });
    await expect(sheet).toBeVisible();

    await expect(sheet.getByText("الحالي")).toBeVisible();
    await expect(sheet.getByText("ترخيصها غير تجاري — تحتاج إذنًا قبل إضافتها").first()).toBeVisible();
    // Surfaced but disabled — never a ghost, never an offer we cannot keep.
    const rows = sheet.getByRole("button", { name: /رواية|حفص|ورش|قالون/ });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(rows.nth(i)).toBeDisabled();
  });
});

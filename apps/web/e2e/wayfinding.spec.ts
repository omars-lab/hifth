import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

/*
 * Loop 6a — wayfinding: getting anywhere, and knowing where you are.
 *
 * Three vendored pages today (7, 9, 19 — all in البقرة), which is enough to
 * prove every claim here: paging walks the pages that exist, the jumper lands
 * through the same restore path a link uses, and a target that is not vendored
 * is refused out loud rather than faked.
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

  test("a jump to an un-vendored ayah is refused, not faked", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    await page.getByRole("button", { name: /اذهب إلى/ }).first().tap();
    const jumper = page.getByRole("dialog", { name: "اذهب إلى" });
    await jumper.getByRole("combobox").fill("الفاتحة");
    await jumper.getByRole("option").first().tap();

    await expect(jumper).toHaveCount(0);
    // Page 1 is not vendored yet: we stay put and say so.
    await expect(page.locator(pageNum)).toHaveText("7");
    await expect(page.locator("[aria-live='polite']")).toContainText(
      "الآية المطلوبة غير متوفّرة بعد",
    );
  });

  test("arrows turn pages, and stop honestly at the last vendored one", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // RTL: ArrowLeft goes forward, the way the pages turn.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("9");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("19");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("19"); // no ghost page 20
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(pageNum)).toHaveText("9");
  });

  test("a turn that steps over a page we do not have says where it landed", async ({ page }) => {
    // `page-turning.md` §7 ④. Every turn in this build crosses a gap — 7 → 9
    // steps over page 8, 9 → 19 over nine more — so a turn that announced only
    // "Page 9" would be the interface papering over the exact thing the vendored
    // corpus must never hide. The scrubber has said this since Loop 6a; the
    // stepper said nothing, and that is what this row is here to keep fixed.
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    const said = page.locator("[aria-live='polite']");

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("9");
    await expect(said).toContainText("أقرب صفحة متوفّرة · صفحة 9");

    // The far end, where nothing moves at all. "Last available page" on its own
    // would tell a reader their arrow did nothing and leave them to guess where
    // they are — with three pages of 604, a guess they will get wrong.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("19");
    await page.keyboard.press("ArrowLeft");
    await expect(said).toContainText("آخر صفحة متوفّرة · صفحة 19");
    await expect(page.locator(pageNum)).toHaveText("19");

    // …and the near end, which is a different sentence for the same reason.
    await page.getByRole("slider").fill("7");
    await page.keyboard.press("ArrowRight");
    await expect(said).toContainText("أول صفحة متوفّرة · صفحة 7");
    await expect(page.locator(pageNum)).toHaveText("7");
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
    await expect(page.locator(pageNum)).toHaveText("9");
    await page.keyboard.press("PageUp");
    await expect(page.locator(pageNum)).toHaveText("7");

    // The other exit. Escape blurs the ayah, and the proof it worked is that
    // the *arrow* turns the page on the very next press — rule 6, reached
    // because `onAyah` is false again.
    await page.locator("#verse-55").focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("9");
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

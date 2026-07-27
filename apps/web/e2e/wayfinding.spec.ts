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

    await page.getByRole("button", { name: "المصحف" }).tap();
    const sheet = page.getByRole("dialog", { name: "المصحف" });
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

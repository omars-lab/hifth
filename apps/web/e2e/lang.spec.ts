import { test, expect } from "@playwright/test";
import { LANG_STORAGE_KEY } from "../src/lang";

/*
 * The chrome speaks English, and the mus'haf still reads right to left.
 *
 * This is the half of the i18n feature that unit tests cannot reach. `i18n.test`
 * proves the bundles are complete and that the credits stay Arabic; what it
 * cannot prove is the thing the reader actually experiences — that flipping the
 * language moves the *document*, that the choice survives a reload, and above
 * all that the parts of the app which are about scripture do **not** flip with
 * it. The stage, the hop rail and the trail are pinned `dir="rtl"` in both
 * languages, and a stylesheet built entirely from logical properties is exactly
 * the kind of thing where "the chrome flips" quietly becomes "everything
 * flips": one inherited `dir` and the rail moves to the wrong thumb, the page
 * turns the wrong way, and every assertion here would still pass if it only
 * checked the words.
 *
 * `test.use({ locale: "en-US" })` is the whole setup. The config pins the suite
 * to `ar` (see playwright.config.ts and why), so this file is the one place the
 * English path exists, and the app is reached the way a reader with an English
 * phone reaches it: by opening it.
 */

test.use({ locale: "en-US" });

test.describe("Hifth · language", () => {
  test("an English phone opens an English chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // The document is the load-bearing half: `lang` decides which voice a
    // screen reader uses, and getting it wrong reads English through an Arabic
    // synthesiser — the failure nobody sees in a screenshot.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await expect(page.getByRole("button", { name: /About Hifth/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Go to/ })).toBeVisible();
    await expect(page.locator("header")).toContainText("Page");

    // The wordmark speaks English too. It used to be pinned to «حفظ · مِلاحة
    // للحُفّاظ» in both languages — a decision this feature reverses, because the
    // wordmark is chrome and the note under the language switch already promises
    // only the mus'haf and the verse text stay Arabic. The name is a name, so
    // the English is its transliteration — the same "Hifth" the colophon uses in
    // prose — not a translation. `.mark` is `aria-hidden`, so it is reached by
    // text rather than by role; the About button above already carries the name
    // to a screen reader.
    const brand = page.getByRole("button", { name: /About Hifth/ });
    await expect(brand).toContainText("Hifth");
    await expect(brand).toContainText("Navigation for huffaz");
    // And it is not the Arabic wordmark hiding behind an English chrome.
    await expect(page.locator("header")).not.toContainText("حفظ");
  });

  test("the mus'haf, the rail, the trail and the page bar stay right-to-left", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // Pinned in the markup, and — because a logical-property stylesheet reads
    // the *computed* direction — asserted as the browser resolved it, not as
    // the attribute was written. The page bar is in this list for a reason a
    // reader would feel immediately: its track runs the length of the mus'haf,
    // so a flip would put page 1 on the left and send every drag the wrong way
    // through the book.
    for (const selector of ["main", "footer", "nav[aria-label='Page bar']"]) {
      const dir = await page
        .locator(selector)
        .first()
        .evaluate((el) => getComputedStyle(el).direction);
      expect(dir, `${selector} must stay RTL under an English chrome`).toBe("rtl");
    }

    // The header is the part that moved.
    const header = await page
      .locator("header")
      .evaluate((el) => getComputedStyle(el).direction);
    expect(header).toBe("ltr");
  });

  test("the page-turn convention does not flip with the chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // The same page numbers `wayfinding.spec.ts` asserts under the Arabic
    // chrome, on the same key presses. Loop 1's decision: the mus'haf is read
    // right to left, so ArrowLeft is the *next* page — in both languages. A
    // hafiz whose phone happens to be in English must not find the book running
    // backwards. The digits are Latin here and Arabic-Indic there, which is why
    // this is a second assertion rather than a locale parameter on the first.
    const pageNum = "header .numeric";
    await expect(page.locator(pageNum)).toHaveText("7");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(pageNum)).toHaveText("8");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(pageNum)).toHaveText("7");
  });

  test("the switch is in the colophon, and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /About Hifth/ }).tap();

    const sheet = page.getByRole("dialog", { name: /About Hifth/ });
    await expect(sheet).toBeVisible();
    // Both languages are offered by name, each in its own script — a reader who
    // cannot read the current chrome can still find the one they can.
    await expect(sheet.getByRole("radio", { name: "English" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await sheet.getByRole("radio", { name: /العربية/ }).tap();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("dialog", { name: "عن حِفظ" })).toBeVisible();

    // A decision outranks the device, and it has to outlive the tab: the whole
    // point of storing it is that a reader chooses once.
    expect(await page.evaluate((k) => localStorage.getItem(k), LANG_STORAGE_KEY)).toBe("ar");
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("button", { name: /عن حِفظ/ })).toBeVisible();
  });

  test("the licence credits are not translated", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /About Hifth/ }).tap();
    const sheet = page.getByRole("dialog", { name: /About Hifth/ });
    await expect(sheet).toBeVisible();

    // `gate:license-copy` binds these to SOURCES.md byte-for-byte. The English
    // sheet shows them exactly as the Arabic one does, because an attribution
    // that changes with the reader is not an attribution that was made.
    await expect(sheet.getByText("المتشابهات")).toBeVisible();
    await expect(sheet.getByText("استعمال حرّ مع ذكر المصدر")).toBeVisible();
    await expect(sheet.locator("a[href='http://corpus.quran.com']")).toBeVisible();
  });

  test("the jumper answers to a romanised name and to an Arabic one", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await page.getByRole("button", { name: /^Go to/ }).tap();

    const field = page.getByRole("combobox");
    // A hafiz reading English chrome still knows the surah as البقرة, and one
    // on a laptop with no Arabic layout types "baqarah". Both must land.
    await field.fill("baqarah");
    await expect(page.getByRole("option").first()).toContainText("Al-Baqarah");

    await field.fill("البقرة");
    await expect(page.getByRole("option").first()).toContainText("Al-Baqarah");
  });
});

import { test, expect, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * A button that shows a word says that word when it is named aloud. A reader
 * who drives the iPad by voice says what they see ("tap Same roots"), and a
 * screen reader reads the name to someone who may also see the word; a name
 * that never says the word it shows finds nothing for the first and reads a
 * different word to the second (plan item 110). Walked on the verse's tools,
 * where every button carries a word under its sign, in both languages, on a
 * computer and on both phones.
 */

/** The words of a string, without the marks between them, for a fair compare. */
function words(s: string): string {
  return s
    .replace(/[…:·،,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function openTools(page: Page): Promise<void> {
  await page.addInitScript((coach) => {
    try {
      localStorage.setItem(coach, "1");
    } catch {
      /* private mode */
    }
  }, COACH_STORAGE_KEY);
  await page.goto("/#/hafs-kfqc/8:3");
  // The pitch build opens the verse's note a moment after the page; it is
  // waited for and closed, or it rises over the tools after the Escape.
  if (test.info().project.name === "pitch") {
    const note = page.getByRole("region", { name: /^(Commentary|التفسير)$/ });
    await expect(note).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(note).toHaveCount(0);
    return;
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: /^(Tools for |أدوات )/ })).toBeVisible();
}

for (const locale of ["en-US", "ar"] as const) {
  test.describe(`Hifth · the verse's tools say the words they show (${locale})`, () => {
    test.use({ locale });

    test("every button on the verse's tools is named with the word under its sign", async ({ page }) => {
      await openTools(page);
      const tools = page.getByRole("region", { name: /^(Tools for |أدوات )/ });
      const pairs = await tools.locator("button:has([data-caption]), a:has([data-caption])").evaluateAll((els) =>
        els
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map((e) => ({
            shown: e.querySelector("[data-caption]")?.textContent ?? "",
            name: e.getAttribute("aria-label") ?? e.textContent ?? "",
          })),
      );
      expect(pairs.length, "the verse's tools show their words").toBeGreaterThan(2);
      const missing = pairs.filter((p) => !words(p.name).includes(words(p.shown)));
      expect(
        missing.map((p) => `"${p.shown}" is named "${p.name}"`),
        "each button's spoken name holds the word it shows",
      ).toEqual([]);
    });

    test("every named button on the screen says the words it shows", async ({ page }) => {
      // The bars around the page too: the switch for one or two pages showed a
      // word its Arabic name never said, and the app's name in the corner was
      // named without the line it shows (plan item 111). A sign with no letters
      // (+, −, ⌖) is not a word anyone says.
      await openTools(page);
      const pairs = await page
        .locator("button[aria-label], a[aria-label], [role=button][aria-label], [role=menuitem][aria-label]")
        .evaluateAll((els) => {
          const seen = (n: Node): string => {
            if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
            if (!(n instanceof Element) || n.getAttribute("aria-hidden") === "true") return "";
            if (getComputedStyle(n).display === "none") return "";
            return [...n.childNodes].map(seen).join(" ");
          };
          return els
            .filter((e) => e.getBoundingClientRect().width > 0 && !e.closest("[aria-hidden=true]"))
            .map((e) => ({ shown: seen(e), name: e.getAttribute("aria-label") ?? "" }))
            .filter((p) => /\p{L}/u.test(p.shown));
        });
      expect(pairs.length, "the screen shows named buttons with words").toBeGreaterThan(5);
      const missing = pairs.filter((p) => !words(p.name).includes(words(p.shown)));
      expect(
        missing.map((p) => `"${words(p.shown)}" is named "${p.name}"`),
        "each button's spoken name holds the words it shows",
      ).toEqual([]);
    });
  });
}

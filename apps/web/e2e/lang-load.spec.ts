import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * A reader downloads the interface text of their own language, and not the other.
 *
 * The English and Arabic interface text used to ride in the start-up code
 * together, so every reader paid for a language they would never see (about
 * 5 KB compressed each). Each language is now its own file, fetched before the
 * first paint for the language the reader opens in, and the other one only
 * when the reader switches to it.
 *
 * Checked in a real browser because the question is what crosses the wire:
 * every script the page loads is read, and the other language's words must
 * not be in any of them. A long catalog-only sentence is the marker, so a
 * short word shared with some other part of the app cannot confuse it.
 */

const marker = (id: "ar" | "en"): string => {
  const catalog = JSON.parse(
    readFileSync(new URL(`../src/messages/${id}.json`, import.meta.url), "utf8"),
  ) as { aboutCaveat: string };
  return catalog.aboutCaveat;
};
const MARKER = { ar: marker("ar"), en: marker("en") };

/** Every script body the page loads from now on. */
function collectScripts(page: Page): string[] {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    try {
      bodies.push(await res.text());
    } catch {
      /* a response the page abandoned; nothing to read */
    }
  });
  return bodies;
}

async function openAndSettle(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("Hifth · only the reader's language is downloaded", () => {
  test.describe("an Arabic phone", () => {
    test.use({ locale: "ar" });

    test("gets the Arabic interface text and none of the English", async ({ page }) => {
      const scripts = collectScripts(page);
      await openAndSettle(page);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      expect(scripts.some((s) => s.includes(MARKER.ar))).toBe(true);
      expect(scripts.some((s) => s.includes(MARKER.en))).toBe(false);
    });
  });

  test.describe("an English phone", () => {
    test.use({ locale: "en-US" });

    test("gets the English interface text and none of the Arabic", async ({ page }) => {
      const scripts = collectScripts(page);
      await openAndSettle(page);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("button", { name: /About Hifth/ })).toBeVisible();
      expect(scripts.some((s) => s.includes(MARKER.en))).toBe(true);
      expect(scripts.some((s) => s.includes(MARKER.ar))).toBe(false);
    });

    test("asks for its language before the app's code has run", async ({ page }) => {
      // Fetching the language only once the app's code is running would add a
      // whole extra round trip before the first paint, which on a slow phone
      // costs more than the bytes saved. So the page names the file up front.
      await page.goto("/");
      const preloads = await page
        .locator("link[rel='modulepreload']")
        .evaluateAll((links) => links.map((l) => (l as HTMLLinkElement).href));
      expect(preloads.some((href) => /\/en\b[^/]*\.js$/.test(href))).toBe(true);
      expect(preloads.some((href) => /\/ar\b[^/]*\.js$/.test(href))).toBe(false);
    });
  });
});

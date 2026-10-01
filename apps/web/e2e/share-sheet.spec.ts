import { test, expect, type Page } from "@playwright/test";

/**
 * The share sheet's link builder (decision share-sheet-builder). Three shapes
 * are built into the app and picked by `?share=a|b|c` in the address, so the
 * decision page can mount all three; C is what the app shows when the address
 * names none. This is the phone test the item asked for: it runs on the two
 * phone projects.
 *
 * What is caught, not what is shown: a headless browser has no share sheet and
 * no clipboard a test can read, so both are replaced before the page loads.
 * `navigator.share` is removed, which is what a desktop browser looks like and
 * sends the sheet down its copy path; the clipboard keeps what was written.
 */
async function catchClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & { __copied?: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (s: string) => void w.__copied!.push(s) },
      configurable: true,
    });
  });
}

const copied = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as Window & { __copied?: string[] }).__copied ?? []);

const siteLink = (page: Page, hash: string): string => {
  const u = new URL(page.url());
  return u.origin + u.pathname + hash;
};

test.describe("Hifth · the share sheet builds a link", () => {
  test("shape C: say what opens with it, then copy the app link or share the website link", async ({ page }) => {
    await catchClipboard(page);
    await page.goto("/?share=c&lang=en#/hafs-kfqc/2:48");
    const share = page.getByRole("button", { name: "Share this ayah as a link" });
    await expect(share).toBeVisible();
    await share.click();

    const sheet = page.getByRole("dialog", { name: "Share this ayah as a link" });
    await expect(sheet).toBeVisible();
    // The verse it is about stays on the page, unlit by any scrim: the sheet
    // sits at the bottom, where the drawer was.
    await expect(sheet.getByRole("radio", { name: "The ayah as it is" })).toBeChecked();
    await sheet.getByRole("radio", { name: "Its look-alikes" }).check();

    await sheet.getByRole("button", { name: "Copy the app link" }).click();
    await expect.poll(() => copied(page)).toEqual(["hifth:///hafs-kfqc/2:48?open=lookalikes"]);
    await expect(sheet.getByRole("status")).toHaveText("Link copied");

    await sheet.getByRole("button", { name: "Share the website link" }).click();
    await expect.poll(() => copied(page)).toEqual([
      "hifth:///hafs-kfqc/2:48?open=lookalikes",
      siteLink(page, "#/hafs-kfqc/2:48?open=lookalikes"),
    ]);

    // Escape puts the sheet away and leaves the verse lit.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(share).toBeVisible();
  });

  test("the tray lifts the verse it shares clear of itself, every line of it", async ({ page }) => {
    // Owner, 2026-09-30, choosing C: "keep the verse visible". 2:48 sits low on
    // page 7, and C's tray — the question and the two links — rose over most of
    // it: the reader was asked what to send with the verse hidden behind the
    // asking. The page moves up, as it does for the commentary note.
    //
    // The iPhone's install notice is put away first, as a reader does once:
    // with it showing too, the room left between the hop chips and the tray is
    // shorter than the verse, and the page then keeps its first line in sight
    // under the chips rather than its last line clear of the tray.
    await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
    await page.goto("/?lang=en#/hafs-kfqc/2:48");
    await page.getByRole("button", { name: "Share this ayah as a link" }).click();
    const sheet = page.getByRole("dialog", { name: "Share this ayah as a link" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio")).not.toHaveCount(0);
    const trayTop = async () => (await sheet.boundingBox())!.y;
    const lowestLine = async () =>
      page.evaluate(() =>
        Math.max(
          ...[...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")].map(
            (el) => el.getBoundingClientRect().bottom,
          ),
        ),
      );
    await expect
      .poll(async () => (await lowestLine()) <= (await trayTop()), {
        message: "the verse's last line is above the tray",
        timeout: 5_000,
      })
      .toBe(true);

    // Put away, the tray gives the room back: the lift goes with it.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("shape B: the two links and no questions", async ({ page }) => {
    await catchClipboard(page);
    await page.goto("/?share=b&lang=en#/hafs-kfqc/2:48");
    await page.getByRole("button", { name: "Share this ayah as a link" }).click();
    const sheet = page.getByRole("dialog", { name: "Share this ayah as a link" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Copy the app link" }).click();
    await expect.poll(() => copied(page)).toEqual(["hifth:///hafs-kfqc/2:48"]);
  });

  test("shape A: one tap, the website link, as the app did before", async ({ page }) => {
    await catchClipboard(page);
    await page.goto("/?share=a&lang=en#/hafs-kfqc/2:48");
    await page.getByRole("button", { name: "Share this ayah as a link" }).click();
    await expect(page.getByRole("dialog", { name: "Share this ayah as a link" })).toHaveCount(0);
    await expect.poll(() => copied(page)).toEqual([siteLink(page, "#/hafs-kfqc/2:48")]);
  });
});

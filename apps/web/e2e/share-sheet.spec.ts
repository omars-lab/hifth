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

test.describe("Hifth · the share card on a phone held sideways", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  for (const [lang, shareName, dialogName] of [
    ["en", "Share this ayah as a link", "Share this ayah as a link"],
    ["ar", "شارك", "شارك"],
  ] as const) {
    test(`held sideways (${lang}), the share card covers no line of the verse it shares, and the look-alike buttons cover none either`, async ({ page }) => {
      // Sideways the phone is wide enough for the card to stand in a corner, as
      // on a laptop, but not tall enough to be a laptop: the page stayed where
      // it was and the card lay over half of the verse, with the look-alike
      // buttons half showing from behind its edge. Moved to the corner the
      // card leaves free, the buttons kept a band over the page so tall that
      // the verse's last line ran off the foot of the page. They now ride the
      // card's own top row, clear of its close button (plan item 38). The card
      // also ran up over the foot of the top bar, cutting its buttons; it now
      // stands below the bar and keeps every one of its own buttons in sight
      // (plan item 42).
      await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
      await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
      await page.getByRole("button", { name: shareName }).first().click();
      const sheet = page.getByRole("dialog", { name: dialogName });
      await expect(sheet).toBeVisible();
      await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const seen = () =>
        page.evaluate(() => {
          const card = document.querySelector("[role=dialog]")!.getBoundingClientRect();
          const stage = document.querySelector("#hifth-overlay")!.closest("[class*=stage]")!.getBoundingClientRect();
          const hit = (r: DOMRect, s: DOMRect) =>
            r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top;
          const lines = [...document.querySelectorAll("#hifth-overlay .hl-sel")].map((el) => el.getBoundingClientRect());
          const chips = [...document.querySelectorAll("button[data-direction]")].map((el) => el.getBoundingClientRect());
          const cardButtons = [...document.querySelectorAll("[role=dialog] button")].map((el) => el.getBoundingClientRect());
          return {
            lines: lines.length,
            underCard: lines.filter((l) => hit(l, card)).length,
            offTheFoot: lines.filter((l) => l.bottom > stage.bottom + 1).length,
            underChips: lines.filter((l) => chips.some((c) => hit(l, c))).length,
            chipsBehindCard: chips.filter((c) => hit(c, card) && !(c.top >= card.top && c.bottom <= card.bottom && c.left >= card.left && c.right <= card.right)).length,
            chipsOnCardButtons: chips.filter((c) => cardButtons.some((b) => hit(c, b))).length,
            cardOverTopBar: Math.max(0, Math.round(document.querySelector("header[class*=chrome]")!.getBoundingClientRect().bottom - card.top)),
            cardButtonsCut: cardButtons.filter((b) => b.top < card.top || b.bottom > card.bottom || b.bottom > innerHeight).length,
          };
        });
      const whole = { lines: 2, underCard: 0, offTheFoot: 0, underChips: 0, chipsBehindCard: 0, chipsOnCardButtons: 0, cardOverTopBar: 0, cardButtonsCut: 0 };
      await expect.poll(seen, { message: "every line of the verse shows, and every button shows whole", timeout: 5_000 }).toEqual(whole);
      // And stays so once the page has come to rest: a later move put the
      // verse's last line back off the foot after it had first shown whole.
      await page.waitForTimeout(800);
      expect(await seen(), "the page moved the verse off its foot after first showing it whole").toEqual(whole);
    });
  }
});

for (const [held, width, height] of [
  ["a large iPad", 1024, 1366],
  ["an iPad mini", 744, 1133],
] as const) {
  test.describe(`Hifth · the share card on ${held} held upright`, () => {
    test.use({ viewport: { width, height } });

    for (const [lang, shareName] of [
      ["en", "Share this ayah as a link"],
      ["ar", "شارك"],
    ] as const) {
      test(`upright (${lang}), the share card covers no line of the verse it shares, and none of the buttons under it`, async ({ page }) => {
        // Upright and this wide, the card stands in the corner above the page's
        // foot, not across it as on a phone, so it never said where it starts,
        // and on its side it would have moved the page aside: told nothing,
        // the page left the verse under it, its first word included (plan
        // item 40). Narrower than a laptop, it also stood at the window's foot,
        // over the row of tools it opens from (plan item 41).
        await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
        await page.goto(`/?lang=${lang}#/hafs-kfqc/2:48`);
        await page.getByRole("button", { name: shareName }).first().click();
        const sheet = page.getByRole("dialog", { name: shareName });
        await expect(sheet).toBeVisible();
        await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
        const seen = () =>
          page.evaluate(() => {
            const card = document.querySelector("[role=dialog]")!.getBoundingClientRect();
            const stage = document.querySelector("#hifth-overlay")!.closest("[class*=stage]")!.getBoundingClientRect();
            const lines = [...document.querySelectorAll("#hifth-overlay .hl-sel")].map((el) => el.getBoundingClientRect());
            return {
              lines: lines.length > 0,
              underCard: lines.filter((l) => l.left < card.right && l.right > card.left && l.top < card.bottom && l.bottom > card.top).length,
              offTheStage: lines.filter((l) => l.top < stage.top - 1 || l.bottom > stage.bottom + 1).length,
              buttonsUnderCard: [...document.querySelectorAll("button")]
                .filter((b) => !b.closest("[role=dialog]"))
                .map((b) => b.getBoundingClientRect())
                .filter((r) => r.width > 0 && r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top).length,
            };
          });
        const whole = { lines: true, underCard: 0, offTheStage: 0, buttonsUnderCard: 0 };
        await expect.poll(seen, { message: "every line of the verse and every button shows, clear of the card", timeout: 5_000 }).toEqual(whole);
        await page.waitForTimeout(800);
        expect(await seen(), "the page moved the verse under the card after first showing it clear").toEqual(whole);
      });
    }
  });
}

import { test, expect, type Locator, type Page } from "@playwright/test";

// On a wide screen the note, the lists and the small sheets stand as cards
// clear of the screen's foot, so the room a sheet keeps for an iPad's home bar
// is only a blank strip under a card's last row (walked in the iPad app on its
// side, 2026-10-13: 44 points under the look-alike list's last row). No browser
// had shown it, because a headless browser reports the home bar's room as
// nothing; Chromium can be told to report one, which is what this does. A sheet
// still across the foot of a narrow screen keeps the room, so the bar never
// sits on its last row.

async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await target.boundingBox());
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
}

// The room the sheet leaves under its last row, with no home bar and then with
// a 20-point one, as an iPad has.
async function footRoom(page: Page, card: Locator): Promise<[number, number]> {
  const read = () => card.evaluate((e) => parseFloat(getComputedStyle(e).paddingBlockEnd));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 0, bottomMax: 0 } });
  const none = await read();
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 20, bottomMax: 20 } });
  const bar = await read();
  return [none, bar];
}

const CARDS: Record<string, string> = {
  "the go-to sheet": "/#/hafs-kfqc/p19?open=jump",
  "about the app": "/#/hafs-kfqc/p19?open=about",
  "the choice of mus'haf": "/#/hafs-kfqc/p19?open=editions",
  "a verse's look-alike list": "/#/hafs-kfqc/10:15?open=lookalikes",
  "a verse's roots list": "/#/hafs-kfqc/2:255?open=roots",
};

test.describe("Hifth · a card standing clear of the screen's foot", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "only Chromium can be told there is a home bar");

  for (const [name, at] of Object.entries(CARDS)) {
    test(`${name} keeps no home-bar room under its last row on a wide screen`, async ({ page }) => {
      await page.goto(at);
      const card = page.locator("[role=dialog]:visible").last();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await settle(card);
      const [none, bar] = await footRoom(page, card);
      expect(none).toBeGreaterThan(0);
      expect(bar, "the card's room under its last row grew by the home bar's").toBe(none);
    });
  }

  test("a sheet across the foot of a phone still keeps the home bar's room", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CARDS["the go-to sheet"]!);
    const card = page.locator("[role=dialog]:visible").last();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await settle(card);
    const [none, bar] = await footRoom(page, card);
    expect(bar - none).toBe(20);
  });
});

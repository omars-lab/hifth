import { test, expect, type Locator, type Page } from "@playwright/test";

// A link can open a panel on arrival (`?open=`), so a test, a checks-guide
// step or a teacher can land in the revision record or the go-to sheet without
// clicking their way there. Owner, 2026-09-28: "there should be anchors and url
// params to enter app in certain mode, on certain page … our tests should use
// this too". The names are the ones in docs/query-params.md.

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

const PANELS: Record<string, (page: Page) => Locator> = {
  jump: (p) => p.getByRole("dialog", { name: "اذهب إلى" }),
  about: (p) => p.getByRole("dialog", { name: "عن حِفظ" }),
  record: (p) => p.getByRole("dialog", { name: "ما فتحتَه من المصحف" }),
  key: (p) => p.getByRole("dialog", { name: "مفتاح ألوان التجويد" }),
  editions: (p) => p.getByRole("dialog", { name: "المصحف" }),
  tips: (p) => p.getByRole("region", { name: "كيف تتنقّل" }),
};

test.describe("Hifth · a link that opens a panel", () => {
  for (const [name, panel] of Object.entries(PANELS)) {
    test(`?open=${name} opens it on arrival, on the page the link names`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/p19?open=${name}`);
      await expect(panel(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('svg[aria-labelledby="page-label-19"]:visible')).toBeVisible();
    });
  }

  test("?open=shelf opens the record at juz scope, where the offline shelf is", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p1?open=shelf");
    const sheet = PANELS.record!(page);
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("radio", { name: "جزء" })).toBeChecked();
  });

  // The verse's own sheets wait for the verse: its look-alikes and roots load
  // after it is selected, and selecting a verse closes whatever roots sheet was
  // up. The screen-reader check in the guide opens its look-alike list this way.
  test("?open=lookalikes opens the verse's look-alike list once it has loaded", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
    await expect(page.getByRole("dialog", { name: /^متشابهات/ })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/#\/hafs-kfqc\/2:48$/);
  });

  // Nothing was pressed, so nothing wears a focus ring: not the close button
  // (walking a phone held sideways, 2026-10-09), and not the list itself.
  test("?open=lookalikes draws no focus ring", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
    const list = page.getByRole("dialog", { name: /^متشابهات/ });
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list).toBeFocused();
    await expect(list).toHaveCSS("outline-style", "none");
  });

  // The look-alike list rose over the foot of the page and the verse it is
  // about stayed under it, on an iPad held upright and on a phone; a note on
  // the same screen slid its verse up clear (walking the iPad app, 2026-10-08).
  for (const [held, size] of [
    ["an iPad held upright", { width: 1024, height: 1366 }],
    ["a phone", { width: 390, height: 844 }],
  ] as const) {
    test(`?open=lookalikes on ${held} leaves the verse above the list`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
      const list = page.getByRole("dialog", { name: /^متشابهات/ });
      await expect(list).toBeVisible({ timeout: 20_000 });
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const lines = page.locator("#hifth-overlay .hl-sel");
      await settle(lines.first());
      const top = (await list.boundingBox())!.y;
      const bottoms = await lines.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().bottom));
      expect(bottoms.length).toBeGreaterThan(0);
      for (const bottom of bottoms) expect(bottom, "a line of the verse is under the list").toBeLessThanOrEqual(top);
    });
  }

  test("?open=roots opens the verse's roots", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=roots");
    await expect(page.getByRole("dialog", { name: /^الجذور، / })).toBeVisible({ timeout: 20_000 });
  });

  test("a verse sheet on a link with no verse opens nothing", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p19?open=lookalikes");
    await expect(page.locator('svg[aria-labelledby="page-label-19"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the address lets go of the panel once it is open", async ({ page }) => {
    // Sharing the page after closing the panel must not send the next person
    // a panel they did not ask for.
    await page.goto("/#/hafs-kfqc/2:48?open=about");
    await expect(PANELS.about!(page)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/#\/hafs-kfqc\/2:48$/);
  });

  test.describe("?tool=", () => {
    test.use({ locale: "en-US" });

    // The tool that is on, said where each layout says it: the computer's bar
    // checks its radio, the phone's closed bar names it on its button.
    const toolOn = (page: Page, isMobile: boolean, name: string): Locator =>
      isMobile
        ? page.locator('[data-phone-bar="c"]').getByRole("button", { name: `Page tools · ${name} is on` })
        : page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio", { name, exact: true, checked: true });

    test("puts the tool in hand on arrival, named by its button's word", async ({ page, isMobile }) => {
      await page.goto("/#/hafs-kfqc/2:48?tool=harakat");
      await expect(toolOn(page, isMobile, "Harakat")).toBeVisible({ timeout: 20_000 });
      // The address lets go of it, as it does of a panel.
      await expect(page).toHaveURL(/#\/hafs-kfqc\/2:48$/);
    });

    test("a tool the app does not have leaves Select in hand", async ({ page, isMobile }) => {
      await page.goto("/#/hafs-kfqc/p7?tool=sign");
      await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toBeVisible({ timeout: 20_000 });
      await expect(toolOn(page, isMobile, "Select")).toBeVisible();
    });
  });

  test("?view=one closes the book to one page on a computer", async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone always shows one page; there is nothing to choose");
    await page.goto("/#/hafs-kfqc/p7?view=one");
    await expect(page.getByRole("radio", { name: "صفحة واحدة" })).toHaveAttribute("aria-checked", "true", {
      timeout: 20_000,
    });
    await expect(page.locator('svg[aria-labelledby="page-label-7"]:visible')).toBeVisible();
    await expect(page.locator('svg[aria-labelledby="page-label-6"]:visible')).toHaveCount(0);
    await expect(page).toHaveURL(/#\/hafs-kfqc\/p7$/);
  });

  test("a panel the app does not have still opens the verse", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p19?open=nope");
    await expect(page.locator('svg[aria-labelledby="page-label-19"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

// The picker lists mus'hafs the site cannot show yet, and a link can name one
// of them, or a name nobody knows. The site has no caller to answer with a
// refusal, as the Mac and iPad app does, so it shows the mus'haf it ships and
// makes the address say so: a link passed on from here stops lying.
test.describe("Hifth · a link naming a mus'haf the site does not have", () => {
  // Page 1 on purpose: it is the page the app opens on, so nothing moves the
  // view for this link, and the address used to keep the name the link gave.
  test("a page opens in the mus'haf the site ships, and the address says which", async ({ page }) => {
    await page.goto("/#/warsh-libya/p1");
    await expect(page.locator('svg[aria-labelledby="page-label-1"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/#\/hafs-kfqc\/p1$/);
  });

  test("a verse in an unknown mus'haf is selected in the one it ships", async ({ page }) => {
    await page.goto("/#/nope/2:255");
    await expect(page.locator('svg[aria-labelledby="page-label-42"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/#\/hafs-kfqc\/2:255$/);
  });
});

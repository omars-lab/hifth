import { test, expect, type Locator, type Page } from "@playwright/test";

// A link can open a panel on arrival (`?open=`), so a test, a checks-guide
// step or a teacher can land in the revision record or the go-to sheet without
// clicking their way there. Owner, 2026-09-28: "there should be anchors and url
// params to enter app in certain mode, on certain page … our tests should use
// this too". The names are the ones in docs/query-params.md.

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

  test("?open=roots opens the verse's roots", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=roots");
    await expect(page.getByRole("dialog", { name: /^الجذور · / })).toBeVisible({ timeout: 20_000 });
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

  test("a panel the app does not have still opens the verse", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p19?open=nope");
    await expect(page.locator('svg[aria-labelledby="page-label-19"]:visible')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

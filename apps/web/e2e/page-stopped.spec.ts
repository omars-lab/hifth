import { expect, test } from "@playwright/test";

/*
 * Launch item 15, in the built page. A part of the page that throws while it
 * draws used to blank the whole screen. Here the list of pages the app reads at
 * start-up arrives in a shape the page cannot use, so drawing throws; the
 * reader must see the stopped screen and its button, not an empty page.
 *
 * The service worker is blocked so the broken answer is the one the page gets.
 */
test.use({ serviceWorkers: "block" });

test("a page that throws while drawing shows the stopped screen, not a blank one", async ({ page }) => {
  await page.route("**/assets/manifest.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"edition":"made-up","pages":7}' }),
  );
  await page.goto("/");
  const title = page.getByRole("heading", { name: "توقّفت الصفحة عن العمل" });
  await expect(title).toBeVisible();
  const again = page.getByRole("button", { name: "افتح الصفحة من جديد" });
  await expect(again).toBeVisible();

  // Whatever broke is gone by the next load (a bad file replaced, a passing
  // fault): the button opens the page again and the mus'haf is back.
  await page.unrouteAll();
  await again.click();
  await expect(page.locator("svg[role='group']").first()).toBeVisible();
  await expect(title).toHaveCount(0);
});

test("when the report panel's file cannot come, the card still offers to open the page again", async ({ page }) => {
  // The report panel loads from the rarely used tools' file once the card
  // shows. Offline before the service worker kept that file, the request fails:
  // the card must still say what happened and keep its one useful button.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let refused = false;
  await page.route(/\/assets\/rarely-used-[^/]+\.js$/, (route) => {
    refused = true;
    return route.abort();
  });
  await page.route("**/assets/manifest.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"edition":"made-up","pages":7}' }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "توقّفت الصفحة عن العمل" })).toBeVisible();
  await expect.poll(() => refused, { message: "the card asked for the report panel's file" }).toBe(true);
  await expect(page.getByRole("button", { name: "افتح الصفحة من جديد" })).toBeVisible();
  // Still there a moment later: the failed load did not take the card with it.
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "توقّفت الصفحة عن العمل" })).toBeVisible();
  await expect(page.getByRole("button", { name: "افتح الصفحة من جديد" })).toBeVisible();
});

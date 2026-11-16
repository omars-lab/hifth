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

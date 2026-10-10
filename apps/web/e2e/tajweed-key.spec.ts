import { test, expect } from "@playwright/test";

// The tajweed key's card at the sizes and in the browsers it gets cut in: its
// own file so the Firefox project runs it too, where the address broke.

// Scrolled to its credit, the key took its title and its close button up and
// out of the card with the first rules, as the look-alike list once did.
test("scrolled to its end, the key keeps its title and close button at the top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/hafs-kfqc/p45");
  await page.getByLabel("مفتاح ألوان التجويد").click();
  const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
  await expect(legend).toBeVisible();
  await legend.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await expect.poll(() => legend.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(40);
  await legend.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  expect(await legend.evaluate((el) => el.scrollTop), "the key scrolled").toBeGreaterThan(40);
  const box = (await legend.boundingBox())!;
  for (const [what, target] of [
    ["the close button", legend.locator("header button")],
    ["the title", legend.getByRole("heading")],
  ] as const) {
    const spot = (await target.boundingBox())!;
    expect(spot.y, `${what} is still inside the card`).toBeGreaterThanOrEqual(box.y - 1);
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest("header") !== null,
      [spot.x + spot.width / 2, spot.y + spot.height / 2],
    );
    expect(hit, `${what} is not covered by the rules`).toBe(true);
  }
});

// In Arabic the credit's web address broke after its "https://", leaving the
// two halves on two lines that read as two things. It moves down whole.
for (const size of [null, { width: 1280, height: 800 }]) {
  test(`the credit's web address is never cut in two: ${size ? "laptop" : "default size"}`, async ({ page }) => {
    if (size) await page.setViewportSize(size);
    await page.goto("/#/hafs-kfqc/p45");
    await page.getByLabel("مفتاح ألوان التجويد").click();
    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    const link = legend.locator("p a[href^='https://']");
    await expect(link).toHaveCount(1);
    expect(await link.evaluate((el) => el.getClientRects().length), "the address is on one line").toBe(1);
    const box = (await link.boundingBox())!;
    const card = (await legend.boundingBox())!;
    expect(box.x + box.width, "the address fits the card").toBeLessThanOrEqual(card.x + card.width);
  });
}

import { test, expect, type Page } from "@playwright/test";

/*
 * The owner's own count of what gets used (docs/design/feature-usage.md),
 * against a real build: a unit test proves the sums, but only a browser proves
 * the app actually counts a page turn, that opening at a page is not counted as
 * one, and that the counts are still there after a reload.
 */

async function openPanel(page: Page) {
  await page.getByRole("button", { name: /عن حِفظ/ }).tap();
  const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
  await expect(sheet).toBeVisible();
  return sheet.getByTestId("usage-readout");
}

test.describe("Hifth · how you use the app", () => {
  test("counts each page turn once, keeps the count across a reload, and forgets on request", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p3");
    // By page number: the first drawing in the page may be a neighbour kept warm, and hidden.
    await expect(page.locator('svg[aria-labelledby="page-label-3"]')).toBeVisible();

    await expect(page).toHaveURL(/\/p3$/);
    for (const p of [4, 5]) {
      await page.keyboard.press("ArrowLeft");
      await expect(page).toHaveURL(new RegExp(`/p${p}$`));
    }

    // Arriving at page 3 is where the reader started, not a turn: two, not three.
    const readout = await openPanel(page);
    const turns = readout.locator("[data-feature='turn-page'] [data-total]");
    await expect(turns).toHaveAttribute("data-total", "2");
    await expect(readout.locator("[data-feature='turn-page']")).toHaveCount(1);
    // The count is words, set in the words' own face: the numbers' face drew
    // the Arabic with long joining strokes between every letter.
    const faces = await readout.locator("[data-feature='turn-page']").evaluate((row) => ({
      name: getComputedStyle(row.firstElementChild!).fontFamily,
      times: getComputedStyle(row.querySelector("[data-total]")!).fontFamily,
    }));
    expect(faces.times).toBe(faces.name);
    // Today ends the strip in the reading direction: on the left, in Arabic.
    const bars = readout.locator("[data-feature='turn-page'] [role='img'] > span");
    await expect(bars).toHaveCount(14);
    const first = (await bars.first().boundingBox())!;
    const today = (await bars.last().boundingBox())!;
    expect(today.x).toBeLessThan(first.x);
    // The fold for the features never used keeps its arrow.
    expect(await readout.locator("summary").evaluate((el) => getComputedStyle(el).display)).toBe("list-item");

    // A picture for whoever walks the panel next; test-results is not committed.
    await readout.scrollIntoViewIfNeeded();
    await readout.screenshot({ path: test.info().outputPath("usage-readout.png") });

    await page.reload();
    await expect(page.locator('svg[aria-labelledby="page-label-5"]')).toBeVisible();
    const again = await openPanel(page);
    await expect(again.locator("[data-feature='turn-page'] [data-total]")).toHaveAttribute("data-total", "2");

    await again.getByTestId("usage-forget").click();
    await expect(again.locator("[data-feature='turn-page']")).toHaveCount(0);
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The crop tool, step 4 of docs/design/page-toolbar-plan.md: drag a box over
 * the page and it comes back as an image of that part of the print, with a
 * line naming the page, to share or save. On the computer's bar and the
 * phone's tray alike.
 */
test.use({ locale: "en-US" });

const sheet = (page: Page): Locator => page.getByRole("dialog", { name: "A cut-out of page 7" });
const pageSvg = (page: Page): Locator => page.locator('svg[aria-labelledby="page-label-7"]:visible');

async function pickCrop(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.locator('[data-phone-bar="c"]').getByRole("button", { name: /^Page tools · / }).click();
  await page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio", { name: "Crop", exact: true }).click();
}

test.describe("Hifth · the crop tool", () => {
  test("a box dragged over the page comes back as an image of it, to save", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page)).toBeVisible();
    await pickCrop(page, isMobile);
    await expect(page.getByText("Drag a box over the page to cut it out")).toBeVisible();

    const r = (await pageSvg(page).boundingBox())!;
    const from = { x: r.x + r.width * 0.2, y: r.y + r.height * 0.3 };
    const to = { x: r.x + r.width * 0.8, y: r.y + r.height * 0.45 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await expect(page.locator("[data-crop-box]")).toBeVisible();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();

    // The drag cut; it did not turn the page.
    await expect(sheet(page)).toBeVisible();
    await expect(page).toHaveURL(/p7$/);
    const img = sheet(page).getByRole("img", { name: "Page 7 · King Fahd Complex print" });
    await expect(img).toBeVisible();
    // Wider than tall, like the box, and drawn large enough to read.
    const size = await img.evaluate((i: HTMLImageElement) => ({ w: i.naturalWidth, h: i.naturalHeight }));
    expect(size.w).toBeGreaterThan(size.h);
    expect(size.w).toBeGreaterThan(800);

    const save = sheet(page).locator("[data-crop-save]");
    await expect(save).toHaveAttribute("download", "hifth-page-7.png");

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("a tap with the crop tool cuts nothing", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page)).toBeVisible();
    await pickCrop(page, isMobile);
    const r = (await pageSvg(page).boundingBox())!;
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await expect(sheet(page)).toHaveCount(0);
  });
});

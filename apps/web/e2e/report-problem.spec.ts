import { expect, test } from "@playwright/test";

/*
 * Launch item 18, in the built page. A reader opens the info panel, presses
 * "Report a problem", and sees the whole report and where it goes before
 * anything can leave: the only way out is a mail link to the project's
 * address, which opens their own mail app. The report reads nothing the reader
 * keeps on the device, so a made-up marker written to storage before the page
 * opens must not be in what is shown or in the mail link.
 */

const MARKER = "made-up-private-marker-7f3a";
const ADDRESS = "hello@hifth.app";

test("the info panel shows the whole report before the reader's own mail app sends it", async ({ page }) => {
  await page.addInitScript((marker) => {
    localStorage.setItem("hifth.report-test.notes", JSON.stringify([{ text: marker }]));
    localStorage.setItem("hifth.report-test.marks", marker);
  }, MARKER);
  await page.goto("/");
  await expect(page.locator("svg[role='group']").first()).toBeVisible();

  await page.getByRole("button", { name: /عن حِفظ/ }).click();
  const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
  await expect(sheet).toBeVisible();

  const open = sheet.getByRole("button", { name: "أبلغ عن مشكلة" });
  await open.scrollIntoViewIfNeeded();
  await open.click();

  const title = sheet.getByRole("heading", { name: "ما في البلاغ" });
  await expect(title).toBeVisible();
  // It sits under the section's own heading, so it must not be drawn bigger
  // than that heading (it was, and the order read upside down).
  const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
  const inner = await title.evaluate(size);
  const outer = await sheet.locator("#colophon-report").evaluate(size);
  expect(inner).toBeLessThanOrEqual(outer);
  await expect(sheet.getByText(ADDRESS)).toBeVisible();
  const box = sheet.getByRole("textbox", { name: "نص البلاغ" });
  await expect(box).toBeVisible();
  const report = await box.inputValue();
  expect(report).toContain("Hifth problem report");
  expect(report).toContain("App: website");
  expect(report).not.toContain(MARKER);

  const send = sheet.getByRole("link", { name: "افتحه في تطبيق البريد" });
  const href = (await send.getAttribute("href")) ?? "";
  expect(href.startsWith(`mailto:${ADDRESS}?`)).toBe(true);
  expect(decodeURIComponent(href)).toContain("Hifth problem report");
  expect(decodeURIComponent(href)).not.toContain(MARKER);

  await sheet.getByRole("button", { name: "أغلق" }).click();
  await expect(box).toHaveCount(0);
});

test.describe("on the card the reader sees when the page stops", () => {
  test.use({ serviceWorkers: "block" });

  test("the report already holds what went wrong", async ({ page }) => {
    await page.route("**/assets/manifest.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"edition":"made-up","pages":7}' }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "توقّفت الصفحة عن العمل" })).toBeVisible();
    await page.getByRole("button", { name: "أبلغ عن مشكلة" }).click();
    const report = await page.getByRole("textbox", { name: "نص البلاغ" }).inputValue();
    expect(report).toContain("Errors (the last");
    expect(report).toContain("drawing");
  });
});

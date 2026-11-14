import { test, expect, type Locator, type Page } from "@playwright/test";
import { DRAWER_TOOLS_KEY } from "../src/drawer-tools";

/*
 * The share menu starts on "The ayah as it is" every time it opens (backlog
 * share-menu-too-plain). Seen in an iPhone test run: a menu that had picked
 * "Its roots" opened on "Its roots" the next time, but only while the share
 * button stayed on screen, and never in the verse's drawer, which starts fresh
 * each time. So the next link sent could open on the roots without the sender
 * meaning it. Now the card starts fresh too, the way the drawer always did.
 *
 * Runs on the phones and on a laptop in Chrome and Firefox, since whether a
 * computer did the same had not been checked. Written before the fix and
 * watched failing.
 */

test.use({ locale: "en-US" });

const shareButton = (page: Page) => page.getByRole("button", { name: "Share this ayah as a link" });
const asItIs = (menu: Locator) => menu.getByRole("radio", { name: "The ayah as it is" });

async function open(page: Page, inDrawer: boolean): Promise<void> {
  if (inDrawer) await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
  await page.goto("/?share=c&lang=en#/hafs-kfqc/2:48");
  await expect(shareButton(page)).toBeVisible();
}

test("the card starts on the ayah as it is, after Escape and after its close button", async ({ page }) => {
  await open(page, false);
  const card = page.getByRole("dialog", { name: "Share this ayah as a link" });

  await shareButton(page).click();
  await card.getByRole("radio", { name: "Its roots" }).check();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await shareButton(page).click();
  await expect(asItIs(card)).toBeChecked();

  await card.getByRole("radio", { name: "Its look-alikes" }).check();
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toBeHidden();
  await shareButton(page).click();
  await expect(asItIs(card)).toBeChecked();
});

test("inside the verse's drawer it starts on the ayah as it is too", async ({ page }) => {
  await open(page, true);
  const section = page.getByRole("region", { name: "Share this ayah as a link" });

  await shareButton(page).click();
  await section.getByRole("radio", { name: "Its roots" }).check();
  await shareButton(page).click();
  await expect(section).toBeHidden();
  await shareButton(page).click();
  await expect(asItIs(section)).toBeChecked();
});

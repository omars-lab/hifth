import { test, expect, type Locator, type Page } from "@playwright/test";
import { DRAWER_TOOLS_KEY } from "../src/drawer-tools";

/*
 * A verse's tool opening inside its drawer, not as another card (decision
 * selection-drawer, open question ③). The owner asked for it five times on the
 * drawer's page; it is built as a setting, the separate card still the default,
 * so these tests turn the setting on first.
 *
 * Same roots is the first tool moved. Pitch step 6 opens the roots list from a
 * link and expects the card: if the default here ever flips, that step changes
 * with it.
 *
 * Written before the build (2026-11-09) and watched failing: Same roots opened
 * its own card and the drawer stepped aside.
 */

test.use({ locale: "en-US" });

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The lit verse's lines, as boxes in window pixels. */
async function litLines(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
  );
}

/** Wait until something stops moving: two identical boxes in a row. */
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

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });

for (const size of [
  { name: "a laptop", width: 1440, height: 900 },
  { name: "an iPad on its side", width: 1180, height: 820 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("with the setting on, Same roots opens inside the drawer, not as its own card, and the verse stays in sight", async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
      await page.goto("/#/hafs-kfqc/2:45");
      await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
      await drawer(page).getByRole("button", { name: /^Same roots · / }).click();

      // The list is a part of the drawer, and no card opened beside it.
      const list = drawer(page).getByRole("region", { name: /^Roots · / });
      await expect(list).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // The nearest root opens by itself, its verses ready to go to.
      await expect(list.getByRole("button", { name: /^Hop to / }).first()).toBeVisible({ timeout: 10_000 });

      // The drawer grew, and no line of the lit verse is under it.
      await settle(drawer(page));
      await expect.poll(async () => (await litLines(page)).length, { message: "a verse is lit" }).toBeGreaterThan(0);
      const box = (await drawer(page).boundingBox())!;
      const under = (await litLines(page)).filter((line) => overlaps(line, box));
      expect(under, "lines of the verse under the drawer").toEqual([]);

      // Pressing Same roots again folds the list away and leaves the drawer.
      await drawer(page).getByRole("button", { name: /^Same roots · / }).click();
      await expect(list).toBeHidden();
      await expect(drawer(page)).toBeVisible();
    });
  });
}

test("with the setting on, Escape folds the roots list away first, and a second Escape puts the drawer away", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
  await page.goto("/#/hafs-kfqc/2:45");
  await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
  await drawer(page).getByRole("button", { name: /^Same roots · / }).click();
  const list = drawer(page).getByRole("region", { name: /^Roots · / });
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(drawer(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
});

test("the setting is in the info panel, the separate card chosen until the reader picks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hafs-kfqc/2:45");
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const group = page.getByRole("dialog", { name: /About Hifth/ }).getByRole("radiogroup", { name: "Where a verse's tools open" });
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio", { name: "In a card of their own" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: "Inside the verse's drawer" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), DRAWER_TOOLS_KEY)).toBe("drawer");
});

/*
 * Share is the second tool moved (2026-11-09). With the setting on, its two
 * links open as a section of the drawer, as Same roots does, and only one tool
 * is open inside the drawer at a time.
 *
 * Written before the build and watched failing: Share opened its own card.
 */
test.describe("Share inside the drawer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("with the setting on, Share opens its links inside the drawer, not as its own card", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    const share = drawer(page).getByRole("button", { name: "Share this ayah as a link" });
    await share.click();

    const links = drawer(page).getByRole("region", { name: "Share this ayah as a link" });
    await expect(links).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(links.getByRole("button", { name: "Share the website link" })).toBeVisible();
    await expect(links.getByRole("button", { name: "Copy the app link" })).toBeVisible();
    await expect(share).toHaveAttribute("aria-expanded", "true");

    // No line of the lit verse is under the grown drawer.
    await settle(drawer(page));
    const box = (await drawer(page).boundingBox())!;
    expect((await litLines(page)).filter((line) => overlaps(line, box)), "lines of the verse under the drawer").toEqual([]);


    // Share again folds the links away and leaves the drawer.
    await share.click();
    await expect(links).toBeHidden();
    await expect(drawer(page)).toBeVisible();
  });

  test("only one tool is open inside the drawer: Share folds the roots list, and Escape folds Share before the drawer", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    await drawer(page).getByRole("button", { name: /^Same roots · / }).click();
    const roots = drawer(page).getByRole("region", { name: /^Roots · / });
    await expect(roots).toBeVisible();

    await drawer(page).getByRole("button", { name: "Share this ayah as a link" }).click();
    const links = drawer(page).getByRole("region", { name: "Share this ayah as a link" });
    await expect(links).toBeVisible();
    await expect(roots).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(links).toBeHidden();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
  });

  test("with the setting off, Share still opens its own card", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    await drawer(page).getByRole("button", { name: "Share this ayah as a link" }).click();
    await expect(page.getByRole("dialog", { name: "Share this ayah as a link" })).toBeVisible();
  });
});

/*
 * Listen, the third tool moved (owner, 2026-11-07: "clicking play should
 * expand drawer as well with additional play options"). With the setting on, a
 * press plays the verse and opens its play options under the drawer's buttons:
 * play on to a verse, repeat, speed.
 *
 * Written before the build and watched failing: Listen only played.
 */
test.describe("Listen inside the drawer", () => {
  test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });

  test.beforeEach(async ({ page }) => {
    // No recitation over the network: an empty file is enough to press Play.
    await page.route("https://verses.quran.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
    );
  });

  test("with the setting on, Listen opens its play options inside the drawer, and the choice is kept", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    const listen = drawer(page).getByRole("button", { name: /^Listen to .*2:45/ });
    await listen.click();

    const options = drawer(page).getByRole("region", { name: /^Play options/ });
    await expect(options).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(options.getByRole("button", { name: /^Play to a verse you pick/ })).toBeVisible();
    const repeat = options.getByRole("radiogroup", { name: "Repeat each verse" });
    const speed = options.getByRole("radiogroup", { name: "Speed" });
    await expect(repeat.getByRole("radio", { name: "Once" })).toBeChecked();
    await expect(speed.getByRole("radio", { name: "As recited" })).toBeChecked();

    await repeat.getByRole("radio", { name: "3 times" }).check();
    await speed.getByRole("radio", { name: "Slower" }).check();

    // No line of the lit verse is under the grown drawer.
    await settle(drawer(page));
    const box = (await drawer(page).boundingBox())!;
    expect((await litLines(page)).filter((line) => overlaps(line, box)), "lines of the verse under the drawer").toEqual([]);

    // Kept on this device: after a reload the same choice is ticked.
    await page.reload();
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    await drawer(page).getByRole("button", { name: /^Listen to .*2:45/ }).click();
    const again = drawer(page).getByRole("region", { name: /^Play options/ });
    await expect(again.getByRole("radio", { name: "3 times" })).toBeChecked();
    await expect(again.getByRole("radio", { name: "Slower" })).toBeChecked();
  });

  test("one tool at a time: Share folds the play options, and Escape folds them before the drawer", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    await drawer(page).getByRole("button", { name: /^Listen to .*2:45/ }).click();
    const options = drawer(page).getByRole("region", { name: /^Play options/ });
    await expect(options).toBeVisible();

    await drawer(page).getByRole("button", { name: "Share this ayah as a link" }).click();
    await expect(options).toBeHidden();
    await expect(drawer(page).getByRole("region", { name: "Share this ayah as a link" })).toBeVisible();

    await drawer(page).getByRole("button", { name: /(Listen to|Pause) .*2:45/ }).click();
    await expect(options).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(options).toBeHidden();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
  });

  test("with the setting off, Listen only plays", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:45");
    await expect(drawer(page)).toBeVisible({ timeout: 20_000 });
    await drawer(page).getByRole("button", { name: /^Listen to .*2:45/ }).click();
    await expect(page.getByRole("region", { name: /^Play options/ })).toHaveCount(0);
  });
});

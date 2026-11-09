import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The pitch demo, one test per step, in the words of what the scholar sees.
 *
 * The steps and what "right" means for each are written in
 * .claude/skills/walk-app/pitch-script.md; this file follows that list and the
 * test names start with the step's number, so the two cannot quietly drift.
 * Written test-first (2026-11-09): a step that fails here is a fault on the
 * demo path, and it gets a backlog row tagged "pitch", not a quiet fix.
 *
 * This runs in Chromium at the size of an iPad on its side. It stands in for
 * the iPad, it is not the iPad: the goal's main number is still the walk on the
 * owner's own device. Steps a browser cannot do as a hand does (turning by the
 * page's edge with a finger, the wifi off) are marked fixme and walked by hand.
 *
 * Assertions are counts, boxes and the app's own interface words only. Nothing
 * here reads or prints the commentary's text, which never leaves the private
 * build.
 */

test.skip(
  process.env.HIFTH_PITCH !== "1",
  "pitch-only: run `make pitch-script` (needs VITE_PITCH=1 and the private note file)",
);

// An iPad on its side: two pages open, the note a card beside the verse.
test.use({ locale: "en-US", viewport: { width: 1180, height: 820 } });

type Box = { x: number; y: number; width: number; height: number };

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const card = (page: Page): Locator => page.getByRole("dialog");
const note = (page: Page): Locator => card(page).getByRole("region", { name: "Commentary" });

/** The global 1-based ordinal of a verse in al-Baqarah (al-Fātiḥah has 7). */
const baqarah = (n: number): number => 7 + n;

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The lit verse's lines, as boxes in window pixels. */
async function litLines(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
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

/** No line of the lit verse is under the open card. */
async function verseClearOfCard(page: Page): Promise<void> {
  await settle(card(page));
  // The wash lands a moment after the card on a link straight to a list.
  await expect.poll(async () => (await litLines(page)).length, { message: "a verse is lit" }).toBeGreaterThan(0);
  const lines = await litLines(page);
  const box = (await card(page).boundingBox())!;
  expect(lines.filter((l) => overlaps(l, box)).length, "lines of the verse under the card").toBe(0);
}

test.describe("The pitch demo, step by step", () => {
  test("1 · the app opens on two pages of the mus'haf with nothing over them", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p42");
    await expect(pageSvg(page, 42)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("svg[aria-labelledby^='page-label-']:visible")).toHaveCount(2);
    await expect(card(page), "no card stands over the pages").toHaveCount(0);
  });

  test.fixme("2 · a page turns by its outer edge and settles, then turns back", async () => {
    // Walked by hand on the iPad: a made-up finger cannot carry the feel of the
    // turn. The browser checks of the edge turn are edge-peel.spec.ts.
  });

  test("3 · a tap on 2:255 opens its note beside it, and the whole verse stays in sight", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p42");
    await expect(pageSvg(page, 42)).toBeVisible({ timeout: 20_000 });
    await pageSvg(page, 42).locator(`#verse-${baqarah(255)}`).click();
    await expect(page.getByRole("dialog", { name: /2:255/ })).toBeVisible();
    await verseClearOfCard(page);
  });

  test("4 · 2:255's note reads in its ten printed paragraphs, to its end", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    await expect(note(page)).toBeVisible({ timeout: 20_000 });
    await expect(note(page).locator("p")).toHaveCount(10);
    const last = note(page).locator("p").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last, "the last paragraph can be read").toBeInViewport();
  });

  test("5 · 2:255's related places show eight cards and a way to the rest, and each card opens its verse", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    await expect(card(page)).toContainText("Related verses", { timeout: 20_000 });
    const cards = card(page).getByRole("button", { name: /^Hop to / });
    await expect(cards).toHaveCount(8);
    await expect(card(page).getByRole("button", { name: /^Show \d+ more related verses?$/ })).toBeVisible();
    const target = (await cards.first().getAttribute("aria-label"))?.match(/\d+:\d+/)?.[0] ?? "";
    expect(target).not.toBe("");
    await cards.first().scrollIntoViewIfNeeded();
    await cards.first().click();
    await expect(page.getByRole("dialog", { name: new RegExp(`${target}\\b`) })).toBeVisible();
  });

  test("6 · 2:255's roots list opens clear of the verse", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=roots");
    await expect(page.getByRole("dialog", { name: /root/i })).toBeVisible({ timeout: 20_000 });
    await verseClearOfCard(page);
  });

  test("7 · 2:48's look-alikes each say why they are there, and the passage reads 2:122–2:123", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
    const list = card(page);
    await expect(list.getByRole("listitem").first()).toBeVisible({ timeout: 20_000 });
    await expect(list.getByRole("listitem").filter({ hasText: /2:122.2:123/ })).toHaveCount(1);
    const rows = await list.getByRole("listitem").all();
    for (const row of rows) {
      const lines = (await row.innerText()).split("\n").filter((l) => l.trim());
      const opens = await row.locator("[aria-expanded]").count();
      expect(lines.length > 1 || opens > 0, "a row with only a verse name and no way to compare").toBe(true);
    }
  });

  test("8 · opening 2:48's row for 2:123 shows the comparison, its name in sight under the title", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48?open=lookalikes");
    const list = card(page);
    await expect(list.getByRole("listitem").first()).toBeVisible({ timeout: 20_000 });
    const row = list
      .getByRole("listitem")
      .filter({ hasText: /2:123/ })
      .filter({ hasNotText: /2:122/ })
      .first();
    await row.locator("[aria-expanded]").click();
    await expect(row.locator("[id^='diff-'] svg")).toHaveCount(2, { timeout: 10_000 });
    await settle(row);
    const title = (await list.locator("header").first().boundingBox())!;
    const top = (await row.boundingBox())!;
    expect(top.y, "the row's name is under the title, not behind it").toBeGreaterThanOrEqual(title.y + title.height - 1);
  });

  test("9 · 10:15's later look-alike 19:73 opens side by side", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "en"));
    await page.goto("/#/hafs-kfqc/10:15?open=lookalikes");
    await page.getByRole("button", { name: /later surahs/ }).first().click();
    const list = page.getByRole("dialog", { name: /later surahs/ });
    await expect(list).toBeVisible({ timeout: 20_000 });
    const row = list.getByRole("listitem").filter({ hasText: /19:73/ });
    await row.locator("[aria-expanded]").click();
    await expect(row.locator("[id^='diff-'] svg")).toHaveCount(2, { timeout: 10_000 });
  });

  test("10 · 15:30's passage in surah 38 opens with its name in sight under the list's title", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "en"));
    await page.goto("/#/hafs-kfqc/15:30?open=lookalikes");
    const list = page.getByRole("dialog", { name: /later surahs/ });
    await expect(list).toBeVisible({ timeout: 20_000 });
    const row = list.getByRole("listitem").filter({ hasText: /38:72.38:75/ });
    await row.locator("[aria-expanded]").click();
    await expect(row.locator("[id^='diff-'] svg")).toHaveCount(2, { timeout: 10_000 });
    await settle(row);
    const title = (await list.locator("header").first().boundingBox())!;
    const top = (await row.boundingBox())!;
    expect(top.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
  });

  test("11 · al-Kahf's introduction opens from the surah's name and leaves the name in sight", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p293");
    const name = pageSvg(page, 293).getByRole("button", { name: /^Surah introduction/ });
    await expect(name).toBeVisible({ timeout: 20_000 });
    await name.click();
    await expect(card(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
    await settle(card(page));
    expect(overlaps((await name.boundingBox())!, (await card(page).boundingBox())!), "the card covers the name").toBe(
      false,
    );
  });

  test("12 · 18:10's note opens, with the book's slanted words slanted", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/18:10?open=commentary");
    await expect(note(page)).toBeVisible({ timeout: 20_000 });
    expect(await note(page).locator("em, i").count(), "slanted words in the note").toBeGreaterThan(0);
  });

  test("13 · 18:60's note covers the whole story, and its link lands on 18:65", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/18:60?open=commentary");
    await expect(note(page)).toBeVisible({ timeout: 20_000 });
    const hop = card(page).getByRole("button", { name: /Hop to .*18:65\b/ }).first();
    await hop.scrollIntoViewIfNeeded();
    await settle(hop);
    await hop.click();
    await expect(page.getByRole("dialog", { name: /18:65\b/ })).toBeVisible();
    await verseClearOfCard(page);
  });

  test.fixme("14 · with a note open, the surah plays and the verse being recited is never under the note", async () => {
    // Walked by hand on the iPad. The browser check is in pitch.spec.ts
    // ("lies clear of the verse being recited"), at an iPad's size.
  });

  test("15 · the Mistake pen marks a word without covering it, and Undo takes the mark away", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("KeyM");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const ask = page.getByRole("dialog", { name: /^What went wrong in / });
    await expect(ask).toBeVisible();
    const box = (await ask.boundingBox())!;
    const onIt = at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;
    expect(onIt, "the question stands over the word it asks about").toBe(false);
    await ask.getByRole("button", { name: "The whole word" }).click();
    const marks = page.locator("[data-mistake-word]:visible");
    await expect(marks).toHaveCount(1);
    await page.getByRole("button", { name: /^Undo/ }).first().click();
    await expect(marks).toHaveCount(0);
  });

  test("16 · a verse nobody planned for (2:37) opens its note like the others", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:37?open=commentary");
    await expect(note(page)).toBeVisible({ timeout: 10_000 });
    expect(await note(page).locator("p").count()).toBeGreaterThan(0);
  });
});

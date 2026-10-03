import { readFileSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { JUMP_ARROWS_KEY } from "../src/jump-arrows";

/*
 * Confusion jumps, step 3 (docs/design/confusion-jumps.md): a verse you have
 * jumped away from carries a small red mark on the lower shoulder of its
 * number, with how many different verses you went to. The note dot keeps the
 * upper shoulder, so a verse can carry both without one covering the other.
 */
test.use({ locale: "en-US" });
/** Set to a folder to keep pictures of the marks, for looking at them by eye. */
const SHOTS = process.env.HIFTH_SHOTS;
// Pictures are taken sharp enough to judge a mark a few pixels high.
if (SHOTS) test.use({ deviceScaleFactor: 4 });

const KEY = (v: string) => `quran/hafs-kfqc/${v}`;
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const mark = (page: Page, verse: string): Locator => pageSvg(page, 9).locator(`[data-confusion-mark="${verse}"]`);

const jump = (id: string, from: string, to: string | null, at: number[], state = "sometimes") => ({
  id,
  from: { key: KEY(from), word: 3 },
  to: to ? { key: KEY(to) } : null,
  times: at.map((t) => ({ at: t, device: "d-test" })),
  state,
  createdAt: at[0],
  updatedAt: at[at.length - 1],
});

const JUMPS = [
  jump("j1", "2:58", "7:161", [1_000, 2_000, 3_000]),
  jump("j2", "2:58", "2:35", [4_000]),
  jump("j3", "2:59", null, [5_000]),
  jump("j4", "2:60", "7:160", [6_000], "beaten"),
  jump("j5", "2:61", "3:112", [7_000], "dismissed"),
];

async function seed(page: Page, confusions: readonly unknown[], notes: readonly unknown[] = []): Promise<void> {
  await page.evaluate(
    ([confusions, notes]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          const sets = tx.objectStore("sets");
          sets.put({ id: "confusions", confusions });
          if (notes.length) {
            sets.delete("notes");
            sets.put({ id: "scoped-notes", notes });
          }
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [confusions, notes] as const,
  );
}

test.describe("Hifth · the mark by a verse you jumped away from", () => {
  test("counts the different verses you went to, and says so", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(mark(page, "2:58")).toBeVisible();
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 2 other verses");
    await expect(mark(page, "2:58").locator("text")).toHaveText("2");
  });

  test("a jump not yet given a destination is marked but not counted; beaten is grey; dismissed is gone", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(mark(page, "2:59")).toBeVisible();
    await expect(mark(page, "2:59")).toHaveAttribute("aria-label", "From 2:59 you have jumped to a verse not named yet");
    await expect(mark(page, "2:59").locator("text")).toHaveText("?");
    await expect(mark(page, "2:60")).toHaveAttribute("data-beaten", "");
    await expect(mark(page, "2:58")).not.toHaveAttribute("data-beaten", "");
    await expect(mark(page, "2:61")).toHaveCount(0);
  });

  test("sits under the note dot on the same verse number, and does not cover it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    const note = {
      id: "nq9",
      kind: "comment",
      scope: { type: "page", edition: "hafs-kfqc", page: 9 },
      text: "Page 9",
      verses: [{ key: KEY("2:58"), addedAt: 2_000 }],
      createdAt: 2_000,
      updatedAt: 2_000,
      usedAt: 2_000,
    };
    await seed(page, JUMPS, [note]);
    await page.reload();
    const dot = pageSvg(page, 9).locator('[data-verse-dot="2:58"] circle:not([data-hit])');
    const jumpMark = mark(page, "2:58").locator("[data-glyph]");
    await expect(dot).toBeVisible();
    await expect(jumpMark).toBeVisible();
    const a = (await dot.boundingBox())!;
    const b = (await jumpMark.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    expect(Math.abs(b.x + b.width / 2 - (a.x + a.width / 2))).toBeLessThan(a.width * 2);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/jump-marks.png` });
      for (const verse of ["2:58", "2:59", "2:60"]) {
        const at = (await mark(page, verse).boundingBox())!;
        await page.screenshot({
          path: `${SHOTS}/jump-mark-${verse.replace(":", "-")}.png`,
          clip: { x: at.x - 60, y: at.y - 40, width: 120, height: 70 },
        });
      }
    }
  });
});

/*
 * Confusion jumps, step 4: the Jump tool on the computer. J picks it; a press
 * on the verse you left and a drag draw a wavy arrow; letting go over another
 * verse marks the jump, and letting go anywhere else asks where you went.
 */
const verse = (ordinal: number) => `svg[aria-labelledby="page-label-9"]:visible #verse-${ordinal}`;
const undoBar = (page: Page) => page.locator("[data-undo-bar]");
const picker = (page: Page, from: string) => page.getByRole("dialog", { name: `Where did ${from} take you?` });

async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }, release = true): Promise<void> {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  if (release) await page.mouse.up();
}

/** Turn the Jump tool on. Its layer covers the page, so find verses' points first. */
async function jumpTool(page: Page): Promise<void> {
  await page.keyboard.press("j");
  await expect(page.getByRole("radio", { name: "Jump" })).toHaveAttribute("aria-checked", "true");
}

/** A point above the page's text, where no verse is. */
async function offVerse(page: Page): Promise<{ x: number; y: number }> {
  const box = (await pageSvg(page, 9).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y - 6 };
}

test.describe("Hifth · the Jump tool on the computer", () => {
  test.skip(({ isMobile }) => isMobile, "phones get the Jump tool in step 5, through the Tools tray and the hold menu");
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
  });

  test("a drag from one verse to another on the page marks the jump, with a way to undo it", async ({ page }) => {
    const a = await ayahTarget(page, verse(65)); // 2:58
    const b = await ayahTarget(page, verse(68)); // 2:61
    await jumpTool(page);
    await drag(page, a, b, false);
    await expect(page.locator("[data-jump-arrow]")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-dragging.png` });
    await page.mouse.up();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-marked.png` });
    await expect(page.locator("[data-jump-arrow]")).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 1 other verse");
    await expect(undoBar(page)).toContainText("Jump from 2:58 to 2:61 marked");
    await undoBar(page).getByRole("button", { name: "Undo" }).click();
    await expect(mark(page, "2:58")).toHaveCount(0);
  });

  test("letting go away from a verse asks where you went: its look-alikes, or not sure yet", async ({ page }) => {
    const a = await ayahTarget(page, verse(65));
    const c = await ayahTarget(page, verse(66)); // 2:59
    await jumpTool(page);
    await drag(page, a, await offVerse(page));
    const list = picker(page, "2:58");
    await expect(list).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-where.png` });
    await list.getByRole("button", { name: /7:161/ }).click();
    await expect(list).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 1 other verse");
    await expect(undoBar(page)).toContainText("Jump from 2:58 to 7:161 marked");

    // The same jump again adds a time, not a second verse.
    await drag(page, a, await offVerse(page));
    await picker(page, "2:58").getByRole("button", { name: /7:161/ }).click();
    await expect(mark(page, "2:58").locator("text")).toHaveText("1");
    await expect(undoBar(page)).toContainText("2 times now");

    await drag(page, c, await offVerse(page));
    await picker(page, "2:59").getByRole("button", { name: "Not sure yet" }).click();
    await expect(mark(page, "2:59").locator("text")).toHaveText("?");
  });

  test("Escape, or letting go on the verse you started from, marks nothing", async ({ page }) => {
    const a = await ayahTarget(page, verse(65));
    await jumpTool(page);
    await drag(page, a, await offVerse(page), false);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-jump-arrow]")).toHaveCount(0);
    await page.mouse.up();
    await expect(picker(page, "2:58")).toHaveCount(0);

    await drag(page, a, { x: a.x + 30, y: a.y });
    await expect(picker(page, "2:58")).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveCount(0);

    // Escape in the list closes it, and nothing is saved.
    await drag(page, a, await offVerse(page));
    await expect(picker(page, "2:58")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker(page, "2:58")).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveCount(0);
  });
});

/*
 * Confusion jumps, step 5: phones. The Jump tool is in the phone's Tools tray,
 * and holding a verse offers "Jump…", which asks where you went straight away
 * with no drawing: the fastest way when your hand is already on the verse.
 */
test.describe("Hifth · jumps on a phone, and from a held verse", () => {
  test("holding a verse and picking Jump… asks where you went, with no arrow to draw", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    const at = await ayahTarget(page, verse(65)); // 2:58
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    const menu = page.getByRole("menu", { name: /^More for / });
    await expect(menu).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-hold-menu-${test.info().project.name}.png` });
    await menu.getByRole("menuitem", { name: "Jump…" }).click();
    await expect(menu).toHaveCount(0);
    const list = picker(page, "2:58");
    await expect(list).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-hold-where-${test.info().project.name}.png` });
    await list.getByRole("button", { name: /7:161/ }).click();
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 1 other verse");
    await expect(undoBar(page)).toContainText("Jump from 2:58 to 7:161 marked");
  });

  test("on a phone, Tools → Jump draws the arrow with a finger's drag", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone's own Tools tray");
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    const a = await ayahTarget(page, verse(65)); // 2:58
    const b = await ayahTarget(page, verse(66)); // 2:59
    await page.locator('[data-phone-bar="c"]').getByRole("button", { name: /^Page tools · / }).click();
    await page.getByRole("radio", { name: "Jump", exact: true }).click();
    await expect(page.getByText("Press where you left the verse, and drag to where your memory went")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-phone-tray-${test.info().project.name}.png` });
    // Drawn with the tray still open, as every phone tool is: closing it puts
    // the page back to plain reading.
    await drag(page, a, b);
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 1 other verse");
  });
});

/*
 * Confusion jumps, step 6: the list behind the mark. A tap on the red mark by
 * a verse's number lists where your memory went from it, one row a verse, and
 * each row can turn there, show the two side by side, count one more time,
 * be marked beaten, or be deleted with Undo.
 */
test.describe("Hifth · the mark at the next pause sign", () => {
  // Every seeded jump leaves from word 3. In 2:58 the next pause sign after it
  // is word 22, the small sign on the third line; 2:59 has none, so only its
  // number is marked; 2:60's first sign is the hizb star before its first
  // word, so its mark is at 11; 2:61's jump is dismissed.
  const wasl = (page: Page, verse: string): Locator => pageSvg(page, 9).locator(`[data-wasl-mark="${verse}"]`);
  const signBox = (verse: string, index: number) => {
    const shard = JSON.parse(readFileSync(new URL("../public/assets/words/hafs-kfqc/9.json", import.meta.url), "utf8"));
    const w = shard.words[verse];
    const [x, y, width, height] = w.boxes[index - w.from];
    return { x, y, width, height };
  };

  test("sits beside the first pause sign after where you left, counted like the verse number's", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(wasl(page, "2:58")).toBeVisible();
    await expect(pageSvg(page, 9).locator("[data-wasl-mark]")).toHaveCount(2);
    await expect(wasl(page, "2:58")).toHaveAttribute("data-wasl-index", "22");
    await expect(wasl(page, "2:58").locator("text")).toHaveText("2");
    await expect(wasl(page, "2:58")).toHaveAttribute(
      "aria-label",
      "At the pause sign in 2:58 you have jumped to 2 other verses",
    );
    await expect(wasl(page, "2:59")).toHaveCount(0);
    await expect(wasl(page, "2:60")).toHaveAttribute("data-wasl-index", "11");
    await expect(wasl(page, "2:60")).toHaveAttribute("data-beaten", "");

    // Beside the sign, after it in reading order (to its left), on its line.
    const sign = signBox("2:58", 22);
    const [x, y] = ((await wasl(page, "2:58").getAttribute("transform")) ?? "").match(/[-\d.]+/g)!.map(Number);
    expect(x).toBeLessThan(sign.x);
    expect(x).toBeGreaterThan(sign.x - 12);
    expect(Math.abs(y! - (sign.y + sign.height / 2))).toBeLessThan(6);
    if (SHOTS) {
      await wasl(page, "2:58").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/jump-wasl-${test.info().project.name}.png` });
    }

    // A tap opens the same list the verse number's mark opens.
    await wasl(page, "2:58").click();
    await expect(page.getByRole("dialog", { name: "Jumps from 2:58" })).toBeVisible();
  });
});

test.describe("Hifth · the saved arrows on the page", () => {
  // Two ways on trial (question 4 of the design): the arrow stays on the
  // page, faint, or shows only while you ask. Every seeded jump leaves from
  // word 3; in 2:58 that is the third word of the first line.
  const arrow = (page: Page, verse: string): Locator => pageSvg(page, 9).locator(`[data-jump-arrow="${verse}"]`);
  const arrows = (page: Page): Locator => pageSvg(page, 9).locator("[data-jump-arrow]");
  const wordBox = (verse: string, word: number) => {
    const shard = JSON.parse(readFileSync(new URL("../public/assets/words/hafs-kfqc/9.json", import.meta.url), "utf8"));
    const w = shard.words[verse];
    const [x, y, width, height] = w.boxes[word - w.from];
    return { x, y, width, height };
  };

  test("stays, faint: one arrow from where you left, labelled with every verse you went to", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(arrow(page, "2:58")).toBeVisible();
    // 2:58, 2:59 and 2:60 (beaten, grey); 2:61's jump is dismissed.
    await expect(arrows(page)).toHaveCount(3);
    await expect(arrow(page, "2:58")).toHaveAttribute("data-word", "3");
    await expect(arrow(page, "2:58").locator("[data-end]")).toHaveText(["7:161 ×3", "2:35"]);
    await expect(arrow(page, "2:59").locator("[data-end]")).toHaveText(["?"]);
    await expect(arrow(page, "2:60")).toHaveAttribute("data-beaten", "");
    await expect(arrow(page, "2:58")).toHaveAttribute("aria-label", "Where you went from here in 2:58");

    // It leaves from under the word you left at, and runs on in reading
    // order, to the left, under the line.
    const word = wordBox("2:58", 3);
    const line = await arrow(page, "2:58")
      .locator("[data-line]")
      .evaluate((el) => {
        const b = (el as SVGGraphicsElement).getBBox();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      });
    expect(Math.abs(line.x + line.width - (word.x + word.width / 2))).toBeLessThan(3);
    expect(line.width).toBeGreaterThan(30);
    expect(line.y).toBeGreaterThan(word.y + word.height * 0.6);
    if (SHOTS) {
      await arrow(page, "2:58").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/jump-arrows-stays-${test.info().project.name}.png` });
    }

    // A tap on it opens the same list as the marks.
    await arrow(page, "2:58").locator("[data-end]").first().click();
    await expect(page.getByRole("dialog", { name: "Jumps from 2:58" })).toBeVisible();
  });

  test("the setting is in the info panel, stays when nobody chose, and takes effect at once", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(arrows(page)).toHaveCount(3);

    const about = page.getByRole("button", { name: /About Hifth/ });
    if (isMobile) await about.tap();
    else await about.click();
    const group = page.getByRole("dialog", { name: /About Hifth/ }).getByRole("radiogroup", { name: "Saved jump arrows" });
    await expect(group.getByRole("radio", { checked: true })).toHaveText("Stay on the page, faint");
    await group.getByRole("radio", { name: "Only when you ask" }).click();
    await expect(group.getByRole("radio", { checked: true })).toHaveText("Only when you ask");
    if (SHOTS) {
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/jump-arrows-setting-${test.info().project.name}.png` });
    }
    expect(await page.evaluate((k) => localStorage.getItem(k), JUMP_ARROWS_KEY)).toBe("asked");
    await page.keyboard.press("Escape");
    await expect(arrows(page)).toHaveCount(0);

    // Kept on this device: the page opens the same way next time.
    await page.reload();
    await expect(mark(page, "2:58")).toBeVisible();
    await expect(arrows(page)).toHaveCount(0);
  });

  test("on request: no arrows until the Jump tool is on, or a verse's list is open", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.evaluate((k) => localStorage.setItem(k, "asked"), JUMP_ARROWS_KEY);
    await page.reload();
    await expect(mark(page, "2:58")).toBeVisible();
    await expect(arrows(page)).toHaveCount(0);

    // Opening one verse's list shows that verse's arrow, and closing it hides it.
    await mark(page, "2:58").click();
    await expect(page.getByRole("dialog", { name: "Jumps from 2:58" })).toBeVisible();
    await expect(arrows(page)).toHaveCount(1);
    await expect(arrow(page, "2:58")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-arrows-asked-${test.info().project.name}.png` });
    await page.keyboard.press("Escape");
    await expect(arrows(page)).toHaveCount(0);

    // With the Jump tool on, every arrow shows, so you see what you have marked.
    if (!isMobile) {
      await page.keyboard.press("j");
      await expect(arrows(page)).toHaveCount(3);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-arrows-asked-tool-${test.info().project.name}.png` });
      // Escape puts the tool down, and the arrows go with it.
      await page.keyboard.press("Escape");
      await expect(arrows(page)).toHaveCount(0);
    }
  });
});

test.describe("Hifth · the list behind a jump mark", () => {
  const jumps = (page: Page, from: string): Locator => page.getByRole("dialog", { name: `Jumps from ${from}` });
  const row = (list: Locator, text: string | RegExp): Locator => list.getByRole("listitem").filter({ hasText: text });

  /** Mark a jump the quickest way there is: hold the verse, Jump…, pick. */
  async function jumpFrom(page: Page, ordinal: number, from: string, pick: (list: Locator) => Promise<void>): Promise<void> {
    const at = await ayahTarget(page, verse(ordinal));
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await page.getByRole("menu", { name: /^More for / }).getByRole("menuitem", { name: "Jump…" }).click();
    await pick(picker(page, from));
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
  });

  test("a tap on the mark lists where you went; Again, Beaten, Delete and Undo work from it", async ({ page }) => {
    await jumpFrom(page, 65, "2:58", (l) => l.getByRole("button", { name: /7:161/ }).click());
    await mark(page, "2:58").click();
    const list = jumps(page, "2:58");
    await expect(list).toBeVisible();
    const r = row(list, "7:161");
    await expect(r).toContainText("1 time · last today");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-list-${test.info().project.name}.png` });

    await r.getByRole("button", { name: "Again" }).click();
    await expect(r).toContainText("2 times · last today");
    await expect(undoBar(page)).toContainText("2 times now");

    await r.getByRole("button", { name: "Beaten" }).click();
    await expect(r.getByRole("button", { name: "Beaten" })).toHaveAttribute("aria-pressed", "true");
    await expect(mark(page, "2:58")).toHaveAttribute("data-beaten", "");

    await r.getByRole("button", { name: "Delete" }).click();
    // The last row gone, the list has nothing left to say and closes.
    await expect(list).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveCount(0);
    await expect(undoBar(page)).toContainText("Jump from 2:58 to 7:161 deleted");
    await undoBar(page).getByRole("button", { name: "Undo" }).click();
    await expect(mark(page, "2:58")).toHaveAttribute("aria-label", "From 2:58 you have jumped to 1 other verse");
  });

  test("Go turns to the verse you went to, and Compare shows the two side by side", async ({ page }) => {
    // 2:58 and 7:161 say the same words in a swapped order, so there is no one
    // shared run to line up: no Compare is offered that would open on nothing.
    await jumpFrom(page, 65, "2:58", (l) => l.getByRole("button", { name: /7:161/ }).click());
    await mark(page, "2:58").click();
    await expect(row(jumps(page, "2:58"), "7:161").getByRole("button", { name: "Compare" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await jumpFrom(page, 67, "2:60", (l) => l.getByRole("button", { name: /7:160/ }).click());
    await mark(page, "2:60").click();
    const r = row(jumps(page, "2:60"), "7:160");
    await r.getByRole("button", { name: "Compare" }).click();
    await expect(r.getByRole("button", { name: "Compare" })).toHaveAttribute("aria-expanded", "true");
    // Both verses, as the mus'haf prints them, here first.
    await expect(r.locator("[data-jump-compare]")).toBeVisible();
    await expect(r.locator("[data-jump-compare]")).toContainText("2:60");
    await expect(r.locator("[data-jump-compare]")).toContainText("7:160");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-compare-${test.info().project.name}.png` });
    await r.getByRole("button", { name: "Go" }).click();
    await expect(jumps(page, "2:60")).toHaveCount(0);
    await expect(page).toHaveURL(/7:160/);
  });

  test("a jump not named yet is named from its row", async ({ page }) => {
    await jumpFrom(page, 66, "2:59", (l) => l.getByRole("button", { name: "Not sure yet" }).click());
    await expect(mark(page, "2:59")).toContainText("?");
    await mark(page, "2:59").click();
    const r = row(jumps(page, "2:59"), "Not sure yet");
    await r.getByRole("button", { name: "Say where" }).click();
    await picker(page, "2:59").getByRole("button").first().click();
    await expect(mark(page, "2:59")).toHaveAttribute("aria-label", "From 2:59 you have jumped to 1 other verse");
  });
});

test.describe("Hifth · jumps in the saved file", () => {
  test("jumps alone are worth a file; they save as version 3 and come back into a cleared device", async ({
    page,
  }, info) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(mark(page, "2:58")).toBeVisible();

    // No bookmark and no note on the device, and still a way to save the jumps.
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sheet.getByRole("button", { name: "Save to a file" }).click(),
    ]);
    const saved = info.outputPath("saved.json");
    await download.saveAs(saved);
    const file = JSON.parse(readFileSync(saved, "utf8")) as { version: number; confusions: { id: string }[] };
    expect(file.version).toBe(3);
    expect(file.confusions.map((c) => c.id).sort()).toEqual(["j1", "j2", "j3", "j4", "j5"]);

    // Clear the device, then load the file back.
    await seed(page, []);
    await page.reload();
    await expect(pageSvg(page, 9)).toBeVisible();
    await expect(mark(page, "2:58")).toHaveCount(0);
    await page.getByRole("button", { name: /what you have opened/ }).click();
    await page.getByTestId("bm-load-file").setInputFiles(saved);
    await expect(page.getByText("5 jumps added from the file")).toBeAttached();
    // A file that brought only jumps does not also say it brought nothing.
    await expect(page.getByText(/Nothing new in that file/)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(mark(page, "2:58")).toBeVisible();
    await expect(mark(page, "2:58").locator("text")).toHaveText("2");

    // Loading the same file again adds nothing: the times are joined, not doubled.
    await page.getByRole("button", { name: /what you have opened/ }).click();
    await page.getByTestId("bm-load-file").setInputFiles(saved);
    await page.keyboard.press("Escape");
    await mark(page, "2:58").click();
    await expect(page.getByRole("dialog", { name: /^Jumps from 2:58/ }).getByText(/^3 times/)).toBeVisible();
  });
});

test.describe("Hifth · all your jumps, in the page map", () => {
  test("the page map lists every jump, the most often first, and a row goes to the verse you left", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p1");
    // Seeded only once the app has started: a write made while it is still
    // starting can lose the page under it (it moved on, once in a full run).
    await expect(pageSvg(page, 1)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    const shelf = sheet.getByRole("region", { name: "Your jumps" });
    const rows = shelf.getByRole("list", { name: "Your jumps" }).getByRole("button");
    // Three times first; then by the latest; the dismissed one is not listed.
    await expect(rows).toHaveText([
      /^From 2:58 to 7:161.*3 times/,
      /^From 2:60 to 7:160.*1 time.*Beaten/,
      /^From 2:59 · not sure where yet.*1 time/,
      /^From 2:58 to 2:35.*1 time/,
    ]);
    if (SHOTS) {
      await shelf.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/jump-shelf-${test.info().project.name}.png` });
    }
    await rows.first().click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/2:58/);
    await expect(mark(page, "2:58")).toBeVisible();
  });

  test("the lists under the page map stay put while its record loads", async ({ page }) => {
    // The sheet says "Opening the record…" until the record is read, and the
    // swap to the map used to take the bookmark, note and jump lists out and
    // put them back. On a phone they were gone for a moment: a tap, a fold
    // just opened, or a test holding the list landed on nothing.
    await page.goto("/#/hafs-kfqc/p1");
    await expect(pageSvg(page, 1)).toBeVisible();
    await seed(page, JUMPS);
    await page.reload();
    await expect(pageSvg(page, 1)).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { taken: string[] };
      w.taken = [];
      new MutationObserver((changes) => {
        for (const c of changes)
          for (const n of c.removedNodes)
            if (n instanceof Element && n.matches("section") && (c.target as Element).closest('[role="dialog"]'))
              w.taken.push(n.getAttribute("aria-labelledby") ?? "?");
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    await expect(sheet.getByRole("list", { name: "Map of the mus'haf" })).toBeVisible();
    await expect(sheet.getByRole("list", { name: "Your jumps" }).getByRole("button")).toHaveCount(4);
    expect(await page.evaluate(() => (window as unknown as { taken: string[] }).taken)).toEqual([]);
  });

  test("a dismissed jump leaves the page, and the page map keeps it to bring back", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await seed(page, [jump("j1", "2:58", "7:161", [1_000])]);
    await page.reload();
    await mark(page, "2:58").click();
    const list = page.getByRole("dialog", { name: "Jumps from 2:58" });
    await list.getByRole("listitem").filter({ hasText: "7:161" }).getByRole("button", { name: "Dismiss" }).click();
    // Its only row gone, the list closes, and the mark with it.
    await expect(list).toHaveCount(0);
    await expect(mark(page, "2:58")).toHaveCount(0);
    await expect(undoBar(page)).toContainText("Jump from 2:58 to 7:161 dismissed; it stays under Your jumps");

    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    const shelf = sheet.getByRole("region", { name: "Your jumps" });
    await expect(shelf.getByText(/^No jumps yet\./)).toBeHidden();
    // Bring back here is the same way back as Undo, so the bar steps aside
    // rather than sit over the very list it points to.
    await expect(undoBar(page)).toHaveCount(0);
    const kept = shelf.getByRole("group", { name: "Dismissed · 1" });
    await kept.getByText("Dismissed · 1").click();
    if (SHOTS) {
      await kept.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/jump-dismissed-${test.info().project.name}.png` });
    }
    const back = kept.getByRole("listitem").filter({ hasText: "From 2:58 to 7:161" });
    await back.getByRole("button", { name: "Bring back" }).click();
    await expect(kept).toHaveCount(0);
    await expect(shelf.getByRole("list", { name: "Your jumps" }).getByRole("button")).toHaveText([/^From 2:58 to 7:161/]);
    await page.keyboard.press("Escape");
    await expect(mark(page, "2:58")).toBeVisible();
  });

  test("with no jumps, the list says how to mark one", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p1");
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const shelf = page.getByRole("dialog", { name: "What you have opened" }).getByRole("region", { name: "Your jumps" });
    await expect(shelf.getByText(/^No jumps yet\./)).toBeVisible();
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

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

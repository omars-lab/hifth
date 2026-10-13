import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The eraser (docs/design/notes-style-toolbar.md ③, the owner's pick on
 * 2026-10-12): with it on, a tap on a kept mark takes that one mark off, with
 * no question asked, because Undo puts it back. It sits beside Undo and Redo,
 * stays on for the next mark, and E or a second press puts it down.
 * Run on a computer: every bar carries the same button, and the taps reach
 * the page the same way.
 */
test.use({ locale: "en-US" });

const KEY = (v: string) => `quran/hafs-kfqc/${v}`;
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const eraser = (page: Page): Locator => bar(page).getByRole("button", { name: "Eraser", exact: true });
const undo = (page: Page): Locator => bar(page).getByRole("button", { name: "Undo", exact: true });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const pins = (page: Page): Locator => page.locator("[data-note-pin]:visible");
const box = (page: Page): Locator => page.getByRole("dialog", { name: /^Your note on / });
const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

async function seed(page: Page, sets: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    (sets) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          const store = tx.objectStore("sets");
          for (const [id, value] of Object.entries(sets)) {
            if (id === "scoped-notes") store.delete("notes");
            store.put({ id, ...(value as object) });
          }
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    sets,
  );
}

async function notePin(page: Page, verse: string, words: string): Promise<void> {
  await page.keyboard.press("KeyN");
  const at = await ayahTarget(page, verse);
  await page.mouse.click(at.x, at.y);
  const text = box(page).getByRole("textbox");
  await expect(text).toBeFocused();
  await text.fill(words);
  await page.keyboard.press("Escape");
  await expect(said(page)).toHaveText("Note saved");
}

test.describe("Hifth · the eraser", () => {
  test("a tap takes a mistake off, the eraser stays on, and Undo puts it back", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await page.getByRole("dialog", { name: /^What went wrong in / }).getByRole("button", { name: "The whole word" }).click();
    await expect(washes(page)).toHaveCount(1);

    await expect(eraser(page)).toHaveAttribute("aria-pressed", "false");
    await eraser(page).click();
    await expect(eraser(page)).toHaveAttribute("aria-pressed", "true");
    await page.mouse.click(at.x, at.y);
    await expect(washes(page)).toHaveCount(0);
    await expect(said(page)).toHaveText("Mark cleared");
    // No picker asks which sign: the mark is simply gone.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await undo(page).click();
    await expect(washes(page)).toHaveCount(1);
    // Still on: a tap on a word with no mark takes nothing off and marks nothing.
    await expect(eraser(page)).toHaveAttribute("aria-pressed", "true");
    const plain = await ayahTarget(page, "#verse-50");
    await page.mouse.click(plain.x, plain.y);
    await expect(washes(page)).toHaveCount(1);

    // E puts it down again.
    await page.keyboard.press("KeyE");
    await expect(eraser(page)).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("KeyE");
    await expect(eraser(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("a tap on a note's pin takes the note off without opening it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await notePin(page, "#verse-46", "Made up");
    await expect(pins(page)).toHaveCount(1);

    await page.keyboard.press("KeyE");
    await pins(page).first().click();
    await expect(pins(page)).toHaveCount(0);
    await expect(box(page)).toHaveCount(0);
    await expect(said(page)).toHaveText("Note deleted");

    await undo(page).click();
    await expect(pins(page)).toHaveCount(1);
  });

  test("a note on two verses loses only the pin tapped, and keeps its words", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    const spot = (word: number, x: number, y: number) => ({ page: 7, word, x, y, onHarakah: false });
    await seed(page, {
      "scoped-notes": {
        notes: [
          {
            id: "two",
            kind: "comment",
            scope: { type: "page", edition: "hafs-kfqc", page: 7 },
            text: "Made up words",
            verses: [
              { key: KEY("2:39"), addedAt: 1_000, spot: spot(2, 210, 180) },
              { key: KEY("2:40"), addedAt: 2_000, spot: spot(3, 140, 260) },
            ],
            createdAt: 1_000,
            updatedAt: 2_000,
            usedAt: 2_000,
          },
        ],
      },
    });
    await page.reload();
    await expect(pins(page)).toHaveCount(2);

    await page.keyboard.press("KeyE");
    await pins(page).first().click();
    await expect(pins(page)).toHaveCount(1);
    await expect(said(page)).toHaveText("Verse taken out of the note");

    // The words are still on the pin left.
    await page.keyboard.press("KeyE");
    await pins(page).first().click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Made up words");
  });

  test("a tap on a ribbon lifts the bookmark without opening its drawer", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await drawer.getByLabel("Name").fill("Keep");
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();
    const ribbon = page.getByRole("button", { name: "Bookmark: Keep" });
    await expect(ribbon).toBeVisible();

    await eraser(page).click();
    await ribbon.click();
    await expect(ribbon).toHaveCount(0);
    await expect(drawer).toHaveCount(0);
    await expect(said(page)).toHaveText("Bookmark lifted: Keep");

    await undo(page).click();
    await expect(ribbon).toBeVisible();
  });

  test("a tap on a jump mark takes off that verse's jumps and leaves the others", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    const jump = (id: string, from: string, to: string | null, at: number) => ({
      id,
      from: { key: KEY(from), word: 3 },
      to: to ? { key: KEY(to) } : null,
      times: [{ at, device: "d-test" }],
      state: "sometimes",
      createdAt: at,
      updatedAt: at,
    });
    await seed(page, {
      confusions: {
        confusions: [jump("j1", "2:58", "7:161", 1_000), jump("j2", "2:58", "2:35", 2_000), jump("j3", "2:59", null, 3_000)],
      },
    });
    await page.reload();
    const mark = (verse: string) => pageSvg(page, 9).locator(`[data-confusion-mark="${verse}"]`);
    await expect(mark("2:58")).toBeVisible();

    await page.keyboard.press("KeyE");
    await mark("2:58").click();
    await expect(mark("2:58")).toHaveCount(0);
    await expect(mark("2:59")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(said(page)).toHaveText("Jumps from 2:58 erased");

    await undo(page).click();
    await expect(mark("2:58")).toBeVisible();
  });
});

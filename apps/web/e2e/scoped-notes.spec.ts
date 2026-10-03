import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { ayahTarget } from "./ayah";

/*
 * Scoped notes, step 2 (docs/design/scoped-notes.md): the first time the app
 * opens after the upgrade, every note pinned the old way moves across into a
 * note that gathers verses, scoped to its page. The pins look exactly as
 * before, a marked mistake stays where it was, the old record is left as a
 * backup, and opening the app again adds nothing.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const pins = (page: Page): Locator => page.locator("[data-note-pin]:visible");
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const box = (page: Page): Locator => page.getByRole("dialog", { name: /^Your note on / });
const choices = (page: Page): Locator => box(page).getByRole("group", { name: "Or add this verse to" });

const KEY = (v: number) => `quran/hafs-kfqc/2:${v}`;
/** Two notes and one marked mistake, written the way the app before the upgrade wrote them. */
const OLD_NOTES = [
  {
    id: "nold1",
    key: KEY(39),
    page: 7,
    word: 2,
    x: 210,
    y: 180,
    onHarakah: false,
    kind: "comment",
    text: "Keep the two halves apart",
    createdAt: 1_000,
    updatedAt: 2_000,
  },
  {
    id: "nold2",
    key: KEY(40),
    page: 7,
    word: 3,
    x: 140,
    y: 260,
    onHarakah: true,
    mark: 1,
    kind: "question",
    text: "Which way is the waqf here?",
    createdAt: 3_000,
    updatedAt: 3_000,
  },
  {
    id: "nold3",
    key: KEY(41),
    page: 7,
    word: 1,
    x: 300,
    y: 320,
    onHarakah: false,
    kind: "correction",
    text: "",
    createdAt: 4_000,
    updatedAt: 4_000,
  },
];

/** One record from the device's bookmark store, or null when there is none. */
function readRecord(page: Page, id: string): Promise<{ notes: Record<string, unknown>[] } | null> {
  return page.evaluate(
    (id) =>
      new Promise<{ notes: Record<string, unknown>[] } | null>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction("sets").objectStore("sets").get(id);
          get.onsuccess = () => {
            open.result.close();
            resolve((get.result as { notes: Record<string, unknown>[] } | undefined) ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    id,
  );
}

async function seedOldNotes(page: Page): Promise<void> {
  await page.evaluate(
    (notes) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          const sets = tx.objectStore("sets");
          sets.put({ id: "notes", notes });
          sets.delete("scoped-notes");
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    OLD_NOTES,
  );
}

async function clearNotes(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          tx.objectStore("sets").delete("notes");
          tx.objectStore("sets").delete("scoped-notes");
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test.describe("Hifth · notes moved across on upgrade", () => {
  test("today's pins survive the upgrade, look the same, and a second open adds nothing", async ({ page }) => {
    // Open once so the device's store exists, then put the old notes in it as
    // the app before the upgrade would have left them.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();

    // Both pins, each exactly where it was pinned; the mistake still marked.
    await expect(pins(page)).toHaveCount(2);
    await expect(page.locator('[data-note-id="nold1"]')).toHaveAttribute("transform", "translate(210 180) scale(1.4)");
    await expect(page.locator('[data-note-id="nold2"]')).toHaveAttribute("transform", "translate(140 260) scale(1.4)");
    await expect(washes(page)).toHaveCount(1);

    // The new record holds two notes of one verse each, scoped to page 7, pin kept.
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length ?? 0).toBe(2);
    const moved = (await readRecord(page, "scoped-notes"))!.notes;
    const first = moved.find((n) => n.id === "nold1")!;
    expect(first.scope).toEqual({ type: "page", edition: "hafs-kfqc", page: 7 });
    expect(first.text).toBe("Keep the two halves apart");
    expect(first.verses).toEqual([
      { key: KEY(39), addedAt: 1_000, spot: { page: 7, word: 2, x: 210, y: 180, onHarakah: false } },
    ]);
    expect(moved.find((n) => n.id === "nold2")!.kind).toBe("question");

    // The old record is left exactly as it was, as a backup.
    expect((await readRecord(page, "notes"))!.notes).toEqual(OLD_NOTES);

    // Opening the app again moves nothing twice.
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(pins(page)).toHaveCount(2);
    await expect(washes(page)).toHaveCount(1);
    expect((await readRecord(page, "scoped-notes"))!.notes).toHaveLength(2);

    // A moved note opens with its words, and an edit lands in the new record only.
    await page.locator('[data-note-id="nold1"]').click();
    const text = box(page).getByRole("textbox");
    await expect(text).toHaveValue("Keep the two halves apart");
    await text.fill("Keep the two halves apart, then join");
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Note saved");
    const edited = (await readRecord(page, "scoped-notes"))!.notes.find((n) => n.id === "nold1")!;
    expect(edited.text).toBe("Keep the two halves apart, then join");
    expect((await readRecord(page, "notes"))!.notes).toEqual(OLD_NOTES);
  });

  test("a note pinned after the upgrade is kept as a note of one verse, and deleting it removes it", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    // With no note yet, there is nothing to add the verse to, so the box offers nothing.
    await expect(box(page).getByRole("textbox")).toBeFocused();
    await expect(choices(page)).toHaveCount(0);
    await box(page).getByRole("textbox").fill("A fresh one");
    await page.keyboard.press("Escape");
    await expect(pins(page)).toHaveCount(1);

    const kept = (await readRecord(page, "scoped-notes"))!.notes;
    expect(kept).toHaveLength(1);
    expect(kept[0]!.text).toBe("A fresh one");
    expect(kept[0]!.verses).toHaveLength(1);
    expect((kept[0]!.verses as { spot?: unknown }[])[0]!.spot).toBeTruthy();
    // Nothing new goes into the old record: it is only a backup now.
    expect((await readRecord(page, "notes"))?.notes ?? []).toEqual([]);

    await pins(page).first().click();
    await box(page).getByRole("button", { name: "Delete note" }).click();
    await expect(pins(page)).toHaveCount(0);
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))!.notes.length).toBe(0);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(pins(page)).toHaveCount(0);
  });

  test("notes save to a file without any bookmark, and come back from it; an old file's notes come too", async ({
    page,
  }, info) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await box(page).getByRole("textbox").fill("Carried in the file");
    await page.keyboard.press("Escape");
    await expect(pins(page)).toHaveCount(1);

    // No bookmark on the device, and still a way to save the notes.
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sheet.getByRole("button", { name: "Save to a file" }).click(),
    ]);
    const saved = info.outputPath("saved.json");
    await download.saveAs(saved);
    const file = JSON.parse(readFileSync(saved, "utf8")) as { version: number; scopedNotes: { text: string }[] };
    expect(file.version).toBe(2);
    expect(file.scopedNotes.map((n) => n.text)).toEqual(["Carried in the file"]);

    // Clear the device, then load the file back.
    await clearNotes(page);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await expect(pins(page)).toHaveCount(0);
    await page.getByRole("button", { name: /what you have opened/ }).click();
    await page.getByTestId("bm-load-file").setInputFiles(saved);
    await expect(pins(page)).toHaveCount(1);
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length ?? 0).toBe(1);

    // A file saved before the upgrade: its note moves across as it loads.
    const old = info.outputPath("old.json");
    writeFileSync(
      old,
      JSON.stringify({ kind: "hifth.bookmarks", version: 1, savedAt: 1, bookmarks: [], notes: [OLD_NOTES[1]] }),
    );
    await page.getByTestId("bm-load-file").setInputFiles(old);
    await expect(pins(page)).toHaveCount(2);
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length ?? 0).toBe(2);
    const ids = (await readRecord(page, "scoped-notes"))!.notes.map((n) => n.id);
    expect(ids).toContain("nold2");
  });

  test("a fresh pin offers the notes it could join, and one tap adds the verse to that note", async ({ page }) => {
    // Two notes on page 7, moved across from before the upgrade.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);

    // A tap with the note tool still makes a new note at once, ready to type in…
    await page.keyboard.press("KeyN");
    // A verse's mark is named by its number counted through the whole Qur'an: 53 is 2:46.
    const at = await ayahTarget(page, "#verse-53");
    await page.mouse.click(at.x, at.y);
    await expect(box(page).getByRole("textbox")).toBeFocused();
    await expect(pins(page)).toHaveCount(3);
    // …and offers the notes on this page, the last used first. (A verse already
    // in a note is never offered that note: tapping 2:39 would offer only one.)
    await expect(choices(page).getByRole("button")).toHaveText(["Which way is the waqf here?", "Keep the two halves apart"]);

    // One tap: the verse joins that note, the box shows the note, and the fresh note is gone.
    await choices(page).getByRole("button", { name: "Keep the two halves apart" }).click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Keep the two halves apart");
    await expect(box(page)).toContainText("Page 7 · 2 verses");
    await expect(box(page)).toContainText("added to this note");
    await expect(choices(page)).toHaveCount(0);
    await expect(pins(page)).toHaveCount(3);
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length ?? 0).toBe(2);
    const joined = (await readRecord(page, "scoped-notes"))!.notes.find((n) => n.id === "nold1")!;
    expect((joined.verses as { key: string }[]).map((v) => v.key)).toEqual([KEY(39), KEY(46)]);

    // Undo puts it back as it was: a new note of its own, with the choices again.
    await box(page).getByRole("button", { name: "Undo" }).click();
    await expect(box(page).getByRole("textbox")).toHaveValue("");
    await expect(choices(page).getByRole("button")).toHaveCount(2);
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length ?? 0).toBe(3);
    const back = (await readRecord(page, "scoped-notes"))!.notes.find((n) => n.id === "nold1")!;
    expect((back.verses as { key: string }[]).map((v) => v.key)).toEqual([KEY(39)]);

    // Join again and write in the note: the words are the note's, on both its pins.
    await choices(page).getByRole("button", { name: "Keep the two halves apart" }).click();
    const text = box(page).getByRole("textbox");
    await expect(text).toHaveValue("Keep the two halves apart");
    await text.fill("Keep the two halves apart, in both");
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Note saved");
    await page.reload();
    await expect(pins(page)).toHaveCount(3);
    await page.locator('[data-note-id="nold1"]').click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Keep the two halves apart, in both");
    // An opened note is not fresh: it offers nothing to join.
    await expect(choices(page)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // On a note of several verses, the box takes out only this verse, and Undo puts it back in the same note.
    await page.locator('[data-note-id="nold1~2:46"]').click();
    await box(page).getByRole("button", { name: "Take this verse out" }).click();
    await expect(pins(page)).toHaveCount(2);
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Verse taken out of the note");
    await expect
      .poll(async () => ((await readRecord(page, "scoped-notes"))!.notes.find((n) => n.id === "nold1")!.verses as unknown[]).length)
      .toBe(1);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(pins(page)).toHaveCount(3);
    await expect
      .poll(async () => ((await readRecord(page, "scoped-notes"))!.notes.find((n) => n.id === "nold1")!.verses as unknown[]).length)
      .toBe(2);
    expect((await readRecord(page, "scoped-notes"))!.notes).toHaveLength(2);
  });
});

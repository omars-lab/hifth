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
  // These pick the note tool from the desktop's tool keys. The list of notes
  // and following one, below, run on the phones too.
  test.skip(({ isMobile }) => isMobile, "picks the note tool from the desktop's keys");
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

/** A note of three verses on three pages, held without pins, and a page note with one. */
const HELD = [
  {
    id: "nj1",
    kind: "comment",
    scope: { type: "juz", juz: 1 },
    text: "Juz 1 weak spots\nWatch the madd before the pause in each.",
    verses: [
      { key: KEY(39), addedAt: 1_000 },
      { key: KEY(58), addedAt: 1_000 },
      { key: KEY(124), addedAt: 1_000 },
    ],
    createdAt: 1_000,
    updatedAt: 1_000,
    usedAt: 5_000,
  },
  {
    id: "np7",
    kind: "question",
    scope: { type: "page", edition: "hafs-kfqc", page: 7 },
    text: "Which way is the waqf here?",
    verses: [{ key: KEY(40), addedAt: 3_000, spot: { page: 7, word: 3, x: 140, y: 260, onHarakah: false } }],
    createdAt: 3_000,
    updatedAt: 3_000,
    usedAt: 3_000,
  },
];

async function seedHeld(page: Page): Promise<void> {
  await page.evaluate(
    (notes) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("hifth.bookmarks.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          const sets = tx.objectStore("sets");
          sets.delete("notes");
          sets.put({ id: "scoped-notes", notes });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    HELD,
  );
}

test.describe("Hifth · the list of notes, and following one", () => {
  test("the page map lists your notes, the last used first, and one can be followed verse by verse", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.getByRole("button", { name: /what you have opened/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    const list = sheet.getByRole("region", { name: "Your notes" });
    await expect(list.getByRole("button")).toHaveText([
      /^Juz 1 weak spots\s*Juz 1 · 3 verses$/,
      /^Which way is the waqf here\?\s*Page 7 · 1 verse$/,
    ]);

    await list.getByRole("button", { name: /Juz 1 weak spots/ }).click();
    await expect(sheet).toBeHidden();
    const bar = page.getByRole("group", { name: "Following a note" });
    await expect(bar).toContainText("Juz 1 weak spots");
    await expect(bar).toContainText("1 of 3");
    await expect(page.locator("header .numeric")).toHaveText("7");
    await expect(page.getByRole("button", { name: /Current ayah Al-Baqarah · 2:39/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Previous verse in this note" })).toBeDisabled();
    // The note's own words are a tap away, and fold back.
    const words = bar.getByText("Watch the madd before the pause in each.");
    await expect(words).toHaveCount(0);
    const title = bar.getByRole("button", { name: "Juz 1 weak spots" });
    await expect(title).toHaveAttribute("aria-expanded", "false");
    await title.click();
    await expect(words).toBeVisible();
    await expect(title).toHaveAttribute("aria-expanded", "true");
    await title.click();
    await expect(words).toHaveCount(0);
    // The bar stays clear of the tools, and of the undo line when one shows.
    expect(await buttonsUnder(page, '[aria-label="Following a note"]')).toEqual([]);
    await page.locator('[data-note-id="np7"]').click();
    await box(page).getByRole("button", { name: "Delete note" }).click();
    const undoLine = page.locator("[data-undo-bar]");
    await expect(undoLine).toBeVisible();
    expect(apart(await bar.boundingBox(), await undoLine.boundingBox())).toBe(true);
    await undoLine.getByRole("button", { name: "Undo" }).click();
    await expect(undoLine).toHaveCount(0);
    await expect(bar).toContainText("1 of 3");

    const next = bar.getByRole("button", { name: "Next verse in this note" });
    await next.click();
    await expect(bar).toContainText("2 of 3");
    await expect(page.locator("header .numeric")).toHaveText("9");
    await expect(page.getByRole("button", { name: /Current ayah Al-Baqarah · 2:58/ })).toBeVisible();

    await next.click();
    await expect(bar).toContainText("3 of 3");
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(next).toBeDisabled();

    await bar.getByRole("button", { name: "Previous verse in this note" }).click();
    await expect(bar).toContainText("2 of 3");
    await expect(page.locator("header .numeric")).toHaveText("9");

    // Leaving: the bar goes, and the reader stays where they are.
    await bar.getByRole("button", { name: "Stop following this note" }).click();
    await expect(bar).toHaveCount(0);
    await expect(page.locator("header .numeric")).toHaveText("9");
  });

  test("with no notes, the list says how to make one", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await clearNotes(page);
    await page.reload();
    await page.getByRole("button", { name: /what you have opened/ }).click();
    const list = page.getByRole("dialog", { name: "What you have opened" }).getByRole("region", { name: "Your notes" });
    await expect(list).toContainText("No notes yet. Pick the note tool and tap a word to start one.");
  });
});

type Box = { x: number; y: number; width: number; height: number } | null;
/** Two boxes on screen that do not overlap. */
function apart(a: Box, b: Box): boolean {
  if (!a || !b) return false;
  return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

/** The buttons outside `sel` that it sits on top of, by their names: none, for a bar that covers nothing. */
function buttonsUnder(page: Page, sel: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const bar = document.querySelector(sel);
    if (!bar) return ["(no bar)"];
    return [...document.querySelectorAll("button")]
      .filter((b) => !bar.contains(b))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top !== null && bar.contains(top);
      })
      .map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
  }, sel);
}

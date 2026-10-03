import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { ayahTarget } from "./ayah";
import { SCOPE_LOOK_KEY } from "../src/scope-look";

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

/**
 * Start a note on a verse the way each device does: the note tool's key and a
 * tap on the computer, and on a phone (which has no tool keys) a hold on the
 * verse and "Note" from its menu. Both open the same fresh note.
 */
async function startNote(page: Page, selector: string, isMobile: boolean): Promise<void> {
  const at = await ayahTarget(page, selector);
  if (!isMobile) {
    await page.keyboard.press("KeyN");
    await page.mouse.click(at.x, at.y);
    return;
  }
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.getByRole("menu", { name: /^More for / }).getByRole("menuitem", { name: "Note" }).click();
}

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
    isMobile,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await startNote(page, "#verse-46", isMobile);
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
    isMobile,
  }, info) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await startNote(page, "#verse-46", isMobile);
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

  test("a fresh pin offers the notes it could join, and one tap adds the verse to that note", async ({ page, isMobile }) => {
    // Two notes on page 7, moved across from before the upgrade.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);

    // A tap with the note tool still makes a new note at once, ready to type in…
    // A verse's mark is named by its number counted through the whole Qur'an: 53 is 2:46.
    await startNote(page, "#verse-53", isMobile);
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
    // Open the page afresh. (A phone's address still names the held verse, and
    // reopening that would scroll the first pin up under the top bar.)
    await page.goto("/#/hafs-kfqc/p7");
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

async function seedHeld(page: Page, held: readonly unknown[] = HELD): Promise<void> {
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
    held,
  );
}

/*
 * Step 5: "Note" in the menu a hold on a verse opens. It is the phone's quick
 * way in, so it runs on phones too, and does what a pin does: a new note at
 * once, with the notes this verse could join as one-tap choices.
 */
test.describe("Hifth · Note from the verse menu", () => {
  test("Note in a verse's menu starts a note with the notes it could join, and one tap joins", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);

    // Hold 2:46 (its mark is 53, counted through the whole Qur'an) still past the hold time.
    const at = await ayahTarget(page, "#verse-53");
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    const menu = page.getByRole("menu", { name: /^More for / });
    await menu.getByRole("menuitem", { name: "Note" }).click();
    await expect(menu).toHaveCount(0);

    await expect(box(page).getByRole("textbox")).toBeFocused();
    await expect(pins(page)).toHaveCount(3);
    await expect(choices(page).getByRole("button")).toHaveText(["Which way is the waqf here?", "Keep the two halves apart"]);

    await choices(page).getByRole("button", { name: "Keep the two halves apart" }).click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Keep the two halves apart");
    await expect(box(page)).toContainText("Page 7 · 2 verses");
    await expect(choices(page)).toHaveCount(0);
    await expect
      .poll(async () => ((await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === "nold1")?.verses as { key: string }[] | undefined)?.map((v) => v.key))
      .toEqual([KEY(39), KEY(46)]);
    expect((await readRecord(page, "scoped-notes"))!.notes).toHaveLength(2);
  });
});

/** The parts after the three narrowest, around page 7. */
const WIDE_PARTS = ["Page 7", "Hizb 1", "Juz 1", "Al-Baqarah", "The whole Qur'an"];

/** Whether the whole note box, Done included, is inside the window. */
async function insideWindow(page: Page): Promise<boolean> {
  const r = (await box(page).boundingBox())!;
  return r.y >= 0 && r.y + r.height <= page.viewportSize()!.height;
}

/** Which of the looks the parts are drawn in. */
function drawnAs(group: Locator): Promise<string | null> {
  return group.evaluate((g) => g.closest("[data-look]")?.getAttribute("data-look") ?? null);
}

/** Each part's drawn shape as it shows on screen: the part of it a slice's clip leaves. */
function shapes(tiers: Locator): Promise<{ width: number; height: number; top: number; left: number }[]> {
  return tiers.evaluateAll((bs) =>
    bs.map((b) => {
      const shape = b.querySelector("[data-tier-shape]")!;
      const r = shape.getBoundingClientRect();
      const clip = /polygon\(([\d.]+)% 0%, ([\d.]+)% 0%/.exec(getComputedStyle(shape).clipPath);
      const share = clip ? (Number(clip[2]) - Number(clip[1])) / 100 : 1;
      const at = b.getBoundingClientRect();
      return { width: r.width * share, height: r.height, top: at.top, left: at.left };
    }),
  );
}

/** Each tier's name as a screen reader says it, top of the pyramid first. */
async function tierNames(group: Locator): Promise<string[]> {
  return group.getByRole("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? ""));
}

/*
 * Step 7: changing what a note is about. Widening always works, and lets the
 * note be offered on more pages; narrowing works only if every verse still
 * fits, and otherwise names the verse that would fall out and changes nothing.
 */
test.describe("Hifth · changing what a note is about", () => {
  test("a note widened to its juz is offered on the next page, and cannot be narrowed back past a verse it holds", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);

    // The box names what the note is about, and that name is the way to change it.
    await page.locator('[data-note-id="nold1"]').click();
    const about = box(page).getByRole("button", { name: "Page 7: change what this note is about" });
    await about.click();
    const parts = box(page).getByRole("group", { name: "What is this note about?" });
    // Its pin is on a whole word, so there is no harakah for it to be about.
    await expect(tierNames(parts)).resolves.toEqual([
      "Harakah",
      "A word of Al-Baqarah · 2:39",
      "Al-Baqarah · 2:39",
      ...WIDE_PARTS,
    ]);
    await expect(parts.getByRole("button", { pressed: true })).toHaveAccessibleName("Page 7");
    await parts.getByRole("button", { name: "Juz 1" }).click();
    await expect(parts).toHaveCount(0);
    // The picked button went with the list, so focus comes back to the line it opened from, and Escape still closes the box.
    await expect(box(page).getByRole("button", { name: "Juz 1: change what this note is about" })).toBeFocused();
    await expect
      .poll(async () => (await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === "nold1")?.scope)
      .toEqual({ type: "juz", juz: 1 });
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);

    // On the next page, a fresh pin is offered the widened note, and not the one still about page 7.
    await page.goto("/#/hafs-kfqc/p8");
    await expect(pageSvg(page, 8)).toBeVisible();
    await startNote(page, "#verse-57", isMobile); // 2:50
    await expect(choices(page).getByRole("button")).toHaveText(["Keep the two halves apart"]);
    await choices(page).getByRole("button", { name: "Keep the two halves apart" }).click();
    await expect(box(page)).toContainText("2 verses");

    // Back to page 7 would leave 2:50 outside: the box says so and changes nothing.
    await box(page).getByRole("button", { name: "Juz 1: change what this note is about" }).click();
    await box(page).getByRole("group", { name: "What is this note about?" }).getByRole("button", { name: "Page 7" }).click();
    await expect(box(page)).toContainText("Al-Baqarah · 2:50 is not in Page 7. Take it out of the note first.");
    await expect
      .poll(async () => (await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === "nold1")?.scope)
      .toEqual({ type: "juz", juz: 1 });
  });

  test("the parts stand as a pyramid, the narrowest on top, and each one's letter picks it", async ({ page, isMobile }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);
    const scopeOf = async (id: string) => (await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === id)?.scope;
    const group = box(page).getByRole("group", { name: "What is this note about?" });

    // A pin on a harakah: every tier can be picked, harakah at the top, the whole Qur'an at the base.
    await page.locator('[data-note-id="nold2"]').click();
    await box(page).getByRole("button", { name: "Page 7: change what this note is about" }).click();
    const tiers = group.getByRole("button");
    await expect(tiers).toHaveCount(8);
    // The box grew by the parts' height; it moves so all of it, Done too, stays in the window.
    await expect.poll(() => insideWindow(page)).toBe(true);
    expect(await tiers.evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-keyshortcuts")))).toEqual(["H", "W", "A", "P", "Z", "J", "S", "Q"]);
    await expect(group.getByRole("button", { disabled: true })).toHaveCount(0);
    // Unless the reader chose another look, the parts are short lines with nothing written on
    // them, a pyramid on its side: the whole Qur'an the longest, on the left, down to one harakah
    // on the right.
    expect(await drawnAs(group)).toBe("side");
    const shown = await shapes(tiers);
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]!.height).toBeGreaterThan(shown[i - 1]!.height);
      expect(shown[i]!.left).toBeLessThan(shown[i - 1]!.left);
    }
    // All eight in the box, the shortest too: a row too wide once pushed two off its edge.
    const card = (await box(page).boundingBox())!;
    for (const b of await tiers.all()) {
      const r = (await b.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(card.x);
      expect(r.x + r.width).toBeLessThanOrEqual(card.x + card.width);
    }
    const letter = (name: string) => group.getByRole("button", { name }).locator("kbd");
    await expect(letter("Juz 1")).toHaveCSS("opacity", "0");
    // Pointing at a line shows its letter in its middle, and its name under the stack.
    if (!isMobile) {
      await group.getByRole("button", { name: "Juz 1" }).hover();
      await expect(letter("Juz 1")).toHaveCSS("opacity", "1");
      await expect(group.locator("xpath=..")).toContainText("Juz 1");
    }
    // The current part has focus, so the letters work straight away; W is not the word tool here.
    await expect(group.getByRole("button", { pressed: true })).toBeFocused();
    await page.keyboard.press("w");
    await expect(group).toHaveCount(0);
    await expect.poll(() => scopeOf("nold2")).toEqual({ type: "word", key: KEY(40), word: 3 });
    const head = box(page).getByRole("button", { name: "A word of Al-Baqarah · 2:40: change what this note is about" });
    await expect(head).toBeFocused();
    await expect(box(page)).toContainText(/^Al-Baqarah · 2:40 · Word/);
    await expect(page.getByRole("toolbar").getByRole("button", { pressed: true })).toHaveCount(0);

    await head.click();
    await page.keyboard.press("h");
    await expect.poll(() => scopeOf("nold2")).toEqual({ type: "harakah", key: KEY(40), word: 3, mark: 1 });
    await box(page).getByRole("button", { name: "A harakah of Al-Baqarah · 2:40: change what this note is about" }).click();
    await page.keyboard.press("Q");
    await expect.poll(() => scopeOf("nold2")).toEqual({ type: "whole" });
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);

    // A pin on a whole word has no harakah to be about: that tier stands greyed, and its letter does nothing.
    await page.locator('[data-note-id="nold1"]').click();
    await box(page).getByRole("button", { name: "Page 7: change what this note is about" }).click();
    await expect(group.getByRole("button", { disabled: true })).toHaveAccessibleName("Harakah");
    await expect.poll(() => insideWindow(page)).toBe(true);
    await page.keyboard.press("h");
    await expect(group).toBeVisible();
    await page.keyboard.press("a");
    await expect.poll(() => scopeOf("nold1")).toEqual({ type: "ayah", key: KEY(39) });
  });
});

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

/** Page 7's look-alikes, held without pins: 2:39 is then in two notes, 2:44 in one. */
const LOOKALIKES = {
  id: "nq7",
  kind: "comment",
  scope: { type: "page", edition: "hafs-kfqc", page: 7 },
  text: "Page 7 look-alikes",
  verses: [
    { key: KEY(44), addedAt: 2_000 },
    { key: KEY(39), addedAt: 2_000 },
  ],
  createdAt: 2_000,
  updatedAt: 2_000,
  usedAt: 4_000,
};

test.describe("Hifth · a dot by the verse number for a verse in a note", () => {
  test("an Escape pressed the moment the list of a verse's notes appears closes it", async ({ page }) => {
    // The list's code arrives on first open, so it is drawn by no tap of the
    // reader's; a quick Escape must still reach it, not fall on the page.
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [...HELD, LOOKALIKES]);
    await page.reload();
    const dot = pageSvg(page, 7).locator('[data-verse-dot="2:39"]');
    await expect(dot).toBeVisible();
    await page.evaluate(() => {
      // Press Escape inside the same task the list is added to the page, before any frame is drawn.
      new MutationObserver((_, watch) => {
        if (!document.querySelector('[role="dialog"][aria-label="2:39 is in 2 notes"]')) return;
        watch.disconnect();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }).observe(document.body, { childList: true, subtree: true });
    });
    await dot.click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog", { name: "2:39 is in 2 notes" })).toHaveCount(0);
  });

  test("a dot sits on the number of each verse in a note, counts the notes, and lists them on a tap", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [...HELD, LOOKALIKES]);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();

    const dot = (verse: number) => pageSvg(page, 7).locator(`[data-verse-dot="2:${verse}"]`);
    await expect(pageSvg(page, 7).locator("[data-verse-dot]")).toHaveCount(2);
    await expect(dot(39)).toHaveText("2");
    await expect(dot(39)).toHaveAttribute("aria-label", "2:39 is in 2 notes");
    await expect(dot(44)).toHaveText("");
    await expect(dot(44)).toHaveAttribute("aria-label", "2:44 is in 1 note");
    // 2:40 is only in a note pinned on one of its words: the pin already shows it.
    await expect(dot(40)).toHaveCount(0);

    // On the verse's number: the left end of its last line.
    const verse = await pageSvg(page, 7).locator('path.ayahPolygon[surah="2"][ayah="39"]').boundingBox();
    const at = await dot(39).boundingBox();
    expect(verse && at).toBeTruthy();
    const cx = at!.x + at!.width / 2;
    const cy = at!.y + at!.height / 2;
    expect(cx - verse!.x).toBeLessThan(verse!.width * 0.15);
    expect(cy - verse!.y).toBeGreaterThan(verse!.height * 0.5);
    // Big enough to hit with a thumb, though it is drawn small.
    expect(Math.min(at!.width, at!.height)).toBeGreaterThanOrEqual(24);

    await dot(39).click();
    const list = page.getByRole("dialog", { name: "2:39 is in 2 notes" });
    await expect(list.getByRole("button")).toHaveText([
      /^Juz 1 weak spots\s*Juz 1 · 3 verses$/,
      /^Page 7 look-alikes\s*Page 7 · 2 verses$/,
    ]);
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();

    // A row follows that note from this verse.
    await dot(39).click();
    await list.getByRole("button", { name: /Page 7 look-alikes/ }).click();
    await expect(list).toBeHidden();
    const bar = page.getByRole("group", { name: "Following a note" });
    await expect(bar).toContainText("Page 7 look-alikes");
    await expect(bar).toContainText("2 of 2");
  });

  test("each page draws its own dots as it arrives", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [...HELD, LOOKALIKES]);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    const dot = (verse: number) => pageSvg(page, 7).locator(`[data-verse-dot="2:${verse}"]`);
    await expect(dot(44)).toHaveCount(1);
    await page.goto("/#/hafs-kfqc/p9");
    await expect(pageSvg(page, 9)).toBeVisible();
    await expect(pageSvg(page, 9).locator('[data-verse-dot="2:58"]')).toHaveCount(1);
  });

  test("on a two-page spread the list opens beside its dot, not across both pages", async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone shows one page, and the list takes its width");
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 8)).toBeVisible();
    // 2:51 ends at the outer edge of the left-hand page, far from the fold.
    await seedHeld(page, [{ ...LOOKALIKES, scope: { type: "juz", edition: "hafs-kfqc", juz: 1 }, verses: [{ key: KEY(51), addedAt: 2_000 }] }]);
    await page.reload();
    const dot = pageSvg(page, 8).locator('[data-verse-dot="2:51"]');
    // Measured only once each is there: the list's code arrives on first open,
    // and a box read before then is nothing (it failed 1 push in many).
    await expect(dot).toBeVisible();
    const at = await dot.boundingBox();
    await dot.click();
    const list = page.getByRole("dialog", { name: "2:51 is in 1 note" });
    await expect(list).toBeVisible();
    const card = await list.boundingBox();
    expect(at && card).toBeTruthy();
    const dotX = at!.x + at!.width / 2;
    expect(card!.x).toBeLessThanOrEqual(dotX);
    expect(card!.x + card!.width).toBeGreaterThanOrEqual(dotX);
    // And it stays on the page the dot is on: it does not reach past the fold.
    const fold = (await pageSvg(page, 8).boundingBox())!;
    expect(card!.x + card!.width).toBeLessThanOrEqual(fold.x + fold.width + 24);
  });
});

/*
 * Step 6 (docs/design/scoped-notes.md): a hold on the juz or surah name at the
 * top of the page, or on the page number, offers the notes about that part and
 * a new note about it. A note about a juz is reached from the juz's own label,
 * not from a mark squeezed onto the text, and it may hold no verse yet.
 */
test.describe("Hifth · notes from the juz, surah and page labels", () => {
  const corner = (page: Page, which: "page" | "surah" | "juz"): Locator =>
    page.locator(`[data-host-page="7"] [data-running-head="${which}"]`);
  const menu = (page: Page): Locator => page.getByRole("menu", { name: /^More for / });
  async function holdCorner(page: Page, which: "page" | "surah" | "juz"): Promise<void> {
    const b = (await corner(page, which).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
  }
  const SURAH3 = {
    id: "ns3",
    kind: "comment",
    scope: { type: "surah", surah: 3 },
    text: "Al Imran openings",
    verses: [],
    createdAt: 6_000,
    updatedAt: 6_000,
    usedAt: 6_000,
  };

  test("the juz label lists the notes about it, and a row follows one", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [...HELD, LOOKALIKES, SURAH3]);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();

    await holdCorner(page, "juz");
    await expect(menu(page).getByRole("menuitem")).toHaveText([
      "Play",
      "Go to the start",
      "Notes (3)",
      "New note",
      "Copy",
      "Share",
    ]);
    await menu(page).getByRole("menuitem", { name: "Notes (3)" }).click();
    const list = page.getByRole("dialog", { name: "Notes in Juz 1" });
    // A note about Al Imran is not about juz 1, and holds none of its verses.
    await expect(list.getByRole("button")).toHaveText([
      /^Juz 1 weak spots\s*Juz 1 · 3 verses$/,
      /^Page 7 look-alikes\s*Page 7 · 2 verses$/,
      /^Which way is the waqf here\?\s*Page 7 · 1 verse$/,
    ]);
    await list.getByRole("button", { name: /Juz 1 weak spots/ }).click();
    await expect(list).toBeHidden();
    await expect(page.getByRole("group", { name: "Following a note" })).toContainText("1 of 3");
  });

  test("a new note about a juz holds no verse, keeps its words, and opens again from the list", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, []);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();

    // No notes yet: nothing to list, so the menu does not offer a list.
    await holdCorner(page, "juz");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Play", "Go to the start", "New note", "Copy", "Share"]);

    // Closed with nothing typed, the new note is not kept.
    await menu(page).getByRole("menuitem", { name: "New note" }).click();
    await expect(box(page)).toHaveAccessibleName("Your note on Juz 1");
    await expect(box(page).getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(box(page)).toBeHidden();
    await holdCorner(page, "juz");
    await expect(menu(page).getByRole("menuitem", { name: /^Notes/ })).toHaveCount(0);

    await menu(page).getByRole("menuitem", { name: "New note" }).click();
    await expect(box(page).getByRole("textbox")).toBeFocused();
    await page.keyboard.type("Juz 1 openings\nThe first word of each quarter.");
    await box(page).getByRole("button", { name: "Done" }).click();
    await expect(box(page)).toBeHidden();
    // It draws nothing on the page: it is about the juz, not a verse.
    await expect(pins(page)).toHaveCount(0);
    await expect(pageSvg(page, 7).locator("[data-verse-dot]")).toHaveCount(0);

    // The surah's label does not list it; the juz's does, and a tap opens its words.
    await holdCorner(page, "surah");
    await expect(menu(page).getByRole("menuitem", { name: /^Notes/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Notes (1)" }).click();
    const list = page.getByRole("dialog", { name: "Notes in Juz 1" });
    await expect(list.getByRole("button")).toHaveText([/^Juz 1 openings\s*Juz 1 · no verses yet$/]);
    await list.getByRole("button").click();
    await expect(box(page).getByRole("textbox")).toHaveValue("Juz 1 openings\nThe first word of each quarter.");
    await page.keyboard.press("Escape");

    // It is kept across a reload, as a note about juz 1 with no verse.
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    const held = await readRecord(page, "scoped-notes");
    expect(held?.notes).toEqual([
      expect.objectContaining({ scope: { type: "juz", juz: 1 }, verses: [], text: "Juz 1 openings\nThe first word of each quarter." }),
    ]);
  });

  test("a note with no verse can change what it is about, to any part around the page you are on", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [{ ...SURAH3, id: "nj9", scope: { type: "juz", juz: 1 }, text: "Juz 1 openings" }]);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Notes (1)" }).click();
    await page.getByRole("dialog", { name: "Notes in Juz 1" }).getByRole("button").click();

    // The top line is the part it is about, and that is the way to change it.
    const about = box(page).getByRole("button", { name: "Juz 1: change what this note is about" });
    await expect(box(page)).toContainText(/^Juz 1/);
    await about.click();
    const group = box(page).getByRole("group", { name: "What is this note about?" });
    // With no verse to start from, the parts are the ones around the page open now,
    // and the three that need a verse stand greyed at the top.
    await expect(tierNames(group)).resolves.toEqual(["Harakah", "Word", "Ayah", ...WIDE_PARTS]);
    await expect(group.getByRole("button", { disabled: true })).toHaveCount(3);

    // Holding no verse, it can be widened or narrowed freely.
    await group.getByRole("button", { name: "The whole Qur'an" }).click();
    await expect(box(page).getByRole("button", { name: "The whole Qur'an: change what this note is about" })).toBeFocused();
    await expect
      .poll(async () => (await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === "nj9")?.scope)
      .toEqual({ type: "whole" });
    await box(page).getByRole("button", { name: "The whole Qur'an: change what this note is about" }).click();
    await group.getByRole("button", { name: "Page 7" }).click();
    await expect
      .poll(async () => (await readRecord(page, "scoped-notes"))?.notes.find((n) => n.id === "nj9")?.scope)
      .toEqual({ type: "page", edition: "hafs-kfqc", page: 7 });
    await page.keyboard.press("Escape");
    await expect(box(page)).toBeHidden();

    // About a page of Al-Baqarah now, it is listed from the surah's label, which a juz note is not.
    await holdCorner(page, "surah");
    await expect(menu(page).getByRole("menuitem", { name: "Notes (1)" })).toBeVisible();
  });

  test("a note about a juz can be deleted from its box, and Undo brings it back", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, [{ ...SURAH3, id: "nj9", scope: { type: "juz", juz: 1 }, text: "Juz 1 openings" }]);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Notes (1)" }).click();
    await page.getByRole("dialog", { name: "Notes in Juz 1" }).getByRole("button").click();
    await box(page).getByRole("button", { name: "Delete note" }).click();
    await expect(box(page)).toBeHidden();
    await expect.poll(async () => (await readRecord(page, "scoped-notes"))?.notes.length).toBe(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect
      .poll(async () => (await readRecord(page, "scoped-notes"))?.notes)
      .toEqual([expect.objectContaining({ id: "nj9", scope: { type: "juz", juz: 1 }, text: "Juz 1 openings" })]);
  });

  test("the surah's and the page's labels make notes about the surah and the page", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the page number sits under the phone's bottom bar; the juz test covers phones");
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedHeld(page, []);
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible();
    for (const [which, name] of [["surah", "Al-Baqarah"], ["page", "Page 7"]] as const) {
      await holdCorner(page, which);
      await menu(page).getByRole("menuitem", { name: "New note" }).click();
      await expect(box(page)).toHaveAccessibleName(`Your note on ${name}`);
      await expect(box(page).getByRole("textbox")).toBeFocused();
      await page.keyboard.type(`About ${name}`);
      await box(page).getByRole("button", { name: "Done" }).click();
    }
    await holdCorner(page, "page");
    await menu(page).getByRole("menuitem", { name: "Notes (1)" }).click();
    await expect(page.getByRole("dialog", { name: "Notes on Page 7" }).getByRole("button")).toHaveText([/^About Page 7/]);
    await page.keyboard.press("Escape");
    // The page is inside the surah, so the surah lists both.
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Notes (2)" }).click();
    await expect(page.getByRole("dialog", { name: "Notes in Al-Baqarah" }).getByRole("button")).toHaveText([
      /^About Page 7/,
      /^About Al-Baqarah/,
    ]);
  });

  test("the look of the parts is picked in the about sheet, remembered, and each one is drawn its own way", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();
    await seedOldNotes(page);
    await page.reload();
    await expect(pins(page)).toHaveCount(2);
    const group = box(page).getByRole("group", { name: "What is this note about?" });
    const looks = [
      ["Sideways", "side"],
      ["Lines", "lines"],
      ["Pyramid", "tall"],
      ["Slim", "slim"],
      ["Steps", "steps"],
      ["One line", "trail"],
    ] as const;
    for (const [name, look] of looks) {
      await page.getByRole("button", { name: /About Hifth/ }).click();
      const sheet = page.getByRole("dialog", { name: "About Hifth" });
      const choice = sheet.getByRole("radiogroup", { name: "Picking what a note is about" });
      await choice.getByRole("radio", { name }).click();
      await expect(choice.getByRole("radio", { checked: true })).toHaveText(name);
      expect(await page.evaluate((k) => localStorage.getItem(k), SCOPE_LOOK_KEY)).toBe(look);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);

      await page.locator('[data-note-id="nold2"]').click();
      await box(page).getByRole("button", { name: "Page 7: change what this note is about" }).click();
      expect(await drawnAs(group)).toBe(look);
      await expect.poll(() => insideWindow(page)).toBe(true);
      const shown = await shapes(group.getByRole("button"));
      expect(shown).toHaveLength(8);
      for (let i = 1; i < shown.length; i++) {
        // A pyramid of any build grows wider going down; on its side, or as steps, it grows taller
        // part by part; one line stays level.
        if (look === "steps" || look === "side") expect(shown[i]!.height).toBeGreaterThan(shown[i - 1]!.height);
        else if (look === "trail") expect(Math.abs(shown[i]!.top - shown[0]!.top)).toBeLessThan(2);
        else expect(shown[i]!.width).toBeGreaterThan(shown[i - 1]!.width);
      }
      await page.keyboard.press("Escape");
      await expect(box(page)).toHaveCount(0);
    }
    // Remembered on this device after a reload.
    await page.reload();
    await page.locator('[data-note-id="nold2"]').click();
    await box(page).getByRole("button", { name: "Page 7: change what this note is about" }).click();
    expect(await drawnAs(group)).toBe("trail");
  });
});

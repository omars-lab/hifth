import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { dropBookmark, editScopedNote, liftBookmark, markConfusion, type Note } from "@hifth/core";
import {
  deviceNameOf,
  loadNotes,
  readBookmarks,
  readConfusions,
  readDevice,
  readSeam,
  renameDevice,
  writeAllNotes,
  writeBookmarks,
  writeConfusions,
  writeSeam,
} from "./bookmark-store.js";

/*
 * Against a real IndexedDB implementation, as the page-history store is: this is
 * the half that can lose a reader's places, so it is not tested behind a double.
 */

const T = 1_758_000_000_000;

beforeEach(async () => {
  await writeBookmarks([]);
});

describe("bookmark store", () => {
  it("starts empty", async () => {
    expect(await readBookmarks()).toEqual([]);
  });

  it("keeps what was written, and a later write replaces the whole set", async () => {
    const set = dropBookmark([], { key: "quran/hafs-kfqc/2:255", page: 42, name: "Kursi" }, T);
    const two = dropBookmark(set, { key: "quran/hafs-kfqc/18:1", page: 293, name: "Friday" }, T + 1);
    expect(await writeBookmarks(two)).toBe(true);
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Kursi", "Friday"]);

    await writeBookmarks(liftBookmark(two, two[0]!.id));
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Friday"]);
  });

  it("keeps the seam apart from the set, so neither write disturbs the other", async () => {
    const set = dropBookmark([], { key: "quran/hafs-kfqc/2:255", page: 42, name: "Kursi" }, T);
    await writeBookmarks(set);
    expect(await writeSeam({ page: 106, at: T })).toBe(true);
    await writeSeam({ page: 107, at: T + 1 });
    expect(await readSeam()).toEqual({ page: 107, at: T + 1 });
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Kursi"]);
    await writeBookmarks([]);
    expect((await readSeam())?.page).toBe(107);
  });
});

/** Put records straight into the store, as an older version of the app left them. */
async function seed(records: Record<string, unknown>[], drop: string[] = []): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("hifth.bookmarks.v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("sets", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction("sets", "readwrite");
  for (const id of drop) tx.objectStore("sets").delete(id);
  for (const r of records) tx.objectStore("sets").put(r);
  await new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
  db.close();
}

const OLD: Note[] = [
  {
    id: "c1",
    key: "quran/hafs-kfqc/2:40",
    page: 7,
    word: 3,
    x: 140,
    y: 260,
    onHarakah: false,
    kind: "comment",
    text: "Keep apart",
    createdAt: T,
    updatedAt: T + 5,
  },
  {
    id: "m1",
    key: "quran/hafs-kfqc/2:41",
    page: 7,
    word: 1,
    x: 0,
    y: 0,
    onHarakah: false,
    kind: "correction",
    text: "",
    createdAt: T,
    updatedAt: T,
  },
];

describe("notes moved across to the kind that gathers verses", () => {
  beforeEach(async () => {
    await seed([], ["notes", "scoped-notes"]);
  });

  it("moves today's notes across once, keeping the old record as it was", async () => {
    await seed([{ id: "notes", notes: OLD }]);
    const got = await loadNotes();
    expect(got?.scoped.map((n) => [n.id, n.text, n.scope])).toEqual([
      ["c1", "Keep apart", { type: "page", edition: "hafs-kfqc", page: 7 }],
    ]);
    expect(got?.mistakes.map((n) => n.id)).toEqual(["m1"]);
    expect(got?.backup.map((n) => n.id)).toEqual(["c1"]);
    // The new record is on the device now, and the old one is unchanged.
    const again = await loadNotes();
    expect(again?.scoped).toEqual(got?.scoped);
    expect(again?.backup).toEqual(got?.backup);
  });

  it("does not bring back from the backup a note changed or deleted since the move", async () => {
    await seed([{ id: "notes", notes: OLD }]);
    const got = (await loadNotes())!;
    expect(await writeAllNotes([...got.backup, ...got.mistakes], editScopedNote(got.scoped, "c1", "Changed", T + 9))).toBe(true);
    expect((await loadNotes())?.scoped.map((n) => n.text)).toEqual(["Changed"]);
    expect(await writeAllNotes([...got.backup, ...got.mistakes], [])).toBe(true);
    expect((await loadNotes())?.scoped).toEqual([]);
  });

  it("starts with nothing on a device that never had notes", async () => {
    expect(await loadNotes()).toEqual({ scoped: [], mistakes: [], backup: [] });
  });
});

describe("confusion jumps kept on the device", () => {
  it("keeps what was written beside the notes, and a later write replaces the whole set", async () => {
    const one = markConfusion([], { key: "quran/hafs-kfqc/2:58", word: 14 }, { key: "quran/hafs-kfqc/7:161" }, T, "d1");
    expect(await writeConfusions(one)).toBe(true);
    expect(await readConfusions()).toEqual(one);
    expect(await writeConfusions([])).toBe(true);
    expect(await readConfusions()).toEqual([]);
  });

  it("drops a stored record it cannot read, rather than the whole set", async () => {
    const one = markConfusion([], { key: "quran/hafs-kfqc/2:58" }, null, T, "d1");
    await writeConfusions([...one, { id: "bad" } as never]);
    expect(await readConfusions()).toEqual(one);
  });

  it("names this device once, with a random id that stays, and a name that can change", async () => {
    const first = await readDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
    expect(first?.id).toMatch(/^d-[0-9a-f-]{8,}$/);
    expect(first?.name).toBe("iPhone");
    expect((await readDevice("anything else"))?.id).toBe(first!.id);
    expect(await renameDevice("Omar's phone")).toBe(true);
    expect(await readDevice("")).toEqual({ id: first!.id, name: "Omar's phone" });
  });
});

describe("the plain name a new device is given", () => {
  it.each([
    ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1", "iPad"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile Safari/537.36", "Android phone"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5; rv:131.0) Gecko/20100101 Firefox/131.0", "Mac, Firefox"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", "Mac, Safari"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Windows, Chrome"],
    ["", "This device"],
  ])("%s → %s", (ua, name) => {
    expect(deviceNameOf(ua)).toBe(name);
  });
});

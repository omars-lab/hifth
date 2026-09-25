/**
 * Where a reader's bookmarks live on the phone — the impure half.
 *
 * The rules are in `@hifth/core`'s bookmarks module; this file only reads and
 * writes. It follows the storage model (docs/decisions/storage-model.md): the
 * phone's own database today, the **whole set written at once** on every change,
 * so a half-written set is never a state the reader can be left in. Saving to a
 * file and loading one back are the carried-off half, and the file shape is the
 * core module's.
 *
 * Like the page-history store beside it, nothing here throws: a storage failure
 * costs the reader a bookmark, never the page they are reading.
 */

import type { Bookmark } from "@hifth/core";

const DB_NAME = "hifth.bookmarks.v1";
const DB_VERSION = 1;
const SETS = "sets";
const SET_KEY = "mine";

interface SetRecord {
  readonly id: typeof SET_KEY;
  readonly bookmarks: readonly Bookmark[];
}

export function bookmarkStoreSupported(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SETS)) db.createObjectStore(SETS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("bookmark store blocked by another tab"));
  });
}

/** Read every bookmark the phone holds. Empty when there are none or no store. */
export async function readBookmarks(): Promise<Bookmark[]> {
  if (!bookmarkStoreSupported()) return [];
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readonly");
    const rec = await new Promise<SetRecord | undefined>((resolve, reject) => {
      const req = tx.objectStore(SETS).get(SET_KEY);
      req.onsuccess = () => resolve(req.result as SetRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    return rec ? [...rec.bookmarks] : [];
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/**
 * Replace the whole set. Resolves true when it landed, false when it did not,
 * so the page can say "not saved on this phone" rather than pretend.
 */
export async function writeBookmarks(set: readonly Bookmark[]): Promise<boolean> {
  if (!bookmarkStoreSupported()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readwrite");
    tx.objectStore(SETS).put({ id: SET_KEY, bookmarks: set } satisfies SetRecord);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/*
 * The seam — where the reader left off (docs/decisions/bookmark-fold.md, "What
 * changed (2026-09-25)"). One page, kept beside the set under its own key, so
 * the kept bookmarks and the place that moves on its own never share a write.
 */
const SEAM_KEY = "seam";

export interface Seam {
  readonly page: number;
  /** When it last moved. */
  readonly at: number;
}

interface SeamRecord extends Seam {
  readonly id: typeof SEAM_KEY;
}

/** Where the seam lies, or null when the reader has not stayed on a page yet. */
export async function readSeam(): Promise<Seam | null> {
  if (!bookmarkStoreSupported()) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readonly");
    const rec = await new Promise<SeamRecord | undefined>((resolve, reject) => {
      const req = tx.objectStore(SETS).get(SEAM_KEY);
      req.onsuccess = () => resolve(req.result as SeamRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    return rec && Number.isInteger(rec.page) ? { page: rec.page, at: rec.at } : null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/** Lay the seam on a page. False when the phone refused the write. */
export async function writeSeam(seam: Seam): Promise<boolean> {
  if (!bookmarkStoreSupported()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readwrite");
    tx.objectStore(SETS).put({ id: SEAM_KEY, ...seam } satisfies SeamRecord);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

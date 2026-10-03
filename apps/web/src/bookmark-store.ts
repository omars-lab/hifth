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

import { isConfusion, isMistake, migrateV1Notes, type Bookmark, type Confusion, type Note, type ScopedNote } from "@hifth/core";

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

/*
 * Notes — the reader's words pinned to the page (docs/design/page-toolbar-plan.md,
 * step 2). Kept in the same database under their own key, written whole like
 * the bookmarks, and carried in the same saved file.
 */
const NOTES_KEY = "notes";

interface NotesRecord {
  readonly id: typeof NOTES_KEY;
  readonly notes: readonly Note[];
}

/*
 * Notes that gather verses (docs/design/scoped-notes.md, step 2). Kept under a
 * key of their own beside the old notes, which now hold only the marked
 * mistakes and, untouched, the notes as they were the day they were moved
 * across: a backup an older version of the app can still read.
 */
const SCOPED_KEY = "scoped-notes";

interface ScopedRecord {
  readonly id: typeof SCOPED_KEY;
  readonly notes: readonly ScopedNote[];
}

/** What the device holds: the new notes, the marked mistakes, and the backup. */
export interface HeldNotes {
  readonly scoped: ScopedNote[];
  readonly mistakes: Note[];
  /** The notes as they were the day they were moved across, kept untouched. */
  readonly backup: Note[];
}

/**
 * Every note the device holds, moving today's notes across the first time.
 * The read and the move are one write, so two tabs opening at once cannot both
 * move them, and a move is never half done. Null when there is no store or it
 * could not be read: then nothing may be written either, or a failed read
 * would overwrite the backup with an empty set.
 */
export async function loadNotes(): Promise<HeldNotes | null> {
  if (!bookmarkStoreSupported()) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readwrite");
    const sets = tx.objectStore(SETS);
    const get = <T>(key: string) =>
      new Promise<T | undefined>((resolve, reject) => {
        const req = sets.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      });
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const [old, held] = await Promise.all([get<NotesRecord>(NOTES_KEY), get<ScopedRecord>(SCOPED_KEY)]);
    const notes = [...(old?.notes ?? [])];
    let scoped = held ? [...held.notes] : null;
    if (!scoped) {
      scoped = migrateV1Notes(notes, []);
      sets.put({ id: SCOPED_KEY, notes: scoped } satisfies ScopedRecord);
    }
    await done;
    return { scoped, mistakes: notes.filter(isMistake), backup: notes.filter((n) => !isMistake(n)) };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Write the notes that gather verses and the old record together, in one
 * write, so the two never disagree. False when the phone refused it.
 */
export async function writeAllNotes(old: readonly Note[], scoped: readonly ScopedNote[]): Promise<boolean> {
  if (!bookmarkStoreSupported()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readwrite");
    const sets = tx.objectStore(SETS);
    sets.put({ id: NOTES_KEY, notes: old } satisfies NotesRecord);
    sets.put({ id: SCOPED_KEY, notes: scoped } satisfies ScopedRecord);
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
 * Confusion jumps (docs/design/confusion-jumps.md, step 2): where the reader's
 * memory jumped from one verse to another. Kept in the same database under a
 * key of their own, written whole like the notes, never sent anywhere.
 */
const CONFUSIONS_KEY = "confusions";

interface ConfusionsRecord {
  readonly id: typeof CONFUSIONS_KEY;
  readonly confusions: readonly Confusion[];
}

async function getRecord<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(SETS, "readonly");
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = tx.objectStore(SETS).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putRecord<T extends { readonly id: string }>(rec: T): Promise<boolean> {
  if (!bookmarkStoreSupported()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(SETS, "readwrite");
    tx.objectStore(SETS).put(rec);
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

/**
 * Every jump the device holds; a stored record that is not one is left out.
 * Null when there is no store or it could not be read, so nothing is written
 * over what is there.
 */
export async function readConfusions(): Promise<Confusion[] | null> {
  if (!bookmarkStoreSupported()) return null;
  try {
    const rec = await getRecord<ConfusionsRecord>(CONFUSIONS_KEY);
    return (rec?.confusions ?? []).filter(isConfusion);
  } catch {
    return null;
  }
}

/** Replace every jump at once. False when the device refused it. */
export function writeConfusions(set: readonly Confusion[]): Promise<boolean> {
  return putRecord({ id: CONFUSIONS_KEY, confusions: set } satisfies ConfusionsRecord);
}

/*
 * Which device a jump was marked on (the design's question 5, answer A): a
 * random id made the first time it is asked for, and a plain name the reader
 * can change. The id is never derived from anything about the device.
 */
const DEVICE_KEY = "device";

export interface Device {
  readonly id: string;
  readonly name: string;
}

// Stored under the shared key `id`, so the device's own id is `deviceId`.
interface DeviceRecord {
  readonly id: typeof DEVICE_KEY;
  readonly deviceId: string;
  readonly name: string;
}

/** The name a new device starts with, from what the browser says it is. */
export function deviceNameOf(ua: string): string {
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android phone";
  const os = /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux|CrOS/.test(ua) ? "Linux" : null;
  if (!os) return "This device";
  const browser = /Firefox\//.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  return browser ? `${os}, ${browser}` : os;
}

function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `d-${c.randomUUID()}`;
  return `d-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

/**
 * This device, made and kept the first time it is asked for. Null when there
 * is no store: then a jump is still marked, under no device.
 */
export async function readDevice(ua: string): Promise<Device | null> {
  if (!bookmarkStoreSupported()) return null;
  try {
    const rec = await getRecord<DeviceRecord>(DEVICE_KEY);
    if (rec && typeof rec.deviceId === "string") return { id: rec.deviceId, name: rec.name };
    const made: Device = { id: randomId(), name: deviceNameOf(ua) };
    return (await putRecord({ id: DEVICE_KEY, deviceId: made.id, name: made.name } satisfies DeviceRecord)) ? made : null;
  } catch {
    return null;
  }
}

/** Give this device a name of the reader's own. */
export async function renameDevice(name: string): Promise<boolean> {
  try {
    const rec = await getRecord<DeviceRecord>(DEVICE_KEY);
    if (!rec?.deviceId) return false;
    return await putRecord({ id: DEVICE_KEY, deviceId: rec.deviceId, name } satisfies DeviceRecord);
  } catch {
    return false;
  }
}

/**
 * Where the usage counts live: on this device, and nowhere else
 * (docs/design/feature-usage.md). The pure half is `usage.ts`.
 *
 * Built the way the revision store is, for the same reasons: IndexedDB rather
 * than localStorage, so a count is never a main-thread write inside a gesture;
 * one record per calendar day, rewritten as the day fills, so a count is kept
 * the moment it lands; and a `since` stamped the first time the store opens, so
 * a list that reads "never" after iOS empties the storage can be told apart
 * from one that has been counting for a month.
 *
 * Nothing here may send anything anywhere. The privacy check holds this file to
 * the same rule as the revision record: no network, no URL, and a closed list
 * of who may import it.
 */

import { dayAt, isUseFeature, type DayStamp, type UseDay, type UseFeature } from "./usage.js";

const DB_NAME = "hifth.usage.v1";
const DB_VERSION = 1;
const DAYS = "days";
const META = "meta";
const SINCE_KEY = "since";

/** Long enough to compare a month with the same month last year. */
export const USE_RETENTION_DAYS = 400;

export interface UseRecord {
  /** Every kept day, oldest first. */
  readonly days: readonly UseDay[];
  /** The day counting began, or null when this browser cannot keep counts. */
  readonly since: DayStamp | null;
  /** The reader's own calendar day when this was read, for the strip to end on. */
  readonly today: DayStamp;
}

function supported(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DAYS)) db.createObjectStore(DAYS, { keyPath: "day" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("usage store blocked by another tab"));
  });
}

async function stampSince(meta: IDBObjectStore, day: DayStamp): Promise<void> {
  const current = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
  if (!current) meta.put({ id: SINCE_KEY, day });
}

async function prune(days: IDBObjectStore, meta: IDBObjectStore, today: DayStamp): Promise<void> {
  const cutoff = dayAt(Date.parse(`${today}T12:00:00Z`) - USE_RETENTION_DAYS * 86_400_000);
  const keys = (await request(days.getAllKeys())) as DayStamp[];
  const kept = keys.filter((k) => k > cutoff);
  for (const k of keys) if (k <= cutoff) days.delete(k);
  const current = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
  const oldest = kept.sort()[0] ?? today;
  if (current && current.day < oldest && kept.length < keys.length) meta.put({ id: SINCE_KEY, day: oldest });
}

/** Add one use of `feature`. Never throws: a lost count must never break a tap. */
export async function countUse(feature: UseFeature, now: number = Date.now()): Promise<void> {
  if (!supported() || !isUseFeature(feature)) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const day = dayAt(now);
    const tx = db.transaction([DAYS, META], "readwrite");
    const days = tx.objectStore(DAYS);
    const meta = tx.objectStore(META);
    const existing = await request<UseDay | undefined>(days.get(day));
    const counts = { ...(existing?.counts ?? {}) };
    counts[feature] = (counts[feature] ?? 0) + 1;
    days.put({ day, counts } satisfies UseDay);
    await stampSince(meta, day);
    await prune(days, meta, day);
    await done(tx);
  } catch {
    // Private modes, a full disk, another tab: no count today, and no fuss.
  } finally {
    db?.close();
  }
}

/** Every kept day, oldest first, and the day counting began. */
export async function readUse(now: number = Date.now()): Promise<UseRecord> {
  const today = dayAt(now);
  if (!supported()) return { days: [], since: null, today };
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([DAYS, META], "readwrite");
    const days = tx.objectStore(DAYS);
    const meta = tx.objectStore(META);
    await stampSince(meta, today);
    await prune(days, meta, today);
    const all = (await request(days.getAll())) as UseDay[];
    const since = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
    await done(tx);
    return {
      days: all.slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
      since: since?.day ?? null,
      today,
    };
  } catch {
    return { days: [], since: null, today };
  } finally {
    db?.close();
  }
}

/** Forget every count, and the day counting began. */
export async function forgetUse(): Promise<void> {
  if (!supported()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([DAYS, META], "readwrite");
    tx.objectStore(DAYS).clear();
    tx.objectStore(META).clear();
    await done(tx);
  } catch {
    // Asked to hold nothing, and holding nothing.
  } finally {
    db?.close();
  }
}

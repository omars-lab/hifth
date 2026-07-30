/**
 * Where the revision record lives — the only impure half of the feature.
 *
 * `@hifth/core`'s `revision.ts` is pure and clockless; this module is the one
 * place that reads a clock, touches storage, and therefore the one place that
 * can lie. Three decisions are load-bearing enough to state:
 *
 * ## IndexedDB, not localStorage
 *
 * Not for size — a look is under a hundred bytes and a year of heavy use does
 * not approach a megabyte. For two other reasons. localStorage is synchronous on
 * the main thread, and this app's entire performance story is the frame budget on
 * a low-end phone (PLAN follow-up ①); a write on every tap is a write inside the
 * gesture. And the eviction machinery already in this repo (`storage.ts`, the CDP
 * eviction spec) speaks IndexedDB, so a record that lives there is covered by
 * tests that already exist rather than by a second story about durability.
 *
 * ## Keyed by day, not by event
 *
 * One record per calendar day, rewritten as the day fills. That is a small write
 * amplification within a day — a hundred taps rewrite a growing array a hundred
 * times — and it is the trade we want: each tap is durable the moment it lands,
 * with no in-memory buffer to lose when the tab is killed. The alternative,
 * batching and flushing, loses exactly the taps made just before the app was
 * closed, which on a phone is most of them.
 *
 * ## `since`, and why it is stored rather than derived
 *
 * iOS deletes script-writable storage after seven days of no interaction, and
 * `persist()` is not documented to stop it (see `storage.ts`). So the record of
 * the three weeks a hafiz did not open the app is deleted *because* they did not
 * open the app — and it does not degrade, it resets to empty, which reads as "you
 * have revised nothing". Said to someone about their own worship.
 *
 * The defence is that the record knows how old it is. `since` is written the
 * first time the store is opened — **not** the first time a look is recorded —
 * because those differ in exactly the case that matters: a record that has
 * existed for a month and holds nothing means the reader did not tap, while a
 * record that has existed since this morning and holds nothing means we lost it.
 * Deriving `since` from the oldest surviving event would collapse the two and
 * throw away the only signal that a wipe happened.
 */

import type { DayStamp, RevisionEvent } from "@hifth/core";
import { dayOf, daysBetween } from "@hifth/core";

const DB_NAME = "hifth.revision.v1";
const DB_VERSION = 1;
const DAYS = "days";
const META = "meta";
const SINCE_KEY = "since";

/**
 * How far back the record reaches. Long enough to answer "this time last year",
 * bounded so the store cannot grow without end on a device nobody ever clears.
 * Stated here rather than left implicit: an unbounded log is a decision too, and
 * one nobody would have chosen on purpose.
 */
export const RETENTION_DAYS = 400;

/** What the caller knows at the moment of a look. The clock is ours, not theirs. */
export interface Look {
  /** Canonical ayah key — the ayah, or the first ayah of a passage. */
  readonly key: string;
  /** Last ayah of a passage. Omit for a single ayah. */
  readonly endKey?: string;
  /** The page it was read on. */
  readonly page: number;
}

export interface RevisionRecord {
  /** Every surviving look, oldest first. */
  readonly events: readonly RevisionEvent[];
  /**
   * The day this record began. `null` only when storage is unavailable — an
   * empty record still knows its own age, which is the point.
   */
  readonly since: DayStamp | null;
}

const EMPTY: RevisionRecord = { events: [], since: null };

/** Whether this browser can hold a record at all. */
export function revisionStoreSupported(): boolean {
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
    // Another tab holding an older version open. We never block a tap on it.
    req.onblocked = () => reject(new Error("revision store blocked by another tab"));
  });
}

interface DayRecord {
  readonly day: DayStamp;
  readonly events: RevisionEvent[];
}

/** The reader's current local calendar day. */
function today(now: number): DayStamp {
  return dayOf({ key: "", page: 0, at: now, tz: -new Date(now).getTimezoneOffset() });
}

/**
 * The days that fall outside the retention window.
 *
 * Pure, and exported so the policy is testable without a database — the part
 * that can silently delete a hafiz's history is not the part to leave to an
 * integration test.
 */
export function expiredDays(days: readonly DayStamp[], asOf: DayStamp): DayStamp[] {
  return days.filter((day) => {
    const age = daysBetween(day, asOf);
    // A stamp we cannot read is not evidence that it is old. Leaving it costs a
    // few bytes; deleting it on a parse failure costs someone their record.
    return !Number.isNaN(age) && age >= RETENTION_DAYS;
  });
}

/**
 * Pruning walks every day key, so it runs once per calendar day rather than once
 * per tap — and once per *day*, not once per session, for two reasons a boolean
 * got wrong. A session left open across midnight would otherwise never prune
 * again; and a read-only session, where the reader opens the app and looks
 * without tapping, would never prune at all and would hand the picture rows the
 * store had promised to have forgotten.
 */
let lastPrunedDay: DayStamp | null = null;

/**
 * Delete days outside the window, and move `since` forward to match.
 *
 * The claim and the contents must not drift: a store that deleted the old days
 * but went on saying "recording since 2025" would offer a year of history over a
 * window holding 400 of them — the same shape of lie as an emptied record
 * rendered as a true one.
 */
async function pruneOnce(
  days: IDBObjectStore,
  meta: IDBObjectStore,
  asOf: DayStamp,
): Promise<void> {
  if (lastPrunedDay === asOf) return;
  lastPrunedDay = asOf;
  const keys = (await request(days.getAllKeys())) as DayStamp[];
  const expired = new Set(expiredDays(keys, asOf));
  if (expired.size === 0) return;
  for (const stale of expired) days.delete(stale);
  const oldest = keys.filter((k) => !expired.has(k)).sort()[0] ?? asOf;
  const current = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
  if (current && current.day < oldest) meta.put({ id: SINCE_KEY, day: oldest });
}

/**
 * Record one deliberate look. Never throws and never rejects: a tap that fails
 * to be written is a lost row in a heatmap, and a tap that throws is a broken
 * app. The caller fires this and forgets it.
 */
export async function recordLook(look: Look, now: number = Date.now()): Promise<void> {
  if (!revisionStoreSupported()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const event: RevisionEvent = {
      key: look.key,
      ...(look.endKey && look.endKey !== look.key ? { endKey: look.endKey } : {}),
      page: look.page,
      at: now,
      tz: -new Date(now).getTimezoneOffset(),
    };
    const day = dayOf(event);
    const tx = db.transaction([DAYS, META], "readwrite");
    const days = tx.objectStore(DAYS);
    const meta = tx.objectStore(META);

    const existing = await request<DayRecord | undefined>(days.get(day));
    days.put({ day, events: [...(existing?.events ?? []), event] } satisfies DayRecord);

    await stampSince(meta, day);
    // Anchored to the clock, which for a look being written now is the same day
    // it lands in — spelled `today(now)` anyway, so the window's origin does not
    // silently become "whatever the last event claimed" if `at` ever stops
    // meaning "just now".
    await pruneOnce(days, meta, today(now));

    await done(tx);
  } catch {
    // Private modes, a quota refusal, a blocked upgrade. All of them mean "no
    // record today", none of them mean "interrupt the reader".
  } finally {
    db?.close();
  }
}

async function stampSince(meta: IDBObjectStore, day: DayStamp): Promise<void> {
  const current = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
  if (!current) meta.put({ id: SINCE_KEY, day });
}

/**
 * Read the whole record, oldest look first.
 *
 * Opening the store is itself what starts the clock on `since` — so a reader who
 * opens the app and taps nothing still ends the day with a record that knows it
 * has been watching, and an emptied record can be told apart from an idle one.
 */
export async function readRecord(now: number = Date.now()): Promise<RevisionRecord> {
  if (!revisionStoreSupported()) return EMPTY;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([DAYS, META], "readwrite");
    const days = tx.objectStore(DAYS);
    const meta = tx.objectStore(META);

    await stampSince(meta, today(now));
    // A reader who opens the app and looks without tapping still gets the
    // window honoured. Pruning only on write would hand the picture rows the
    // store had already promised to have forgotten.
    await pruneOnce(days, meta, today(now));
    const all = (await request(days.getAll())) as DayRecord[];
    const since = await request<{ id: string; day: DayStamp } | undefined>(meta.get(SINCE_KEY));
    await done(tx);

    const events = all
      .slice()
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
      .flatMap((record) => record.events)
      .sort((a, b) => a.at - b.at);
    return { events, since: since?.day ?? null };
  } catch {
    return EMPTY;
  } finally {
    db?.close();
  }
}

/**
 * Delete the record, including its age.
 *
 * Deliberately total: a "forget" that kept `since` would leave the app claiming
 * to have been watching over a period it can no longer show, which is the same
 * lie an ITP wipe tells. Forgetting resets the clock too.
 */
export async function forgetRecord(): Promise<void> {
  if (!revisionStoreSupported()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([DAYS, META], "readwrite");
    tx.objectStore(DAYS).clear();
    tx.objectStore(META).clear();
    await done(tx);
    lastPrunedDay = null;
  } catch {
    // Nothing to report: the caller asked us to have no record, and we have none.
  } finally {
    db?.close();
  }
}

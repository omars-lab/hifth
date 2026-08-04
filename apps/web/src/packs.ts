/**
 * Pinned juz packs: the paper a hafiz chose to keep.
 *
 * `planPack` in `@hifth/core` decides *which* files a pinned juz is made of.
 * This module puts them somewhere they survive being offline, records that it
 * did, and — the half the loop actually turns on — notices when they are gone.
 *
 * ## Why the app owns the pack cache, and not the service worker
 *
 * The obvious design is to let the existing runtime caches do it: page requests
 * already go through workbox's `hifth-pages` (CacheFirst) and shard requests
 * through `hifth-data`. Pinning would then be "warm those caches".
 *
 * It does not work, and the way it fails is quiet. `hifth-pages` is an LRU
 * capped at 32 entries, sized for a browsing trail — a juz is 20–23 pages, so
 * pinning juz 30 and then reading twelve pages of juz 1 evicts a third of what
 * was pinned. The reader is told they have a juz; the LRU disagrees; nobody
 * finds out until the plane. A pin that shares an eviction policy with ordinary
 * reading is not a pin.
 *
 * So a pack lives in its own cache, under its own name, with no expiration
 * plugin attached to it, and `assets.ts` looks there **before** it reaches for
 * the network. Offline then works because the app read its own pack, not
 * because a service-worker route happened to match — which is also why this is
 * testable without a service worker at all.
 *
 * ## Cache Storage for the bytes, IndexedDB for the claim
 *
 * The two are separate on purpose, and separating them is what makes eviction
 * *detectable*. Cache Storage holds the responses; IndexedDB holds the record
 * that says "juz 30 was pinned on the 4th, and these are its 23 pages". A
 * browser storage sweep — ITP's seven-day rule, a quota purge — can take either
 * one. When it takes the cache and leaves the register, the app can see the
 * difference between them and say so.
 *
 * That is the same finding `repairShellCache` in `pwa.ts` recorded about the
 * precache: eviction leaves every online signal healthy. A pack that were only
 * a cache would have nothing left to compare against, and the reader would
 * discover the loss by opening the app in aeroplane mode a week later — the one
 * moment nothing can be done about it.
 *
 * ## What it never does
 *
 * It does not throw at the caller. A phone that refuses the write, a private
 * mode with no Cache Storage, a quota that says no: every one of them means
 * "this juz is not pinned", and none of them means "take the app down". The
 * caller gets `null` or a status saying so, and the reader gets told in words.
 */

/** Where pinned bytes live. Never given an expiration plugin — see the header. */
export const PACK_CACHE = "hifth-pack-v1";

const DB_NAME = "hifth.packs.v1";
const DB_VERSION = 1;
const PACKS = "packs";

/** How many files are fetched at once while pinning. */
const CONCURRENCY = 4;

/** What the register says was pinned. */
export interface PackRecord {
  /** `${edition}/${juz}` — the primary key. */
  readonly id: string;
  readonly edition: string;
  readonly juz: number;
  /** Every URL the pack intends to hold, pages and shards together. */
  readonly urls: readonly string[];
  /** Bytes actually written, as measured while writing them. */
  readonly bytes: number;
  readonly pinnedAt: number;
  /** Ayahs of this juz this build has no paper for. Usually 0. */
  readonly absentAyahs: number;
}

/**
 * What the cache says now.
 *
 * `torn` is not a rounding error between the other two: a partly-swept pack
 * still opens most of its pages, so it is the state most likely to be mistaken
 * for a working one, and the only honest thing to do with it is name it.
 */
export type PackHealth = "whole" | "torn" | "gone";

export interface PackStatus {
  readonly juz: number;
  readonly edition: string;
  readonly health: PackHealth;
  /** How many of the pack's URLs the cache still holds. */
  readonly present: number;
  readonly total: number;
  readonly bytes: number;
  readonly pinnedAt: number;
  readonly absentAyahs: number;
}

/** Progress while pinning, reported after every file. */
export interface PinProgress {
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
}

export interface PinOptions {
  readonly onProgress?: (p: PinProgress) => void;
  /** Aborting stops further fetches; what was already written stays written. */
  readonly signal?: AbortSignal;
}

/** Whether this browser can hold a pack at all. */
export function packsSupported(): boolean {
  return (
    typeof caches !== "undefined" &&
    caches !== null &&
    typeof indexedDB !== "undefined" &&
    indexedDB !== null
  );
}

export function packId(edition: string, juz: number): string {
  return `${edition}/${juz}`;
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
      if (!db.objectStoreNames.contains(PACKS)) db.createObjectStore(PACKS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("pack register blocked by another tab"));
  });
}

/**
 * Fetch every URL of a pack into the pack cache and record that we did.
 *
 * Returns the record even when some files failed — with `urls` holding what the
 * pack *intends* to contain, so the very next `checkPack` reports `torn` rather
 * than a whole pack that is quietly short. A pin that recorded only what it
 * managed to write would be a pin that can never be found wanting.
 */
export async function pinPack(
  edition: string,
  juz: number,
  urls: readonly string[],
  absentAyahs: number,
  options: PinOptions = {},
): Promise<PackRecord | null> {
  if (!packsSupported()) return null;
  const { onProgress, signal } = options;
  let db: IDBDatabase | null = null;
  try {
    const cache = await caches.open(PACK_CACHE);
    let bytes = 0;
    let finished = 0;

    const queue = [...urls];
    const worker = async (): Promise<void> => {
      for (;;) {
        if (signal?.aborted) return;
        const url = queue.shift();
        if (url === undefined) return;
        try {
          const res = await fetch(url);
          if (res.ok) {
            // Measured off a clone rather than trusting Content-Length, which a
            // compressed response does not report in the units this counts in.
            //
            // Sized into a local first. `bytes += await …` reads `bytes` before
            // it awaits, so four workers all add to the same stale zero and the
            // pack reports the size of one file — which looks like a plausible
            // small number rather than like a bug.
            const size = (await res.clone().blob()).size;
            bytes += size;
            await cache.put(url, res);
          }
        } catch {
          // One missing file does not abandon the other twenty-two. The pack
          // will report itself torn, which is the truth and is actionable.
        }
        finished += 1;
        onProgress?.({ done: finished, total: urls.length, bytes });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

    const record: PackRecord = {
      id: packId(edition, juz),
      edition,
      juz,
      urls: [...urls],
      bytes,
      pinnedAt: Date.now(),
      absentAyahs,
    };
    db = await openDb();
    const tx = db.transaction([PACKS], "readwrite");
    tx.objectStore(PACKS).put(record);
    await done(tx);
    return record;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/** Forget a pack: its bytes and its claim, in that order. */
export async function unpinPack(edition: string, juz: number): Promise<void> {
  if (!packsSupported()) return;
  let db: IDBDatabase | null = null;
  try {
    const id = packId(edition, juz);
    db = await openDb();
    const existing = await readOne(db, id);
    if (existing) {
      const cache = await caches.open(PACK_CACHE);
      // Only the URLs this pack claims. Two packs share the leaves at their
      // common boundary, so clearing the whole cache would unpin the neighbour
      // as a side effect of unpinning this one.
      const others = (await listPacks()).filter((p) => p.id !== id);
      const kept = new Set(others.flatMap((p) => p.urls));
      for (const url of existing.urls) if (!kept.has(url)) await cache.delete(url);
    }
    const tx = db.transaction([PACKS], "readwrite");
    tx.objectStore(PACKS).delete(id);
    await done(tx);
  } catch {
    // The caller asked for this juz not to be pinned. If we could not even read
    // the register, it is not pinned in any sense they can observe.
  } finally {
    db?.close();
  }
}

async function readOne(db: IDBDatabase, id: string): Promise<PackRecord | undefined> {
  const tx = db.transaction([PACKS], "readonly");
  const record = await request<PackRecord | undefined>(tx.objectStore(PACKS).get(id));
  await done(tx);
  return record;
}

/** Every pack the register claims, lowest juz first. */
export async function listPacks(): Promise<PackRecord[]> {
  if (!packsSupported()) return [];
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([PACKS], "readonly");
    const all = await request<PackRecord[]>(tx.objectStore(PACKS).getAll());
    await done(tx);
    return all.slice().sort((a, b) => a.juz - b.juz);
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/**
 * Ask the cache whether a pack is still there.
 *
 * This is the eviction detector, and it is a count rather than a boolean
 * because a sweep does not have to be total. `present` is what the cache holds
 * of what the register claims; the gap between them is the whole news.
 */
export async function checkPack(record: PackRecord): Promise<PackStatus> {
  const base = {
    juz: record.juz,
    edition: record.edition,
    total: record.urls.length,
    bytes: record.bytes,
    pinnedAt: record.pinnedAt,
    absentAyahs: record.absentAyahs,
  };
  if (!packsSupported()) return { ...base, health: "gone", present: 0 };
  try {
    const cache = await caches.open(PACK_CACHE);
    let present = 0;
    for (const url of record.urls) if (await cache.match(url)) present += 1;
    const health: PackHealth =
      present === 0 ? "gone" : present === record.urls.length ? "whole" : "torn";
    return { ...base, health, present };
  } catch {
    // Cache Storage unreachable is indistinguishable, from here, from the pack
    // having been taken — and the two call for the same offer.
    return { ...base, health: "gone", present: 0 };
  }
}

/** Every claimed pack, checked against the cache. */
export async function packStatuses(): Promise<PackStatus[]> {
  const records = await listPacks();
  return await Promise.all(records.map(checkPack));
}

/**
 * A pinned response for this URL, if one is held.
 *
 * `assets.ts` calls this before the network. Never throws: a browser with no
 * Cache Storage, or one that has just swept it, simply has nothing pinned, and
 * the fetch that follows is the ordinary path.
 */
export async function packedResponse(url: string): Promise<Response | undefined> {
  if (typeof caches === "undefined" || caches === null) return undefined;
  try {
    const cache = await caches.open(PACK_CACHE);
    return await cache.match(url);
  } catch {
    return undefined;
  }
}

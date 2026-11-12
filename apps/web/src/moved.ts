/**
 * Hifth has moved from the blog address to hifth.app/read — the rules, with no
 * window in them (the page parts are in `components/MovedSheet.tsx` and
 * `useCarryIn.ts`).
 *
 * A reader's marks live in their browser, under the address they were made at,
 * so a new address starts empty. The old page carries them across: it opens the
 * new page, waits for it to say it is ready, and hands it the same file "Save
 * to a file" would write. The new page takes it only from the old address, only
 * once its own marks have loaded, and says how many came across. If any of that
 * fails, saving a file and loading it still works, as it always has.
 *
 * Both addresses are fixed here. A page served over plain http — only ever a
 * test on this laptop, which serves one build at two addresses — may name stand-ins
 * in its own storage. The addresses are never read from the link, so no link
 * can send a reader's marks anywhere else.
 */

export interface Addresses {
  /** Where Hifth was: the blog's origin (the app sits under /hifth/ there). */
  readonly old: string;
  /** Where it is now: hifth.app. */
  readonly next: string;
  /** The app's own page at the new address, which the carry opens. */
  readonly page: string;
}

export const ADDRESSES: Addresses = {
  old: "https://blog.bytesofpurpose.com",
  next: "https://hifth.app",
  page: "https://hifth.app/read/",
};

/** What the new page is opened with, so it knows to take the marks. */
export const CARRY_HASH = "#/carry";

/**
 * The switch. Off until hifth.app/read is live and checked (plan step 5); the
 * new page's side of the carry works either way, since nothing reaches it
 * until the old page shows the sheet. A test that names stand-in addresses
 * turns it on for itself (`sheetOn`).
 */
export const MOVED_SHEET_ON = false;

/** Test-only stand-in addresses `{old, next, page?}`, honoured only over plain http. */
export const ADDRESSES_KEY = "hifth.moved.addresses.v1";
/** When the reader last said "Later". */
export const LATER_KEY = "hifth.moved.later.v1";
/** How many marks the carry took across, once it has. */
export const CARRIED_KEY = "hifth.moved.carried.v1";
/** The new tab's count of what arrived, kept across the reload that lays settings. */
export const ARRIVED_KEY = "hifth.moved.arrived.v1";

/** "Later" keeps the sheet away for a week. */
export const LATER_MS = 7 * 24 * 60 * 60 * 1000;

/** How long the old page waits for the new one before offering the file instead. */
export const CARRY_WAIT_MS = 15_000;

function bareOrigin(x: unknown): string | null {
  if (typeof x !== "string") return null;
  try {
    const u = new URL(x);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin === x ? x : null;
  } catch {
    return null;
  }
}

/** The two addresses, with a test's stand-ins only when the page came over plain http. */
export function addressesFor(protocol: string, stored: string | null): Addresses {
  if (protocol !== "http:" || !stored) return ADDRESSES;
  try {
    const got = JSON.parse(stored) as Record<string, unknown>;
    const old = bareOrigin(got.old);
    const next = bareOrigin(got.next);
    if (!old || !next) return ADDRESSES;
    const page = got.page === undefined ? `${next}/` : got.page;
    if (typeof page !== "string" || !page.startsWith(`${next}/`) || page.includes("#")) return ADDRESSES;
    return { old, next, page };
  } catch {
    return ADDRESSES;
  }
}

/** The sheet's switch: the constant, or a test's own stand-in addresses. */
export function sheetOn(addresses: Addresses): boolean {
  return MOVED_SHEET_ON || addresses !== ADDRESSES;
}

/** Whether the old page shows the sheet. */
export function sheetShows(at: {
  on: boolean;
  native: boolean;
  origin: string;
  laterAt: number | null;
  now: number;
  addresses: Addresses;
}): boolean {
  if (!at.on || at.native || at.origin !== at.addresses.old) return false;
  return at.laterAt === null || at.now - at.laterAt >= LATER_MS;
}

/** Before the marks have gone, the sheet offers to carry them; after, to open hifth.app. */
export function sheetState(carried: string | null): "carry" | "open" {
  return carried !== null && /^\d+$/.test(carried) ? "open" : "carry";
}

/** Where the reader left off: the red ribbon's page, and when it last moved. */
export interface CarriedSeam {
  readonly page: number;
  readonly at: number;
}

/**
 * How the carry reads and lays the reader's place. Handed in by the app, so the
 * two halves of the carry never open the store that also holds the look-alike
 * jumps (the revision-privacy check keeps that store's importers to a short list).
 */
export interface CarryPlace {
  read(): Promise<CarriedSeam | null>;
  write(seam: CarriedSeam): Promise<boolean>;
}

/**
 * Which of the reader's settings go with the carry: everything the app keeps under
 * its own name in the browser, except this card's own keys, a dismissed notice,
 * what this browser heard or kept of a recitation, and the names of the databases:
 * the marks go by the file, and the revision record only when the reader says so.
 */
export const carriesSetting = (key: string): boolean =>
  key.startsWith("hifth.") &&
  !/^hifth\.(moved|notice|bookmarks|packs|revision|tafsir|usage|recitation\.(kept|heard))\./.test(key);

/** The settings to send, read from the old address's storage. */
export function settingsOf(storage: Storage): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    const v = k && carriesSetting(k) ? storage.getItem(k) : null;
    if (k && v !== null) out[k] = v;
  }
  return out;
}

/** Lays the carried settings the new address does not have yet. How many it laid. */
export function laySettings(storage: Storage, settings: unknown): number {
  let laid = 0;
  if (!settings || typeof settings !== "object") return 0;
  for (const [k, v] of Object.entries(settings)) {
    if (!carriesSetting(k) || typeof v !== "string" || storage.getItem(k) !== null) continue;
    storage.setItem(k, v);
    laid++;
  }
  return laid;
}

export type CarryMessage =
  | { type: "hifth-carry-ready" }
  | { type: "hifth-carry"; file: string; seam?: CarriedSeam | undefined; settings?: Record<string, string> | undefined }
  | { type: "hifth-carry-done"; added: number };

function seamOf(v: unknown): CarriedSeam | undefined {
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return undefined;
  const { page, at } = s;
  return Number.isInteger(page) && (page as number) >= 1 && Number.isFinite(at)
    ? { page: page as number, at: at as number }
    : undefined;
}

/**
 * Which place the new address keeps: the one that moved last. A place the
 * reader already has at hifth.app, newer than the old address's, is not undone
 * by a carry. Null only when neither address has one.
 */
export function newerSeam(own: CarriedSeam | null, carried: CarriedSeam | undefined): CarriedSeam | null {
  if (!carried) return own;
  return own && own.at >= carried.at ? own : carried;
}

/**
 * A message the carry understands, or null. It must come from the exact address
 * and the exact window expected — the one this page opened, or the one that
 * opened it — and say one of three things in the expected shape.
 */
export function carryMessage(
  e: { origin: string; source: unknown; data: unknown },
  from: string,
  window: unknown,
): CarryMessage | null {
  if (e.origin !== from || e.source !== window || window === null || window === undefined) return null;
  const d = e.data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  if (d.type === "hifth-carry-ready") return { type: "hifth-carry-ready" };
  if (d.type === "hifth-carry" && typeof d.file === "string") {
    // An older old address sends no place, and a place in the wrong shape is
    // dropped; either way the marks still come across.
    const seam = seamOf(d.seam);
    return { type: "hifth-carry", file: d.file, seam, settings: d.settings as Record<string, string> | undefined };
  }
  if (d.type === "hifth-carry-done" && Number.isInteger(d.added) && (d.added as number) >= 0)
    return { type: "hifth-carry-done", added: d.added as number };
  return null;
}

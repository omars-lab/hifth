/**
 * Bookmarks — the reader's own named places, as plain data and pure rules.
 *
 * Two decisions shape this file (docs/decisions/bookmark-fold.md): a reader
 * holds **many** bookmarks, dropped and lifted, each with a name and its own
 * timeline; and the set is kept on the phone with a way to save it to a file
 * and load it back (the storage model, docs/decisions/storage-model.md). The
 * third (docs/decisions/bookmark-admin.md) adds clearing in bulk — one surah's
 * bookmarks, or all of them.
 *
 * Everything here is pure and clockless: every change takes `now`. The store
 * that touches the phone lives in the web app and only ever writes the whole
 * set at once, which is the storage model's "written all at once" — a half-
 * written set is never a state a reader can be left in.
 */

import { parseAyahKey } from "./keys.js";
import { isNote, type Note } from "./notes.js";

/** One thing that happened to a bookmark. Its timeline is a list of these. */
export interface BookmarkEvent {
  readonly at: number;
  readonly what: "dropped" | "renamed" | "moved" | "opened";
  /** The page it sat on after the event. */
  readonly page: number;
}

export interface Bookmark {
  readonly id: string;
  /** The ayah it marks — the first on its page when dropped from the page. */
  readonly key: string;
  readonly page: number;
  readonly name: string;
  readonly timeline: readonly BookmarkEvent[];
}

/** The file a reader saves and loads. Versioned so a later shape can read it. */
export interface BookmarkFile {
  readonly kind: "hifth.bookmarks";
  readonly version: 1;
  readonly savedAt: number;
  readonly bookmarks: readonly Bookmark[];
  /**
   * The reader's notes, in the same file (note-export-shape = C: one file is
   * the reader's whole state). Absent in files saved before notes existed.
   */
  readonly notes?: readonly Note[];
}

/** Longest name a ribbon carries; longer names are cut, not refused. */
export const BOOKMARK_NAME_MAX = 40;

/** The surah a bookmark belongs to, or null for a key we cannot read. */
export function surahOf(bookmark: Pick<Bookmark, "key">): number | null {
  return parseAyahKey(bookmark.key)?.surah ?? null;
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, BOOKMARK_NAME_MAX);
}

/** When a bookmark was dropped. */
export function droppedAt(b: Bookmark): number {
  return b.timeline[0]?.at ?? 0;
}

/**
 * A fresh id. Time plus a counter, so two drops in the same millisecond still
 * differ; the set is one reader's, so nothing here needs to be globally unique.
 */
export function bookmarkId(now: number, set: readonly Bookmark[]): string {
  const base = `b${now.toString(36)}`;
  let n = 0;
  let id = base;
  while (set.some((b) => b.id === id)) id = `${base}-${++n}`;
  return id;
}

/** Drop a new bookmark. A blank name gets a default the caller supplies. */
export function dropBookmark(
  set: readonly Bookmark[],
  at: { key: string; page: number; name: string },
  now: number,
): Bookmark[] {
  const bookmark: Bookmark = {
    id: bookmarkId(now, set),
    key: at.key,
    page: at.page,
    name: cleanName(at.name),
    timeline: [{ at: now, what: "dropped", page: at.page }],
  };
  return [...set, bookmark];
}

function change(
  set: readonly Bookmark[],
  id: string,
  edit: (b: Bookmark) => Bookmark | null,
): Bookmark[] {
  const out: Bookmark[] = [];
  for (const b of set) {
    if (b.id !== id) {
      out.push(b);
      continue;
    }
    const next = edit(b);
    if (next) out.push(next);
  }
  return out;
}

export function renameBookmark(
  set: readonly Bookmark[],
  id: string,
  name: string,
  now: number,
): Bookmark[] {
  const clean = cleanName(name);
  return change(set, id, (b) =>
    clean === b.name || clean === ""
      ? b
      : { ...b, name: clean, timeline: [...b.timeline, { at: now, what: "renamed", page: b.page }] },
  );
}

export function moveBookmark(
  set: readonly Bookmark[],
  id: string,
  to: { key: string; page: number },
  now: number,
): Bookmark[] {
  return change(set, id, (b) =>
    b.key === to.key
      ? b
      : { ...b, key: to.key, page: to.page, timeline: [...b.timeline, { at: now, what: "moved", page: to.page }] },
  );
}

/** Note that the reader went back to a bookmark — its timeline is its history. */
export function openBookmark(set: readonly Bookmark[], id: string, now: number): Bookmark[] {
  return change(set, id, (b) => ({
    ...b,
    timeline: [...b.timeline, { at: now, what: "opened", page: b.page }],
  }));
}

/** Lift one bookmark off the page. */
export function liftBookmark(set: readonly Bookmark[], id: string): Bookmark[] {
  return change(set, id, () => null);
}

/** Clear every bookmark in one surah. */
export function clearSurah(set: readonly Bookmark[], surah: number): Bookmark[] {
  return set.filter((b) => surahOf(b) !== surah);
}

/** The bookmarks on one page, oldest first, so ribbons keep their order. */
export function bookmarksOnPage(set: readonly Bookmark[], page: number): Bookmark[] {
  return set.filter((b) => b.page === page).sort((a, b) => droppedAt(a) - droppedAt(b));
}

export interface SurahGroup {
  readonly surah: number;
  readonly bookmarks: readonly Bookmark[];
}

/**
 * The set grouped by surah, in mus'haf order, each group in reading order. A
 * bookmark whose key cannot be read goes last under surah 0 rather than being
 * hidden — a reader must be able to see, and clear, everything they hold.
 */
export function groupBySurah(set: readonly Bookmark[]): SurahGroup[] {
  const groups = new Map<number, Bookmark[]>();
  for (const b of set) {
    const s = surahOf(b) ?? 0;
    const list = groups.get(s);
    if (list) list.push(b);
    else groups.set(s, [b]);
  }
  const order = (s: number) => (s === 0 ? Infinity : s);
  return [...groups.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([surah, list]) => ({
      surah,
      bookmarks: list.sort(
        (a, b) =>
          (parseAyahKey(a.key)?.ayah ?? 0) - (parseAyahKey(b.key)?.ayah ?? 0) ||
          droppedAt(a) - droppedAt(b),
      ),
    }));
}

/** The file a reader saves. */
export function toBookmarkFile(
  set: readonly Bookmark[],
  now: number,
  notes?: readonly Note[],
): BookmarkFile {
  const file: BookmarkFile = { kind: "hifth.bookmarks", version: 1, savedAt: now, bookmarks: set };
  return notes && notes.length > 0 ? { ...file, notes } : file;
}

function isEvent(x: unknown): x is BookmarkEvent {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.at === "number" &&
    typeof e.page === "number" &&
    (e.what === "dropped" || e.what === "renamed" || e.what === "moved" || e.what === "opened")
  );
}

function isBookmark(x: unknown): x is Bookmark {
  if (!x || typeof x !== "object") return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.key === "string" &&
    parseAyahKey(b.key) !== null &&
    typeof b.page === "number" &&
    Number.isInteger(b.page) &&
    b.page >= 1 &&
    typeof b.name === "string" &&
    Array.isArray(b.timeline) &&
    b.timeline.length > 0 &&
    b.timeline.every(isEvent)
  );
}

/**
 * Read a saved file. Returns null for anything that is not one — a reader who
 * picks the wrong file is told so, and nothing they hold is touched.
 */
export function parseBookmarkFile(text: string): BookmarkFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (f.kind !== "hifth.bookmarks" || f.version !== 1 || !Array.isArray(f.bookmarks)) return null;
  if (!f.bookmarks.every(isBookmark)) return null;
  if (f.notes !== undefined && !(Array.isArray(f.notes) && f.notes.every(isNote))) return null;
  const file: BookmarkFile = {
    kind: "hifth.bookmarks",
    version: 1,
    savedAt: typeof f.savedAt === "number" ? f.savedAt : 0,
    bookmarks: f.bookmarks.map((b) => ({ ...b, name: cleanName(b.name) })),
  };
  return Array.isArray(f.notes) ? { ...file, notes: f.notes as Note[] } : file;
}

/**
 * Load a file into what the phone holds. Loading never deletes: a bookmark only
 * on the phone stays, one only in the file arrives, and one in both keeps the
 * copy whose timeline is longer — the one that has seen more of the reader.
 */
export function mergeBookmarks(held: readonly Bookmark[], loaded: readonly Bookmark[]): Bookmark[] {
  const byId = new Map<string, Bookmark>();
  for (const b of held) byId.set(b.id, b);
  for (const b of loaded) {
    const mine = byId.get(b.id);
    if (!mine || b.timeline.length > mine.timeline.length) byId.set(b.id, b);
  }
  return [...byId.values()];
}

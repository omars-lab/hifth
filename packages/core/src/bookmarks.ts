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

import { isConfusion, type Confusion } from "./confusions.js";
import { parseAyahKey } from "./keys.js";
import { isNote, type Note } from "./notes.js";
import { dropRemoved, isRemoval, joinRemovals, type Removal } from "./removals.js";
import { isScopedNote, type ScopedNote } from "./scoped-notes.js";

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
  /**
   * When Undo last put this bookmark back after it was taken away. Undo is not
   * an event on the timeline (it restores the bookmark as it was), but another
   * device may already hold the removal, so the bookmark must count as changed
   * after it or the next merge takes it away again (removals.ts).
   */
  readonly backAt?: number;
}

/** The file a reader saves and loads. Versioned so a later shape can read it. */
export interface BookmarkFile {
  readonly kind: "hifth.bookmarks";
  /**
   * 1 until the reader has notes that gather verses; 2 once the file carries
   * them, so an older app refuses it out loud instead of quietly losing them;
   * 3 once it carries jumps, for the same reason.
   */
  readonly version: 1 | 2 | 3;
  readonly savedAt: number;
  readonly bookmarks: readonly Bookmark[];
  /**
   * The reader's notes, in the same file (note-export-shape = C: one file is
   * the reader's whole state). Absent in files saved before notes existed.
   */
  readonly notes?: readonly Note[];
  /** Notes that gather verses (docs/design/scoped-notes.md). Only in a version 2 file. */
  readonly scopedNotes?: readonly ScopedNote[];
  /** Where the reader's memory jumped (docs/design/confusion-jumps.md). Only in a version 3 file. */
  readonly confusions?: readonly Confusion[];
  /**
   * The bookmarks, notes and jumps the reader took away, by id and time only,
   * so a device merging this copy takes them away too (removals.ts). Absent
   * when there are none. No new version number: an older app reads the file
   * and skips this list, which only means it keeps a mark this device deleted,
   * as it always did.
   */
  readonly removed?: readonly Removal[];
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
  scopedNotes?: readonly ScopedNote[],
  confusions?: readonly Confusion[],
  removed?: readonly Removal[],
): BookmarkFile {
  const file: BookmarkFile = { kind: "hifth.bookmarks", version: 1, savedAt: now, bookmarks: set };
  const withNotes = notes && notes.length > 0 ? { ...file, notes } : file;
  const withScoped: BookmarkFile = scopedNotes ? { ...withNotes, version: 2, scopedNotes } : withNotes;
  // A file with no jumps keeps its old number, so an older copy of the app still reads it.
  const withJumps = confusions && confusions.length > 0 ? { ...withScoped, version: 3 as const, confusions } : withScoped;
  return removed && removed.length > 0 ? { ...withJumps, removed } : withJumps;
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
    b.timeline.every(isEvent) &&
    (b.backAt === undefined || (typeof b.backAt === "number" && Number.isFinite(b.backAt)))
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
  if (f.kind !== "hifth.bookmarks" || (f.version !== 1 && f.version !== 2 && f.version !== 3) || !Array.isArray(f.bookmarks))
    return null;
  if (!f.bookmarks.every(isBookmark)) return null;
  if (f.notes !== undefined && !(Array.isArray(f.notes) && f.notes.every(isNote))) return null;
  if (f.scopedNotes !== undefined && !(f.version >= 2 && Array.isArray(f.scopedNotes) && f.scopedNotes.every(isScopedNote)))
    return null;
  if (f.confusions !== undefined && !(f.version === 3 && Array.isArray(f.confusions) && f.confusions.every(isConfusion)))
    return null;
  if (f.removed !== undefined && !(Array.isArray(f.removed) && f.removed.every(isRemoval))) return null;
  const file: BookmarkFile = {
    kind: "hifth.bookmarks",
    version: f.version,
    savedAt: typeof f.savedAt === "number" ? f.savedAt : 0,
    bookmarks: f.bookmarks.map((b) => ({ ...b, name: cleanName(b.name) })),
  };
  const withNotes = Array.isArray(f.notes) ? { ...file, notes: f.notes as Note[] } : file;
  const withScoped = Array.isArray(f.scopedNotes) ? { ...withNotes, scopedNotes: f.scopedNotes as ScopedNote[] } : withNotes;
  const withJumps = Array.isArray(f.confusions) ? { ...withScoped, confusions: f.confusions as Confusion[] } : withScoped;
  return Array.isArray(f.removed)
    ? { ...withJumps, removed: (f.removed as Removal[]).map((r) => ({ id: r.id, at: r.at })) }
    : withJumps;
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
    if (!mine) {
      byId.set(b.id, b);
      continue;
    }
    const [kept, other] = b.timeline.length > mine.timeline.length ? [b, mine] : [mine, b];
    // The copy kept is never older than the other: if the other was put back
    // by Undo later than anything on the kept copy's timeline, that time comes
    // along, or an older removal elsewhere would take the bookmark away.
    const later = bookmarkChangedAt(other);
    byId.set(b.id, later > bookmarkChangedAt(kept) ? { ...kept, backAt: later } : kept);
  }
  return [...byId.values()];
}

/** When a bookmark last changed: its last event, or the last time Undo put it back. */
export function bookmarkChangedAt(b: Bookmark): number {
  return Math.max(b.timeline.reduce((m, e) => Math.max(m, e.at), 0), b.backAt ?? 0);
}

/** Marks a bookmark as put back now, so a removal elsewhere older than now cannot take it away. */
export function touchBookmark(b: Bookmark, now: number): Bookmark {
  return { ...b, backAt: now };
}

/**
 * Merge another device's copy of the bookmarks, with both sides' removals: a
 * bookmark taken away on either side after its last change goes, one changed
 * after its removal stays and its removal is forgotten. `added` counts the
 * bookmarks that arrived, for the line the reader sees.
 */
export function mergeBookmarkFile(
  held: readonly Bookmark[],
  heldRemoved: readonly Removal[],
  loaded: readonly Bookmark[],
  loadedRemoved: readonly Removal[],
): { bookmarks: Bookmark[]; removed: Removal[]; added: number } {
  const gone = joinRemovals(heldRemoved, loadedRemoved);
  const bookmarks = dropRemoved(mergeBookmarks(held, loaded), gone, bookmarkChangedAt);
  const there = new Set(bookmarks.map((b) => b.id));
  const had = new Set(held.map((b) => b.id));
  return {
    bookmarks,
    removed: gone.filter((r) => !there.has(r.id)),
    added: bookmarks.filter((b) => !had.has(b.id)).length,
  };
}

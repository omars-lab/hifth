/**
 * Putting two copies of a reader's marks together (sign-in step 21c,
 * docs/design/sign-in.md, "your marks follow you").
 *
 * The button "Keep a copy of my marks on hifth.app" fetches the copy kept
 * there, puts it together with this device's marks, sends the result back and
 * loads it here. Both sides are marks files, so this is the merge the app
 * already does when a reader loads a saved file, for all four kinds at once
 * (bookmarks, notes, marked mistakes and look-alike jumps), with both sides'
 * deletions. It is pure, so the page can send the result the moment it has
 * it, without waiting for its own state to catch up.
 *
 * Neither side is favoured: a mark in either arrives, a mark held in both
 * keeps the copy changed last, and a deletion on either side takes a mark away
 * unless the mark changed after it.
 */

import { mergeBookmarkFile, toBookmarkFile, type BookmarkFile } from "./bookmarks.js";
import { mergeConfusionsFile } from "./confusions.js";
import { copyRemovals, removalsOf } from "./removals.js";
import { mergeNotesFile } from "./scoped-notes.js";

export function mergeMarkFiles(a: BookmarkFile, b: BookmarkFile, now: number): BookmarkFile {
  const aGone = a.removed ?? [];
  const bGone = b.removed ?? [];
  const bookmarks = mergeBookmarkFile(a.bookmarks, removalsOf(aGone, "bookmark"), b.bookmarks, removalsOf(bGone, "bookmark"));
  // The first side's notes are read the way a loaded file's are, so an older
  // file's plain notes are kept whichever side it is on.
  const aNotes = mergeNotesFile([], [], a.notes ?? [], a.scopedNotes ?? []);
  const notes = mergeNotesFile(
    aNotes.scoped,
    aNotes.mistakes,
    b.notes ?? [],
    b.scopedNotes ?? [],
    removalsOf(aGone, "note"),
    removalsOf(bGone, "note"),
  );
  const jumps = mergeConfusionsFile(a.confusions ?? [], removalsOf(aGone, "jump"), b.confusions ?? [], removalsOf(bGone, "jump"));
  return toBookmarkFile(
    bookmarks.bookmarks,
    now,
    notes.mistakes,
    notes.scoped,
    jumps.confusions,
    copyRemovals(
      [bookmarks.removed, notes.removed, jumps.removed],
      [...bookmarks.bookmarks, ...notes.scoped, ...notes.mistakes, ...jumps.confusions],
    ),
  );
}

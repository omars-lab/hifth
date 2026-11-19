import { describe, expect, it } from "vitest";
import { dropBookmark, parseBookmarkFile, toBookmarkFile, type BookmarkFile } from "./bookmarks.js";
import { markConfusion } from "./confusions.js";
import { mergeMarkFiles } from "./marks-copy.js";
import { addNote, markMistake } from "./notes.js";
import { addScopedNote, editScopedNote } from "./scoped-notes.js";

// The copy kept on hifth.app and the marks on this device are both marks files.
// Every mark here is made up; no verse's words appear.
const K = (v: string) => `quran/hafs-kfqc/${v}`;
const PHONE = "d-phone";

const ids = (f: BookmarkFile) => ({
  bookmarks: f.bookmarks.map((b) => b.id).sort(),
  scoped: (f.scopedNotes ?? []).map((n) => n.id).sort(),
  mistakes: (f.notes ?? []).map((n) => n.id).sort(),
  jumps: (f.confusions ?? []).map((c) => c.id).sort(),
  removed: (f.removed ?? []).map((r) => r.id).sort(),
});

describe("putting this device's marks and the kept copy together", () => {
  const ipad = toBookmarkFile(
    dropBookmark([], { key: K("2:255"), page: 42, name: "ipad" }, 1_000),
    1_500,
    markMistake([], { key: K("2:256"), page: 42, word: 3, x: 0.5, y: 0.5 }, 1_100),
    editScopedNote(addScopedNote([], { type: "ayah", key: K("2:255") }, 1_200), "n" + (1_200).toString(36), "made-up note", 1_300),
  );
  const iphone = toBookmarkFile(
    dropBookmark([], { key: K("3:1"), page: 50, name: "iphone" }, 2_000),
    2_500,
    [],
    [],
    markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 2_100, PHONE),
  );

  it("keeps every mark of both, of all four kinds", () => {
    const both = mergeMarkFiles(ipad, iphone, 3_000);
    expect(ids(both)).toEqual({
      bookmarks: [...ids(ipad).bookmarks, ...ids(iphone).bookmarks].sort(),
      scoped: ids(ipad).scoped,
      mistakes: ids(ipad).mistakes,
      jumps: ids(iphone).jumps,
      removed: [],
    });
    expect(both.savedAt).toBe(3_000);
  });

  it("is a marks file the app and hifth.app can read back", () => {
    const text = JSON.stringify(mergeMarkFiles(ipad, iphone, 3_000));
    const back = parseBookmarkFile(text);
    expect(back).not.toBeNull();
    expect(ids(back!)).toEqual(ids(mergeMarkFiles(ipad, iphone, 3_000)));
  });

  it("gives the same marks whichever side comes first", () => {
    expect(ids(mergeMarkFiles(ipad, iphone, 3_000))).toEqual(ids(mergeMarkFiles(iphone, ipad, 3_000)));
  });

  it("changes nothing when a copy is put together with itself", () => {
    expect(ids(mergeMarkFiles(ipad, ipad, 3_000))).toEqual(ids(ipad));
  });

  it("a mark deleted on one device stays deleted, and the deletion travels on", () => {
    const gone = ipad.bookmarks[0]!.id;
    const deleted: BookmarkFile = { ...ipad, bookmarks: [], removed: [{ id: gone, at: 1_400 }] };
    const both = mergeMarkFiles(deleted, ipad, 3_000);
    expect(both.bookmarks.map((b) => b.id)).not.toContain(gone);
    expect(both.removed).toEqual([{ id: gone, at: 1_400 }]);
    // and from the other side too
    expect(mergeMarkFiles(ipad, deleted, 3_000).bookmarks.map((b) => b.id)).not.toContain(gone);
  });

  it("a mark changed on one device after it was deleted on another stays, and the deletion is forgotten", () => {
    const note = ipad.scopedNotes![0]!;
    const deleted: BookmarkFile = { ...ipad, scopedNotes: [], removed: [{ id: note.id, at: 1_350 }] };
    const changed: BookmarkFile = {
      ...ipad,
      scopedNotes: editScopedNote(ipad.scopedNotes!, note.id, "changed later", 1_400),
    };
    const both = mergeMarkFiles(deleted, changed, 3_000);
    expect(both.scopedNotes!.map((n) => n.id)).toContain(note.id);
    expect(both.removed ?? []).toEqual([]);
  });

  it("a deletion of one kind of mark never takes away another kind", () => {
    const jump = iphone.confusions![0]!;
    // A removal with a note's first letter but a jump's id cannot exist; one with the jump's own id
    // takes only the jump.
    const deleted: BookmarkFile = { ...iphone, confusions: [], removed: [{ id: jump.id, at: 2_200 }] };
    const both = mergeMarkFiles(deleted, ipad, 3_000);
    expect(both.confusions ?? []).toEqual([]);
    expect(ids(both).bookmarks).toEqual([...ids(ipad).bookmarks, ...ids(iphone).bookmarks].sort());
    expect(ids(both).scoped).toEqual(ids(ipad).scoped);
  });

  it("an older file's plain notes are kept from either side, not lost", () => {
    const old: BookmarkFile = {
      kind: "hifth.bookmarks",
      version: 1,
      savedAt: 900,
      bookmarks: [],
      notes: addNote([], { key: K("2:255"), page: 42, word: 1, x: 0.2, y: 0.2 }, 900),
    };
    const first = mergeMarkFiles(old, iphone, 3_000);
    const second = mergeMarkFiles(iphone, old, 3_000);
    expect((first.scopedNotes ?? []).length).toBe(1);
    expect(ids(first)).toEqual(ids(second));
  });
});

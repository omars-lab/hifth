import { describe, expect, it } from "vitest";
import { dropBookmark, parseBookmarkFile, toBookmarkFile } from "./bookmarks.js";
import {
  NOTE_TEXT_MAX,
  addNote,
  editNote,
  isNote,
  mergeNotes,
  notesOnPage,
  removeNote,
  restoreNote,
} from "./notes.js";

const k = (s: number, a: number) => `quran/hafs-kfqc/${s}:${a}`;
const T = 1_758_000_000_000;
const at = { key: k(2, 5), page: 3, word: 4, x: 120.5, y: 88 };

describe("notes", () => {
  it("pins an empty comment on a word, never on a single mark yet", () => {
    const [n] = addNote([], at, T);
    expect(n).toMatchObject({ ...at, text: "", kind: "comment", onHarakah: false, createdAt: T, updatedAt: T });
    expect(isNote(n)).toBe(true);
  });

  it("gives two notes pinned in the same moment different ids", () => {
    const set = addNote(addNote([], at, T), at, T);
    expect(new Set(set.map((n) => n.id)).size).toBe(2);
  });

  it("edits text, trimmed and cut to length, and leaves unchanged text alone", () => {
    const set = addNote([], at, T);
    const id = set[0]!.id;
    const edited = editNote(set, id, "  check this\r\nline  ", T + 5);
    expect(edited[0]).toMatchObject({ text: "check this\nline", updatedAt: T + 5 });
    expect(editNote(edited, id, "check this\nline", T + 9)[0]!.updatedAt).toBe(T + 5);
    expect(editNote(set, id, "x".repeat(NOTE_TEXT_MAX + 50), T)[0]!.text).toHaveLength(NOTE_TEXT_MAX);
  });

  it("removes a note and puts it back once", () => {
    const set = addNote([], at, T);
    const gone = removeNote(set, set[0]!.id);
    expect(gone).toEqual([]);
    const back = restoreNote(gone, set[0]!);
    expect(back).toEqual(set);
    expect(restoreNote(back, set[0]!)).toHaveLength(1);
  });

  it("finds the notes on one page", () => {
    const set = addNote(addNote([], at, T), { ...at, page: 4 }, T + 1);
    expect(notesOnPage(set, 4)).toHaveLength(1);
  });

  it("merges without deleting, keeping the copy edited last", () => {
    const held = editNote(addNote([], at, T), `n${T.toString(36)}`, "mine", T + 10);
    const loaded = editNote(held, held[0]!.id, "theirs", T + 20);
    expect(mergeNotes(held, loaded)[0]!.text).toBe("theirs");
    expect(mergeNotes(loaded, held)[0]!.text).toBe("theirs");
    const other = addNote([], { ...at, page: 9 }, T + 30);
    expect(mergeNotes(held, other)).toHaveLength(2);
  });

  it("refuses things that are not notes", () => {
    const [n] = addNote([], at, T);
    expect(isNote({ ...n, key: "nope" })).toBe(false);
    expect(isNote({ ...n, kind: "rant" })).toBe(false);
    expect(isNote({ ...n, word: -1 })).toBe(false);
    expect(isNote({ ...n, word: null })).toBe(true);
  });
});

describe("notes in the saved file", () => {
  const bookmarks = dropBookmark([], { key: k(2, 1), page: 2, name: "" }, T);

  it("rides in the bookmark file and comes back", () => {
    const notes = editNote(addNote([], at, T), `n${T.toString(36)}`, "a note", T + 1);
    const parsed = parseBookmarkFile(JSON.stringify(toBookmarkFile(bookmarks, T + 2, notes)));
    expect(parsed?.notes).toEqual(notes);
    expect(parsed?.bookmarks).toHaveLength(1);
  });

  it("leaves notes out of a file when there are none, and still reads old files", () => {
    const file = toBookmarkFile(bookmarks, T);
    expect("notes" in file).toBe(false);
    expect(parseBookmarkFile(JSON.stringify(file))?.notes).toBeUndefined();
  });

  it("refuses a file whose notes are broken", () => {
    const bad = { ...toBookmarkFile(bookmarks, T), notes: [{ id: "x" }] };
    expect(parseBookmarkFile(JSON.stringify(bad))).toBeNull();
  });
});

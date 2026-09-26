import { describe, expect, it } from "vitest";
import { dropBookmark, parseBookmarkFile, toBookmarkFile } from "./bookmarks.js";
import {
  NOTE_TEXT_MAX,
  addNote,
  editNote,
  isMistake,
  isNote,
  markMistake,
  mergeNotes,
  mistakeOn,
  notesOnPage,
  pickMistakeSign,
  removeNote,
  restoreNote,
  signsOfNote,
} from "./notes.js";

const k = (s: number, a: number) => `quran/hafs-kfqc/${s}:${a}`;
const T = 1_758_000_000_000;
const at = { key: k(2, 5), page: 3, word: 4, x: 120.5, y: 88 };

describe("notes", () => {
  it("pins an empty comment on a word by default", () => {
    const [n] = addNote([], at, T);
    expect(n).toMatchObject({ ...at, text: "", kind: "comment", onHarakah: false, createdAt: T, updatedAt: T });
    expect(n!.mark).toBeUndefined();
    expect(isNote(n)).toBe(true);
  });

  it("pins a comment on several signs, keeping the first in `mark` for older readers", () => {
    const [n] = addNote([], { ...at, marks: [5, 2, 5, 3] }, T);
    expect(n!.marks).toEqual([2, 3, 5]);
    expect(n!.mark).toBe(2);
    expect(n!.onHarakah).toBe(true);
    expect(signsOfNote(n!)).toEqual([2, 3, 5]);
    expect(isNote(n)).toBe(true);
    expect(isNote({ ...n!, marks: [1, -1] })).toBe(false);
    // One sign is just `mark`; none is the whole word.
    const [one] = addNote([], { ...at, marks: [4] }, T);
    expect(one!.marks).toBeUndefined();
    expect(signsOfNote(one!)).toEqual([4]);
    expect(signsOfNote(addNote([], at, T)[0]!)).toEqual([]);
  });

  it("pins a comment on one vowel-sign when given its mark", () => {
    const [n] = addNote([], { ...at, mark: 7 }, T);
    expect(n).toMatchObject({ word: 4, mark: 7, onHarakah: true, kind: "comment" });
    expect(isNote(n)).toBe(true);
    expect(addNote([], { ...at, mark: null }, T)[0]!.onHarakah).toBe(false);
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

describe("marked mistakes", () => {
  it("marks a word once, as a correction with no sign yet, and keeps it off the pins", () => {
    const set = markMistake([], at, T);
    const again = markMistake(set, at, T + 1);
    expect(again).toHaveLength(1);
    expect(set[0]).toMatchObject({ kind: "correction", mark: null, onHarakah: false, text: "" });
    expect(isMistake(set[0]!)).toBe(true);
    expect(isNote(set[0])).toBe(true);
    expect(notesOnPage(set, 3)).toEqual([]);
    expect(mistakeOn(set, 3, at.key, 4)?.id).toBe(set[0]!.id);
    expect(mistakeOn(set, 3, at.key, 5)).toBeUndefined();
  });

  it("narrows to one sign and back to the whole word", () => {
    const set = markMistake([], at, T);
    const id = set[0]!.id;
    const onSign = pickMistakeSign(set, id, 2, T + 5);
    expect(onSign[0]).toMatchObject({ mark: 2, onHarakah: true, updatedAt: T + 5 });
    expect(pickMistakeSign(onSign, id, 2, T + 9)[0]!.updatedAt).toBe(T + 5);
    expect(pickMistakeSign(onSign, id, null, T + 9)[0]).toMatchObject({ mark: null, onHarakah: false });
  });

  it("rides in the saved file and comes back", () => {
    const set = pickMistakeSign(markMistake([], at, T), markMistake([], at, T)[0]!.id, 1, T + 1);
    const file = parseBookmarkFile(JSON.stringify(toBookmarkFile([], T, set)));
    expect(file?.notes?.[0]).toMatchObject({ kind: "correction", mark: 1, onHarakah: true });
  });

  it("refuses a sign number that is not a whole number", () => {
    expect(isNote({ ...markMistake([], at, T)[0]!, mark: 1.5 })).toBe(false);
  });
});

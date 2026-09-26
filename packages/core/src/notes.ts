/**
 * Notes — a reader's own words pinned to a spot on the page, as plain data and
 * pure rules.
 *
 * The note tool (docs/design/page-toolbar-plan.md, step 2) drops a pin at the
 * word under the pointer. Two decisions shape what a note is:
 *
 * - **An exported batch is a portable annotation file, the reader's whole
 *   state** (docs/decisions/notes-export.md, note-export-shape = C): each note
 *   names its verse and the spot it covers, whether it sits on a harakah, and
 *   its kind — and the bookmarks ride in the same file. So a note carries a
 *   reference into the print (verse, word number, a point on the page), never
 *   the print's words.
 * - **The batch leaves as a file the reader saves and loads back**
 *   (note-persistence = B), which is the bookmark file's own path; notes join
 *   it rather than starting a second file.
 *
 * A comment note is anchored to a *word*. The mistake tool (step 3) marks a
 * word as a slip — a note of the kind "correction" with no text — and a second
 * tap narrows it to one vowel-sign on that word, which sets `mark` and
 * `onHarakah`. A comment can sit on one sign too: the sign tool and the word
 * tool (harakah-pick = D) pin a note to the sign the reader took.
 *
 * Everything here is pure and clockless, like the bookmarks module: every
 * change takes `now`.
 */

import { parseAyahKey } from "./keys.js";

/** The kinds a note may be (notes-export.md). The note tool makes comments. */
export type NoteKind = "comment" | "correction" | "developers" | "question";

const KINDS: readonly NoteKind[] = ["comment", "correction", "developers", "question"];

export interface Note {
  readonly id: string;
  /** The verse it is about. */
  readonly key: string;
  readonly page: number;
  /** The word it is pinned to, by its number on the page; null when none was under the pointer. */
  readonly word: number | null;
  /** Where the pin stands, in the page's own drawing units. */
  readonly x: number;
  readonly y: number;
  /** True when the note sits on one vowel-sign rather than the whole word. */
  readonly onHarakah: boolean;
  /**
   * Which sign, by its place in the verse's list of signs (the order the app's
   * sign data ships them in). Absent or null: the whole word.
   */
  readonly mark?: number | null;
  /**
   * Every sign the note sits on, in ascending order, when it sits on more than
   * one (the word tool's several-part pick). `mark` is always the first of
   * them, so a file read by an app that knows only `mark` still lands the note
   * on one of its signs rather than losing it. Absent for one sign or none.
   */
  readonly marks?: readonly number[];
  readonly kind: NoteKind;
  readonly text: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Longest note kept; longer text is cut, not refused. */
export const NOTE_TEXT_MAX = 2000;

function cleanText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim().slice(0, NOTE_TEXT_MAX);
}

/** A fresh id: time plus a counter, as for bookmarks. */
export function noteId(now: number, set: readonly Note[]): string {
  const base = `n${now.toString(36)}`;
  let n = 0;
  let id = base;
  while (set.some((x) => x.id === id)) id = `${base}-${++n}`;
  return id;
}

/** Every sign a note sits on, ascending; empty when it sits on the whole word. */
export function signsOfNote(n: Pick<Note, "mark" | "marks">): number[] {
  if (n.marks && n.marks.length > 0) return [...n.marks];
  return n.mark === undefined || n.mark === null ? [] : [n.mark];
}

/**
 * Pin a new, empty note. The reader types into it next. `mark` pins it to one
 * vowel-sign on the word (the sign tool, or a sign taken in the word tool);
 * `marks` to several; neither, it sits on the word.
 */
export function addNote(
  set: readonly Note[],
  at: {
    key: string;
    page: number;
    word: number | null;
    x: number;
    y: number;
    mark?: number | null;
    marks?: readonly number[];
  },
  now: number,
): Note[] {
  const several = [...new Set(at.marks ?? [])].sort((a, b) => a - b);
  const mark = several.length > 0 ? several[0]! : (at.mark ?? null);
  const note: Note = {
    id: noteId(now, set),
    key: at.key,
    page: at.page,
    word: at.word,
    x: at.x,
    y: at.y,
    onHarakah: mark !== null,
    ...(mark !== null ? { mark } : {}),
    ...(several.length > 1 ? { marks: several } : {}),
    kind: "comment",
    text: "",
    createdAt: now,
    updatedAt: now,
  };
  return [...set, note];
}

/** Change a note's text. Unchanged text leaves the set as it was. */
export function editNote(set: readonly Note[], id: string, text: string, now: number): Note[] {
  const clean = cleanText(text);
  return set.map((x) => (x.id === id && x.text !== clean ? { ...x, text: clean, updatedAt: now } : x));
}

export function removeNote(set: readonly Note[], id: string): Note[] {
  return set.filter((x) => x.id !== id);
}

/** Put a removed note back, unless one with its id is already there. */
export function restoreNote(set: readonly Note[], note: Note): Note[] {
  return set.some((x) => x.id === note.id) ? [...set] : [...set, note];
}

/** The notes a reader wrote on a page, as pins. Marked mistakes are drawn on their word instead. */
export function notesOnPage(set: readonly Note[], page: number): Note[] {
  return set.filter((x) => x.page === page && !isMistake(x));
}

/**
 * A marked mistake (step 3): a note of the kind "correction" on a word. It is
 * the decided note shape, so it rides in the same store and the same saved
 * file as every other note.
 */
export function isMistake(note: Note): boolean {
  return note.kind === "correction";
}

/** The mistake already marked on this word, if there is one. */
export function mistakeOn(set: readonly Note[], page: number, key: string, word: number): Note | undefined {
  return set.find((x) => isMistake(x) && x.page === page && x.key === key && x.word === word);
}

/** Mark a word as a slip. A word already marked is left as it is. */
export function markMistake(
  set: readonly Note[],
  at: { key: string; page: number; word: number; x: number; y: number },
  now: number,
): Note[] {
  if (mistakeOn(set, at.page, at.key, at.word)) return [...set];
  const note: Note = {
    id: noteId(now, set),
    key: at.key,
    page: at.page,
    word: at.word,
    x: at.x,
    y: at.y,
    onHarakah: false,
    mark: null,
    kind: "correction",
    text: "",
    createdAt: now,
    updatedAt: now,
  };
  return [...set, note];
}

/** Narrow a marked mistake to one sign on its word, or back to the whole word (null). */
export function pickMistakeSign(set: readonly Note[], id: string, mark: number | null, now: number): Note[] {
  return set.map((x) =>
    x.id === id && (x.mark ?? null) !== mark ? { ...x, mark, onHarakah: mark !== null, updatedAt: now } : x,
  );
}

export function isNote(x: unknown): x is Note {
  if (!x || typeof x !== "object") return false;
  const n = x as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.key === "string" &&
    parseAyahKey(n.key) !== null &&
    typeof n.page === "number" &&
    Number.isInteger(n.page) &&
    n.page >= 1 &&
    (n.word === null || (typeof n.word === "number" && Number.isInteger(n.word) && n.word >= 0)) &&
    typeof n.x === "number" &&
    Number.isFinite(n.x) &&
    typeof n.y === "number" &&
    Number.isFinite(n.y) &&
    typeof n.onHarakah === "boolean" &&
    (n.mark === undefined || n.mark === null || (typeof n.mark === "number" && Number.isInteger(n.mark) && n.mark >= 0)) &&
    (n.marks === undefined ||
      (Array.isArray(n.marks) &&
        (n.marks as unknown[]).every((m) => typeof m === "number" && Number.isInteger(m) && m >= 0))) &&
    KINDS.includes(n.kind as NoteKind) &&
    typeof n.text === "string" &&
    typeof n.createdAt === "number" &&
    typeof n.updatedAt === "number"
  );
}

/**
 * Load notes from a file into what the phone holds. Loading never deletes: a
 * note in both keeps the copy edited last.
 */
export function mergeNotes(held: readonly Note[], loaded: readonly Note[]): Note[] {
  const byId = new Map<string, Note>();
  for (const x of held) byId.set(x.id, x);
  for (const x of loaded) {
    const mine = byId.get(x.id);
    if (!mine || x.updatedAt > mine.updatedAt) byId.set(x.id, { ...x, text: cleanText(x.text) });
  }
  return [...byId.values()];
}

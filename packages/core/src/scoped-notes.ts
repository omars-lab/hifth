/**
 * Scoped notes — a reader's note that gathers verses from one part of the
 * Qur'an, as plain data and pure rules (docs/design/scoped-notes.md, build
 * step 1).
 *
 * Today a note is a few words pinned to one word of one verse (notes.ts).
 * Here a note is the reader's words plus a list of verses, and it has a scope
 * picked when it is made: a surah, a juz, a hizb, a page of one print, or the
 * whole Qur'an (scoped-notes-scopes). The scope decides which verses the note
 * can take. Each note has one text (scoped-notes-text), and every note saved
 * today moves across as a note of its one verse, scoped to the page it was
 * pinned on (scoped-notes-old-notes). Marked mistakes are not notes of this
 * kind and stay in notes.ts.
 *
 * Everything here is pure and clockless, like notes.ts: every change takes
 * `now`. A page scope needs the print's verse-to-page table, which the app
 * loads; it is passed in as `pageOf` rather than held here.
 */

import { parseAyahKey } from "./keys.js";
import { isMistake, mergeNotes, NOTE_TEXT_MAX, type Note } from "./notes.js";
import { AYAH_COUNTS, HIZB_STARTS, JUZ_STARTS, TOTAL_AYAHS, fromAbsoluteAyah, hizbOf, juzOf, toAbsoluteAyah } from "./quran-meta.js";
import type { EditionId } from "./types.js";

export type NoteScope =
  | { readonly type: "surah"; readonly surah: number }
  | { readonly type: "juz"; readonly juz: number }
  | { readonly type: "hizb"; readonly hizb: number }
  | { readonly type: "page"; readonly edition: EditionId; readonly page: number }
  | { readonly type: "whole" };

/** Where a pin stands, when a verse was added by pinning: the same fields as a note today. */
export interface NoteSpot {
  readonly page: number;
  readonly word: number | null;
  readonly x: number;
  readonly y: number;
  readonly onHarakah: boolean;
  readonly mark?: number | null;
  readonly marks?: readonly number[];
  readonly letter?: number;
}

export interface NoteVerse {
  /** The verse, as its key in a named print. */
  readonly key: string;
  readonly addedAt: number;
  /** Present when the verse was added by pinning; absent when it belongs to the whole verse. */
  readonly spot?: NoteSpot;
}

export type ScopedNoteKind = "comment" | "question" | "developers";

const KINDS: readonly ScopedNoteKind[] = ["comment", "question", "developers"];

export interface ScopedNote {
  readonly id: string;
  readonly kind: ScopedNoteKind;
  readonly scope: NoteScope;
  readonly text: string;
  /** In mus'haf order, no verse twice. */
  readonly verses: readonly NoteVerse[];
  readonly createdAt: number;
  /** When its text or scope last changed. */
  readonly updatedAt: number;
  /**
   * When it was last worked on: made, its text or scope changed, or a verse
   * added or removed. Reading it does not count. Orders the notes offered.
   */
  readonly usedAt: number;
}

/** The print's page for a verse key, or null when the print does not carry it. */
export type PageOf = (key: string) => number | null;

/** The verse a key names, with its place in the mus'haf; null for a key past the end of its surah. */
function verseOf(key: string): { edition: EditionId; surah: number; ayah: number; abs: number } | null {
  const k = parseAyahKey(key);
  if (!k || k.surah < 1 || k.surah > 114 || k.ayah < 1 || k.ayah > AYAH_COUNTS[k.surah - 1]!) return null;
  return { edition: k.edition, surah: k.surah, ayah: k.ayah, abs: toAbsoluteAyah(k.surah, k.ayah) };
}

/** Does the scope hold this verse? A page scope with no table to ask holds nothing. */
export function scopeContains(scope: NoteScope, key: string, pageOf?: PageOf): boolean {
  const v = verseOf(key);
  if (!v) return false;
  switch (scope.type) {
    case "whole":
      return true;
    case "surah":
      return v.surah === scope.surah;
    case "juz":
      return juzOf(v.surah, v.ayah) === scope.juz;
    case "hizb":
      return hizbOf(v.surah, v.ayah) === scope.hizb;
    case "page":
      return v.edition === scope.edition && pageOf !== undefined && pageOf(key) === scope.page;
  }
}

/** Verses from one division's start up to the next division's start. */
function divisionSize(starts: readonly (readonly [number, number])[], n: number): number {
  const from = toAbsoluteAyah(...starts[n - 1]!);
  const to = n < starts.length ? toAbsoluteAyah(...starts[n]!) : TOTAL_AYAHS + 1;
  return to - from;
}

/** How many verses the scope holds. Used to put the smaller scope first when two notes tie. */
export function scopeSize(scope: NoteScope, pageOf?: PageOf): number {
  switch (scope.type) {
    case "whole":
      return TOTAL_AYAHS;
    case "surah":
      return AYAH_COUNTS[scope.surah - 1] ?? 0;
    case "juz":
      return divisionSize(JUZ_STARTS, scope.juz);
    case "hizb":
      return divisionSize(HIZB_STARTS, scope.hizb);
    case "page": {
      if (!pageOf) return 0;
      let n = 0;
      for (let abs = 1; abs <= TOTAL_AYAHS; abs++) {
        const { surah, ayah } = fromAbsoluteAyah(abs);
        if (pageOf(`quran/${scope.edition}/${surah}:${ayah}`) === scope.page) n++;
      }
      return n;
    }
  }
}

/** The same verse in any print: a note holds it once. */
function sameVerse(a: string, b: string): boolean {
  const x = verseOf(a);
  const y = verseOf(b);
  return x !== null && y !== null && x.abs === y.abs;
}

function inOrder(verses: readonly NoteVerse[]): NoteVerse[] {
  return [...verses].sort(
    (a, b) => (verseOf(a.key)?.abs ?? 0) - (verseOf(b.key)?.abs ?? 0) || a.key.localeCompare(b.key),
  );
}

function freshId(now: number, set: readonly { id: string }[]): string {
  const base = `n${now.toString(36)}`;
  let n = 0;
  let id = base;
  while (set.some((x) => x.id === id)) id = `${base}-${++n}`;
  return id;
}

/** Make an empty note with a scope. A note may hold no verses: one made from a juz label starts this way. */
export function addScopedNote(set: readonly ScopedNote[], scope: NoteScope, now: number): ScopedNote[] {
  const note: ScopedNote = {
    id: freshId(now, set),
    kind: "comment",
    scope,
    text: "",
    verses: [],
    createdAt: now,
    updatedAt: now,
    usedAt: now,
  };
  return [...set, note];
}

/** Can this note take this verse: inside its scope, and not in it already? */
export function canTake(note: ScopedNote, key: string, pageOf?: PageOf): boolean {
  return scopeContains(note.scope, key, pageOf) && !note.verses.some((v) => sameVerse(v.key, key));
}

/** Add a verse to a note. A verse outside the scope, or already there, leaves the set as it was. */
export function addVerse(
  set: readonly ScopedNote[],
  id: string,
  verse: { key: string; spot?: NoteSpot },
  now: number,
  pageOf?: PageOf,
): ScopedNote[] {
  const target = set.find((x) => x.id === id);
  if (!target || !canTake(target, verse.key, pageOf)) return [...set];
  const added: NoteVerse = { key: verse.key, addedAt: now, ...(verse.spot ? { spot: verse.spot } : {}) };
  return set.map((x) => (x.id === id ? { ...x, verses: inOrder([...x.verses, added]), usedAt: now } : x));
}

/** Take a verse out of a note. The note stays, even with no verses left. */
export function removeVerse(set: readonly ScopedNote[], id: string, key: string, now: number): ScopedNote[] {
  return set.map((x) =>
    x.id === id && x.verses.some((v) => sameVerse(v.key, key))
      ? { ...x, verses: x.verses.filter((v) => !sameVerse(v.key, key)), usedAt: now }
      : x,
  );
}

/** Change a note's text. Unchanged text leaves the set as it was. */
export function editScopedNote(set: readonly ScopedNote[], id: string, text: string, now: number): ScopedNote[] {
  const clean = text.replace(/\r\n?/g, "\n").trim().slice(0, NOTE_TEXT_MAX);
  return set.map((x) => (x.id === id && x.text !== clean ? { ...x, text: clean, updatedAt: now, usedAt: now } : x));
}

/** The verses a note holds that its scope does not: only a loaded file can bring these. */
export function outsideScope(note: ScopedNote, pageOf?: PageOf): string[] {
  return note.verses.filter((v) => !scopeContains(note.scope, v.key, pageOf)).map((v) => v.key);
}

/**
 * Change a note's scope. Widening always works. Narrowing works only when
 * every verse still fits; otherwise nothing changes and the verses that would
 * fall out are named, because a verse is never dropped to make a scope fit.
 */
export function changeScope(
  set: readonly ScopedNote[],
  id: string,
  scope: NoteScope,
  now: number,
  pageOf?: PageOf,
): { ok: true; notes: ScopedNote[] } | { ok: false; outside: string[] } {
  const target = set.find((x) => x.id === id);
  if (!target) return { ok: true, notes: [...set] };
  const outside = outsideScope({ ...target, scope }, pageOf);
  if (outside.length > 0) return { ok: false, outside };
  return { ok: true, notes: set.map((x) => (x.id === id ? { ...x, scope, updatedAt: now, usedAt: now } : x)) };
}

/**
 * The notes to offer when a verse is added: those that can take it, last used
 * first; on a tie the smaller scope, then the newer note, then the id, so the
 * order never wobbles. The first `limit` are offered, the rest go under "More
 * notes". Notes already holding the verse are named apart, never offered.
 */
export function suggestNotes(
  set: readonly ScopedNote[],
  key: string,
  pageOf?: PageOf,
  limit = 3,
): { offered: ScopedNote[]; more: ScopedNote[]; alreadyIn: ScopedNote[] } {
  const sizes = new Map<ScopedNote, number>();
  const size = (n: ScopedNote) => {
    if (!sizes.has(n)) sizes.set(n, scopeSize(n.scope, pageOf));
    return sizes.get(n)!;
  };
  const order = (a: ScopedNote, b: ScopedNote) =>
    b.usedAt - a.usedAt || size(a) - size(b) || b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const alreadyIn = set.filter((n) => n.verses.some((v) => sameVerse(v.key, key))).sort(order);
  const fit = set.filter((n) => canTake(n, key, pageOf)).sort(order);
  return { offered: fit.slice(0, limit), more: fit.slice(limit), alreadyIn };
}

/**
 * Move today's notes across: each comment, question and developer note becomes
 * a note of its one verse, scoped to the page it was pinned on, with its id,
 * text, kind, times and pin unchanged. Marked mistakes are left where they are.
 * A note already moved (its id is there) is skipped, so running it twice adds
 * nothing. Returns the scoped notes, the ones already held first.
 */
export function migrateV1Notes(old: readonly Note[], held: readonly ScopedNote[]): ScopedNote[] {
  const have = new Set(held.map((n) => n.id));
  const moved: ScopedNote[] = [];
  for (const n of old) {
    if (isMistake(n) || have.has(n.id)) continue;
    const k = parseAyahKey(n.key);
    if (!k) continue;
    const spot: NoteSpot = {
      page: n.page,
      word: n.word,
      x: n.x,
      y: n.y,
      onHarakah: n.onHarakah,
      ...(n.mark !== undefined ? { mark: n.mark } : {}),
      ...(n.marks !== undefined ? { marks: n.marks } : {}),
      ...(n.letter !== undefined ? { letter: n.letter } : {}),
    };
    moved.push({
      id: n.id,
      kind: n.kind as ScopedNoteKind,
      scope: { type: "page", edition: k.edition, page: n.page },
      text: n.text,
      verses: [{ key: n.key, addedAt: n.createdAt, spot }],
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      usedAt: n.updatedAt,
    });
    have.add(n.id);
  }
  return [...held, ...moved];
}

const whole = (n: unknown, lo: number, hi: number) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;

function isScope(x: unknown): x is NoteScope {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  switch (s.type) {
    case "whole":
      return true;
    case "surah":
      return whole(s.surah, 1, 114);
    case "juz":
      return whole(s.juz, 1, JUZ_STARTS.length);
    case "hizb":
      return whole(s.hizb, 1, HIZB_STARTS.length);
    case "page":
      return typeof s.edition === "string" && s.edition.length > 0 && whole(s.page, 1, Number.MAX_SAFE_INTEGER);
    default:
      return false;
  }
}

function isSpot(x: unknown): x is NoteSpot {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    whole(s.page, 1, Number.MAX_SAFE_INTEGER) &&
    (s.word === null || whole(s.word, 0, Number.MAX_SAFE_INTEGER)) &&
    typeof s.x === "number" &&
    Number.isFinite(s.x) &&
    typeof s.y === "number" &&
    Number.isFinite(s.y) &&
    typeof s.onHarakah === "boolean" &&
    (s.mark === undefined || s.mark === null || whole(s.mark, 0, Number.MAX_SAFE_INTEGER)) &&
    (s.marks === undefined || (Array.isArray(s.marks) && s.marks.every((m) => whole(m, 0, Number.MAX_SAFE_INTEGER)))) &&
    (s.letter === undefined || whole(s.letter, 0, Number.MAX_SAFE_INTEGER))
  );
}

function isVerse(x: unknown): x is NoteVerse {
  if (!x || typeof x !== "object") return false;
  const v = x as Record<string, unknown>;
  return typeof v.key === "string" && verseOf(v.key) !== null && typeof v.addedAt === "number" && (v.spot === undefined || isSpot(v.spot));
}

/**
 * Is this a well-formed note? A verse outside the note's scope is allowed (a
 * loaded file can bring one, and it is kept and named, never dropped); the same
 * verse twice is not.
 */
export function isScopedNote(x: unknown): x is ScopedNote {
  if (!x || typeof x !== "object") return false;
  const n = x as Record<string, unknown>;
  if (
    !(
      typeof n.id === "string" &&
      KINDS.includes(n.kind as ScopedNoteKind) &&
      isScope(n.scope) &&
      typeof n.text === "string" &&
      Array.isArray(n.verses) &&
      n.verses.every(isVerse) &&
      typeof n.createdAt === "number" &&
      typeof n.updatedAt === "number" &&
      typeof n.usedAt === "number"
    )
  )
    return false;
  const seen = new Set<number>();
  for (const v of n.verses as NoteVerse[]) {
    const abs = verseOf(v.key)!.abs;
    if (seen.has(abs)) return false;
    seen.add(abs);
  }
  return true;
}

/**
 * Load notes from a file into what the phone holds. Loading never deletes: a
 * note in both keeps the copy changed last, where adding or removing a verse
 * counts as a change as much as editing the text.
 */
export function mergeScopedNotes(held: readonly ScopedNote[], loaded: readonly ScopedNote[]): ScopedNote[] {
  const changed = (n: ScopedNote) => Math.max(n.updatedAt, n.usedAt);
  const byId = new Map<string, ScopedNote>();
  for (const x of held) byId.set(x.id, x);
  for (const x of loaded) {
    const mine = byId.get(x.id);
    if (!mine || changed(x) > changed(mine)) byId.set(x.id, { ...x, verses: inOrder(x.verses) });
  }
  return [...byId.values()];
}

/**
 * A saved file loaded into what the device holds. A file from before the
 * upgrade carries only old notes: its notes move across as they load, and its
 * mistakes stay mistakes. A newer file carries the new kind of note as well.
 * Either way a note held in both places keeps the copy changed last, and
 * `added` counts what the device did not have, for the line the reader is told.
 */
export function mergeNotesFile(
  heldScoped: readonly ScopedNote[],
  heldMistakes: readonly Note[],
  fileNotes: readonly Note[],
  fileScoped: readonly ScopedNote[],
): { scoped: ScopedNote[]; mistakes: Note[]; added: number } {
  const scoped = mergeScopedNotes(mergeScopedNotes(heldScoped, migrateV1Notes(fileNotes, [])), fileScoped);
  const mistakes = mergeNotes(heldMistakes, fileNotes.filter(isMistake));
  return { scoped, mistakes, added: scoped.length - heldScoped.length + mistakes.length - heldMistakes.length };
}

/*
 * Until the note tool offers existing notes (step 3) and notes have a list of
 * their own (step 4), the page still draws one pin per pinned verse and the
 * app still changes notes through those pins. These two turn the notes into
 * pins and a changed set of pins back into notes, so the screen is unchanged
 * while what the device keeps is the new kind of note.
 */

/** A pin's id: the note's own id for its first pinned verse, then the note's id and the verse. */
function pinId(note: ScopedNote, verse: NoteVerse, first: boolean): string {
  if (first) return note.id;
  const v = verseOf(verse.key);
  return v ? `${note.id}~${v.surah}:${v.ayah}` : `${note.id}~${verse.key}`;
}

/** One pin per pinned verse, shaped as the page draws pins today. A verse with no pin draws none. */
export function pinsOf(set: readonly ScopedNote[]): Note[] {
  const out: Note[] = [];
  for (const n of set) {
    let first = true;
    for (const v of n.verses) {
      if (!v.spot) continue;
      out.push({
        id: pinId(n, v, first),
        key: v.key,
        ...v.spot,
        kind: n.kind,
        text: n.text,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      });
      first = false;
    }
  }
  return out;
}

/**
 * Carry a changed set of pins back into the notes. A pin gone takes its verse
 * out, and a note whose last pin went is gone, as deleting a pin always was;
 * a pin with new words gives the note those words; a pin the notes do not know
 * (a fresh one, or one put back by Undo) becomes a page note of its one verse.
 * A note with no pinned verse at all, which only a loaded file can bring, is
 * left alone.
 */
export function fromPins(held: readonly ScopedNote[], pins: readonly Note[], now: number): ScopedNote[] {
  const byId = new Map(pins.filter((p) => !isMistake(p)).map((p) => [p.id, p]));
  const known = new Set<string>();
  const next: ScopedNote[] = [];
  for (const n of held) {
    let first = true;
    let pinned = 0;
    let newest: Note | null = null;
    const verses = n.verses.filter((v) => {
      if (!v.spot) return true;
      const id = pinId(n, v, first);
      first = false;
      pinned++;
      known.add(id);
      const p = byId.get(id);
      if (p && p.text !== n.text && (!newest || p.updatedAt > newest.updatedAt)) newest = p;
      return p !== undefined;
    });
    if (pinned > 0 && verses.length === 0) continue;
    let note = n;
    if (verses.length < n.verses.length) note = { ...note, verses, usedAt: now };
    const edit = newest as Note | null;
    if (edit) note = { ...note, text: edit.text, updatedAt: edit.updatedAt, usedAt: Math.max(note.usedAt, edit.updatedAt) };
    next.push(note);
  }
  const fresh = [...byId.values()].filter((p) => !known.has(p.id));
  return fresh.length === 0 ? next : migrateV1Notes(fresh, next);
}

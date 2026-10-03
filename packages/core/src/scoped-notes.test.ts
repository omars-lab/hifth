import { describe, expect, it } from "vitest";
import { parseBookmarkFile, toBookmarkFile } from "./bookmarks.js";
import { addNote, markMistake, type Note } from "./notes.js";
import { toAbsoluteAyah } from "./quran-meta.js";
import {
  addScopedNote,
  addVerse,
  changeScope,
  isScopedNote,
  joinNote,
  mergeScopedNotes,
  noteTitle,
  migrateV1Notes,
  outsideScope,
  pinsOf,
  fromPins,
  mergeNotesFile,
  removeVerse,
  scopeContains,
  scopeSize,
  suggestNotes,
  notesAbout,
  notesOfVerse,
  verseDots,
  type NoteScope,
  type PageOf,
  type ScopedNote,
} from "./scoped-notes.js";

const k = (s: number, a: number) => `quran/hafs-kfqc/${s}:${a}`;
const T = 1_758_000_000_000;

/** A stand-in for the print's verse-to-page table: page 7 holds 2:38 to 2:48, as in the real print. */
const pageOf: PageOf = (key) => {
  const m = /^quran\/hafs-kfqc\/(\d+):(\d+)$/.exec(key);
  if (!m) return null;
  const abs = toAbsoluteAyah(Number(m[1]), Number(m[2]));
  if (abs < toAbsoluteAyah(2, 38)) return abs <= 7 ? 1 : 2 + Math.floor((abs - 8) / 8);
  if (abs <= toAbsoluteAyah(2, 48)) return 7;
  return 8 + Math.floor((abs - toAbsoluteAyah(2, 49)) / 10);
};

const page7: NoteScope = { type: "page", edition: "hafs-kfqc", page: 7 };

function note(id: string, scope: NoteScope, usedAt: number, extra: Partial<ScopedNote> = {}): ScopedNote {
  return { id, kind: "comment", scope, text: id, verses: [], createdAt: 0, updatedAt: 0, usedAt, ...extra };
}

describe("what a scope holds", () => {
  it("a juz holds its own verses and stops at the next juz's first verse", () => {
    const juz1: NoteScope = { type: "juz", juz: 1 };
    const juz2: NoteScope = { type: "juz", juz: 2 };
    expect(scopeContains(juz1, k(2, 141))).toBe(true);
    expect(scopeContains(juz1, k(2, 142))).toBe(false);
    expect(scopeContains(juz2, k(2, 142))).toBe(true);
  });

  it("a hizb starts where the table says: hizb 2 at 2:75", () => {
    expect(scopeContains({ type: "hizb", hizb: 1 }, k(2, 74))).toBe(true);
    expect(scopeContains({ type: "hizb", hizb: 2 }, k(2, 74))).toBe(false);
    expect(scopeContains({ type: "hizb", hizb: 2 }, k(2, 75))).toBe(true);
  });

  it("a page holds what the print puts on it, and only in that print", () => {
    expect(scopeContains(page7, k(2, 37), pageOf)).toBe(false);
    expect(scopeContains(page7, k(2, 38), pageOf)).toBe(true);
    expect(scopeContains(page7, k(2, 48), pageOf)).toBe(true);
    expect(scopeContains(page7, k(2, 49), pageOf)).toBe(false);
    expect(scopeContains(page7, "quran/other-print/2:40", pageOf)).toBe(false);
    // Without the print's table nobody can say, so the answer is no rather than a guess.
    expect(scopeContains(page7, k(2, 40))).toBe(false);
  });

  it("a surah holds only its own verses; the whole Qur'an holds every verse", () => {
    expect(scopeContains({ type: "surah", surah: 2 }, k(2, 286))).toBe(true);
    expect(scopeContains({ type: "surah", surah: 2 }, k(3, 1))).toBe(false);
    expect(scopeContains({ type: "whole" }, k(114, 6))).toBe(true);
  });

  it("an ayah, a word or a harakah holds its one verse, in any print, and nothing else", () => {
    const ayah: NoteScope = { type: "ayah", key: k(2, 50) };
    const word: NoteScope = { type: "word", key: k(2, 50), word: 3 };
    const harakah: NoteScope = { type: "harakah", key: k(2, 50), word: 3, mark: 1 };
    for (const scope of [ayah, word, harakah]) {
      expect(scopeContains(scope, k(2, 50))).toBe(true);
      expect(scopeContains(scope, "quran/hafs-madani/2:50")).toBe(true);
      expect(scopeContains(scope, k(2, 51))).toBe(false);
      expect(scopeSize(scope)).toBe(1);
    }
  });

  it("a verse number past the end of its surah is held by nothing", () => {
    for (const scope of [{ type: "surah", surah: 2 }, { type: "juz", juz: 3 }, { type: "whole" }] as NoteScope[]) {
      expect(scopeContains(scope, k(2, 287), pageOf)).toBe(false);
    }
    expect(scopeContains({ type: "whole" }, "not a verse")).toBe(false);
  });

  it("knows how many verses each scope holds", () => {
    expect(scopeSize(page7, pageOf)).toBe(11);
    expect(scopeSize({ type: "hizb", hizb: 1 })).toBe(81);
    expect(scopeSize({ type: "juz", juz: 1 })).toBe(148);
    expect(scopeSize({ type: "surah", surah: 2 })).toBe(286);
    expect(scopeSize({ type: "whole" })).toBe(6236);
  });
});

describe("a note's verses", () => {
  it("makes an empty note with a scope, used the moment it is made", () => {
    const [n] = addScopedNote([], { type: "juz", juz: 1 }, T);
    expect(n).toMatchObject({ kind: "comment", text: "", verses: [], createdAt: T, updatedAt: T, usedAt: T });
    expect(isScopedNote(n)).toBe(true);
  });

  it("takes a verse inside its scope and marks the note used", () => {
    const set = [note("a", { type: "juz", juz: 1 }, T)];
    const [n] = addVerse(set, "a", { key: k(2, 40) }, T + 5);
    expect(n!.verses).toEqual([{ key: k(2, 40), addedAt: T + 5 }]);
    expect(n!.usedAt).toBe(T + 5);
    expect(n!.updatedAt).toBe(0);
  });

  it("refuses a verse outside its scope, and the same verse twice", () => {
    const set = [note("a", { type: "juz", juz: 1 }, T)];
    expect(addVerse(set, "a", { key: k(2, 142) }, T + 5)).toEqual(set);
    const once = addVerse(set, "a", { key: k(2, 40) }, T + 5);
    expect(addVerse(once, "a", { key: k(2, 40) }, T + 9)).toEqual(once);
  });

  it("keeps verses in mus'haf order whatever order they were added in", () => {
    let set = [note("a", { type: "whole" }, T)];
    for (const key of [k(3, 7), k(2, 40), k(2, 255), k(1, 1)]) set = addVerse(set, "a", { key }, T);
    expect(set[0]!.verses.map((v) => v.key)).toEqual([k(1, 1), k(2, 40), k(2, 255), k(3, 7)]);
  });

  it("keeps the pin's spot when a verse is added by pinning", () => {
    const spot = { page: 7, word: 3, x: 10, y: 20, onHarakah: false };
    const [n] = addVerse([note("a", page7, T)], "a", { key: k(2, 40), spot }, T, pageOf);
    expect(n!.verses[0]!.spot).toEqual(spot);
  });

  it("removing the last verse keeps the note", () => {
    const set = addVerse([note("a", { type: "whole" }, T)], "a", { key: k(2, 40) }, T);
    const [n] = removeVerse(set, "a", k(2, 40), T + 9);
    expect(n).toMatchObject({ id: "a", verses: [], usedAt: T + 9 });
  });
});

describe("changing a note's scope", () => {
  const held = addVerse([note("a", page7, T)], "a", { key: k(2, 40) }, T, pageOf);

  it("widening always works, and counts as a change", () => {
    const r = changeScope(held, "a", { type: "juz", juz: 1 }, T + 9, pageOf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.notes[0]).toMatchObject({ scope: { type: "juz", juz: 1 }, updatedAt: T + 9, usedAt: T + 9 });
  });

  it("narrowing names the verses that would fall out and changes nothing", () => {
    const wide = addVerse([note("a", { type: "juz", juz: 1 }, T)], "a", { key: k(2, 100) }, T);
    const r = changeScope(wide, "a", page7, T + 9, pageOf);
    expect(r).toEqual({ ok: false, outside: [k(2, 100)] });
  });

  it("narrows down to the one word or harakah of a note of one verse, and back out", () => {
    const one = addVerse([note("a", page7, T)], "a", { key: k(2, 40) }, T, pageOf);
    const r = changeScope(one, "a", { type: "harakah", key: k(2, 40), word: 2, mark: 0 }, T + 9, pageOf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isScopedNote(r.notes[0])).toBe(true);
    expect(changeScope(r.notes, "a", { type: "ayah", key: k(2, 41) }, T + 10, pageOf)).toEqual({ ok: false, outside: [k(2, 40)] });
    expect(changeScope(r.notes, "a", page7, T + 10, pageOf).ok).toBe(true);
  });

  it("a saved word or harakah scope with no verse key, or no word, is refused", () => {
    expect(isScopedNote(note("a", { type: "word", key: "nope", word: 3 } as NoteScope, T))).toBe(false);
    expect(isScopedNote(note("a", { type: "harakah", key: k(2, 40), word: 2 } as unknown as NoteScope, T))).toBe(false);
    expect(isScopedNote(note("a", { type: "ayah", key: k(2, 40) }, T))).toBe(true);
  });
});

describe("which notes are offered when a verse is added", () => {
  const verse = k(2, 40);
  const set: ScopedNote[] = [
    note("weak", { type: "juz", juz: 1 }, T + 4),
    note("alike", { type: "whole" }, T + 3),
    note("bani", { type: "surah", surah: 2 }, T + 2),
    note("madd", page7, T + 1),
    note("imran", { type: "surah", surah: 3 }, T + 9),
  ];

  it("offers the notes that can take it, last used first, three at most, the rest under more", () => {
    const s = suggestNotes(set, verse, pageOf);
    expect(s.offered.map((n) => n.id)).toEqual(["weak", "alike", "bani"]);
    expect(s.more.map((n) => n.id)).toEqual(["madd"]);
    expect(s.alreadyIn).toEqual([]);
  });

  it("never offers a note that already holds the verse, and names it instead", () => {
    const withIt = addVerse(set, "weak", { key: verse }, T + 4);
    const s = suggestNotes(withIt, verse, pageOf);
    expect(s.offered.map((n) => n.id)).toEqual(["alike", "bani", "madd"]);
    expect(s.alreadyIn.map((n) => n.id)).toEqual(["weak"]);
  });

  it("breaks ties by the smaller scope, then the newer note, then the id", () => {
    const tied = [
      note("z-whole", { type: "whole" }, T),
      note("y-juz-old", { type: "juz", juz: 1 }, T, { createdAt: 1 }),
      note("x-juz-new", { type: "juz", juz: 1 }, T, { createdAt: 2 }),
      note("b-page", page7, T),
      note("a-page", page7, T),
    ];
    const s = suggestNotes(tied, verse, pageOf, 10);
    expect(s.offered.map((n) => n.id)).toEqual(["a-page", "b-page", "x-juz-new", "y-juz-old", "z-whole"]);
  });

  it("offers nothing when no note can take the verse", () => {
    const noWhole = set.filter((n) => n.scope.type !== "whole");
    expect(suggestNotes(noWhole, k(114, 1), pageOf)).toEqual({ offered: [], more: [], alreadyIn: [] });
    // A whole-Qur'an note can take any verse, so it is offered even at the far end of the book.
    expect(suggestNotes(set, k(114, 1), pageOf).offered.map((n) => n.id)).toEqual(["alike"]);
  });
});

describe("adding a fresh pin's verse to a note you already have", () => {
  // A pin just made on 2:46 is a page note of that one verse, with no words yet.
  const fresh = migrateV1Notes(addNote([], { key: k(2, 46), page: 7, word: 4, x: 30, y: 40 }, T + 10), [])[0]!;
  const slips = note("slips", page7, T + 5, {
    text: "Page 7 slips\nthe madd in each",
    verses: [{ key: k(2, 40), addedAt: T, spot: { page: 7, word: 1, x: 1, y: 2, onHarakah: false } }],
  });
  const set = [slips, note("juz30", { type: "juz", juz: 30 }, T + 6), fresh];

  it("moves the verse and its pin into the note, and the fresh note is gone", () => {
    const got = joinNote(set, fresh.id, "slips", T + 20, pageOf)!;
    expect(got.notes.map((n) => n.id)).toEqual(["slips", "juz30"]);
    const joined = got.notes[0]!;
    expect(joined.verses.map((v) => v.key)).toEqual([k(2, 40), k(2, 46)]);
    expect(joined.verses[1]!.spot).toEqual(fresh.verses[0]!.spot);
    expect(joined.usedAt).toBe(T + 20);
    // The pin the page now draws for it carries the note's words, and its id is the one returned.
    const pin = pinsOf(got.notes).find((p) => p.id === got.pin)!;
    expect(pin.key).toBe(k(2, 46));
    expect(pin.text).toBe("Page 7 slips\nthe madd in each");
  });

  it("refuses a note that cannot take the verse, and a fresh note that is not fresh", () => {
    expect(joinNote(set, fresh.id, "juz30", T + 20, pageOf)).toBeNull();
    expect(joinNote(set, fresh.id, "gone", T + 20, pageOf)).toBeNull();
    const typed = set.map((n) => (n.id === fresh.id ? { ...n, text: "already typed" } : n));
    expect(joinNote(typed, fresh.id, "slips", T + 20, pageOf)).toBeNull();
  });

  it("a note's title is its first line, cut short with an ellipsis when it runs on", () => {
    expect(noteTitle(slips)).toBe("Page 7 slips");
    expect(noteTitle({ ...slips, text: "Verses that look alike and differ by a single word" })).toBe(
      "Verses that look alike and differ by a s…",
    );
  });
});

describe("moving today's notes across", () => {
  const pinned = addNote([], { key: k(2, 40), page: 7, word: 3, x: 10, y: 20 }, T);
  const old: Note[] = [
    ...markMistake(pinned, { key: k(2, 41), page: 7, word: 2, x: 5, y: 6 }, T + 1),
    ...addNote([], { key: k(2, 44), page: 7, word: null, x: 1, y: 2 }, T + 2),
  ].map((n) => (n.kind === "comment" && n.word === 3 ? { ...n, text: "watch the madd", updatedAt: T + 7 } : n));

  it("each note becomes a note of one verse on its page, with the same id, text, kind, times and pin", () => {
    const moved = migrateV1Notes(old, []);
    const first = old.find((n) => n.text === "watch the madd")!;
    expect(moved).toContainEqual({
      id: first.id,
      kind: "comment",
      scope: page7,
      text: "watch the madd",
      verses: [{ key: k(2, 40), addedAt: T, spot: { page: 7, word: 3, x: 10, y: 20, onHarakah: false } }],
      createdAt: T,
      updatedAt: T + 7,
      usedAt: T + 7,
    });
    expect(moved.every(isScopedNote)).toBe(true);
  });

  it("a pin with no word keeps no word", () => {
    const moved = migrateV1Notes(old, []);
    expect(moved.find((n) => n.verses[0]!.key === k(2, 44))!.verses[0]!.spot!.word).toBeNull();
  });

  it("leaves marked mistakes where they are", () => {
    expect(migrateV1Notes(old, []).some((n) => n.verses.some((v) => v.key === k(2, 41)))).toBe(false);
  });

  it("running it twice adds nothing", () => {
    const once = migrateV1Notes(old, []);
    expect(migrateV1Notes(old, once)).toEqual(once);
  });
});

describe("loading notes from a file", () => {
  it("never deletes, and keeps the copy changed last", () => {
    const mine = note("a", { type: "whole" }, T + 5, { text: "mine" });
    const theirs = note("a", { type: "whole" }, T + 9, { text: "theirs" });
    const onlyFile = note("b", { type: "whole" }, T);
    expect(mergeScopedNotes([mine], [theirs, onlyFile])).toEqual([theirs, onlyFile]);
    expect(mergeScopedNotes([theirs], [mine])).toEqual([theirs]);
  });

  it("a verse outside its note's scope loads and is named, not dropped", () => {
    const odd = note("a", page7, T, { verses: [{ key: k(2, 40), addedAt: T }, { key: k(9, 1), addedAt: T }] });
    expect(isScopedNote(odd)).toBe(true);
    expect(outsideScope(odd, pageOf)).toEqual([k(9, 1)]);
  });
});

describe("the saved file, version 2", () => {
  const scoped = [note("a", { type: "juz", juz: 1 }, T, { verses: [{ key: k(2, 40), addedAt: T }] })];

  it("round-trips its notes", () => {
    const file = toBookmarkFile([], T, [], scoped);
    expect(file.version).toBe(2);
    const back = parseBookmarkFile(JSON.stringify(file));
    expect(back?.scopedNotes).toEqual(scoped);
  });

  it("a file without scoped notes is still version 1, so an older app reads it", () => {
    expect(toBookmarkFile([], T).version).toBe(1);
  });

  it("a version 1 file loads, and its notes move across", () => {
    const old = addNote([], { key: k(2, 40), page: 7, word: 3, x: 10, y: 20 }, T);
    const back = parseBookmarkFile(JSON.stringify(toBookmarkFile([], T, old)));
    expect(migrateV1Notes(back!.notes!, back!.scopedNotes ?? [])).toHaveLength(1);
  });

  it("a broken note refuses the whole file", () => {
    const file = { ...toBookmarkFile([], T, [], scoped), scopedNotes: [{ ...scoped[0], scope: { type: "juz", juz: 31 } }] };
    expect(parseBookmarkFile(JSON.stringify(file))).toBeNull();
    const twice = { ...toBookmarkFile([], T, [], scoped), scopedNotes: [{ ...scoped[0], verses: [{ key: k(2, 40), addedAt: T }, { key: k(2, 40), addedAt: T }] }] };
    expect(parseBookmarkFile(JSON.stringify(twice))).toBeNull();
  });
});

describe("pins on the page while the app still draws one pin per note", () => {
  const spot = (x: number) => ({ page: 7, word: 1, x, y: 10, onHarakah: false });
  const oneVerse = (id: string, v: number, text: string, at = 5): ScopedNote => ({
    id,
    kind: "comment",
    scope: { type: "page", edition: "hafs-kfqc", page: 7 },
    text,
    verses: [{ key: k(2, v), addedAt: at, spot: spot(v) }],
    createdAt: at,
    updatedAt: at,
    usedAt: at,
  });

  it("a note of one pinned verse is one pin with the note's id, words and times", () => {
    const pinned = pinsOf([oneVerse("a", 40, "hello", 7)]);
    expect(pinned).toEqual([
      {
        id: "a",
        key: k(2, 40),
        page: 7,
        word: 1,
        x: 40,
        y: 10,
        onHarakah: false,
        kind: "comment",
        text: "hello",
        createdAt: 7,
        updatedAt: 7,
      },
    ]);
  });

  it("a note of several pinned verses is one pin per verse, the later ones named by their verse; a verse with no pin draws none", () => {
    const many: ScopedNote = {
      ...oneVerse("m", 40, "both"),
      verses: [
        { key: k(2, 40), addedAt: 1, spot: spot(40) },
        { key: k(2, 41), addedAt: 2 },
        { key: k(2, 42), addedAt: 3, spot: spot(42) },
      ],
    };
    expect(pinsOf([many]).map((p) => [p.id, p.key, p.text])).toEqual([
      ["m", k(2, 40), "both"],
      ["m~2:42", k(2, 42), "both"],
    ]);
  });

  it("an unchanged set of pins changes nothing", () => {
    const set = [oneVerse("a", 40, "x"), oneVerse("b", 41, "y")];
    expect(fromPins(set, pinsOf(set), 99)).toEqual(set);
  });

  it("a new pin becomes a page note of its one verse", () => {
    const set = [oneVerse("a", 40, "x")];
    const pin = { ...pinsOf([oneVerse("fresh", 45, "new", 50)])[0]! };
    const next = fromPins(set, [...pinsOf(set), pin], 99);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ ...oneVerse("fresh", 45, "new", 50), usedAt: 50 });
  });

  it("a pin whose words changed changes the note's words and times", () => {
    const set = [oneVerse("a", 40, "x")];
    const edited = pinsOf(set).map((p) => ({ ...p, text: "changed", updatedAt: 60 }));
    const next = fromPins(set, edited, 99);
    expect(next[0]).toMatchObject({ text: "changed", updatedAt: 60, usedAt: 60 });
  });

  it("removing the only pin of a note removes the note, as deleting a pin always has", () => {
    const set = [oneVerse("a", 40, "x"), oneVerse("b", 41, "y")];
    expect(fromPins(set, pinsOf(set).filter((p) => p.id !== "a"), 99).map((n) => n.id)).toEqual(["b"]);
  });

  it("removing one pin of several takes that verse out and keeps the note", () => {
    const many: ScopedNote = {
      ...oneVerse("m", 40, "both"),
      verses: [
        { key: k(2, 40), addedAt: 1, spot: spot(40) },
        { key: k(2, 42), addedAt: 3, spot: spot(42) },
      ],
    };
    const next = fromPins([many], pinsOf([many]).filter((p) => p.id !== "m~2:42"), 99);
    expect(next[0]!.verses.map((v) => v.key)).toEqual([k(2, 40)]);
    expect(next[0]!.usedAt).toBe(99);
  });

  it("a note with no pinned verse, which only a loaded file can bring, is left alone", () => {
    const bare: ScopedNote = { ...oneVerse("bare", 40, "words only"), verses: [] };
    expect(fromPins([bare], [], 99)).toEqual([bare]);
  });

  it("a deleted note put back by Undo comes back with its id", () => {
    const set = [oneVerse("a", 40, "x")];
    const gone = fromPins(set, [], 99);
    expect(gone).toEqual([]);
    expect(fromPins(gone, pinsOf(set), 100).map((n) => n.id)).toEqual(["a"]);
  });
});

describe("loading a saved file into what the device holds", () => {
  const old = (id: string, kind: Note["kind"], updatedAt: number): Note => ({
    id,
    key: k(2, 40),
    page: 7,
    word: 1,
    x: 1,
    y: 2,
    onHarakah: false,
    kind,
    text: id,
    createdAt: 1,
    updatedAt,
  });

  it("an old file's notes move across, its mistakes stay mistakes, and the count says what is new", () => {
    const r = mergeNotesFile([], [], [old("c", "comment", 5), old("m", "correction", 5)], []);
    expect(r.scoped.map((n) => n.id)).toEqual(["c"]);
    expect(r.mistakes.map((n) => n.id)).toEqual(["m"]);
    expect(r.added).toBe(2);
  });

  it("a new file's notes merge by id, the copy changed last winning", () => {
    const mine = note("a", { type: "whole" }, 10);
    const theirs = { ...note("a", { type: "whole" }, 20), text: "theirs" };
    const r = mergeNotesFile([mine], [], [], [theirs, note("b", { type: "whole" }, 1)]);
    expect(r.scoped.map((n) => [n.id, n.text])).toEqual([
      ["a", "theirs"],
      ["b", "b"],
    ]);
    expect(r.added).toBe(1);
  });

  it("an old note already moved and changed since on the device is not taken back", () => {
    const moved = migrateV1Notes([old("c", "comment", 5)], []);
    const edited = [{ ...moved[0]!, text: "newer", updatedAt: 50, usedAt: 50 }];
    const r = mergeNotesFile(edited, [], [old("c", "comment", 5)], []);
    expect(r.scoped[0]!.text).toBe("newer");
    expect(r.added).toBe(0);
  });
});

describe("the dot by a verse's number", () => {
  const note = (id: string, usedAt: number, verses: ScopedNote["verses"]): ScopedNote => ({
    id,
    kind: "comment",
    scope: page7,
    text: id,
    verses,
    createdAt: T,
    updatedAt: T,
    usedAt,
  });
  const spot = { page: 7, word: 3, x: 140, y: 260, onHarakah: false };
  const set = [
    note("a", T + 1, [{ key: k(2, 39), addedAt: T }, { key: k(2, 44), addedAt: T }]),
    note("b", T + 3, [{ key: k(2, 39), addedAt: T }]),
    note("c", T + 2, [{ key: k(2, 40), addedAt: T, spot }]),
  ];

  it("counts the notes each verse is in", () => {
    expect(verseDots(set)).toEqual(new Map([[k(2, 39), 2], [k(2, 44), 1]]));
  });

  it("leaves out a verse whose every note pinned it, since its pins already show", () => {
    expect(verseDots(set).has(k(2, 40))).toBe(false);
    const alsoWhole = [...set, note("d", T, [{ key: k(2, 40), addedAt: T }])];
    expect(verseDots(alsoWhole).get(k(2, 40))).toBe(2);
  });

  it("lists a verse's notes, the one used last first", () => {
    expect(notesOfVerse(set, k(2, 39)).map((n) => n.id)).toEqual(["b", "a"]);
    expect(notesOfVerse(set, k(2, 41))).toEqual([]);
  });
});

describe("the notes a juz, surah or page label lists", () => {
  const juz1: NoteScope = { type: "juz", juz: 1 };
  const set = [
    note("juz", juz1, T + 1),
    note("hizb", { type: "hizb", hizb: 2 }, T + 5),
    note("page", page7, T + 2),
    note("surah", { type: "surah", surah: 2 }, T + 3),
    note("whole", { type: "whole" }, T + 4, { verses: [{ key: k(2, 40), addedAt: T }] }),
    note("elsewhere", { type: "whole" }, T + 6, { verses: [{ key: k(3, 1), addedAt: T }] }),
    note("juz2", { type: "juz", juz: 2 }, T + 7),
  ];
  const ids = (scope: NoteScope) => notesAbout(set, scope, pageOf).map((n) => n.id);

  it("a juz lists the notes about it or about a part inside it, and those holding one of its verses", () => {
    expect(ids(juz1)).toEqual(["hizb", "whole", "page", "juz"]);
  });

  it("a surah lists what lies inside it; a juz that runs past its end is not inside it", () => {
    // Juz 1 starts in Al-Fatihah, so it is not inside Al-Baqarah.
    expect(ids({ type: "surah", surah: 2 })).toEqual(["juz2", "hizb", "whole", "surah", "page"]);
  });

  it("a page lists its own notes and those holding one of its verses", () => {
    expect(ids(page7)).toEqual(["whole", "page"]);
    expect(ids({ type: "page", edition: "hafs-kfqc", page: 9 })).toEqual([]);
  });
});

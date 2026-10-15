import { AYAH_COUNTS } from "./quran-meta.js";

/** A verse the commentary cites, as written ("5:15–16", "1:6c") and where it goes. */
export interface Citation {
  readonly text: string;
  /** The first verse cited — a range goes to its start, a lettered note to its verse. */
  readonly surah: number;
  readonly ayah: number;
}

// surah:ayah, then an optional range end, then an optional note letter; or a
// verse of the surah the prose is in, which the book writes "v. 5" or "vv. 4–7".
const CITE = /\b(\d{1,3}):(\d{1,3})(?:[–-]\d{1,3})?[a-z]?\b|\bvv?\.\s*(\d{1,3})(?:[–-]\d{1,3})?[a-z]?\b/g;

// A bare verse number continuing a list — "2:42, 140, and 146" — which the book
// writes without repeating the surah, after a comma. It must end where a list
// item ends (a comma, a semicolon, a stop, a bracket, a colon that starts no
// verse, "and", "of this surah", or the end), so "1:5, 40 days" leaves the 40
// alone and "23: 24" stays one citation. Not after a semicolon: the book puts
// one between surahs, and a bare number there is as often a slip for another
// surah as a verse of the same one, and a wrong link is worse than none.
const FOLLOW =
  /,\s*(?:and\s+)?(\d{1,3})(?:[–-]\d{1,3})?[a-z]?(?=[,;.)\]]|:(?!\s*\d)|\s+(?:and|of\s+this)\b|\s+\(|$)/y;

// The Bible's books by name, each with its number of chapters (the most of a
// numbered set: 2 Kings has 25). The commentary cites them as "Genesis 2:7",
// and a chapter and verse there is not the surah and verse of the same numbers.
// The count keeps a prophet apart from the book named for him: "Jonah 37:139"
// is the Qur'an's tale, since the book of Jonah has four chapters.
const BIBLE: Readonly<Record<string, number>> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21,
  Ruth: 4, Samuel: 31, Kings: 25, Chronicles: 36, Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42,
  Psalm: 150, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, Songs: 8, Isaiah: 66, Jeremiah: 52,
  Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4,
  Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16, Corinthians: 16,
  Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, Thessalonians: 5, Timothy: 6,
  Titus: 3, Philemon: 1, Hebrews: 13, James: 5, Peter: 5, Jude: 1, Revelation: 22,
};

// What stands before a chapter and verse of another book: a Bible book's name,
// or a dated work's year closing its bracket, which a volume and page follow
// ("[1999], 2:45"). Returns the chapters that book has, Infinity for a page.
const ANOTHER = /(?:\b([A-Z][a-z]+)\s+|\d{4}\]\s*,\s*)$/;
const anotherBook = (before: string): number => {
  const m = ANOTHER.exec(before);
  if (!m) return 0;
  return m[1] === undefined ? Infinity : (BIBLE[m[1]] ?? 0);
};

// A list of another book's verses goes on past a semicolon or a comma without
// naming the book again ("Genesis 2:7; 3:19"), so a reference that only a mark
// or an "and" parts from the last one is of the same book.
const SAME_LIST = /^[\s,;]*(?:and\s+)?$/;

const isVerse = (surah: number, ayah: number): boolean => {
  const count = AYAH_COUNTS[surah - 1];
  return count !== undefined && ayah >= 1 && ayah <= count;
};

/**
 * Split a paragraph of The Study Quran's prose into plain text and the verses
 * it cites, in order, so each citation can be drawn as a link. A number that
 * is not a real verse stays text. `here` is the surah the prose is about, which
 * a "v. 5" means; without it, those stay text.
 */
export function splitCitations(text: string, here?: number): (string | Citation)[] {
  const parts: (string | Citation)[] = [];
  let last = 0;
  // Where the last reference to another book ended, and how many chapters
  // that book has, so the list it begins can be followed.
  let other = { end: -1, chapters: 0 };
  for (const m of text.matchAll(CITE)) {
    const same = m[3] !== undefined;
    if (same && here === undefined) continue;
    if (!same) {
      const listed = other.end >= 0 && SAME_LIST.test(text.slice(other.end, m.index));
      const chapters = listed ? other.chapters : anotherBook(text.slice(Math.max(last, m.index - 40), m.index));
      if (Number(m[1]) <= chapters) {
        other = { end: m.index + m[0].length, chapters };
        continue;
      }
    }
    other = { end: -1, chapters: 0 };
    const surah = same ? here! : Number(m[1]);
    const ayah = Number(same ? m[3] : m[2]);
    if (!isVerse(surah, ayah)) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ text: m[0], surah, ayah });
    last = m.index + m[0].length;
    // Then any more verses of the same surah the list goes on to name.
    for (;;) {
      FOLLOW.lastIndex = last;
      const f = FOLLOW.exec(text);
      if (!f || !isVerse(surah, Number(f[1]))) break;
      const at = f.index + f[0].search(/\d/);
      parts.push(text.slice(last, at));
      parts.push({ text: text.slice(at, f.index + f[0].length), surah, ayah: Number(f[1]) });
      last = f.index + f[0].length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

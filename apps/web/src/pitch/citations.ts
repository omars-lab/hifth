import { AYAH_COUNTS } from "@hifth/core";

/** A verse the commentary cites, as written ("5:15–16", "1:6c") and where it goes. */
export interface Citation {
  readonly text: string;
  /** The first verse cited — a range goes to its start, a lettered note to its verse. */
  readonly surah: number;
  readonly ayah: number;
}

// surah:ayah, then an optional range end, then an optional note letter.
const CITE = /\b(\d{1,3}):(\d{1,3})(?:[–-]\d{1,3})?[a-z]?\b/g;

// A bare verse number continuing a list — "2:42, 140, and 146" — which the book
// writes without repeating the surah. It must end where a list item ends (a
// comma, a semicolon, a stop, a bracket, "and", or the end), so "1:5, 40 days"
// leaves the 40 alone.
const FOLLOW = /,\s*(?:and\s+)?(\d{1,3})(?:[–-]\d{1,3})?[a-z]?(?=[,;.)\]]|\s+and\b|$)/y;

const isVerse = (surah: number, ayah: number): boolean => {
  const count = AYAH_COUNTS[surah - 1];
  return count !== undefined && ayah >= 1 && ayah <= count;
};

/**
 * Split a paragraph of The Study Quran's prose into plain text and the verses
 * it cites, in order, so each citation can be drawn as a link. A number that
 * is not a real verse stays text.
 */
export function splitCitations(text: string): (string | Citation)[] {
  const parts: (string | Citation)[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
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

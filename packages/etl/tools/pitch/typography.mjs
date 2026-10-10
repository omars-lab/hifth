/**
 * The book's own typography, put back where the capture flattened it: the book
 * prints curly quotes and an en dash in a range of numbers, and the capture
 * sometimes gives straight quotes and a hyphen instead (about one note in fifty).
 * One rule for the whole book, so no hand-read row is spent on it.
 *
 * Run first of the three last touches (lettering.mjs), before the misreads are
 * mended and the slant is laid on, so both kinds of hand-read row are written
 * against the text as a reader sees it, curly quotes and all. Each mark is swapped for one mark, so a row written against
 * the text before this rule moves to it by position alone. The slant's marks,
 * where a note already carries them, count as part of the line: a quote
 * straight after a run opens is an opening quote.
 *
 * A quote mark between two letters is left alone: there it is a letter the
 * capture misread, not a quotation, and belongs to the hand-read misreads.
 */

const OPENS_AFTER = /[\s([{—–“‘]/;
const LETTER = /\p{L}/u;

/** Set the book's quotes and dashes in one paragraph. */
export function setTypography(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const before = out.at(-1);
    const after = text[i + 1];
    if (ch === "-" && /\d/.test(before ?? "") && /\d/.test(after ?? "")) out += "–";
    else if (ch === '"') {
      if (LETTER.test(before ?? "") && LETTER.test(after ?? "")) out += ch;
      else out += before === undefined || OPENS_AFTER.test(before) ? "“" : "”";
    } else if (ch === "'") out += before === undefined || OPENS_AFTER.test(before) ? "‘" : "’";
    else out += ch;
  }
  return out;
}

/** Set the typography of every note and translation in one surah, in place. */
export function setSurahTypography(verses) {
  const done = new Map();
  for (const entry of Object.values(verses)) {
    entry.commentary = entry.commentary.map((note) => {
      if (!done.has(note)) done.set(note, setTypography(note));
      return done.get(note);
    });
    if (typeof entry.translation === "string") entry.translation = setTypography(entry.translation);
  }
}

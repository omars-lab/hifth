/**
 * Marks the capture misread: the book slants a closing square bracket inside a
 * slanted quotation, and the capture took it for a slash, a round bracket or a
 * letter, leaving a bracket that never closes. It also misreads the odd word or
 * verse number (a letter for a digit, and the reference is no longer a link). No
 * rule can tell which character was meant, so each is read off the page picture
 * by hand and listed in the
 * private books repository: a row names the verse, the few characters as the
 * capture has them (`was`), and as the page prints them (`is`).
 *
 * A row that finds nothing, or finds two places, is refused rather than
 * guessed, as the slanted words are. Mended after the book's quotes are set and
 * before the slant is laid on (lettering.mjs), so a row of either kind is written
 * against the text as printed.
 */

/**
 * Mend the listed misreads in one surah's notes, in place. `verses` maps a
 * reference to its entry; `rows` is the whole hand-read list. A note filed
 * under several verses is mended under all of them. Returns which rows matched.
 */
export function mendSurah(surah, verses, rows) {
  const used = new Set();
  const mended = new Map();
  rows.forEach((row, i) => {
    if (Number(row.verse.split(":")[0]) !== surah) return;
    if (row.was === row.is) throw new Error(`${row.verse}: misread row "${row.was}" changes nothing`);
    const notes = (verses[row.verse]?.commentary ?? []).map((note) => mended.get(note) ?? note);
    const places = notes.reduce((n, note) => n + note.split(row.was).length - 1, 0);
    if (!places) throw new Error(`${row.verse}: misread row "${row.was}" finds nothing in the verse's notes`);
    if (places > 1) throw new Error(`${row.verse}: misread row "${row.was}" is in ${places} places; give it more context`);
    const original = verses[row.verse].commentary.find((note) => (mended.get(note) ?? note).includes(row.was));
    mended.set(original, (mended.get(original) ?? original).replace(row.was, row.is));
    used.add(i);
  });
  for (const entry of Object.values(verses))
    entry.commentary = entry.commentary.map((note) => mended.get(note) ?? note);
  return used;
}

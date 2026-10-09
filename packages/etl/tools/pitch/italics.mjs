/**
 * The words The Study Quran sets in italics: quoted words of the verse,
 * transliterated terms, a glossed word. The capture keeps no type style, and
 * the same word is slanted in one place and upright in the next, so no rule can
 * put them back. For the demo's verses they are read off the page pictures by
 * hand and listed in the private books repository, each row a few words of
 * context with the slanted run between underscores: "the word _qarya_ means".
 *
 * A row finds its place in the verse's notes and the run is wrapped in two
 * private-use characters the reader's panel draws as italics. A row that finds
 * nothing, or finds two places, is refused rather than guessed: the context is
 * there to make it one place. A row marked `every` slants each whole word it
 * finds in the verse's notes, and must find at least one.
 */

/** Opens a slanted run. The reader's panel has the same pair. */
export const SLANT_START = "\uE000";
/** Closes a slanted run. */
export const SLANT_END = "\uE001";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (piece) => escape(piece).replace(/\s+/g, "[\\s\\u00a0]+");

/** The row as a pattern: each slanted run a group; a letter at either end must end a word. */
function rowPattern(row) {
  const pieces = row.at.normalize("NFC").split("_");
  if (pieces.length < 3 || pieces.length % 2 === 0)
    throw new Error(`${row.verse}: italics row "${row.at}" has no slanted run between underscores`);
  const body = pieces.map((p, i) => (i % 2 ? `(${pattern(p)})` : pattern(p))).join("");
  const letter = /[\p{L}\p{M}]/u;
  const before = letter.test(row.at.at(0).replace("_", row.at.at(1))) ? "(?<![\\p{L}\\p{M}])" : "";
  const after = letter.test(row.at.at(-1).replace("_", row.at.at(-2))) ? "(?![\\p{L}\\p{M}])" : "";
  return new RegExp(`${before}${body}${after}`, "gdu");
}

/** Where a row's runs fall in each note: [note, start, end] triples. */
function runsOf(row, notes) {
  const re = rowPattern(row);
  const found = [];
  let places = 0;
  notes.forEach((note, n) => {
    for (const m of note.matchAll(re)) {
      places++;
      for (const [start, end] of m.indices.slice(1)) found.push([n, start, end]);
    }
  });
  if (!places) throw new Error(`${row.verse}: italics row "${row.at}" finds nothing in the verse's notes`);
  if (places > 1 && !row.every)
    throw new Error(`${row.verse}: italics row "${row.at}" is in ${places} places; give it more context`);
  return found;
}

/** One note with its runs wrapped, overlapping runs merged. */
function wrap(note, runs) {
  const merged = [];
  for (const [s, e] of [...runs].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  let out = note;
  for (const [s, e] of merged.reverse()) out = out.slice(0, s) + SLANT_START + out.slice(s, e) + SLANT_END + out.slice(e);
  return out;
}

/**
 * Slant the listed runs in one surah's notes, in place. `verses` maps a
 * reference to its entry; `rows` is the whole hand-read list. A note filed
 * under several verses is slanted under all of them. Returns which rows matched.
 */
export function slantSurah(surah, verses, rows) {
  const used = new Set();
  const byVerse = new Map();
  rows.forEach((row, i) => {
    if (Number(row.verse.split(":")[0]) !== surah) return;
    byVerse.set(row.verse, [...(byVerse.get(row.verse) ?? []), i]);
  });
  const slanted = new Map();
  for (const [ref, ids] of byVerse) {
    const notes = verses[ref]?.commentary ?? [];
    const runs = notes.map(() => []);
    for (const i of ids) {
      for (const [n, s, e] of runsOf(rows[i], notes)) runs[n].push([s, e]);
      used.add(i);
    }
    notes.forEach((note, n) => {
      if (!runs[n].length) return;
      const out = wrap(note, runs[n]);
      if (slanted.has(note) && slanted.get(note) !== out)
        throw new Error(`${ref}: a note it shares with another verse is slanted two different ways; list its rows under one verse`);
      slanted.set(note, out);
    });
  }
  for (const entry of Object.values(verses))
    entry.commentary = entry.commentary.map((note) => slanted.get(note) ?? note);
  return used;
}

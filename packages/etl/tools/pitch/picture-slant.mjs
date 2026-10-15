/**
 * The slant read off the page pictures, for the notes nobody read by hand.
 *
 * page-words.swift reads every word of a captured picture with its box and how
 * far its letters lean: upright type leans about 0 degrees, the book's italic
 * about 10. Each note is found among the words of its surah's pictures by runs
 * of at least three words in the same order (the picture also holds the verse
 * and the other notes, so a shorter likeness is not trusted), and each of its
 * words takes the lean of the word it was found as. A word leaning between 6
 * and 20 degrees is slanted; so is a word between two slanted ones on the
 * same printed line that is short (three letters or fewer, too little ink to
 * measure well) or leans at least 3 degrees. Neighbouring slanted words make
 * one run, a comma, stop or parenthesis at its edge left outside and a
 * question mark, exclamation, closing quote or bracket it ends on taken in, as
 * the book sets them.
 *
 * Measured on the 1,012 notes read by hand, with the transliteration marks
 * laid on after it: it slants 94 in 100 of the words the book slants, and 99
 * in 100 of the words it slants are slanted in the book
 * (docs/issues/italics-from-page-pictures.md).
 */
import { SLANT_END, SLANT_START } from "./italics.mjs";

/** A word as the matcher compares it: no marks, no case, letters and digits only. */
export const normWord = (w) =>
  w
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/** The print's italic, in degrees. Steeper is a misreading of the ink. */
export const leans = (slant) => slant >= 6 && slant <= 20;

const SHORT = 3;
/** A word between two slanted ones leaning at least this much is taken as slanted too. */
const SLIGHT = 3;
const LONGEST_SEARCH = 64;

/** Where a note's words stand in the picture's words: for each, the word's index or -1. */
function align(tokens, stream, index) {
  const at = tokens.map(() => -1);
  const taken = new Uint8Array(stream.length);
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (at[i] >= 0) continue;
    const places = index.get(tokens[i].key + " " + tokens[i + 1].key + " " + tokens[i + 2].key);
    if (!places) continue;
    let best = null;
    let tie = false;
    for (const j of places.slice(0, LONGEST_SEARCH)) {
      let back = 0;
      while (i - back > 0 && j - back > 0 && at[i - back - 1] < 0 && !taken[j - back - 1] && tokens[i - back - 1].key === stream[j - back - 1].key) back++;
      let len = back;
      while (i - back + len < tokens.length && j - back + len < stream.length && at[i - back + len] < 0 && !taken[j - back + len] && tokens[i - back + len].key === stream[j - back + len].key) len++;
      if (!best || len > best.len) [best, tie] = [{ i: i - back, j: j - back, len }, false];
      else if (len === best.len) tie = true;
    }
    if (!best || tie || best.len < 3) continue;
    for (let k = 0; k < best.len; k++) {
      at[best.i + k] = best.j + k;
      taken[best.j + k] = 1;
    }
  }
  return at;
}

/** The note's words, with where each one's letters begin and end. */
function tokensOf(note) {
  const out = [];
  for (const m of note.matchAll(/[^\s\u00a0]+/gu)) {
    const key = normWord(m[0]);
    if (!key) continue;
    const first = m[0].search(/[\p{L}\p{N}]/u);
    const core = m[0].search(/[^\p{L}\p{M}\p{N}]*$/u);
    // The book sets these inside a run that ends on them (in the notes read by
    // hand, 115 times against 11); a comma, stop or parenthesis stays outside.
    const last = core + (m[0].slice(core).match(/^[?!\u201d\]]+/u)?.[0].length ?? 0);
    out.push({ key, start: m.index + first, end: m.index + last });
  }
  return out;
}

function slantNote(note, stream, index) {
  const tokens = tokensOf(note);
  const at = align(tokens, stream, index);
  if (at.every((j) => j < 0)) return note;
  const word = (i) => (i >= 0 && i < tokens.length && at[i] >= 0 ? stream[at[i]] : null);
  const slanted = tokens.map((_, i) => Boolean(word(i) && leans(word(i).slant)));
  const sameLine = (a, b) => a && b && a.pic === b.pic && a.line === b.line;
  // A word between two slanted ones on the same printed line goes into the
  // run when it is short (too little ink to measure well) or leans a little:
  // the print does not end a run for one word. Two such words in a row do end
  // it (measured: they bring in more upright words than slanted ones).
  const carried = slanted.map((s, i) => {
    if (s || !slanted[i - 1] || !slanted[i + 1]) return s;
    const [before, after, self] = [word(i - 1), word(i + 1), word(i)];
    const faint = self && self.slant >= SLIGHT && self.slant <= 20;
    return (tokens[i].key.length <= SHORT || faint) && sameLine(before, after) && (!self || sameLine(self, before));
  });
  const runs = [];
  carried.forEach((s, i) => {
    if (!s) return;
    if (carried[i - 1]) runs.at(-1)[1] = tokens[i].end;
    else runs.push([tokens[i].start, tokens[i].end]);
  });
  let out = note;
  for (const [s, e] of runs.reverse()) out = out.slice(0, s) + SLANT_START + out.slice(s, e) + SLANT_END + out.slice(e);
  return out;
}

/** The pictures a surah's notes were read from (each captured block names its own), in page order. */
export function picturesOf(src) {
  const named = [
    ...(src.entries ?? []).flatMap((e) => (e.commentary ?? []).flatMap((c) => (c.blocks ?? []).map((b) => b.png))),
    ...(src.orphans ?? []).map((o) => o.png),
  ].filter(Boolean);
  const page = (png) => Number(png.match(/_p(\d+)\.png$/)?.[1] ?? 0);
  return [...new Set(named)].sort((a, b) => page(a) - page(b) || a.localeCompare(b));
}

/**
 * Slant, in place, the notes of one surah not in `read` (the notes read by
 * hand), from `words`: every word read off the surah's pictures, in reading
 * order, each `{ text, slant, line, pic }`. A note already holding a slanted run
 * is left as it is.
 */
export function slantFromPictures(verses, words, read) {
  const stream = words.map((w) => ({ ...w, key: normWord(w.text) })).filter((w) => w.key);
  const index = new Map();
  for (let j = 0; j + 2 < stream.length; j++) {
    const key = stream[j].key + " " + stream[j + 1].key + " " + stream[j + 2].key;
    const places = index.get(key);
    if (places) places.push(j);
    else index.set(key, [j]);
  }
  const done = new Map();
  for (const entry of Object.values(verses))
    entry.commentary = entry.commentary.map((note) => {
      if (read.has(note) || note.includes(SLANT_START)) return note;
      if (!done.has(note)) done.set(note, slantNote(note, stream, index));
      return done.get(note);
    });
}

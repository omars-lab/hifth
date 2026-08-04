/**
 * Canonical node-key grammar (spec §1).
 *
 * Loop 0 implements only the ayah-key formatter that the asset extractor needs
 * (`formatAyahKey`) plus a parser for that same form. The full grammar — word
 * ranges (`#w3-7`), roots (`root/ktb`), reserved namespaces (`hadith/…`) and
 * comparison/ordering — arrives in Loop 1 with property-based round-trip tests.
 *
 * It did not arrive in Loop 1, and the paragraph above is left standing because
 * the shape of the delay is the useful part: the word half was not waiting on a
 * parser, it was waiting on *geometry*. There was no answer to "which word is
 * under this finger" until word-B vendored 91 451 boxes onto our frame, and a
 * key nobody can point at is a key nobody can test. So `#w3` and `#w3-7` land
 * here now, beside the shard reader in `words.ts` that gives them referents.
 * `root/…` and `hadith/…` still have none and are still not written.
 *
 * The word index inside a `#w` key is **the print's**, not QAC's — it counts
 * pause marks as words, because the mus'haf numbers them. See `words.ts`.
 */

import type { EditionId } from "./types.js";

export interface AyahKey {
  readonly kind: "ayah";
  readonly edition: EditionId;
  readonly surah: number;
  readonly ayah: number;
}

/** Build the canonical ayah key, e.g. `quran/hafs-kfqc/2:48`. */
export function formatAyahKey(edition: EditionId, surah: number, ayah: number): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah out of range: ${surah}`);
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new RangeError(`ayah out of range: ${ayah}`);
  }
  return `quran/${edition}/${surah}:${ayah}`;
}

const AYAH_KEY_RE = /^quran\/([^/]+)\/(\d+):(\d+)$/;

/** Parse an ayah key; returns null if it is not a bare ayah key. */
export function parseAyahKey(key: string): AyahKey | null {
  const m = AYAH_KEY_RE.exec(key);
  if (!m) return null;
  const [, edition, surahStr, ayahStr] = m;
  return {
    kind: "ayah",
    edition: edition as EditionId,
    surah: Number(surahStr),
    ayah: Number(ayahStr),
  };
}

/**
 * A word, or a run of words, inside one ayah. `to === from` is a single word;
 * the two forms are distinct on the wire (`#w3` vs `#w3-3`) but only the first
 * is ever written, so one selection has one key.
 */
export interface WordKey {
  readonly kind: "word";
  readonly edition: EditionId;
  readonly surah: number;
  readonly ayah: number;
  /** The print's word index of the first word, inclusive. */
  readonly from: number;
  /** …and of the last, inclusive. Equal to `from` for a single word. */
  readonly to: number;
}

/**
 * Build a word key, e.g. `quran/hafs-kfqc/2:48#w3` or `…#w3-7`.
 *
 * A descending range throws rather than being quietly swapped: a drag that ran
 * right-to-left is the caller's to order, and normalising here would hide the
 * one bug — an anchor and a cursor that were never sorted — that this form can
 * actually have.
 */
export function formatWordKey(
  edition: EditionId,
  surah: number,
  ayah: number,
  from: number,
  to: number = from,
): string {
  const base = formatAyahKey(edition, surah, ayah);
  if (!Number.isInteger(from) || from < 1) {
    throw new RangeError(`word index out of range: ${from}`);
  }
  if (!Number.isInteger(to) || to < from) {
    throw new RangeError(`word range out of order: ${from}-${to}`);
  }
  return to === from ? `${base}#w${from}` : `${base}#w${from}-${to}`;
}

const WORD_KEY_RE = /^quran\/([^/]+)\/(\d+):(\d+)#w(\d+)(?:-(\d+))?$/;

/** Parse a word key; returns null if it is not one (a bare ayah key included). */
export function parseWordKey(key: string): WordKey | null {
  const m = WORD_KEY_RE.exec(key);
  if (!m) return null;
  const [, edition, surahStr, ayahStr, fromStr, toStr] = m;
  const from = Number(fromStr);
  const to = toStr === undefined ? from : Number(toStr);
  if (from < 1 || to < from) return null;
  return { kind: "word", edition: edition as EditionId, surah: Number(surahStr), ayah: Number(ayahStr), from, to };
}

/**
 * The ayah a key sits in: `…/2:48#w3-7` → `…/2:48`, and a bare ayah key is
 * returned unchanged. Null if it is neither — this is the guard everything that
 * takes "a selection" uses before handing it to the ayah-shaped machinery
 * (resolver, adjacency, revision record), all of which predate `#w`.
 */
export function ayahKeyOf(key: string): string | null {
  if (AYAH_KEY_RE.test(key)) return key;
  const w = parseWordKey(key);
  return w ? formatAyahKey(w.edition, w.surah, w.ayah) : null;
}

/** Decode the source `number` attribute (surah*1000 + ayah) into {surah, ayah}. */
export function decodeAyahNumber(number: number): { surah: number; ayah: number } {
  return { surah: Math.floor(number / 1000), ayah: number % 1000 };
}

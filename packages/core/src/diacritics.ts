/**
 * The print's mark vocabulary — the twenty-six things it draws above and below
 * a letter, and the integer each one is called by.
 *
 * Every layer that touches sub-word geometry needs the same list, and the list
 * is not a design choice anybody gets to make: it is what the ligature corpus's
 * `data-diacritic` attribute actually contains, measured over all 604 pages on
 * 2026-08-07. So it is written down once, here, and the ETL imports it rather
 * than growing its own copy — the same arrangement `build-tajweed.mjs` already
 * has with {@link isTajweedRuleId}, where a name the app cannot paint stops the
 * build instead of reaching a shard.
 *
 * ── Why an integer and not the name ─────────────────────────────────────────
 *
 * A page carries ~540 marks. Spelling "superscript alef" beside each one would
 * cost more than the geometry does; an index costs one or two characters. The
 * order below is therefore load-bearing — an id is only meaningful against this
 * array — which is why the order is *frequency*, descending, and why the counts
 * are written beside it. Frequency order is not cosmetic: it puts the cheap
 * one-character ids on the marks that occur most, and it makes a re-measure
 * that reorders the list obvious rather than silent.
 *
 * **Appending is safe. Reordering is not.** A shard written before a reorder
 * would read as a different mark on every page. If a future print introduces a
 * twenty-seventh mark, add it at the end and leave the rest alone, even though
 * that breaks the frequency ordering — the ordering is a nicety and the ids are
 * a contract.
 *
 * ── What is deliberately not here ───────────────────────────────────────────
 *
 * **Dots.** The corpus draws i'jam — the dots that distinguish ب ت ث — as a
 * separate `data-dots` attribute with three values over 105,269 paths, and they
 * are excluded on purpose. A dot is not a mark a reader is ever told to notice;
 * it is part of the letter's identity. Including them would add a third of the
 * corpus's paths to carry something nobody would ever highlight.
 *
 * **Waqf marks, the juz star and the sajda ornaments.** The print sets each of
 * those as its own *word*, with its own `data-word-index-in-ayah`, and the word
 * shards already flag them (`marks`, see `build-words.mjs`'s `isPauseMark`).
 * They are pauses and page furniture, not marks on a letter, and they are
 * already addressable one level up.
 *
 * **Any claim about pronunciation.** These are the names the print's own
 * markup uses. "damma iqlab" is a damma the corpus tagged as participating in
 * iqlab; this module records that the corpus said so and nothing more. Mapping
 * marks to tajweed rules is {@link TajweedRuleId}'s job and it is a different,
 * harder question — the tajweed shards index into Tanzil Uthmani codepoints,
 * not into this print's paths.
 */

/**
 * Every named mark the print draws, most frequent first, with the path count
 * measured over the whole mus'haf. The index of a name in this array is its id.
 *
 * The long tail is real and is kept: `small noon` occurs exactly once in the
 * Qur'an (68:1, نٓ), and a vocabulary that dropped the singletons would be a
 * vocabulary that quietly cannot describe one page.
 */
export const DIACRITICS = [
  "fatha", //                 122,948
  "kasra", //                  45,970
  "damma", //                  37,320
  "sukun", //                  37,148
  "shadda", //                 22,678
  "hamza", //                  16,385
  "wasla", //                  13,483
  "superscript alef", //        9,726
  "maddah", //                  5,376
  "rounded zero", //            3,988
  "successive fathatan", //     2,901
  "successive kasratan", //     1,935
  "successive dammatan", //     1,807
  "small waw", //               1,257
  "small yeh", //                 995
  "fathatan", //                  734
  "kasratan", //                  599
  "dammatan", //                  578
  "small meem", //                270
  "damma iqlab", //               134
  "fatha iqlab", //               106
  "kasra iqlab", //                99
  "rectangular zero", //           66
  "small seen", //                  8
  "vowel sign", //                  3
  "small noon", //                  1
] as const;

/** One of the names the print draws. */
export type DiacriticName = (typeof DIACRITICS)[number];

/**
 * The integer a shard calls this mark by, or `-1` if the print has never drawn
 * it.
 *
 * `-1` rather than `undefined` so a caller that forgets to check writes an
 * impossible index instead of `undefined` into geometry — the ETL is expected
 * to throw on it, and a number that indexes nothing is louder downstream than a
 * hole. See `readDiacritics` in the ETL, which does exactly that.
 */
export function diacriticId(name: string): number {
  return (DIACRITICS as readonly string[]).indexOf(name);
}

/** Is this a name the print draws? The ETL's guard against a corpus that grew. */
export function isDiacriticName(name: string): name is DiacriticName {
  return diacriticId(name) >= 0;
}

/** The name an id stands for, or `null` if it stands for nothing. */
export function diacriticName(id: number): DiacriticName | null {
  return DIACRITICS[id] ?? null;
}

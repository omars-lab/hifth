/**
 * A surah's introduction, cleaned for the note drawer.
 *
 * The capture of The Study Quran gives each surah's introduction as the
 * paragraphs it found on the surah's first pages. Walking the pitch showed
 * three things wrong with what it found:
 *
 *   - every introduction ended with the opening verse (the basmala, in the book's English),
 *     which the print sets under the introduction as the first line of the
 *     surah. It is not part of the introduction, and the drawer showed it as if
 *     it were its last paragraph;
 *   - where an introduction runs over a page the capture did not take, only its
 *     end was kept, so Al-Kahf's introduction opened on "Finally," and Ṭā Hā's
 *     was the end of one word;
 *   - nothing told the reader that a cut-off introduction was cut off.
 *
 * So the opening verse is left off, a paragraph that is only the broken-off
 * end of a word is dropped, and an introduction that begins partway through is
 * marked with "…" the way a printed excerpt is. The words themselves are never
 * changed. `opening` is the book's own translation of the opening verse, read
 * from the capture, so no held text is written here.
 */

// Words a paragraph only opens with when it carries on from one before it.
const CARRIES_ON = /^(Finally|Moreover|Furthermore|However|Thus|Also|In addition|Likewise|Similarly|Then)\b/;

const bare = (text) => text.trim().replace(/[.\s]+$/, "");

export function cleanIntro(paragraphs, opening) {
  const kept = paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !(opening && bare(p) === bare(opening)))
    // The end of a word with nothing before it: lower case and only a few letters.
    .filter((p) => !(/^\p{Ll}/u.test(p) && p.length < 12));
  if (kept.length && (/^\p{Ll}/u.test(kept[0]) || CARRIES_ON.test(kept[0]))) kept[0] = `… ${kept[0]}`;
  return kept;
}

/**
 * The last three touches to a surah's notes, in the one order every hand-read
 * row is written against: the book's quotes and dashes set first
 * (typography.mjs), then the misread marks mended (misreads.mjs), then the
 * slant laid on (italics.mjs), the hand-read rows and then, in the notes nobody
 * read, the transliterated terms. A misread or slanted-words row is copied off the
 * page as a reader sees it, curly quotes and all, so the rule that sets the
 * quotes runs before either looks for its words.
 */
import { slantMarkedTerms, slantSurah } from "./italics.mjs";
import { mendSurah } from "./misreads.mjs";
import { setSurahTypography } from "./typography.mjs";

/** Letter one surah's notes in place; returns which misread and italics rows matched. */
export function letterSurah(surah, verses, { misreads, italics }) {
  setSurahTypography(verses);
  const mended = mendSurah(surah, verses, misreads);
  const slanted = slantSurah(surah, verses, italics);
  // The notes read by hand, as slanted: every note of a verse with a row.
  const read = new Set(
    italics.filter((row) => Number(row.verse.split(":")[0]) === surah).flatMap((row) => verses[row.verse]?.commentary ?? []),
  );
  slantMarkedTerms(verses, read);
  return { misreads: mended, italics: slanted };
}

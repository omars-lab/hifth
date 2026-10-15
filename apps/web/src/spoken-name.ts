/**
 * A button that shows a word under its sign says that word when it is named
 * aloud (plan item 110). A reader driving the iPad by voice says what they see
 * ("tap Same roots"), and a screen reader reads the name to someone who may see
 * the word too; a name that never says it finds nothing for the first and reads
 * a different word to the second. The messages are written so the name already
 * holds the word; this catches the one that does not (Listen's "Offline") and
 * any written later, by putting the shown word first.
 */
export function spokenName(name: string, shown: string | undefined, sep: string): string {
  if (!shown) return name;
  return words(name).includes(words(shown)) ? name : `${shown}${sep}${name}`;
}

/** The words of a string, without the marks between them, for a fair compare. */
function words(s: string): string {
  return s
    .replace(/[…:·،,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Full stops and new paragraphs the capture of The Study Quran lost.
 *
 * Where a paragraph ends inside one captured block, the capture sometimes keeps
 * neither the paragraph's last full stop nor the break after it, so the drawer
 * showed two sentences running together ("…their praise This verse…"). Text
 * alone cannot tell such a spot from a verse quoted mid-sentence, which the book
 * also runs straight on from a lowercase word, so each one was read off the
 * printed page and listed in print-breaks.json.
 *
 * A listed spot is named by a short fingerprint of the words around it, never by
 * the words themselves, so the list holds no text of the book. The extractor
 * refuses a list entry that no longer matches anything, so a recapture that
 * moves the words cannot leave the list quietly out of date.
 *
 * The print also sets some Arabic case endings small and raised above a word
 * ("Allāhu" with its "u" lifted). The capture set those down as stray letters at
 * the start of the next sentence ("…God). u an Hayya…"), so they are dropped.
 */
import { createHash } from "node:crypto";

// Characters either side of the seam that make up its fingerprint.
const REACH = 16;

/** Every space that runs into a capital: where a paragraph might have ended. */
export function seams(text) {
  const out = [];
  for (const m of text.matchAll(/(?<=\S) (?=\p{Lu})/gu)) out.push({ at: m.index });
  return out;
}

/**
 * Drop raised endings the capture set down as stray letters: a run of lone
 * "u", "an" or "un" at the start of a paragraph or of a sentence, before a
 * capital. No English sentence opens with a lowercase word.
 */
export function dropRaisedEndings(text) {
  return text.replace(/(^|[.!?][)”]? )(?:(?:u|an|un) )+(?=\p{Lu})/gu, "$1");
}

/** The fingerprint of the seam at `at` (the index of its space). */
export function seamPrint(text, at) {
  return createHash("sha1").update(text.slice(Math.max(0, at - REACH), at + 1 + REACH)).digest("hex").slice(0, 12);
}

/**
 * Put back the listed stops and breaks in one verse's paragraphs. `marks` is
 * the whole list; `used` says which of its entries matched, by index.
 */
export function restoreBreaks(verse, blocks, marks) {
  const mine = new Map();
  marks.forEach((m, i) => m.verse === verse && mine.set(m.print, i));
  const used = new Set();
  const out = [];
  for (const block of blocks) {
    let from = 0;
    let text = "";
    for (const { at } of seams(block)) {
      const i = mine.get(seamPrint(block, at));
      if (i === undefined) continue;
      used.add(i);
      text += block.slice(from, at) + (marks[i].stop ?? ".");
      from = at + 1;
      if (marks[i].kind === "break") {
        out.push(text);
        text = "";
      } else text += " ";
    }
    out.push(text + block.slice(from));
  }
  return { blocks: out, used };
}

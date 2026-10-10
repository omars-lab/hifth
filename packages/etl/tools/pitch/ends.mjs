/**
 * A note whose last sentence lost its closing stop: the capture often dropped
 * the full stop at the very end of a note, where the next verse's note begins.
 * Text alone cannot tell a lost stop from a note cut short, so the ones the
 * printed page settles are listed in print-ends.json, each by a fingerprint of
 * the note's last words (never the words) with the page it was read on.
 *
 * A listed ending is found under whichever verse holds the note, not only the
 * verse it was read under: a note shared by a range of verses is mended under
 * each of them, and a note the capture later files under its own verse is
 * still found.
 */
import { createHash } from "node:crypto";

const REACH = 32;
// A closing bracket closes a note only when its sentence stopped inside it;
// the print often sets the stop after the bracket instead, and the capture
// dropped that one too.
const CLOSED = /(?:[.!?…:;"'”’»]|[.!?…][)\]])$/u;

/** Whether a note already ends the way a finished sentence does. */
export function endsClosed(text) {
  return CLOSED.test(text.trimEnd());
}

/**
 * Whether a note's ending still wants reading off the page: it ends open and
 * no row settles it. A row with an empty stop records a page that prints none.
 */
export function endUnread(text, ends) {
  return !endsClosed(text) && !ends.some((e) => e.print === endPrint(text));
}

/** A fingerprint of a note's last words. */
export function endPrint(text) {
  return createHash("sha1").update(text.trimEnd().slice(-REACH)).digest("hex").slice(0, 12);
}

/**
 * A note the capture cut short, part way through a sentence or a list of
 * references, most often at a page's foot. The rest is read off the page into
 * a private file beside the capture, never into this repository, keyed by the
 * same fingerprint of the cut note's last words, and is added exactly as read
 * (a tail that carries on a word or a reference starts with no space). `tails`
 * is that file's list; `used` says which entries matched.
 */
export function restoreCutTail(blocks, tails) {
  const used = new Set();
  const last = blocks.at(-1)?.trimEnd();
  if (!last) return { blocks, used };
  const i = tails.findIndex((t) => t.print === endPrint(last));
  if (i < 0) return { blocks, used };
  used.add(i);
  return { blocks: [...blocks.slice(0, -1), last + tails[i].tail], used };
}

/**
 * One verse's finished paragraphs with the listed stop put back on the last
 * one. `ends` is the whole list; `used` says which of its entries matched.
 */
export function restoreLastStop(blocks, ends) {
  const used = new Set();
  const last = blocks.at(-1)?.trimEnd();
  if (!last || endsClosed(last)) return { blocks, used };
  const i = ends.findIndex((e) => e.print === endPrint(last));
  if (i < 0) return { blocks, used };
  used.add(i);
  return { blocks: [...blocks.slice(0, -1), last + (ends[i].stop ?? ".")], used };
}

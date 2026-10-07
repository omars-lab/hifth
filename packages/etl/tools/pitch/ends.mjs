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
const CLOSED = /[.!?…:;)\]"'”’»]$/u;

/** A fingerprint of a note's last words. */
export function endPrint(text) {
  return createHash("sha1").update(text.trimEnd().slice(-REACH)).digest("hex").slice(0, 12);
}

/**
 * One verse's finished paragraphs with the listed stop put back on the last
 * one. `ends` is the whole list; `used` says which of its entries matched.
 */
export function restoreLastStop(blocks, ends) {
  const used = new Set();
  const last = blocks.at(-1)?.trimEnd();
  if (!last || CLOSED.test(last)) return { blocks, used };
  const i = ends.findIndex((e) => e.print === endPrint(last));
  if (i < 0) return { blocks, used };
  used.add(i);
  return { blocks: [...blocks.slice(0, -1), last + (ends[i].stop ?? ".")], used };
}

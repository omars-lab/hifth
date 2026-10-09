/**
 * A note the capture set aside: when a stray scrap (often the tail of a
 * cross-reference from across a page break) lands in front of a note's verse
 * label, the capture cannot tell which verse the block belongs to and files it
 * with the surah's set-aside blocks instead of under any verse. The verse then
 * shows no note at all, though the book prints one.
 *
 * Text alone cannot tell such a note from the many set-aside scraps that are
 * only a verse's own words printed twice, so the ones the printed page settles
 * are listed in print-orphans.json: a fingerprint of the whole block (never its
 * words), the verses its label names, and the page it was read on. The note is
 * put back from its label on, under every verse the label covers, the way a
 * shared note is filed everywhere else.
 */
import { createHash } from "node:crypto";

/** A fingerprint of a whole set-aside block. */
export function orphanPrint(text) {
  return createHash("sha1").update(text.trim()).digest("hex").slice(0, 12);
}

/** The label a note covering `from`..`to` opens with, as the print sets it. */
function labelAt(text, from, to) {
  const label = from === to ? `${from}` : `${from}[–-]${to}`;
  return new RegExp(`(?:^|\\s)(${label})[\\s\\u00a0]`, "u").exec(text);
}

/**
 * The listed set-aside notes of one surah. `orphans` is the capture's
 * set-aside blocks, `list` the whole hand-read list. Returns each verse's
 * rescued notes and which list rows matched.
 */
export function rescueOrphans(surah, orphans, list) {
  const notes = new Map();
  const used = new Set();
  list.forEach((row, i) => {
    if (row.surah !== surah) return;
    const block = orphans.find((o) => orphanPrint(o.text ?? "") === row.print);
    if (!block) return;
    const m = labelAt(block.text, row.from, row.to);
    if (!m) throw new Error(`${surah}: set-aside block ${row.print} has no label for verses ${row.from}–${row.to}`);
    const note = block.text.slice(m.index + m[0].indexOf(m[1])).trim();
    for (let a = row.from; a <= row.to; a++) notes.set(a, [...(notes.get(a) ?? []), note]);
    used.add(i);
  });
  return { notes, used };
}

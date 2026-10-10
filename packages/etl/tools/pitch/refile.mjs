/**
 * Paragraphs the capture filed under the wrong verse. Two shapes have been found
 * on the pages: a note's last paragraphs filed under a later verse its text
 * names (the note's own verse then ends early and the other opens on them), and
 * a note shared by two verses whose later paragraphs reached only one of them
 * (the other holds the opening paragraph alone).
 *
 * Text alone cannot tell either from a verse's own note, so the ones the
 * printed page settles are listed in print-refiles.json: the verse they sit
 * under (`from`), the verse they belong to (`to`), a fingerprint of each
 * paragraph in order (never its words), and the page it was read on. The
 * paragraphs go to the end of `to`'s note. `keep` leaves them under `from` as
 * well, for the shared note.
 *
 * A third shape: a verse's own note run straight on from the end of a note it
 * shares with others, label and all ("… ends here. 74 Its own note …"), so every
 * verse sharing the note showed it. A `split` row names the spot by the seam's
 * fingerprint (see breaks.mjs); the shared note is cut there under every verse
 * that holds it, the stray label dropped, and the rest goes to the end of `to`.
 */
import { seamPrint, seams } from "./breaks.mjs";
import { orphanPrint } from "./orphans.mjs";

/** Cut a verse's own note off the shared paragraph it was run into; true if the row matched. */
function splitOff(row, verses) {
  for (const paragraph of verses[row.from]?.commentary ?? []) {
    const seam = seams(paragraph).find(({ at }) => seamPrint(paragraph, at) === row.split);
    if (!seam) continue;
    const label = new RegExp(`\\s+${row.to.split(":")[1]}$`);
    const head = paragraph.slice(0, seam.at).replace(label, "");
    const tail = paragraph.slice(seam.at + 1);
    for (const entry of Object.values(verses))
      entry.commentary = entry.commentary.map((p) => (p === paragraph ? head : p));
    if (verses[row.to].commentary.includes(tail))
      throw new Error(`${row.to} already holds the note print-refiles.json cuts off for it`);
    verses[row.to].commentary = [...verses[row.to].commentary, tail];
    return true;
  }
  return false;
}

/** Refile one surah's listed paragraphs in place; returns which rows matched. */
export function refileSurah(surah, verses, list) {
  const used = new Set();
  list.forEach((row, i) => {
    if (row.surah !== surah) return;
    if (row.split) {
      if (splitOff(row, verses)) used.add(i);
      return;
    }
    const from = verses[row.from]?.commentary;
    const to = verses[row.to]?.commentary;
    if (!from || !to) return;
    const prints = from.map(orphanPrint);
    const at = prints.findIndex((_, k) => row.prints.every((p, j) => prints[k + j] === p));
    if (at < 0) return;
    const moved = from.slice(at, at + row.prints.length);
    for (const paragraph of moved)
      if (to.includes(paragraph))
        throw new Error(`${row.to} already holds a paragraph print-refiles.json gives it from ${row.from}`);
    verses[row.to].commentary = [...to, ...moved];
    if (!row.keep) verses[row.from].commentary = from.filter((_, k) => k < at || k >= at + moved.length);
    used.add(i);
  });
  return used;
}

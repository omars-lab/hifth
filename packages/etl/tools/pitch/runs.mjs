/**
 * A range the note cites as one ("vv. 4–7") arrives in the capture as every
 * verse in it, one after another. Taken one verse each, a single range filled
 * the related list's few places and pushed out every other reference the note
 * makes: 18:60 cites eight separate places and showed two of them. So a run of
 * verses that follow each other in the same surah, in the order the capture
 * lists them, becomes one road to its first verse that says where it ends.
 *
 * The capture's list also keeps only the first of several verses a note cites
 * from one surah by bare number ("9:4, 7, 12" gives 9:4 alone), though the
 * note's own text links all of them. Those are read back from the note with
 * the reader's own citation rule and added after the book's list, so they fill
 * places it left empty and never push one of its references out.
 */

import { splitCitations } from "@hifth/core";

/**
 * Fold runs of consecutive verses into ranges. Each item is
 * `{ to: [surah, ayah], commentary }`; a folded run keeps its first verse in
 * `to`, its last in `through`, and has commentary if any verse in it has.
 */
export function foldRuns(refs) {
  const out = [];
  for (const { to, commentary } of refs) {
    const last = out.at(-1);
    const end = last?.through ?? last?.to;
    if (last && end[0] === to[0] && end[1] + 1 === to[1]) {
      last.through = to;
      last.commentary ||= commentary;
    } else out.push({ to, commentary });
  }
  return out.map((r) => (r.through ? { to: r.to, through: r.through, commentary: r.commentary } : r));
}

/** The marks that open and close an italic run (italics.mjs); a citation reads through them. */
const SLANTS = /[\uE000\uE001]/gu;

/**
 * Every verse a note's paragraphs cite, as `[surah, ayah]`, once each, in the
 * order they first appear. `surah` is the one the note is in, which "v. 5" means.
 */
export function citedIn(notes, surah) {
  const seen = new Set();
  const out = [];
  for (const note of notes)
    for (const part of splitCitations(note.replace(SLANTS, ""), surah)) {
      if (typeof part === "string") continue;
      const key = `${part.surah}:${part.ayah}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([part.surah, part.ayah]);
    }
  return out;
}

/**
 * Add the cited verses the roads leave out, after them. A verse a road already
 * covers is dropped; one straight after a road's end in the same surah runs
 * that road on, as a cited run would have been folded.
 */
export function addCited(roads, cited) {
  const out = roads.map((r) => ({ ...r }));
  const endOf = (r) => r.through ?? r.to;
  for (const to of cited) {
    const [s, a] = to;
    if (out.some((r) => r.to[0] === s && r.to[1] <= a && a <= endOf(r)[1])) continue;
    const before = out.find((r) => endOf(r)[0] === s && endOf(r)[1] + 1 === a);
    if (before) before.through = to;
    else out.push({ to, commentary: false });
  }
  return out.map((r) => (r.through ? { to: r.to, through: r.through, commentary: r.commentary } : r));
}

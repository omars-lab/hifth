/**
 * What one mark ended up saying, out of everything that was said about it.
 *
 * A sitting writes down events, not verdicts. A reader picks a mark up, pushes it
 * left, pushes it too far, brings it back, decides the rectangle is the wrong shape
 * as well, stretches it, and moves on. That is six lines in the transcript about one
 * mark, and every one of them is true. None of them is the answer.
 *
 * The answer is where the rectangle was when they let go of it. Reading it any other
 * way has already cost this project a number: the first scorer averaged the presses,
 * and presses cancel — a mark pushed a unit left and half a unit back reads as half a
 * unit of movement whichever way you average it, but a mark pushed a unit left and a
 * unit right reads as *no movement at all*, which is the one thing that certainly did
 * not happen. It printed nothing moved for twenty-six marks that had all been dragged
 * the better part of two units.
 *
 * So: the route is not the statement. The resting place is.
 *
 * ## What settling does, and does not do
 *
 * **Position and size settle to the last one, because both are running totals.**
 * A move carries how far it went just now and where the rectangle now stands; a
 * reshape carries the size it now is. Take the last of each and the pushing back and
 * forth resolves itself, however many goes it took.
 *
 * **Words gather and repeat once.** A mark can be called more than one thing —
 * "moved" and "the print is odd here" is a common and coherent pair, because a reader
 * who thinks the print is wrong still puts the rectangle where they think it belongs.
 * But being called moved eleven times is one statement, not eleven, and counting it
 * eleven times lets one stubborn mark outvote a whole page of easy ones.
 *
 * **Taking an answer back has already happened.** The sitting page removes a retracted
 * answer from the transcript rather than writing a note beside it, so what arrives here
 * is only what the reader still stood behind when they handed it over. Nothing to undo,
 * and this paragraph exists so nobody adds code to undo it twice.
 *
 * **Later sittings win.** The same mark can be looked at twice — a rebuild that did not
 * exclude it, or a reader going back over their own work. Feeding the files in the order
 * they were handed over means the later look settles the row, which is the only ordering
 * that makes a second opinion worth asking for.
 *
 * **How many goes it took is kept.** It is not part of the verdict about the mark. It is
 * a verdict about the controls: a rectangle that takes nine presses to settle is one the
 * pad is not letting anybody place, and that finding is invisible once the route is
 * thrown away.
 */

import { correctionFor } from "./registration-grain.mjs";

/**
 * Where the sitting drew each rectangle, re-run rather than remembered.
 *
 * A transcript records what the reader said, never what they were looking at, so
 * anything that reads one has to rebuild the picture from the displacements and the
 * two numbers the sitting was built with. Both readers do it — the scorer to measure
 * the reader's own hand, the settler to write down where the rectangle came to rest —
 * and if they rebuilt it differently the same sitting would settle two ways.
 *
 * `placed` is per axis because the search window is a square: a mark whose best match
 * sits against the edge of it may have a better one just outside that was never looked
 * for, so a convincing score there is not evidence. That has been got wrong here once
 * already, by testing the distance rather than each axis.
 */
export function asDrawn(allRows, { radius = 3, iouFloor = 0.55 } = {}) {
  const EPS = 1e-6;
  const atEdge = (r) => Math.abs(Math.abs(r.dx) - radius) < EPS || Math.abs(Math.abs(r.dy) - radius) < EPS;
  const placed = (r) => r.iouBest >= iouFloor && !atEdge(r);
  const byId = new Map();
  for (const r of allRows) byId.set(`${r.page}:${r.k}`, r);
  const { apply } = correctionFor("line-tilt", allRows);
  const drawnAt = (r) => {
    const c = placed(r) ? { dx: r.dx, dy: r.dy } : apply(r);
    return [r.box[0] + c.dx, r.box[1] + c.dy, r.box[2], r.box[3]];
  };
  return { byId, placed, drawnAt, ruleOf: (r) => (placed(r) ? "ink" : "line-tilt") };
}

/**
 * The six words a sitting can say about a mark, in the order a person would want to
 * read them: what is wrong with our rectangle, then what is wrong with the print, then
 * what could not be settled at all.
 */
export const VOCABULARY = [
  "looks-right",
  "placement",
  "wrong-shape",
  "intended-ink",
  "print-defect",
  "exception",
];

/** The words that say our placement is wrong. Everything else is not that. */
export const FAULTS = ["placement", "wrong-shape", "intended-ink"];

/**
 * Collapse a transcript to one row per mark.
 *
 * `said` is a list of events in the order they were given. Pass several sittings by
 * concatenating them oldest first — settling is last-writer-wins on position, size and
 * order of appearance, so the order of the input is the order of authority.
 *
 * Returns a Map keyed by mark id. Each row carries what the mark is (`page`, `line`,
 * `name`, `rule`), what was said about it (`words`, `notes`), where it came to rest
 * (`to`, measured from the uncorrected box) and at what size (`size`, with `was` for
 * the size it started at), and how much work that took (`goes`).
 */
export function settle(said) {
  const rows = new Map();
  for (const e of said) {
    if (!e || typeof e.id !== "string") continue;
    let row = rows.get(e.id);
    if (!row) {
      row = {
        id: e.id,
        page: e.page,
        line: e.line,
        name: e.name,
        rule: e.rule,
        words: [],
        to: null,
        size: null,
        was: null,
        notes: [],
        goes: 0,
        reshapes: 0,
      };
      rows.set(e.id, row);
    }
    // A later sitting may know something the earlier one did not — the rule a mark was
    // drawn by is re-derived from the displacements on every read, so the last one is
    // the one that agrees with the displacements this run was given.
    if (e.rule != null) row.rule = e.rule;
    if (e.kind && !row.words.includes(e.kind)) row.words.push(e.kind);
    if (Array.isArray(e.to)) row.to = e.to;
    if (Array.isArray(e.size)) row.size = e.size;
    // The size it started at is a fact about the rectangle we shipped, so it comes from
    // the first reshape and is not overwritten by later ones, which carry it forward
    // unchanged anyway.
    if (Array.isArray(e.was) && row.was == null) row.was = e.was;
    // Moving and reshaping are counted apart because they are complaints about
    // different controls: one about the pad and the drag, the other about the handles.
    if (e.kind === "placement") row.goes += 1;
    if (e.kind === "wrong-shape") row.reshapes += 1;
    // A note is the one thing a reader writes in their own words, so nothing is thrown
    // away and nothing is merged: two notes about one mark are two things they said.
    if (typeof e.note === "string" && e.note.trim() && !row.notes.includes(e.note)) {
      row.notes.push(e.note);
    }
  }
  for (const row of rows.values()) {
    row.words.sort((a, b) => VOCABULARY.indexOf(a) - VOCABULARY.indexOf(b));
  }
  return rows;
}

/**
 * Did this row say our rectangle is wrong?
 *
 * Deliberately not "does it carry a fault word": a mark called fine and then moved
 * carries both, and the conservative reading of that pair is the fault — somebody who
 * says a thing is fine and then changes it has told you it needed changing. The
 * affirmation is kept in `words` so the contradiction stays visible rather than being
 * resolved out of sight.
 */
export const isFault = (row) => row.words.some((w) => FAULTS.includes(w));

/**
 * Marks sort by page, then by their index within the page — the order the print puts
 * them in, which is the order anybody checking this by hand will want to walk them.
 */
export const byMark = (a, b) => {
  const [pa, ka] = a.id.split(":").map(Number);
  const [pb, kb] = b.id.split(":").map(Number);
  return pa - pb || ka - kb;
};

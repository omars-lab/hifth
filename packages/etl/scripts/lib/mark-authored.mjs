/**
 * A person's hand-placed marks, read back into a table a builder can ship.
 *
 * The sitting pages let a reader drag a mark's rectangle onto its own ink and
 * bank where they left it; `settle-mark-report.mjs` collapses a sitting into a
 * per-mark ruling and commits it under `docs/validation/rulings/`. That is the
 * far end of *capturing* a placement — but nothing has ever read those rulings
 * back into the rectangles the app draws. This module is that missing half: it
 * distils every committed ruling into one map from a mark's own identity to the
 * rectangle a person put it at, so a build step can overlay human truth exactly
 * where it exists and leave the automatic placement everywhere else.
 *
 * ## Why identity, not position
 *
 * A ruling names its mark by `page:k` — the mark's index in document order on
 * its page. That index is not a fact about the mark; it is a fact about the
 * walk that found it, and a fresh extract of the print can renumber a page and
 * silently re-point every id on it. A placement a person spent an afternoon on
 * must outlive that. So the key here is `authoredIdOf` — the word the mark sits
 * on, the mark's name, and its rank among the marks it could be confused with —
 * all of which are re-derived from the print itself and survive a renumbering.
 *
 * The bridge from a stored `page:k` ruling to that identity is a match on what
 * the ruling *also* records: the raw rectangle the mark shipped at and its name.
 * A live mark with the same name whose shipped rectangle sits where the ruling
 * says is the same mark, whatever its index has become. `matchLiveMark` is that
 * match, and it falls back to the bare index only when the name still agrees, so
 * a corpus that has not moved still resolves and one that has is caught rather
 * than trusted.
 *
 * Every function is a pure reader of its arguments — `marksForPage` is injected,
 * never imported — so the unit test drives it on synthetic marks and the whole
 * thing runs with no 380 MB corpus cache on disk.
 */

/**
 * A mark's own identity, re-derivable from the print and stable across extracts:
 * the word it sits on (`surah:aya:idx`), the mark's name, and its rank among the
 * same-named marks in its group (`nth` of `of`, the count `marksOf` assigns
 * right-to-left). Two marks a reader could tell apart never share one.
 */
export const authoredIdOf = (m) => `${m.surah}:${m.aya}:${m.idx}/${m.name}#${m.nth}of${m.of}`;

const near = (a, b, eps) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);

/**
 * The live mark a settled ruling row is about, found by what the ruling records
 * beside its `page:k` id: the mark's name and the raw rectangle it shipped at.
 *
 * A single live mark of that name whose shipped rectangle sits at the ruling's
 * `box` is the answer, whatever its current index. When the raw match is not
 * unique, fall back to the stored index — but only if the mark now sitting there
 * still carries the same name and a rectangle near the one recorded, so an index
 * that has drifted onto a different mark is refused rather than believed.
 * Returns `null` when neither path resolves.
 */
export function matchLiveMark(marks, row, eps = 0.05) {
  const byBox = marks.filter((m) => m.name === row.name && near(m.box, row.box, eps));
  if (byBox.length === 1) return byBox[0];
  const k = Number(String(row.id).split(":")[1]);
  const at = Number.isInteger(k) ? marks[k] : undefined;
  if (at && at.name === row.name && near(at.box, row.box, eps * 4)) return at;
  return null;
}

/**
 * Distil committed rulings into one map from a mark's identity to the rectangle
 * a person placed it at. `rulings` is one entry per committed file —
 * `{ from, settledAt, settledMarks }`, the shape `settle-mark-report.mjs` writes
 * — and `marksForPage(page)` returns that page's live marks (from `marksOf`).
 *
 * Only rows a reader actually faulted and placed (`fault` with a `settled`
 * rectangle) are taken; an untouched row carries no human answer. When two
 * rulings place the same mark, the later `settledAt` wins, so re-sitting a mark
 * corrects it rather than doubling it. Rows whose mark cannot be resolved are
 * returned in `unresolved` rather than dropped silently — a build step should
 * refuse to ship while any remain, because an unresolved placement is one a
 * person made and the app is about to ignore.
 */
export function authoredPlacements(rulings, marksForPage) {
  const placements = new Map();
  const unresolved = [];
  for (const r of rulings) {
    const at = r.settledAt || "";
    for (const row of r.settledMarks || []) {
      if (!(row.fault && Array.isArray(row.settled))) continue;
      const m = matchLiveMark(marksForPage(row.page), row);
      if (!m) {
        unresolved.push({ from: r.from, id: row.id, name: row.name, page: row.page });
        continue;
      }
      const cid = authoredIdOf(m);
      const prev = placements.get(cid);
      if (!prev || at >= prev.at) {
        placements.set(cid, { id: cid, rect: row.settled, from: r.from, at, page: row.page, name: row.name });
      }
    }
  }
  return { placements, unresolved };
}

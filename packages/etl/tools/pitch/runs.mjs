/**
 * A range the note cites as one ("vv. 4–7") arrives in the capture as every
 * verse in it, one after another. Taken one verse each, a single range filled
 * the related list's few places and pushed out every other reference the note
 * makes: 18:60 cites eight separate places and showed two of them. So a run of
 * verses that follow each other in the same surah, in the order the capture
 * lists them, becomes one road to its first verse that says where it ends.
 */

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

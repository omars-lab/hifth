/**
 * Where the machine, on its own, would put a mark — the automatic half of
 * option H, with the human left out.
 *
 * ## Why this is its own function and not two copies
 *
 * Two places need the exact same answer to "where does the automatic pipeline
 * draw this mark". `build-mark-placements.mjs` needs it to lay down what ships:
 * the automatic rectangle, then a person's rectangle over the top where a person
 * placed one. The least-sure placement sitting needs it as the *rival* in a
 * blind trial: the shipped rectangle against the one the machine alone would
 * have drawn, so a reader who prefers the shipped one is evidence the extra
 * placement work was right rather than busy.
 *
 * If those two computed the automatic rectangle from separate copies of the same
 * fifteen lines, the sitting would eventually be judging a rival the ship asset
 * no longer draws — and nothing would fail, because both would still produce a
 * rectangle. It is the same rot `marks.mjs` was split out to prevent, one layer
 * down: a pair of walks over the same rule that drift because the rule lives in
 * two hands. So the rule lives here, and both import it. `gate:mark-placements`
 * re-derives every shipped rectangle offline, which is the check that this
 * function still produces what is committed.
 *
 * ## The rule, in three tiers
 *
 * A mark is placed on its **own ink** when its best match cleared the IoU floor
 * and the search did not run out of the room it was given (its own recorded
 * reach, not a fixed radius — a mark searched wide that landed early was nowhere
 * near its wall). Then the rectangle is the shipped box moved by the measured
 * displacement.
 *
 * A mark the search **refused reaches for the ink**: the pieces of print under
 * its own window are unioned into one candidate, taken when the guard trusts its
 * area (grown no more than 1.75×, shrunk no more than to 0.571× of the shipped
 * box). This is the one move that fixes a refused doubled mark's size and a
 * refused single's position at once.
 *
 * A mark with **no piece to point to**, or a union the guard throws out, falls
 * back to the **printed line's own tilt** — the `line-tilt` correction fitted on
 * that page. The floor that makes H shippable rather than reckless: a mark
 * chasing weak ink it cannot find is set down on the line, not on the noise.
 */
import { refusedItsOwnInk } from "./mark-ink.mjs";
import { GUARD, pieceUnionCandidate, reachOrFall } from "./piece-union.mjs";

/**
 * The rule, in two numbers. A mark is placed on its own ink when its best match
 * clears `iou` and the search did not run out of `radius` (or the wider reach
 * the mark itself records). Both are the settled values every sitting used.
 */
export const RULE = { iou: 0.55, radius: 3 };

/** The raster grain the ink search ran at, and so the grain a reach candidate is cut at. */
export const RES = 16;

/** One decimal, the precision every shipped rectangle carries. */
export const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The automatic rectangle for one mark, and which tier drew it.
 *
 * @param mark  the corpus mark, for its shipped box `[x, y, w, h]`.
 * @param row   the mark's measured displacement row: `dx`, `dy`, `ink`,
 *              `iouBest`, `searchedAt`, `box` — everything the ink search
 *              recorded. `refusedItsOwnInk` reads it; `reachOrFall` decides.
 * @param ink   the page's ink shapes (from `readPageInk`), needed only when the
 *              mark refused its own ink and reaches for a union.
 * @param corr  the page's fitted `line-tilt` correction (from `correctionFor`),
 *              applied only when a refused mark has no union to trust.
 * @returns `{ rect: [x, y, w, h], src: "ink" | "reach" | "tilt" }` — rounded to
 *          one decimal, exactly as the shipped shard carries it.
 */
export function automaticPlacement({ mark, row, ink, corr }) {
  const refused = refusedItsOwnInk(row, RULE.radius, RULE.iou);
  const { candidate, ratio } = refused
    ? pieceUnionCandidate(row, ink, { radius: RULE.radius, res: RES })
    : { candidate: null, ratio: null };
  const src = reachOrFall(refused, candidate, ratio, GUARD);
  if (src === "ink") {
    return { rect: [r1(mark.box[0] + row.dx), r1(mark.box[1] + row.dy), r1(mark.box[2]), r1(mark.box[3])], src };
  }
  if (src === "reach") {
    return { rect: candidate.map(r1), src };
  }
  const d = corr.apply(row);
  return { rect: [r1(mark.box[0] + d.dx), r1(mark.box[1] + d.dy), r1(mark.box[2]), r1(mark.box[3])], src };
}

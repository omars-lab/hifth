/**
 * The reach-for-the-ink candidate, and the guard that decides whether to trust
 * it — the one rule two scripts must agree on to the pixel.
 *
 * `probe-piece-union.mjs` measures this candidate over a population so a person
 * can see what it would draw; `build-mark-placements.mjs` draws it, for every
 * mark the ink search refused that carries one. If those two ever computed the
 * candidate a hair differently, the shipped rectangle would stop being the one
 * the measurement vouched for — so the candidate, its window, and the guard
 * live here once and both import them.
 *
 * The rule, in one sentence (㉘ in `docs/design/mark-registration.md`): of the
 * pieces of ink in a mark's own search window, take every piece whose middle
 * falls inside the rectangle we already ship, and union their bounding boxes
 * into a candidate. A mark with no such piece has nothing to point to and keeps
 * its shipped rectangle rather than guess.
 *
 * The guard (㉞, decided): a union can sweep in a neighbour's ink and grow
 * implausibly large, or — more often — come out short and shrink. Refuse the
 * candidate, and keep the shipped rectangle, whenever its area sits far from the
 * shipped area in *either* direction: grown past 1.75×, or fallen under 0.571×
 * (that is 1/1.75). Checked both ways against 181 marks a reader settled, this
 * catches 34 of 39 disagreements for 2 false refusals in 106 — the point past
 * which loosening costs more than it buys.
 */
import { inkPieces } from "./ink.mjs";

/** Grown past this many times the shipped area, or shrunk under its reciprocal, and the candidate is refused. */
export const GUARD = { grow: 1.75, shrink: 1 / 1.75 };

/** True when a candidate's area ratio is close enough to the shipped box to trust. */
export const guardPasses = (ratio, guard = GUARD) => ratio > guard.shrink && ratio < guard.grow;

/**
 * Which of the three automatic tiers a mark is drawn on, named once so the build
 * and its test agree on the rule rather than each spelling it out.
 *
 * A mark whose ink search placed it confidently sits on its own found ink. A mark
 * the search refused reaches for the ink instead — the union of the pieces under
 * its window — but only when that union has one to point to (`candidate`) and its
 * area stays close enough to the shipped rectangle for the guard to believe it.
 * A refused mark with no piece, or one whose union the guard throws out, falls
 * back to the printed line's own tilt. A hand placement, resolved by the caller,
 * wins over all three and is not this function's to know about.
 */
export function reachOrFall(refused, candidate, ratio, guard = GUARD) {
  if (!refused) return "ink";
  if (candidate && guardPasses(ratio, guard)) return "reach";
  return "tilt";
}

/**
 * One mark's search window: the shipped rectangle padded by however far this
 * mark was actually allowed to look (`effRadius`, wider for marks the ordinary
 * radius gave up on). The pieces have to be exactly the ones the mark's own
 * search had in view, or the candidate answers a question nobody asked.
 */
export function windowOf(box, effRadius) {
  const pad = effRadius + 1;
  const padX = pad + box[2];
  return { vx: box[0] - padX, vy: box[1] - pad, vw: box[2] + 2 * padX, vh: box[3] + 2 * pad };
}

/**
 * Every piece of ink in a window, as a bounding box, keyed by nothing but its
 * own connectivity. Mirrors the box half of `build-mark-report.mjs`'s `crop()`
 * exactly — same ring loop, same thin-ring exclusion — so the two agree pixel
 * for pixel about what a piece is.
 */
export function pieceBoxesIn(shapes, vx, vy, vw, vh, res) {
  const cut = inkPieces(shapes, vx, vy, vw, vh, res);
  const seen = new Map();
  const boxes = [];
  for (const sh of shapes) {
    for (const ring of sh.rings) {
      let lo = Infinity;
      let hi = -Infinity;
      let loy = Infinity;
      let hiy = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < lo) lo = ring[i];
        if (ring[i] > hi) hi = ring[i];
        if (ring[i + 1] < loy) loy = ring[i + 1];
        if (ring[i + 1] > hiy) hiy = ring[i + 1];
      }
      if (hi < vx || lo > vx + vw || hiy < vy || loy > vy + vh) continue;
      // A ring too thin to have rasterised anything belongs to no piece.
      const l = cut.of(ring);
      if (!l) continue;
      let p = seen.get(l);
      if (p === undefined) {
        p = boxes.length;
        seen.set(l, p);
        boxes.push([lo, loy, hi, hiy]);
      } else {
        const b = boxes[p];
        if (lo < b[0]) b[0] = lo;
        if (loy < b[1]) b[1] = loy;
        if (hi > b[2]) b[2] = hi;
        if (hiy > b[3]) b[3] = hiy;
      }
    }
  }
  return boxes;
}

const n3 = (v) => Math.round(v * 1000) / 1000;

/**
 * The candidate for one mark, or null when there is no piece to point to.
 *
 * `row` is one per-mark ink-search row (`box`, and its own `searchedAt`); `shapes`
 * are the page's outlines from `readPageInk`. Returns the union rectangle, its
 * area ratio against the shipped box, and how much it grows each way — the same
 * three `probe-piece-union.mjs` reports, so a reader's measurement and the build's
 * draw are the same numbers.
 */
export function pieceUnionCandidate(row, shapes, { radius = 3, res = 16 } = {}) {
  const [bx, by, bw, bh] = row.box;
  const effRadius = row.searchedAt ?? radius;
  const { vx, vy, vw, vh } = windowOf(row.box, effRadius);
  const boxes = pieceBoxesIn(shapes, vx, vy, vw, vh, res);

  // "Whose middle falls inside the rectangle we already ship" — tested against
  // the shipped box, never an ink-corrected one, so the candidate is found
  // independent of what the displacement search already guessed.
  let lo = Infinity;
  let loy = Infinity;
  let hi = -Infinity;
  let hiy = -Infinity;
  let unioned = 0;
  for (const b of boxes) {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    if (cx < bx || cx > bx + bw || cy < by || cy > by + bh) continue;
    unioned += 1;
    if (b[0] < lo) lo = b[0];
    if (b[1] < loy) loy = b[1];
    if (b[2] > hi) hi = b[2];
    if (b[3] > hiy) hiy = b[3];
  }
  if (!unioned) return { candidate: null, ratio: null, grow: null, piecesInWindow: boxes.length, piecesUnioned: 0 };

  const candidate = [n3(lo), n3(loy), n3(hi - lo), n3(hiy - loy)];
  const ratio = n3((candidate[2] * candidate[3]) / (bw * bh));
  const grow = [n3(candidate[2] - bw), n3(candidate[3] - bh)];
  return { candidate, ratio, grow, piecesInWindow: boxes.length, piecesUnioned: unioned };
}

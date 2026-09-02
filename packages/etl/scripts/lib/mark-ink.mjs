/**
 * Two questions about one rectangle, and the arithmetic that separates them.
 *
 * A mark's box says two things at once: *here* and *a kasra*. They fail
 * independently and they cost differently, so they are scored separately here
 * and never combined into one number.
 *
 * - **Registration** — is the box where the mark is? Scored by sliding the
 *   mark's own outline over the shipped print and recording where it fits best.
 *   The answer is a displacement in page units, and a displacement has a mean,
 *   which is why this can tell a *bias* (correctable) from *noise* (not).
 * - **Identity** — is the ink under the box the mark we named? Scored by putting
 *   all twenty-six marks the print knows how to draw on the same spot and asking
 *   which one the ink looks most like. The answer is a class, so it has a
 *   confusion matrix.
 *
 * ## The two numbers, and what they physically mean
 *
 * Both are computed on binary masks sampled at a fixed number of points per page
 * unit, over the rectangle the outline being tested occupies.
 *
 * **Overlap** is the Jaccard index — shared area over combined area — which is
 * the same quantity object detection has scored boxes with since PASCAL VOC, and
 * which document-layout benchmarks still use. It is reported because it is
 * legible: 0.60 means three fifths of the ink and the outline coincide. It is
 * *not* used to choose a placement, because it rewards a placement that simply
 * finds more ink.
 *
 * **Agreement** is the correlation coefficient between the two masks — the
 * ordinary product-moment correlation of two 0/1 variables, which is what
 * normalised cross-correlation reduces to when both images are binary. It is
 * what chooses the placement, because it is scored against what would be
 * expected by chance *at that ink density*: a template dragged onto a solid
 * black letter scores near zero, not near one. That property is the whole reason
 * the offset search cannot be fooled by sliding downhill into the nearest heavy
 * stroke, and it is why the two metrics are both here rather than one.
 *
 * Agreement of 1 is an exact match; 0 is exactly chance; negative means the
 * outline lands where the ink is not. On a mark of median size — 6.3 by 3.4 page
 * units, so about a hundred by fifty samples — one sample is a fortieth of the
 * mark's height, and the smallest displacement this can resolve is that.
 *
 * ## Why a placement search at all, when the claim is about one rectangle
 *
 * Because "the box is 0.3 units low" and "the box is on the wrong letter" are
 * the same verdict if all you measure is the score at the claimed spot. The
 * search turns one number into three — how well it fits where it claims, how
 * well it could fit, and how far it had to move — and only the third can tell a
 * print that is slightly out of register from one that is mislabelled.
 */
import { boxSum, rasterise, shapeOf, flatten } from "./ink.mjs";

/**
 * A reproducible stream of numbers in `[0, 1)`.
 *
 * Sampling has to be reproducible or a reported rate is not a measurement of
 * anything — someone re-running it gets a different sample and a different
 * number and has no way to tell which of the two moved. `Math.random` cannot be
 * seeded, so this is the standard 32-bit mixer, chosen because it is eight lines
 * and has no state anybody has to trust.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The Wilson score interval for a proportion.
 *
 * Every rate in this probe is `k` of `n` drawn from 326,515, so every rate needs
 * an interval or it is a number with no scale on it. Wilson rather than the
 * textbook normal approximation for one specific reason: the interesting rates
 * here are small — a percent or two — and the normal approximation puts the
 * lower bound of a small proportion below zero, which is not a statement about
 * anything. Wilson stays inside `[0, 1]` and behaves at `k = 0`, which is the
 * case a passing run is most likely to be in.
 *
 * `z` defaults to 1.96, the two-sided 95% normal quantile.
 */
export function wilson(k, n, z = 1.959964) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

/**
 * How many marks would have to be looked at to resolve a rate of `p` to within
 * `±e`, if the sample were drawn from an infinite population — then corrected
 * for the fact that it is drawn from `N`.
 *
 * Reported rather than assumed, because "we sampled five hundred" and "five
 * hundred is enough to see a one percent effect" are different claims and only
 * the second is worth anything.
 */
export function sampleSizeFor(p, e, N, z = 1.959964) {
  const n0 = (z * z * p * (1 - p)) / (e * e);
  return Math.ceil(n0 / (1 + (n0 - 1) / N));
}

// ------------------------------------------------------------------ masks --

/**
 * One outline, ready to be slid about: its samples as a sparse list, its own
 * rectangle, and its area.
 *
 * Sparse rather than a dense mask because the search below evaluates several
 * hundred placements and each one only ever asks about the samples the outline
 * actually covers — which for a thin curved stroke in its own bounding box is
 * around a third of them.
 */
export function stamp(rings, ox, oy, cols, rows, res) {
  const mask = rasterise([shapeOf(rings, "nonzero")], ox, oy, cols, rows, res);
  const is = [];
  const js = [];
  let i0 = cols;
  let j0 = rows;
  let i1 = 0;
  let j1 = 0;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!mask[j * cols + i]) continue;
      is.push(i);
      js.push(j);
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
  }
  // Column and row are kept apart rather than as one flat index. A flat index
  // plus a horizontal displacement walks off the end of its row and reappears at
  // the start of the next one, which is not a translation of anything.
  return {
    is: Int32Array.from(is),
    js: Int32Array.from(js),
    box: [i0, j0, i1 + 1, j1 + 1],
    area: is.length,
    cols,
    rows,
  };
}

/**
 * Agreement and overlap of one outline against the observed ink, at one
 * displacement measured in samples.
 *
 * `di, dj` shift the outline, not the ink. Both metrics are computed over the
 * outline's own rectangle at that displacement, so the denominator moves with
 * the numerator and a placement is never rewarded for having been dragged
 * somewhere with more paper in view.
 *
 * **Everything is counted over the same rectangle, and that is not a detail.**
 * A displacement can push part of the outline off the edge of what was
 * rasterised. If the shared samples were counted over the whole raster while the
 * ink was counted over the visible rectangle only, the two counts would be about
 * different regions, and a correlation coefficient computed from counts over two
 * different regions is not bounded by one — an early version of this returned
 * 5.509 for a deliberately-wrong placement, which is how the mistake was found.
 * So the rectangle is clipped to the raster first, and the outline's own area is
 * then recounted inside it.
 */
export function scoreAt(st, obs, sat, cols, rows, di, dj) {
  const [bi0, bj0, bi1, bj1] = st.box;
  const i0 = Math.max(0, Math.min(cols, bi0 + di));
  const j0 = Math.max(0, Math.min(rows, bj0 + dj));
  const i1 = Math.max(0, Math.min(cols, bi1 + di));
  const j1 = Math.max(0, Math.min(rows, bj1 + dj));
  const n = (i1 - i0) * (j1 - j0);
  if (n <= 0) return { inter: 0, ink: 0, n: 0, t: 0, seen: 0, iou: 0, phi: 0 };
  let t = 0;
  let inter = 0;
  for (let q = 0; q < st.is.length; q += 1) {
    const i = st.is[q] + di;
    const j = st.js[q] + dj;
    if (i < i0 || i >= i1 || j < j0 || j >= j1) continue;
    t += 1;
    if (obs[j * cols + i]) inter += 1;
  }
  const ink = boxSum(sat, cols, rows, i0, j0, i1, j1);
  const iou = t + ink - inter > 0 ? inter / (t + ink - inter) : 0;
  const varT = t * (n - t);
  const varI = ink * (n - ink);
  const phi = varT > 0 && varI > 0 ? (n * inter - t * ink) / Math.sqrt(varT * varI) : 0;
  // A correlation lies in [-1, 1] by construction, so a value outside it is not
  // a bad score, it is a broken count — and a broken count that is merely
  // reported looks like a very good match and gets believed. Loud, not clamped.
  if (!(phi >= -1.0000001 && phi <= 1.0000001)) {
    throw new Error(`agreement ${phi} is outside [-1, 1]: n=${n} outline=${t} ink=${ink} shared=${inter}`);
  }
  return { inter, ink, n, t, seen: st.area ? t / st.area : 0, iou, phi };
}

/**
 * The best placement within `radius` page units of the claimed one.
 *
 * Two passes: a coarse sweep on a quarter-unit lattice, then a one-sample sweep
 * around whatever the coarse pass liked. Two passes rather than one because a
 * single one-sample sweep over a three-unit radius is ten thousand placements
 * per mark and the surface is smooth enough not to need them; and because a
 * coarse-only answer would quantise the displacement to a quarter unit, which is
 * larger than the bias this exists to measure.
 *
 * Ties go to the smaller displacement, and that rule is load-bearing: a blank
 * region scores zero everywhere, and without it the reported offset for an empty
 * box would be whichever corner of the search the loop happened to reach last.
 *
 * Neither pass may step outside the radius it was given, and the second one used
 * to. It refines around the coarse winner, so a winner sitting on the boundary let
 * the refinement reach a quarter unit past it — and an answer past the boundary is
 * one this function never checked, because it never scored the placements further
 * out that would have said whether it was really the best. Worse, it is invisible
 * afterwards: the way a caller tells that a mark ran out of room is that its offset
 * came back sitting exactly on the boundary, and 2,252 marks in the corpus came back
 * just past it instead. 1,923 of those were being accepted as placed from their own
 * ink, at a median match of 0.859 against the 0.909 a good match scores. Clamping
 * puts them back on the boundary where they can be seen and looked at again.
 */
export function bestPlacement(st, obs, sat, cols, rows, res, radius) {
  let best = { di: 0, dj: 0, phi: -2, iou: 0 };
  const consider = (di, dj) => {
    const s = scoreAt(st, obs, sat, cols, rows, di, dj);
    const far = di * di + dj * dj;
    const bf = best.di * best.di + best.dj * best.dj;
    if (s.phi > best.phi + 1e-12 || (Math.abs(s.phi - best.phi) <= 1e-12 && far < bf)) {
      best = { di, dj, phi: s.phi, iou: s.iou, inter: s.inter, ink: s.ink, n: s.n };
    }
  };
  const coarse = Math.max(1, Math.round(res / 4));
  const span = Math.round(radius * res);
  for (let dj = -span; dj <= span; dj += coarse) for (let di = -span; di <= span; di += coarse) consider(di, dj);
  const lo = (c) => Math.max(-span, c - coarse);
  const hi = (c) => Math.min(span, c + coarse);
  const i0 = lo(best.di);
  const i1 = hi(best.di);
  const j0 = lo(best.dj);
  const j1 = hi(best.dj);
  for (let dj = j0; dj <= j1; dj += 1) for (let di = i0; di <= i1; di += 1) consider(di, dj);
  return best;
}

// ------------------------------------------------------- the second look --

/**
 * Did the search run out of room on this mark?
 *
 * An offset sitting exactly on the boundary is not a measurement. It is the search
 * saying "this is as far as I was allowed to go, and it was still getting better" —
 * which is why the direction is worth something and the distance is not. Per axis,
 * because the region searched is a square: asking whether the straight-line distance
 * reached the boundary inscribes a circle in that square and throws away every
 * corner.
 *
 * How far a mark was allowed to look is a property of the mark, since the ones the
 * ordinary look gave up on are looked at again further out. A row that does not say
 * predates that and was searched like every other row of its file.
 */
export function ranOutOfRoom(row, radius, eps = 1e-6) {
  const reach = row.searchedAt ?? radius;
  return Math.abs(Math.abs(row.dx) - reach) < eps || Math.abs(Math.abs(row.dy) - reach) < eps;
}

/** The mark could not be placed from its own ink: out of room, or a poor match. */
export function refusedItsOwnInk(row, radius, floor = 0.55) {
  return row.iouBest < floor || ranOutOfRoom(row, radius);
}

/**
 * Fold a wider second look back into the first look's answers.
 *
 * The rule is deliberately one-directional: a wider answer is taken only where the
 * first look refused, only when the wider look does not itself refuse, and only when
 * it matches better. Everything else keeps the answer it already had, byte for byte,
 * so widening the search cannot move a mark that was already placed. That matters
 * more than it sounds — searching everything wide keeps 99.82% of marks accepted but
 * moves 4.11% of them by more than two units, onto the neighbouring mark's ink, and
 * there is no ground truth anywhere that could tell you which of those were right.
 */
export function withSecondLook(first, wider, { radius, wide, floor = 0.55 } = {}) {
  const at = (r) => `${r.page}:${r.k}`;
  const was = new Map(first.map((r) => [at(r), r]));
  const better = new Map();
  for (const w of wider) {
    const before = was.get(at(w));
    if (!before || !refusedItsOwnInk(before, radius, floor)) continue;
    if (refusedItsOwnInk(w, wide, floor)) continue;
    if (!(w.iouBest > before.iouBest)) continue;
    better.set(at(w), w);
  }
  return { rows: first.map((r) => better.get(at(r)) ?? r), took: better.size };
}

// -------------------------------------------------------------- templates --

/**
 * One drawn mark, normalised so that two of them can be compared without either
 * one's page getting a vote.
 *
 * The ligature corpus has a single frame for all 604 pages, so a mark's outline
 * is already at a comparable size wherever it was drawn — but the *pages* we
 * ship are not: pages 1 and 2 sit in a 235-unit square and the rest in a 345 by
 * 550 rectangle, and the fitted scale between the two prints ranges from 1.16 to
 * 1.33 across the corpus. So a template is kept in the corpus's own frame and
 * carried onto a page by that page's own recorded fit, never by an average.
 */
export function outlineRings(d, sx, sy, tx, ty) {
  return flatten(d, [sx, 0, 0, sy, tx, ty], 1 / 64);
}

/**
 * One exemplar outline per mark name, chosen from the whole corpus.
 *
 * The exemplar is the instance closest to its own class's average shape, drawn
 * at the corpus's own scale so that the comparison between two classes is a
 * comparison of the marks and not of how big the print happened to draw them.
 *
 * **Why an average and not the first one found.** A print draws the same mark at
 * slightly different sizes depending on what is under it — the design doc
 * measures one such family at 0.89× an ordinary stroke. Taking the first
 * instance in page order would pin every later comparison to whatever page 1
 * happened to do. Taking the one nearest the average makes the choice a property
 * of the class.
 *
 * **Why the nearest instance and not the average itself.** An averaged mask is a
 * grey blur that no print ever drew, and a blur matches everything slightly. The
 * exemplar is a real outline the publisher really drew, which is the only kind
 * of template whose score means something on its own.
 */
export function chooseExemplars(instances, res, half) {
  const cols = half * 2;
  const rows = half * 2;
  const out = new Map();
  for (const [name, list] of instances) {
    const masks = [];
    for (const inst of list) {
      const [x0, y0, x1, y1] = inst.box;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rings = flatten(inst.d, [1, 0, 0, 1, 0, 0], 1 / (4 * res));
      masks.push(rasterise([shapeOf(rings, "nonzero")], cx - half / res, cy - half / res, cols, rows, res));
    }
    const mean = new Float64Array(cols * rows);
    for (const m of masks) for (let q = 0; q < m.length; q += 1) mean[q] += m[q];
    for (let q = 0; q < mean.length; q += 1) mean[q] /= masks.length;
    let bi = 0;
    let bd = Infinity;
    for (let k = 0; k < masks.length; k += 1) {
      let e = 0;
      for (let q = 0; q < mean.length; q += 1) {
        const v = masks[k][q] - mean[q];
        e += v * v;
      }
      if (e < bd) {
        bd = e;
        bi = k;
      }
    }
    out.set(name, { ...list[bi], spread: Math.sqrt(bd / (cols * rows)), seen: list.length });
  }
  return out;
}

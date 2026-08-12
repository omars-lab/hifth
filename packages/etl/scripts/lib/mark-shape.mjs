/**
 * Does the drawing match the name, with no page anywhere in the question?
 *
 * There are two separate things that can be wrong with a mark, and for a while
 * this repo measured them as one number — which is how you get a headline that
 * swings eighteen points depending on how you choose to count:
 *
 * 1. **The rectangle is in the wrong place.** That is a question about two
 *    printings of the same mus'haf and the transform between them, and it is
 *    answered in `mark-ink.mjs`, which needs the shipped page's ink to answer it.
 * 2. **The drawing does not match the name it was given.** That is a question
 *    about *one* printing, on its own. The corpus drew an outline and, in the
 *    same breath, named it. Either the two agree or they do not, and no page, no
 *    fitted transform and no second printing enters the arithmetic.
 *
 * Everything in this file answers only the second. That is deliberate and it is
 * the point: a displacement cannot contaminate a measurement it is not an input
 * to. The two probes can then be set beside each other and the comparison means
 * something, because neither one's failures are the other's.
 *
 * ## The three outcomes, which are never summed
 *
 * A drawing is scored against one canonical example of every name the print
 * knows, all of them centred on the same spot and stretched to the same box —
 * see `fitTo` for why the size has to be taken out before anything else is
 * asked. The winner is then read against the label three ways:
 *
 * - **agrees** — the winner is the label.
 * - **indistinguishable** — the winner is a different name that this print draws
 *   as the *same shape*. A fatha and a kasra are one short stroke each; what
 *   separates them is that one sits above the letter and one below, and a
 *   comparison that centres both has thrown that away before it starts. This is
 *   a **limit of the method**, not a defect in the data, and counting it as a
 *   disagreement would be measuring the question rather than the corpus.
 * - **differs** — the winner is outside the label's shape group. Only this one
 *   is a finding about the data, and only this one is worth a person's time.
 *
 * The groups are not a list somebody wrote down; they are derived below by
 * scoring every canonical example against every other and joining any pair that
 * agrees above a stated threshold. So the excuse in the middle column is
 * auditable: it is a number, it came from the print, and if the print changes it
 * changes with it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { integral, rasterise, shapeOf } from "./ink.mjs";
import { chooseExemplars, outlineRings, scoreAt, stamp } from "./mark-ink.mjs";
import { pathBBox } from "./mushaf-frame.mjs";

/**
 * One canonical example per drawn name, over the whole cache — built once and
 * shared by both probes.
 *
 * Shared and not merely similar: the placement probe and the labelling probe
 * have to be comparable, and two libraries of templates built by two functions
 * would eventually differ by one page's worth of scan and make every comparison
 * between the two probes an argument about which library was right.
 *
 * Built rather than committed. It is derived from bytes already pinned by hash,
 * so committing it would be a second copy of the same fact with its own way of
 * going stale. Cached in `out/` because the scan is the slowest thing either
 * probe does and nothing about it changes between runs.
 *
 * The reservoir halves itself when it fills, which keeps the kept instances
 * evenly spread over the corpus in one pass without knowing the class counts up
 * front — the alternative, keeping the first few hundred, would pin every later
 * comparison to whatever the opening pages happen to do.
 */
export function loadExemplars({ cacheFile, pages, outlinesOf, rebuild = false, cap = 256 }) {
  if (existsSync(cacheFile) && !rebuild) return new Map(JSON.parse(readFileSync(cacheFile, "utf8")));
  const kept = new Map();
  const stride = new Map();
  const seen = new Map();
  for (const p of pages) {
    for (const o of outlinesOf(p)) {
      const c = (seen.get(o.name) ?? 0) + 1;
      seen.set(o.name, c);
      const s = stride.get(o.name) ?? 1;
      if ((c - 1) % s !== 0) continue;
      if (!kept.has(o.name)) kept.set(o.name, []);
      const list = kept.get(o.name);
      list.push({ page: p, d: o.d, box: pathBBox(o.d) });
      if (list.length > cap) {
        kept.set(
          o.name,
          list.filter((_, i) => i % 2 === 0),
        );
        stride.set(o.name, s * 2);
      }
    }
  }
  // 6 samples per corpus unit over 12 units square: the widest mark in the
  // corpus is 8.2 by 7.4 there, so nothing is clipped by the frame.
  const chosen = chooseExemplars(kept, 6, 36);
  for (const [name, v] of chosen) v.of = seen.get(name);
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify([...chosen]));
  return chosen;
}

/**
 * The frame every shape comparison happens in.
 *
 * Twelve samples per corpus unit over a twelve-unit square. The widest mark in
 * the corpus is 8.2 by 7.4 units, so nothing is clipped by the frame; twelve
 * samples a unit puts about eighty by forty on a mark of middling size — fine
 * enough that the difference between two names is many samples wide, coarse
 * enough that the whole twenty-six-by-twenty-six matrix is instant.
 */
export const SHAPE_RES = 12;
export const SHAPE_HALF = 72;

/**
 * One drawing, centred in that frame — optionally stretched to a stated box —
 * as both a sparse stamp and a dense mask.
 *
 * Centred on the middle of its own bounding box, which is the whole reason this
 * is a *shape* comparison: where the mark sat relative to its letter is
 * discarded here, on purpose, and the cost of discarding it is exactly the
 * middle column of the three outcomes above.
 *
 * The box comes from the curve's true extrema rather than from the flattened
 * outline, and every caller uses this one function, so that two drawings are
 * never centred by two slightly different rules — a half-sample of disagreement
 * about where the middle is would show up as a shape difference and be believed.
 *
 * `sx, sy` stretch the drawing about that same centre before it is sampled. At
 * 1, 1 this is the plain centring it always was; the comparison below uses it to
 * put the canonical example on the box of whatever it is being compared against,
 * for the reason `fitTo` explains.
 */
export function centred(d, res = SHAPE_RES, half = SHAPE_HALF, sx = 1, sy = 1) {
  const [x0, y0, x1, y1] = pathBBox(d);
  const rings = outlineRings(
    d,
    sx,
    sy,
    -((x0 + x1) / 2) * sx + half / res,
    -((y0 + y1) / 2) * sy + half / res,
  );
  const cols = half * 2;
  const rows = half * 2;
  return {
    s: stamp(rings, 0, 0, cols, rows, res),
    m: rasterise([shapeOf(rings, "nonzero")], 0, 0, cols, rows, res),
    cols,
    rows,
    size: [x1 - x0, y1 - y0],
  };
}

/**
 * How much to stretch one drawing so its box matches another's.
 *
 * **Why this exists at all.** For a while this file compared every drawing to
 * every canonical example at the size each happened to be drawn, and that is a
 * measurement of two things at once: whether two marks are the same shape, and
 * whether the print drew them the same size. The print does not draw them the
 * same size — it sets a mark smaller under a crowded word and larger under an
 * open one, and for some names the difference between the tenth and the
 * ninetieth of the corpus is a third of the mark's own width. When the two sizes
 * disagree, ink lands on gap, and the agreement score does not merely fall: it
 * goes *negative*, because ink where the example says paper is worse than
 * nothing. Two drawings a reader calls the same glyph came back at minus
 * nought-point-one, and a negative number between two identical-looking shapes
 * is not a fact about the print. It is the comparison misaligning them.
 *
 * The effect is worst where a name is drawn from more than one piece *and* at a
 * range of sizes. A single stroke slid off by a tenth still overlaps itself and
 * degrades gently; a mark made of a vowel above a small letter re-spaces its two
 * pieces when it grows, and both of them miss.
 *
 * **Both axes, not one.** Matching the diagonals — one number, isotropic —
 * recovers most of it, and matching width and height separately recovers nearly
 * all: the print stretches some marks along one axis only. The cost is that the
 * comparison can no longer use *proportion* as evidence, and that cost is paid
 * openly rather than assumed away: the whole square is recomputed with it, and
 * the names it can no longer tell apart are exactly the two pairs it could not
 * tell apart before. Nothing new was merged. What changed is that the pairs the
 * old arithmetic left hovering just under the line — four of them within a
 * tenth — fell away from it, so the grouping is decided by a wider gap than it
 * used to be.
 *
 * **Rounded to a grid** so the cache of stretched examples is finite and two
 * runs of this file agree to the byte. A fiftieth of a scale moves a
 * middling mark by about a sample, which is the resolution the comparison has
 * anyway; and the bounds keep a hairline or a stray blob from asking for a
 * stretch no drawing could survive.
 */
export const FIT_STEP = 0.02;
export function fitTo(from, to) {
  const q = (v) => Math.max(0.2, Math.min(5, Math.round(v / FIT_STEP) * FIT_STEP));
  const fw = from[2] - from[0];
  const fh = from[3] - from[1];
  return [q(fw > 0 ? (to[2] - to[0]) / fw : 1), q(fh > 0 ? (to[3] - to[1]) / fh : 1)];
}

/**
 * Every canonical example scored against every other — the whole square, not
 * each one's nearest neighbour.
 *
 * Published in full rather than summarised, because the shape groups derived
 * from it decide which disagreements are excused, and an excuse that cannot be
 * audited is one that will eventually be believed for the wrong reason.
 *
 * Each example is stretched onto the box of the one it is being scored against,
 * for the reason `fitTo` gives, so every cell of the square asks about shape and
 * nothing about size. Both directions are still computed and kept: they come out
 * near enough identical once the boxes match — the agreement formula is
 * symmetric in its two masks and they now share a rectangle — but they are
 * measured rather than assumed, and the grouping below still takes the larger of
 * each pair, which is the reading that excuses the most and therefore the one
 * that cannot be accused of manufacturing disagreements.
 */
export function similarityMatrix(lib, res = SHAPE_RES, half = SHAPE_HALF) {
  const names = [...lib.keys()].sort();
  const box = new Map();
  for (const name of names) box.set(name, pathBBox(lib.get(name).d));
  const cols = half * 2;
  const rows = half * 2;
  const phi = names.map(() => new Float64Array(names.length));
  for (let a = 0; a < names.length; a += 1) {
    const A = centred(lib.get(names[a]).d, res, half);
    const sat = integral(A.m, cols, rows);
    for (let b = 0; b < names.length; b += 1) {
      const [sx, sy] = fitTo(box.get(names[b]), box.get(names[a]));
      const B = centred(lib.get(names[b]).d, res, half, sx, sy);
      phi[a][b] = scoreAt(B.s, A.m, sat, cols, rows, 0, 0).phi;
    }
  }
  return { names, phi };
}

/**
 * Names this method is not entitled to tell apart, derived from that matrix.
 *
 * Union-find over every pair whose agreement — the more generous of the two
 * directions — reaches the threshold. Returns the representative for any name,
 * the groups themselves, and the pairs that caused each join, so a reader can
 * see not merely *that* two names were merged but which number merged them.
 */
export function shapeGroups({ names, phi }, threshold) {
  const parent = new Map(names.map((n) => [n, n]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const joins = [];
  for (let a = 0; a < names.length; a += 1) {
    for (let b = a + 1; b < names.length; b += 1) {
      const v = Math.max(phi[a][b], phi[b][a]);
      if (v < threshold) continue;
      joins.push({ a: names[a], b: names[b], phi: v });
      const ra = find(names[a]);
      const rb = find(names[b]);
      if (ra !== rb) parent.set(ra, rb);
    }
  }
  const members = new Map();
  for (const n of names) {
    const g = find(n);
    if (!members.has(g)) members.set(g, []);
    members.get(g).push(n);
  }
  return {
    groupOf: (n) => (parent.has(n) ? find(n) : n),
    groups: [...members.values()].filter((v) => v.length > 1).map((v) => v.slice().sort()),
    joins: joins.sort((x, y) => y.phi - x.phi),
    threshold,
  };
}

/**
 * The strokes a mark is drawn from, in the order the print drew them.
 *
 * A mark like a vowel over a small letter is not one closed shape; it is two or
 * three, written one after another in the same instruction. Splitting on the
 * move that starts each one recovers them exactly, because the split is the
 * print's own division and not an inference from the picture.
 */
export function pieces(d) {
  return d.split(/(?=[Mm])/).filter((s) => s.trim().length > 2);
}

/**
 * Are these the wrong strokes, or the right strokes set at the wrong distance?
 *
 * A whole-shape comparison answers "is this the same picture", and for a mark
 * drawn from one stroke that is the same question as "is this the same mark".
 * For a mark drawn from three it is not, because the picture also encodes how
 * far apart the print set them — and this print does not set them at a fixed
 * distance. So a comparison can report a stark disagreement about a drawing
 * whose every stroke is the canonical stroke.
 *
 * This separates the two. Each stroke is scored against the canonical example's
 * stroke in the same position, which answers the first question; and the
 * distances between stroke centres are compared, in units of the mark's own
 * size, which answers the second. A caller that has both can say which of them
 * a disagreement is about, and — this is the point — can find out that the
 * answer is *always* the second, which is a fact about the comparison rather
 * than about the corpus, and is not one any single number would have given.
 *
 * Returns nothing when the two are not drawn from the same number of strokes,
 * because then there is no pairing to make and pretending otherwise would put a
 * number on a comparison that was never made.
 */
export function pieceCheck(d, ex, res = SHAPE_RES, half = SHAPE_HALF) {
  const P = pieces(d);
  const Q = pieces(ex);
  if (P.length !== Q.length) return null;
  const one = (a, b) => {
    const A = centred(a, res, half);
    const [sx, sy] = fitTo(pathBBox(b), pathBBox(a));
    const B = centred(b, res, half, sx, sy);
    if (!A.s.area || !B.s.area) return 0;
    return scoreAt(B.s, A.m, integral(A.m, A.cols, A.rows), A.cols, A.rows, 0, 0).phi;
  };
  const per = P.map((_, i) => one(P[i], Q[i]));
  const mid = (s) => {
    const b = pathBBox(s);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  };
  const span = (b) => Math.max(b[2] - b[0], b[3] - b[1]);
  const dz = span(pathBBox(d));
  const ez = span(pathBBox(ex));
  let spacing = 0;
  for (let i = 0; i < P.length; i += 1) {
    for (let j = i + 1; j < P.length; j += 1) {
      const a = mid(P[i]);
      const b = mid(P[j]);
      const c = mid(Q[i]);
      const e = mid(Q[j]);
      spacing = Math.max(
        spacing,
        Math.hypot((a[0] - b[0]) / dz - (c[0] - e[0]) / ez, (a[1] - b[1]) / dz - (c[1] - e[1]) / ez),
      );
    }
  }
  return { per, worst: Math.min(...per), spacing, n: P.length };
}

/**
 * A reusable comparer: any drawing scored against every canonical example,
 * each one stretched onto that drawing's own box, and given the three-way
 * verdict.
 *
 * **The stretch is decided by the drawing, never by the label.** Every example
 * is put on the same box, so the label the corpus wrote gets no say in how any
 * of them is drawn, and the winner would be the same if the label were replaced
 * with any other. That is what lets a caller plant a deliberately wrong label
 * and learn something from what happens: the planted label costs nothing to
 * evaluate and cannot flatter itself.
 *
 * Stretched examples are cached, because a whole-corpus pass asks for the same
 * few hundred thousand comparisons at a few hundred distinct sizes, and the
 * rounding in `fitTo` is what makes that cache finite.
 *
 * `margin` is how far the winner beat the label's own example. It is reported
 * rather than thresholded here, because what counts as a decisive win is a
 * property of how far two instances of the *same* name normally sit apart —
 * which the caller measures, and which this function has no business assuming.
 */
export function classifier(lib, groupOf, res = SHAPE_RES, half = SHAPE_HALF) {
  const ex = [];
  for (const [name, e] of lib) {
    if (centred(e.d, res, half).s.area) ex.push({ name, d: e.d, box: pathBBox(e.d) });
  }
  const cache = new Map();
  const stampFor = (e, sx, sy) => {
    const k = `${e.name}|${sx.toFixed(2)}|${sy.toFixed(2)}`;
    let v = cache.get(k);
    if (!v) {
      v = centred(e.d, res, half, sx, sy).s;
      cache.set(k, v);
    }
    return v;
  };
  return (d, label) => {
    const obs = centred(d, res, half);
    if (!obs.s.area) return null;
    const obsBox = pathBBox(d);
    const sat = integral(obs.m, obs.cols, obs.rows);
    const votes = ex
      .map((e) => {
        const [sx, sy] = fitTo(e.box, obsBox);
        return { name: e.name, phi: scoreAt(stampFor(e, sx, sy), obs.m, sat, obs.cols, obs.rows, 0, 0).phi };
      })
      .sort((a, b) => b.phi - a.phi);
    const mine = votes.find((v) => v.name === label);
    const won = votes[0];
    return {
      saw: won.name,
      sawPhi: won.phi,
      minePhi: mine ? mine.phi : -2,
      margin: won.phi - (mine ? mine.phi : -2),
      runnerUp: votes[1] ? votes[1].name : null,
      verdict:
        won.name === label ? "agrees" : groupOf(won.name) === groupOf(label) ? "indistinguishable" : "differs",
    };
  };
}

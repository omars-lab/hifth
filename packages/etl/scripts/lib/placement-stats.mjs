/**
 * The arithmetic behind a placing session, kept apart so it can be tested.
 *
 * `score-mark-nudge.mjs` reads a file of answers and prints a verdict. The
 * verdict is only worth as much as the intervals under it, and an interval is
 * the one thing in that script nobody can eyeball for correctness — a number
 * with a bracket beside it looks equally authoritative whether the bracket is
 * right or half its true width. So the estimators live here, against fixtures
 * where the answer is known by construction.
 *
 * Everything here is per-axis and unitless. The caller supplies page units and
 * gets page units back.
 */

export const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};

/**
 * A normal interval on a mean, which is the right shape here and not elsewhere
 * in this check: a residual is an average of continuous displacements, where the
 * forced choice's numbers are counts of successes and get Wilson intervals. The
 * two are not interchangeable, and a count reported with one of these would be
 * wrong at exactly the small samples this check runs at.
 *
 * It assumes every value is an independent fact. Read `clusteredCI` before
 * believing that of anything measured on a page.
 */
export function meanCI(xs, z = 1.96) {
  const m = mean(xs);
  const n = xs.length;
  if (n < 2) return { m, lo: -Infinity, hi: Infinity, sd: 0, n };
  const s = sd(xs);
  const half = (z * s) / Math.sqrt(n);
  return { m, lo: m - half, hi: m + half, sd: s, n };
}

/**
 * The same mean, with the standard error the sample actually has.
 *
 * Two marks on one page are not two facts about the fit. They share that page's
 * frame — whatever is wrong with it is wrong for both of them, in the same
 * direction, by nearly the same amount — so a session of sixty placements over
 * forty pages carries something closer to forty pages' worth of information than
 * to sixty trials' worth. `meanCI` above cannot know that, and the interval it
 * returns is narrower than the truth by a factor that grows with how many marks
 * share a page.
 *
 * This is not a new idea in this repo. `probe-mark-ink.mjs` says the same thing
 * about its own sampling, in as many words, and has said it since it was
 * written. The lesson did not travel to the scorer, and a residual was banked as
 * *distinguishable from nought* on an interval that a page-clustered estimate
 * puts across zero. Hence a function rather than a comment.
 *
 * The estimator is the ordinary cluster-robust one: sum the deviations within
 * each page first, then treat those page totals as the things that vary. The
 * `G/(G-1)` factor is the standard finite-cluster correction; with few pages the
 * interval is optimistic even so, and the caller prints the page count beside it
 * for exactly that reason.
 *
 * @param xs    the values
 * @param keys  same length as `xs`; which cluster each value belongs to
 */
export function clusteredCI(xs, keys, z = 1.96) {
  const m = mean(xs);
  const n = xs.length;
  const sums = new Map();
  for (let i = 0; i < n; i += 1) {
    const k = keys[i];
    sums.set(k, (sums.get(k) || 0) + (xs[i] - m));
  }
  const g = sums.size;
  if (g < 2) return { m, lo: -Infinity, hi: Infinity, se: NaN, g, n };
  let ss = 0;
  for (const s of sums.values()) ss += s * s;
  const se = Math.sqrt((g / (g - 1)) * ss) / n;
  const half = z * se;
  return { m, lo: m - half, hi: m + half, se, g, n };
}

/**
 * A straight line through the points, with a standard error that respects the
 * pages the points came from.
 *
 * Used three ways by the scorer and the same arithmetic each time: is the
 * proposed move the right *size* (landings against proposed moves), does the
 * residual depend on where the mark sits (residuals against position), does it
 * drift as a session wears on (residuals against trial order).
 *
 * The intercept is fitted and then partialled out, which is why only the
 * centred regressor appears in the sandwich. That is exact for a single
 * regressor when the clusters are balanced and very close otherwise; a session
 * that ever gets far from balanced should be reporting that fact rather than
 * relying on this.
 *
 * Returns `null` when the regressor does not vary — which is itself the answer
 * worth printing, since a regressor that does not vary cannot measure anything.
 */
export function slopeOf(xs, ys, keys, z = 1.96) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const xt = xs.map((v) => v - mx);
  const sxx = xt.reduce((s, v) => s + v * v, 0);
  if (!sxx) return null;
  const b = xt.reduce((s, v, i) => s + v * ys[i], 0) / sxx;
  const a = mean(ys) - b * mx;
  const e = ys.map((v, i) => v - a - b * xs[i]);
  const per = new Map();
  for (let i = 0; i < n; i += 1) per.set(keys[i], (per.get(keys[i]) || 0) + xt[i] * e[i]);
  const g = per.size;
  let ss = 0;
  for (const v of per.values()) ss += v * v;
  const se = g > 1 ? Math.sqrt((g / (g - 1)) * ss) / sxx : NaN;
  const half = z * se;
  return { b, a, se, t: se ? b / se : NaN, lo: b - half, hi: b + half, g, n, spread: sd(xs) };
}

/**
 * Does splitting by some label explain anything, or does it only spend degrees
 * of freedom?
 *
 * The tempting move after a session like this is to find the subgroup with the
 * biggest number in it and call that the cause. The check against that is
 * whether a mean per group leaves *less* unexplained spread than one mean for
 * everything, once both are charged for the parameters they used. If the split
 * model's residual spread is the larger of the two, the labels bought nothing,
 * and the biggest subgroup was the biggest by luck.
 *
 * Returns both spreads and the group count. `many >= one` means: do not split.
 */
export function spreadUnderSplit(values, labels) {
  const one = sd(values);
  const groups = new Map();
  for (let i = 0; i < values.length; i += 1) {
    if (!groups.has(labels[i])) groups.set(labels[i], []);
    groups.get(labels[i]).push(values[i]);
  }
  let ss = 0;
  for (const vs of groups.values()) {
    const m = mean(vs);
    for (const v of vs) ss += (v - m) ** 2;
  }
  const df = values.length - groups.size;
  return { one, many: df > 0 ? Math.sqrt(ss / df) : NaN, groups: groups.size, df };
}

/**
 * How far apart are two readers, and is that further apart than either of them
 * is from themselves?
 *
 * Everything else here measures one hand against the print, and that comparison
 * has two readings it cannot separate: *the print is out by this much* and *this
 * reader places rectangles this way*. They come out as the same number. Two
 * people placing the same marks is the only thing that tells them apart.
 *
 * The difference is taken **per mark**, not between the two readers' averages.
 * Two hands can average to the same place while disagreeing about every single
 * rectangle, and an average-of-averages would report that as agreement — which
 * would say the leftover is a property of the page at exactly the moment it is
 * not. The interval on the per-mark difference is clustered by page for the same
 * reason every other interval in this file is.
 *
 * The scale it is read against is the two hands' own wobble, added the way
 * independent wobbles add. Two readers who each scatter by a twentieth of a unit
 * cannot be expected to agree closer than about a fourteenth, so a gap inside
 * that is agreement, and only a gap that clears it is a disagreement about the
 * print rather than about nothing.
 *
 * @param pairs  `[{page, d: [dx, dy]}]` — one entry per mark both readers placed,
 *               `d` being the second reader's landing minus the first's.
 * @param floors `[a, b]` — each reader's own precision, from marks they placed
 *               twice. A non-finite entry (nobody repeated anything) makes
 *               `beyond` false: an unmeasured wobble is not a small one.
 */
export function agreementOf(pairs, floors, z = 1.96) {
  const pages = pairs.map((p) => p.page);
  const by = [0, 1].map((k) =>
    clusteredCI(
      pairs.map((p) => p.d[k]),
      pages,
      z,
    ),
  );
  const gaps = pairs.map((p) => Math.hypot(p.d[0], p.d[1])).sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : NaN;
  const known = floors.every((f) => Number.isFinite(f));
  const expected = known ? Math.hypot(...floors) : NaN;
  return { n: pairs.length, by, typical, expected, beyond: known && typical > expected };
}

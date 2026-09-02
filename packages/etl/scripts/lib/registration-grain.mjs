/**
 * At what grain is the difference between the two prints actually constant?
 *
 * Every mark and every word box the app draws rides four numbers a page, fitted
 * between our print and the ligature corpus on the ayah-end ornaments — the only
 * objects both label. That fit is excellent at the ornaments and wrong at the
 * text, and a whole-corpus pass says the four numbers cannot be rescued: the
 * best per-page transform that could possibly be fitted still leaves about four
 * tenths of a unit of scatter across and a third of a unit down, on marks that
 * are five and a half units wide and three and a half tall.
 *
 * So the question stops being *what are the four numbers* and becomes *over what
 * group are four numbers enough*. This file is that question, and only that
 * question: a correction is a median or a fit over a group, so a grain is usable
 * exactly when its groups still hold enough marks for one to mean anything.
 *
 * ```
 *   page   1 group  a page     ~540 marks   what ships today
 *   line  15 groups a page      ~36 marks   what justification is set at
 *   word ~144 groups a page    ~3.7 marks   fits noise
 *   mark ~540 groups a page        1 mark   manufactures the wrong-mark fault
 * ```
 *
 * Three of the four rungs this file builds share the middle row: `line` gives
 * each printed line one offset, `line-tilt` lets that offset slide evenly along
 * the line, and `line-curve` lets it bend. Same thirty-six marks, asked for one
 * number, then two, then three — so the ladder gets finer twice over without the
 * groups ever getting thinner.
 *
 * The line is not a guess. Two renderings of one text diverge because their
 * glyph advance widths and line metrics differ, so error accumulates *along* a
 * line and resets at the next one — which is an argument from typesetting and
 * not from our own numbers, and it predicts a tilt within each line as well as
 * an offset per line. `line-tilt` is that prediction written down.
 *
 * `line-curve` is the rung after it, and it was found by asking what the marks
 * a tilt still leaves badly out have in common. The answer was: each other. More
 * than half of them sit on the one line in fifteen that has gone wrong as a
 * whole, and a mark at either end of a line is about twice as likely to be badly
 * out as one in the middle — which is what accumulation looks like when it does
 * not accumulate at a constant rate, and is not a shape a straight line has the
 * freedom to follow. Bending it pays, measured on the half of the marks the fit
 * was never shown: badly out 4.95% -> 4.12%, median leftover 0.224 -> 0.198
 * units, over 326,515 rows and 8,702 printed lines. Wearing another line's bend
 * costs 34.40%, against 18.20% for no per-line correction at all — so each
 * line's bend is a fact about that line and not a shape absorbed from noise.
 *
 * The ladder stops here rather than wherever the arithmetic stops improving. A
 * cubic was fitted the same way and rejected: better on its own training marks
 * and worse on the held-out half, which is the signature of a term with nothing
 * to find. It is not a rung this file builds, so that comparison is not
 * reproducible from here — it was run once, off the ladder, and is recorded as
 * the reason there is no fourth term rather than as a measurement to lean on.
 *
 * What bending does not clear: it fixes the middle of a line and barely touches
 * the ends. The middle goes from 4.34% badly out to 2.94%, while the two ends go
 * from 6.58% and 6.95% to 5.97% and 6.02% — so a mark at the end of a printed
 * line is still about twice as likely to be badly out as one in the middle, and
 * whatever is doing that is not a shape in the position along the line at all.
 * That is left standing on purpose rather than chased with a fifth rung.
 *
 * Nothing here rasterises anything. A correction moves the rectangle, and the
 * displacement to the ink is already measured, so the residual under a candidate
 * grain is arithmetic and a search over grains costs seconds. What it cannot say
 * is how much ink a rectangle would then cover, because overlap is not linear in
 * the displacement — that answer only comes from re-scoring, and re-scoring is
 * `probe-mark-ink.mjs`'s job.
 */

/** The grains this file knows how to build, coarsest first. */
export const GRAINS = ["page", "line", "line-tilt", "line-curve"];

/**
 * How many observations a group must hold per term of the fit it is given.
 *
 * A tilt has two terms and a curve has three, so the same floor buys a curve
 * two-thirds of the evidence it buys a tilt. Three per term is the point below
 * which the extra term is reading noise, and stating it here means lowering the
 * floor cannot quietly buy a curve nobody has the marks for.
 */
const PER_TERM = 3;
const TERMS = { line: 1, "line-tilt": 2, "line-curve": 3 };

/** Marks with essentially no ink under them estimate nothing and are left out. */
const EMPTY = 0.02;

/** How few marks a group may hold and still be given its own correction. */
export const FLOOR = 20;

/**
 * The same floor, for a correction fitted on half the marks.
 *
 * Holding a split-half measurement to the production floor asks the wrong
 * question and quietly answers it badly: the split halves every group, so a
 * printed line carrying a comfortable thirty-six marks arrives at the fit with
 * eighteen and is refused. What then gets measured is not how well a per-line
 * correction works — it is how many lines survived the halving, and every line
 * that did not falls back to its page and drags the answer toward the page
 * grain. This is not hypothetical: at the production floor two lines in three
 * were being refused, and the grain looked three times weaker than it is.
 *
 * A halved group is still the size the floor was chosen for, so the halved
 * floor is the one that keeps the question about the grain.
 */
export const SPLIT_FLOOR = Math.ceil(FLOOR / 2);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Where along its line a mark sits. Across only: justification stretches a line
 * along its own direction, so that is the axis a within-line tilt is fitted in.
 */
const centreX = (r) => r.box[0] + r.box[2] / 2;

export const pageKey = (r) => r.page;
export const lineKey = (r) => `${r.page}:${r.line}`;

/**
 * The straight line through a set of points, and how far the points sit from it.
 *
 * One copy, because several things here are the same regression asked at
 * different grains — what transform the ink implies for a whole page, what
 * stretch it implies along one printed line — and a second copy of a
 * least-squares fit is a second place for them to quietly disagree.
 */
export function fitLine(obs, want) {
  const n = obs.length;
  const mx = obs.reduce((a, b) => a + b, 0) / n;
  const my = want.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (obs[i] - mx) * (want[i] - my);
    sxx += (obs[i] - mx) * (obs[i] - mx);
  }
  const a = sxx > 0 ? sxy / sxx : 1;
  const b = my - a * mx;
  let e = 0;
  for (let i = 0; i < n; i += 1) {
    const d = want[i] - (a * obs[i] + b);
    e += d * d;
  }
  return { a, b, sd: Math.sqrt(e / Math.max(1, n - 2)) };
}

/**
 * The gentlest curve through a set of points, and how far the points sit from it.
 *
 * Fitted in a coordinate centred and scaled on the points themselves, and the
 * centre and the scale are handed back with the coefficients, because a squared
 * term in raw page units on a line that starts at 176 is three well-conditioned
 * numbers pretending to be one badly-conditioned one. A group with no width, or
 * too few distinct positions to bend through, has no curve in it: the fit falls
 * back to the straight line rather than to nothing, which is the same choice
 * this file makes everywhere a group is too thin to estimate what it was asked.
 */
export function fitCurve(obs, want) {
  const n = obs.length;
  const x0 = obs.reduce((a, b) => a + b, 0) / n;
  const varx = obs.reduce((a, b) => a + (b - x0) ** 2, 0) / Math.max(1, n - 1);
  const s = varx > 0 ? Math.sqrt(varx) : 1;
  const t = obs.map((x) => (x - x0) / s);

  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let y0 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i += 1) {
    const u = t[i];
    const uu = u * u;
    s1 += u;
    s2 += uu;
    s3 += uu * u;
    s4 += uu * uu;
    y0 += want[i];
    y1 += u * want[i];
    y2 += uu * want[i];
  }
  // The normal equations for [1, t, t²], solved by hand rather than by a matrix
  // library this package does not have. Cramer's rule on a symmetric 3×3.
  const m = [[n, s1, s2], [s1, s2, s3], [s2, s3, s4]];
  const det3 = (a) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det3(m);
  const sub = (col, v) => det3(m.map((row, i) => row.map((x, j) => (j === col ? v[i] : x))));
  const scale = Math.max(1, Math.abs(n * s2 * s4));
  if (!Number.isFinite(d) || Math.abs(d) < 1e-9 * scale) {
    const straight = fitLine(obs, want);
    return { c: straight.b + straight.a * x0, b: straight.a * s, a: 0, x0, s, sd: straight.sd, bent: false };
  }
  const v = [y0, y1, y2];
  const c = sub(0, v) / d;
  const b = sub(1, v) / d;
  const a = sub(2, v) / d;
  let e = 0;
  for (let i = 0; i < n; i += 1) {
    const g = want[i] - (a * t[i] * t[i] + b * t[i] + c);
    e += g * g;
  }
  return { a, b, c, x0, s, sd: Math.sqrt(e / Math.max(1, n - 3)), bent: true };
}

/** Where a fitted curve says a mark at this position should move to. */
export const atCurve = (f, x) => {
  const t = (x - f.x0) / f.s;
  return f.a * t * t + f.b * t + f.c;
};

/**
 * What a line's own correction says about one mark, whichever shape it has.
 *
 * One copy, used by the correction and by its shuffled control alike, so a new
 * rung cannot be right in the model and wrong in the control that is supposed to
 * refute it — which would make the control pass by agreeing with nothing.
 */
function alongLine(grain, l, r) {
  if (!l) return { dx: 0, dy: 0 };
  if (grain === "line") return { dx: l.dx, dy: l.dy };
  const cx = centreX(r);
  if (grain === "line-tilt") return { dx: l.x.a * cx + l.x.b, dy: l.y.a * cx + l.y.b };
  return { dx: atCurve(l.x, cx), dy: atCurve(l.y, cx) };
}

/** Every group a keying function names, with its rows, ink-empty rows dropped. */
export function groupBy(rs, key) {
  const g = new Map();
  for (const r of rs) {
    if (r.ink < EMPTY) continue;
    const k = key(r);
    if (k === null || k === undefined || (typeof k === "number" && !Number.isFinite(k))) continue;
    if (typeof k === "string" && k.endsWith(":NaN")) continue;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return g;
}

/**
 * The displacement of every group, as the median of the group's marks.
 *
 * The median rather than the mean, because the thing being estimated is what the
 * group as a whole does, and a handful of marks that really are on the wrong
 * letter would drag a mean. Groups too small to estimate anything are left out
 * rather than corrected by a number built from four observations.
 */
export function shiftsBy(rs, key, floor = FLOOR) {
  const out = new Map();
  for (const [k, xs] of groupBy(rs, key)) {
    if (xs.length < floor) continue;
    out.set(k, { dx: median(xs.map((r) => r.dx)), dy: median(xs.map((r) => r.dy)), n: xs.length });
  }
  return out;
}

/**
 * Build the correction a grain would apply, fitted on `train`.
 *
 * Finer grains are layered on top of the page rather than replacing it. A line
 * with too few marks to estimate anything then falls back to its page's
 * displacement instead of to nothing — the difference between a sparse line
 * being left alone and a sparse line being made worse.
 *
 * Returns a function from a row to `{dx, dy}`, plus the tables it was built
 * from, so a caller can report how many groups actually earned a correction.
 */
export function correctionFor(grain, train, floor = FLOOR) {
  if (!GRAINS.includes(grain)) throw new Error(`unknown grain: ${grain}`);
  const page = shiftsBy(train, pageKey, floor);
  const after = train.map((r) => {
    const p = page.get(r.page) ?? { dx: 0, dy: 0 };
    return { ...r, dx: r.dx - p.dx, dy: r.dy - p.dy };
  });

  let finer = () => ({ dx: 0, dy: 0 });
  let line = new Map();
  if (grain === "line") {
    line = shiftsBy(after, lineKey, floor);
  } else if (grain === "line-tilt" || grain === "line-curve") {
    const need = Math.max(floor, PER_TERM * TERMS[grain]);
    const shape = grain === "line-tilt" ? fitLine : fitCurve;
    for (const [k, xs] of groupBy(after, lineKey)) {
      if (xs.length < need) continue;
      const cx = xs.map(centreX);
      line.set(k, { x: shape(cx, xs.map((r) => r.dx)), y: shape(cx, xs.map((r) => r.dy)) });
    }
  }
  if (grain !== "page") finer = (r) => alongLine(grain, line.get(lineKey(r)), r);

  const apply = (r) => {
    const p = page.get(r.page);
    if (!p) return { dx: 0, dy: 0 };
    const f = finer(r);
    return { dx: p.dx + f.dx, dy: p.dy + f.dy };
  };
  return { apply, pages: page, lines: line };
}

/**
 * The same grain, with every group wearing some *other* group's correction.
 *
 * This is the control that separates a grain from a shape of noise. If the
 * per-line numbers are real facts about how the two prints set that line, then
 * wearing the wrong line's is worse than wearing none at all. If they are noise
 * the model absorbed, the shuffle makes no odds — and that is the answer, at the
 * cost of one rotation. It rotates rather than randomises so the control is the
 * same on every re-run.
 */
export function shuffledCorrectionFor(grain, train, floor = FLOOR) {
  const built = correctionFor(grain, train, floor);
  if (grain === "page") return built;
  const keys = [...built.lines.keys()];
  if (keys.length < 2) return built;
  const swap = new Map(keys.map((k, i) => [k, keys[(i + 7) % keys.length]]));
  const apply = (r) => {
    const p = built.pages.get(r.page);
    if (!p) return { dx: 0, dy: 0 };
    const l = built.lines.get(swap.get(lineKey(r)));
    if (!l) return { dx: p.dx, dy: p.dy };
    const f = alongLine(grain, l, r);
    return { dx: p.dx + f.dx, dy: p.dy + f.dy };
  };
  return { ...built, apply };
}

/**
 * A reproducible coin, so a split half is the same split on every re-run.
 *
 * Keyed on the mark's own identity rather than on its position in a list: the
 * sampler that produced the list is seeded, but a run over a different page set
 * would otherwise put a different half of each page in training and nothing
 * would say so.
 */
export function half(r) {
  let h = 2166136261 ^ Math.imul(r.page, 1000003) ^ r.k;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) % 2;
}

/**
 * What is left after a correction, in page units.
 *
 * `over` counts marks landing further than `off` from their own ink. That
 * threshold is the one the rest of this work reports against; it is a
 * "badly out" test, not a quality bar.
 */
export function residualsUnder(rs, apply, off = 0.75) {
  const ex = [];
  const ey = [];
  const d = [];
  for (const r of rs) {
    if (r.ink < EMPTY) continue;
    const c = apply(r);
    const a = r.dx - c.dx;
    const b = r.dy - c.dy;
    ex.push(a);
    ey.push(b);
    d.push(Math.hypot(a, b));
  }
  const sorted = [...d].sort((a, b) => a - b);
  const at = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
  const spread = (xs) => {
    const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
  };
  return {
    n: d.length,
    med: at(0.5),
    p95: at(0.95),
    over: d.length ? (100 * d.filter((x) => x > off).length) / d.length : 0,
    sdx: spread(ex),
    sdy: spread(ey),
  };
}

/**
 * A grain, fitted on one half of the marks and scored on the other.
 *
 * This is the whole defence against the circularity the rest of this work is
 * built to avoid: the correction is fitted to maximise agreement with the ink
 * and then scored by agreement with the ink, so a richer model improves every
 * time — including when what it is fitting is noise. It cannot improve on marks
 * it was never shown. `trained` is returned beside `heldOut` on purpose: the gap
 * between them is the overfit, and a rung that only wins on its own training
 * marks has earned nothing.
 */
export function splitHalfLadder(rows, grain, { floor = SPLIT_FLOOR, shuffled = false } = {}) {
  const a = rows.filter((r) => half(r) === 0);
  const b = rows.filter((r) => half(r) === 1);
  const build = shuffled ? shuffledCorrectionFor : correctionFor;
  const { apply, pages, lines } = build(grain, a, floor);
  return {
    grain,
    shuffled,
    groups: { pages: pages.size, lines: lines.size },
    heldOut: residualsUnder(b, apply),
    trained: residualsUnder(a, apply),
  };
}

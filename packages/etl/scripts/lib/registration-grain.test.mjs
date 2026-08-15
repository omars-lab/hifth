/**
 * The grain search, on prints whose true difference we built ourselves.
 *
 * The failure this has to catch is the one the whole method is arranged around:
 * a correction fitted to agree with the ink and then scored by agreement with
 * the ink gets better every time it is given more parameters, *including* when
 * the thing it is fitting is noise. Read on the marks it was fitted to, a
 * per-line model always looks like progress. So the fixtures come in a pair —
 * one page set where the lines really do differ, and one where they differ by
 * nothing at all — and the second must **appear** to improve and then lose on
 * the marks it never saw. A version of this file where both fixtures pass on
 * trained-on numbers alone is a version that would have let us ship noise.
 *
 * Everything here is deterministic. A fixture that wobbles between runs cannot
 * be argued from months later, which is the only reason these numbers exist.
 */
import { describe, expect, it } from "vitest";
import {
  FLOOR,
  SPLIT_FLOOR,
  atCurve,
  correctionFor,
  fitCurve,
  fitLine,
  half,
  lineKey,
  residualsUnder,
  shiftsBy,
  shuffledCorrectionFor,
  splitHalfLadder,
} from "./registration-grain.mjs";

/** A repeatable wobble in [-1, 1), so a fixture is the same fixture every run. */
function wobble(seed) {
  let s = (seed * 1103515245 + 12345) >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) / 8388608 - 1;
  };
}

/**
 * A synthetic corpus: `pages` pages, 15 printed lines each, `per` marks a line.
 *
 * `truth(page, line, cx)` is the displacement between the two prints at that
 * spot — the thing a correction is trying to recover. On top of it sits a
 * quarter of a unit of wobble, which stands in for everything the model is not
 * entitled to reach: where inside its letter a mark was set, and how well the
 * ink was found under it.
 */
function corpus(truth, { pages = 8, per = 60, noise = 0.25, seed = 7 } = {}) {
  const rnd = wobble(seed);
  const rows = [];
  let k = 0;
  for (let p = 1; p <= pages; p += 1) {
    for (let line = 1; line <= 15; line += 1) {
      for (let i = 0; i < per; i += 1) {
        const cx = 20 + (i / per) * 300;
        const t = truth(p, line, cx);
        rows.push({
          page: p,
          k: k += 1,
          line,
          box: [cx - 2.8, 100 + line * 30, 5.6, 3.6],
          ink: 0.4,
          dx: t.dx + rnd() * noise,
          dy: t.dy + rnd() * noise,
        });
      }
    }
  }
  return rows;
}

/** The whole difference is the page's: what today's four-number fit can reach. */
const PAGE_ONLY = (p) => ({ dx: 0.5 + p * 0.03, dy: -1.1 - p * 0.02 });

/** Each printed line slides on its own, as two prints justifying differently do. */
const PER_LINE = (p, line) => ({
  dx: PAGE_ONLY(p).dx + (line % 5) * 0.18 - 0.36,
  dy: PAGE_ONLY(p).dy + (line % 3) * 0.22 - 0.22,
});

/** The same, plus error accumulating along each line and resetting at the next. */
const PER_LINE_TILT = (p, line, cx) => {
  const b = PER_LINE(p, line);
  return { dx: b.dx + (cx - 170) * 0.004, dy: b.dy + (cx - 170) * 0.0012 };
};

/**
 * The same again, except the drift does not accumulate at a constant rate.
 *
 * A straight fit has no freedom to follow this: whatever slope it picks is too
 * shallow at one end of the line and too steep at the other, which is what the
 * real corpus looks like when it is read by where along the line a mark sits.
 */
const PER_LINE_CURVE = (p, line, cx) => {
  const b = PER_LINE(p, line);
  const t = (cx - 170) / 150;
  return { dx: b.dx + 0.55 * t * t + 0.2 * t, dy: b.dy + 0.18 * t * t };
};

describe("fitLine", () => {
  it("recovers a slope and an intercept it was given", () => {
    const xs = Array.from({ length: 30 }, (_, i) => i * 0.5);
    const out = fitLine(xs, xs.map((x) => 0.4 + 0.03 * x));
    expect(out.a).toBeCloseTo(0.03, 10);
    expect(out.b).toBeCloseTo(0.4, 10);
    expect(out.sd).toBeCloseTo(0, 10);
  });

  it("reports how far the points sit from the line it drew", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i);
    const out = fitLine(xs, xs.map((x, i) => x * 0.1 + (i % 2 ? 0.2 : -0.2)));
    expect(out.a).toBeCloseTo(0.1, 2);
    expect(out.sd).toBeCloseTo(0.2, 1);
  });
});

describe("fitCurve", () => {
  // Read through atCurve rather than off the coefficients: the fit works in a
  // coordinate of its own making, so the coefficients are only meaningful with
  // the centre and scale that came back beside them, and every caller reads it
  // this way. A test that unpicked them would be testing the wrong thing.
  const bend = (x) => 0.4 + 0.03 * x + 0.002 * x * x;

  it("recovers a bend it was given", () => {
    const xs = Array.from({ length: 30 }, (_, i) => 170 + i * 5);
    const out = fitCurve(xs, xs.map(bend));
    expect(out.bent).toBe(true);
    expect(out.sd).toBeCloseTo(0, 6);
    for (const x of [xs[0], xs[15], xs[29]]) expect(atCurve(out, x)).toBeCloseTo(bend(x), 6);
  });

  it("beats a straight fit exactly where a straight fit cannot reach — the ends", () => {
    const xs = Array.from({ length: 30 }, (_, i) => 170 + i * 5);
    const straight = fitLine(xs, xs.map(bend));
    expect(fitCurve(xs, xs.map(bend)).sd).toBeLessThan(straight.sd);
    const end = xs[29];
    expect(Math.abs(straight.a * end + straight.b - bend(end))).toBeGreaterThan(0.5);
  });

  it("reports how far the points sit from the curve it drew", () => {
    const xs = Array.from({ length: 40 }, (_, i) => 170 + i);
    const out = fitCurve(xs, xs.map((x, i) => bend(x) + (i % 2 ? 0.2 : -0.2)));
    expect(out.sd).toBeCloseTo(0.2, 1);
  });

  it("falls back to the straight line through a group with no width to bend across", () => {
    // Every mark at the same spot: there is no bend to see, and the normal
    // equations are singular. The answer is the straight line's, not a throw and
    // not nothing — the same choice this file makes wherever a group is too thin
    // for what it was asked.
    const xs = Array.from({ length: 20 }, () => 200);
    const out = fitCurve(xs, xs.map((_, i) => 1.5 + (i % 2 ? 0.1 : -0.1)));
    expect(out.bent).toBe(false);
    expect(Number.isFinite(atCurve(out, 200))).toBe(true);
    expect(atCurve(out, 200)).toBeCloseTo(1.5, 6);
  });

  it("falls back rather than bending through two distinct positions", () => {
    // Two positions determine a straight line and leave a quadratic a free
    // parameter, so any bend it drew would be invented. It draws none.
    const xs = [180, 180, 180, 320, 320, 320];
    const out = fitCurve(xs, xs.map((x) => 0.4 + 0.01 * x));
    expect(out.bent).toBe(false);
    expect(atCurve(out, 250)).toBeCloseTo(0.4 + 0.01 * 250, 6);
  });
});

describe("shiftsBy", () => {
  const rows = corpus(PAGE_ONLY, { pages: 3, per: 40 });

  it("recovers each page's displacement", () => {
    const s = shiftsBy(rows, (r) => r.page);
    expect(s.size).toBe(3);
    expect(s.get(2).dx).toBeCloseTo(PAGE_ONLY(2).dx, 1);
    expect(s.get(2).dy).toBeCloseTo(PAGE_ONLY(2).dy, 1);
  });

  it("leaves out any group too small to estimate anything", () => {
    const thin = rows.filter((r) => r.page === 1 || r.k % 97 === 0);
    const s = shiftsBy(thin, (r) => r.page);
    expect(s.has(1)).toBe(true);
    expect(s.has(3)).toBe(false);
  });

  it("ignores marks with no ink under them, which measure nothing", () => {
    const blanked = rows.map((r) => (r.page === 3 ? { ...r, ink: 0 } : r));
    expect(shiftsBy(blanked, (r) => r.page).has(3)).toBe(false);
  });

  it("is not dragged by a handful of marks that really are on the wrong letter", () => {
    const withStrays = rows.map((r, i) => (i % 20 === 0 ? { ...r, dx: r.dx + 40 } : r));
    const s = shiftsBy(withStrays, (r) => r.page);
    expect(s.get(1).dx).toBeCloseTo(PAGE_ONLY(1).dx, 1);
  });
});

describe("correctionFor", () => {
  it("refuses a grain it does not know", () => {
    expect(() => correctionFor("word", corpus(PAGE_ONLY))).toThrow(/unknown grain/);
  });

  it("recovers a per-line difference the page grain cannot reach", () => {
    const rows = corpus(PER_LINE);
    const { apply } = correctionFor("line", rows);
    const r = rows.find((x) => x.page === 4 && x.line === 7);
    expect(apply(r).dx).toBeCloseTo(PER_LINE(4, 7).dx, 1);
    expect(apply(r).dy).toBeCloseTo(PER_LINE(4, 7).dy, 1);
  });

  it("recovers the tilt along a line, not just its offset", () => {
    const rows = corpus(PER_LINE_TILT);
    const { apply } = correctionFor("line-tilt", rows);
    const one = rows.filter((r) => r.page === 3 && r.line === 9);
    // Read at both ends of the line as well as the middle: a model that got the
    // offset right and the slope wrong is correct in the middle and nowhere else.
    // A tenth of a unit is the bar because that is what a line fitted from sixty
    // marks, each carrying a quarter of a unit of wobble, is worth at its ends —
    // and it is an order of magnitude below the error being corrected.
    for (const r of [one[0], one[Math.floor(one.length / 2)], one[one.length - 1]]) {
      expect(apply(r).dx - PER_LINE_TILT(3, 9, r.box[0] + 2.8).dx).toBeLessThan(0.1);
      expect(apply(r).dx - PER_LINE_TILT(3, 9, r.box[0] + 2.8).dx).toBeGreaterThan(-0.1);
    }
  });

  it("follows a bend along a line at both ends, where a straight fit runs out", () => {
    const rows = corpus(PER_LINE_CURVE);
    const one = rows.filter((r) => r.page === 3 && r.line === 9);
    const read = (apply, r) => apply(r).dx - PER_LINE_CURVE(3, 9, r.box[0] + 2.8).dx;
    const tilt = correctionFor("line-tilt", rows).apply;
    const curve = correctionFor("line-curve", rows).apply;
    const ends = [one[0], one[one.length - 1]];
    // The straight fit is not merely less good at the ends, it is out by more
    // than a tenth of a unit — the bar the tilt test holds itself to — because a
    // slope that splits the difference is wrong in the same direction at both.
    for (const r of ends) expect(Math.abs(read(tilt, r))).toBeGreaterThan(0.1);
    for (const r of ends) expect(Math.abs(read(curve, r))).toBeLessThan(0.1);
  });

  it("leaves a line with too few marks wearing its page's correction, not none", () => {
    const rows = corpus(PER_LINE).filter((r) => !(r.page === 2 && r.line === 5 && r.k % 7 !== 0));
    const { apply, lines } = correctionFor("line", rows);
    expect(lines.has(lineKey({ page: 2, line: 5 }))).toBe(false);
    const sparse = rows.find((r) => r.page === 2 && r.line === 5);
    expect(apply(sparse).dx).toBeCloseTo(PAGE_ONLY(2).dx, 1);
  });

  it("refuses a bend on a line too thin to carry three terms, where a tilt still fits", () => {
    // Three observations per term, so the same floor buys a curve two-thirds of
    // the evidence it buys a tilt. Seven marks is enough for a slope and not for
    // a bend, and the floor on its own would have allowed both.
    const all = corpus(PER_LINE_CURVE);
    const rows = [
      ...all.filter((r) => !(r.page === 2 && r.line === 5)),
      ...all.filter((r) => r.page === 2 && r.line === 5).slice(0, 7),
    ];
    const k = lineKey({ page: 2, line: 5 });
    expect(correctionFor("line-tilt", rows, 5).lines.has(k)).toBe(true);
    const curve = correctionFor("line-curve", rows, 5);
    expect(curve.lines.has(k)).toBe(false);
    // And what it falls back to is that page's own correction, not nothing.
    const thin = rows.at(-1);
    expect(curve.apply(thin).dx).toBeCloseTo(correctionFor("page", rows, 5).apply(thin).dx, 6);
  });

  it("gives a page it never measured no correction at all, rather than a guess", () => {
    const { apply } = correctionFor("page", corpus(PAGE_ONLY, { pages: 2 }));
    expect(apply({ page: 99, line: 3, box: [0, 0, 5.6, 3.6], ink: 0.4, dx: 1, dy: 1 })).toEqual({
      dx: 0,
      dy: 0,
    });
  });
});

describe("the split half", () => {
  it("puts a mark on the same side on every run, and both sides get some", () => {
    const rows = corpus(PAGE_ONLY, { pages: 2, per: 40 });
    const first = rows.map(half);
    expect(rows.map(half)).toEqual(first);
    const ones = first.filter((x) => x === 1).length;
    expect(ones).toBeGreaterThan(rows.length * 0.35);
    expect(ones).toBeLessThan(rows.length * 0.65);
  });
});

/**
 * The pair the whole file exists for.
 *
 * Both fixtures are handed the same ladder. The one whose lines really differ
 * must win on marks it never saw; the one whose lines differ by nothing must
 * win only on the marks it was fitted to. Nothing else distinguishes them —
 * same page displacements, same wobble, same counts.
 */
describe("a per-line correction, against a corpus that has per-line structure and one that does not", () => {
  const real = corpus(PER_LINE);
  const flat = corpus(PAGE_ONLY);
  const ladder = (rows, grain, shuffled = false) => splitHalfLadder(rows, grain, { shuffled });

  it("pays on held-out marks when the lines genuinely differ", () => {
    const page = ladder(real, "page");
    const line = ladder(real, "line");
    expect(line.heldOut.sdx).toBeLessThan(page.heldOut.sdx * 0.75);
    expect(line.heldOut.sdy).toBeLessThan(page.heldOut.sdy * 0.85);
    expect(line.heldOut.over).toBeLessThan(page.heldOut.over);
  });

  it("appears to pay and then loses, when the lines differ by nothing", () => {
    const page = ladder(flat, "page");
    const line = ladder(flat, "line");
    // On its own training marks it fits the wobble, so it looks like progress.
    expect(line.trained.sdx).toBeLessThan(page.trained.sdx);
    expect(line.trained.sdy).toBeLessThan(page.trained.sdy);
    // On marks it never saw, that same fitted wobble is added noise.
    expect(line.heldOut.sdx).toBeGreaterThan(page.heldOut.sdx);
    expect(line.heldOut.sdy).toBeGreaterThan(page.heldOut.sdy);
  });

  it("fits the wobble harder still when given a slope, and still loses", () => {
    const page = ladder(flat, "page");
    const line = ladder(flat, "line");
    const tilt = ladder(flat, "line-tilt");
    expect(tilt.trained.sdx).toBeLessThan(line.trained.sdx);
    expect(tilt.heldOut.sdx).toBeGreaterThan(page.heldOut.sdx);
  });

  it("keeps improving on held-out marks when there is a real tilt to find", () => {
    const rows = corpus(PER_LINE_TILT);
    const line = ladder(rows, "line");
    const tilt = ladder(rows, "line-tilt");
    expect(tilt.heldOut.sdx).toBeLessThan(line.heldOut.sdx);
  });

  it("keeps improving again on held-out marks when there is a real bend to find", () => {
    const rows = corpus(PER_LINE_CURVE);
    const tilt = ladder(rows, "line-tilt");
    const curve = ladder(rows, "line-curve");
    expect(curve.heldOut.sdx).toBeLessThan(tilt.heldOut.sdx);
    expect(curve.heldOut.over).toBeLessThan(tilt.heldOut.over);
  });

  it("bends the wobble harder still when there is no bend, and loses for it", () => {
    // The rung after the tilt has to face the same pair as the tilt did, or all
    // that has been shown is that a model with more parameters fits better.
    const page = ladder(flat, "page");
    const tilt = ladder(flat, "line-tilt");
    const curve = ladder(flat, "line-curve");
    expect(curve.trained.sdx).toBeLessThan(tilt.trained.sdx);
    expect(curve.heldOut.sdx).toBeGreaterThan(page.heldOut.sdx);
  });

  it("says how many groups earned a correction, so a win cannot be a win on four lines", () => {
    const line = ladder(real, "line");
    expect(line.groups.pages).toBe(8);
    expect(line.groups.lines).toBe(8 * 15);
  });
});

/**
 * The other control, and the one that needs no held-out half at all.
 *
 * Split-half answers *did this model learn something*. The shuffle answers
 * *was there anything at this grain to learn* — because if the per-line numbers
 * are facts about how each line was set, wearing a different line's must be
 * worse than wearing none.
 */
describe("wearing another line's correction", () => {
  it("is worse than no line correction at all, when the lines really differ", () => {
    const rows = corpus(PER_LINE);
    const page = splitHalfLadder(rows, "page");
    const wrong = splitHalfLadder(rows, "line", { shuffled: true });
    expect(wrong.heldOut.sdx).toBeGreaterThan(page.heldOut.sdx);
    expect(wrong.heldOut.over).toBeGreaterThan(page.heldOut.over);
  });

  it("refuses the bend too, when the bend is worn by the wrong line", () => {
    // The control has to be run at the new rung as well, or all that has been
    // shown is that a model with a third parameter fits better. What is *not*
    // claimed here is that a shuffled bend hurts more than a shuffled slope: on
    // this fixture every line bends the same way and only the offsets differ, so
    // the wrong line's bend is mostly the right bend on the wrong intercept.
    const rows = corpus(PER_LINE_CURVE);
    const page = splitHalfLadder(rows, "page");
    const right = splitHalfLadder(rows, "line-curve");
    const wrong = splitHalfLadder(rows, "line-curve", { shuffled: true });
    expect(wrong.heldOut.sdx).toBeGreaterThan(page.heldOut.sdx);
    expect(wrong.heldOut.over).toBeGreaterThan(page.heldOut.over);
    expect(wrong.heldOut.over).toBeGreaterThan(right.heldOut.over * 2);
  });

  it("makes almost no odds when the lines differ by nothing", () => {
    const rows = corpus(PAGE_ONLY);
    const right = splitHalfLadder(rows, "line");
    const wrong = splitHalfLadder(rows, "line", { shuffled: true });
    expect(wrong.heldOut.sdx).toBeCloseTo(right.heldOut.sdx, 1);
  });

  it("leaves the page grain alone, there being nothing to shuffle", () => {
    const rows = corpus(PAGE_ONLY, { pages: 3 });
    const a = shuffledCorrectionFor("page", rows);
    const b = correctionFor("page", rows);
    const r = rows[0];
    expect(a.apply(r)).toEqual(b.apply(r));
  });
});

/**
 * The trap the halved floor exists to close, on a corpus the size of a real page.
 *
 * A printed line carries about thirty-six marks. Split in half for a held-out
 * measurement it arrives at the fit with eighteen — under the production floor of
 * twenty, so it is refused and falls back to its page. What then gets measured is
 * not how well a per-line correction works but how many lines survived the
 * halving, and the answer comes back several times weaker than the truth. This
 * fixture has real per-line structure and thirty-six marks a line, so the only
 * thing separating the two readings below is the floor.
 */
describe("the floor a split-half measurement is held to", () => {
  const rows = corpus(PER_LINE, { per: 36 });
  const LINES = 8 * 15;
  const at = (floor, grain) => splitHalfLadder(rows, grain, { floor });

  // Not every line: the split is a coin, so a line of thirty-six lands a training
  // half of eighteen on average and occasionally of nine, and one of the hundred
  // and twenty here does. That is the floor doing its job rather than failing —
  // what matters is that it is one line and not two in three.
  // The fixture reproduces the real thing closely: it keeps a bit over a quarter
  // of its lines at the production floor, where the corpus kept 635 of 1,723.
  it("refuses most lines at the production floor and almost none at the halved one", () => {
    expect(at(FLOOR, "line").groups.lines).toBeLessThan(LINES * 0.5);
    expect(at(SPLIT_FLOOR, "line").groups.lines).toBeGreaterThan(LINES * 0.95);
  });

  it("reads the grain as weaker than it is when held to the production floor", () => {
    const page = at(SPLIT_FLOOR, "page");
    const strict = at(FLOOR, "line");
    const fair = at(SPLIT_FLOOR, "line");
    // Both are honest numbers about *something*; only the second is a number
    // about the grain. The refused lines drag the first back toward the page.
    expect(fair.heldOut.sdx).toBeLessThan(strict.heldOut.sdx);
    expect(strict.heldOut.sdx).toBeCloseTo(page.heldOut.sdx, 1);
  });

  it("is the default, so nobody has to remember it", () => {
    expect(splitHalfLadder(rows, "line").groups.lines).toBe(at(SPLIT_FLOOR, "line").groups.lines);
  });
});

describe("residualsUnder", () => {
  it("measures against the correction applied, and counts what is still badly out", () => {
    const rows = corpus(PAGE_ONLY, { pages: 2, per: 40, noise: 0 });
    const none = residualsUnder(rows, () => ({ dx: 0, dy: 0 }));
    const { apply } = correctionFor("page", rows);
    const fixed = residualsUnder(rows, apply);
    expect(none.over).toBe(100);
    expect(fixed.over).toBe(0);
    expect(fixed.med).toBeLessThan(0.01);
  });

  it("leaves out marks with no ink, which have no displacement to report", () => {
    const rows = corpus(PAGE_ONLY, { pages: 1, per: 40 });
    const blanked = rows.map((r, i) => (i % 2 ? { ...r, ink: 0 } : r));
    expect(residualsUnder(blanked, () => ({ dx: 0, dy: 0 })).n).toBe(rows.length / 2);
  });
});

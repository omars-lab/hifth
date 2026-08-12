/**
 * The estimators behind a placing session, on data where the answer is known.
 *
 * Every number `score-mark-nudge.mjs` prints ends up quoted into a register and
 * argued from months later, and an interval is the one part of that output
 * nobody can check by looking at it. A bracket half its true width reads exactly
 * like a bracket the right width, and the failure it causes — banking a residual
 * as real when it is not — is the failure that actually happened here once.
 *
 * So the fixtures are built so that the truth is a matter of construction rather
 * than of measurement: a value that is *entirely* the page it came from must
 * produce a page-clustered interval far wider than one that treats every
 * placement as its own fact, and a label with nothing behind it must fail to
 * explain anything.
 */
import { describe, expect, it } from "vitest";
import { clusteredCI, mean, meanCI, sd, slopeOf, spreadUnderSplit } from "./placement-stats.mjs";

/**
 * Ten pages, six placements each, where the value is the page's offset and
 * nothing else. This is the extreme of what the real session is a mild case of:
 * sixty numbers carrying ten pages' worth of information.
 */
function perfectlyClustered() {
  const offsets = [-0.4, -0.3, -0.25, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3, 0.45];
  const xs = [];
  const keys = [];
  offsets.forEach((o, p) => {
    for (let i = 0; i < 6; i += 1) {
      xs.push(o);
      keys.push(p);
    }
  });
  return { xs, keys };
}

describe("mean and sd", () => {
  it("are the ordinary ones, with sd on n-1", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(sd([1, 2, 3])).toBeCloseTo(1, 12);
    expect(sd([5])).toBe(0);
  });
});

describe("meanCI", () => {
  it("is symmetric about the mean and narrows as the square root of n", () => {
    const few = meanCI([1, 2, 3, 4]);
    const many = meanCI([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
    expect(few.m).toBeCloseTo(2.5, 12);
    expect(many.m).toBeCloseTo(2.5, 12);
    expect(few.hi - few.m).toBeCloseTo(few.m - few.lo, 12);
    expect(many.hi - many.lo).toBeLessThan(few.hi - few.lo);
  });

  it("refuses to pretend a single value has an interval", () => {
    const one = meanCI([0.3]);
    expect(one.lo).toBe(-Infinity);
    expect(one.hi).toBe(Infinity);
  });
});

describe("clusteredCI", () => {
  it("leaves the estimate alone and only touches what is claimed about it", () => {
    const { xs, keys } = perfectlyClustered();
    expect(clusteredCI(xs, keys).m).toBeCloseTo(meanCI(xs).m, 12);
  });

  it("is far wider when every value is its page", () => {
    const { xs, keys } = perfectlyClustered();
    const naive = meanCI(xs);
    const clustered = clusteredCI(xs, keys);
    expect(clustered.hi - clustered.lo).toBeGreaterThan(naive.hi - naive.lo);
    // Six identical values per page carry one page's worth of information, so
    // the honest interval is about √6 of the one that counts them separately —
    // a little wider still, because ten pages get the finite-cluster loading.
    const ratio = (clustered.hi - clustered.lo) / (naive.hi - naive.lo);
    expect(ratio).toBeGreaterThan(Math.sqrt(6));
    expect(ratio).toBeLessThan(Math.sqrt(6) * 1.1);
  });

  it("agrees with the naive interval when nothing shares a page", () => {
    const xs = [-0.4, -0.3, -0.25, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3, 0.45];
    const keys = xs.map((_, i) => i);
    const naive = meanCI(xs);
    const clustered = clusteredCI(xs, keys);
    // Not identical: one cluster per value differs from the naive estimator only
    // by the finite-cluster correction, which is what the ratio below is.
    expect((clustered.hi - clustered.lo) / (naive.hi - naive.lo)).toBeCloseTo(1, 1);
  });

  it("reports how many pages it had, since few clusters is still optimistic", () => {
    const { xs, keys } = perfectlyClustered();
    expect(clusteredCI(xs, keys).g).toBe(10);
    expect(clusteredCI(xs, keys).n).toBe(60);
  });

  it("declines rather than guesses when there is only one page", () => {
    const out = clusteredCI([0.1, 0.2, 0.3], [7, 7, 7]);
    expect(out.lo).toBe(-Infinity);
    expect(out.hi).toBe(Infinity);
    expect(out.g).toBe(1);
  });
});

describe("slopeOf", () => {
  it("recovers a slope it was given", () => {
    const xs = Array.from({ length: 40 }, (_, i) => -2 + i * 0.1);
    const ys = xs.map((x) => 3 + 0.7 * x);
    const out = slopeOf(xs, ys, xs.map((_, i) => i));
    expect(out.b).toBeCloseTo(0.7, 10);
    expect(out.a).toBeCloseTo(3, 10);
  });

  it("gives back nothing when the regressor does not vary", () => {
    const xs = Array.from({ length: 12 }, () => -1);
    const ys = xs.map((_, i) => i * 0.01);
    expect(slopeOf(xs, ys, xs.map((_, i) => i))).toBeNull();
  });

  it("reports the spread of the regressor, which is what says whether the slope could mean anything", () => {
    const wide = Array.from({ length: 30 }, (_, i) => -3 + i * 0.2);
    const narrow = Array.from({ length: 30 }, (_, i) => -1 + (i % 3) * 0.01);
    const keys = wide.map((_, i) => i);
    expect(slopeOf(wide, wide.map((x) => x), keys).spread).toBeGreaterThan(
      slopeOf(narrow, narrow.map((x) => x), keys).spread,
    );
  });

  it("widens the slope's interval when the points cluster", () => {
    // Ten pages, three points each; the page decides the y, the x within a page
    // is noise. Treating thirty points as thirty facts makes this look precise.
    const xs = [];
    const ys = [];
    const keys = [];
    for (let p = 0; p < 10; p += 1) {
      const lift = (p % 2 ? 1 : -1) * 0.5;
      for (let i = 0; i < 3; i += 1) {
        xs.push(p * 0.1 + i * 0.01);
        ys.push(lift);
        keys.push(p);
      }
    }
    const clustered = slopeOf(xs, ys, keys);
    const asIndependent = slopeOf(xs, ys, keys.map((_, i) => i));
    expect(clustered.se).toBeGreaterThan(asIndependent.se);
  });
});

describe("spreadUnderSplit", () => {
  it("says a meaningless label explains nothing", () => {
    // Values drawn from one process, labelled arbitrarily. A mean per label
    // fits the noise, and once it is charged for the parameters it used it
    // leaves at least as much spread as one mean did.
    const values = Array.from({ length: 36 }, (_, i) => Math.sin(i * 1.7) * 0.4);
    const labels = values.map((_, i) => `l${i % 9}`);
    const out = spreadUnderSplit(values, labels);
    expect(out.groups).toBe(9);
    expect(out.many).toBeGreaterThanOrEqual(out.one * 0.95);
  });

  it("says a real label explains a great deal", () => {
    const values = [];
    const labels = [];
    for (let g = 0; g < 4; g += 1) {
      for (let i = 0; i < 9; i += 1) {
        values.push(g * 2 + (i % 3) * 0.01);
        labels.push(`g${g}`);
      }
    }
    const out = spreadUnderSplit(values, labels);
    expect(out.many).toBeLessThan(out.one / 10);
  });

  it("declines when every value has its own label", () => {
    const values = [1, 2, 3];
    const out = spreadUnderSplit(values, ["a", "b", "c"]);
    expect(out.df).toBe(0);
    expect(Number.isNaN(out.many)).toBe(true);
  });
});

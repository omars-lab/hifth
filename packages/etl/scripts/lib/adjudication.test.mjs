/**
 * The session plan, on marks small enough to count by hand.
 *
 * What is worth asserting here is not that the page looks right — that is a
 * thing to look at, and there is a page for looking at it. It is that the
 * *design* of the session holds, because every one of these properties is a way
 * the result could be quietly worthless:
 *
 * - if the mix drifts, a session can end up with no catches and no way to know
 *   whether the person was paying attention;
 * - if the corrected rectangle sits in the same panel more often than not, a
 *   person who always presses the same key scores well and the count means
 *   nothing;
 * - if a decoy happens to point back at the as-shipped position, that trial is
 *   an as-shipped trial wearing the wrong label and it pollutes the yardstick;
 * - if the plan is not reproducible from the seed, the scorer rebuilds a
 *   different key and every number it prints is fiction.
 *
 * The marks below are invented. The point is the arithmetic over them, and
 * inventing them is what lets this run without the hundreds of megabytes of
 * corpus cache the real readers want.
 */
import { describe, expect, it } from "vitest";
import { planNudge, planSession, REPEAT_GAP, selectPages, START_R, windowFor } from "./adjudication.mjs";
import { shapeOf } from "./ink.mjs";

/** Twelve pages of forty marks, each a plausible size, all of them solid ink. */
const io = {
  marksFor: (page) =>
    Array.from({ length: 40 }, (_, k) => ({
      page,
      k,
      name: "fatha",
      surah: 1,
      aya: 1 + (k % 7),
      idx: k,
      box: [20 + (k % 8) * 30, 30 + Math.floor(k / 8) * 40, 4 + (k % 3), 3 + (k % 2)],
      d: "M0 0",
      fit: { sx: 1, sy: 1, tx: 0, ty: 0 },
    })),
  // One rectangle covering the whole page, so every candidate clears the ink
  // floor and the pool is decided by the walk rather than by the ink.
  inkFor: () => [shapeOf([[0, 0, 400, 0, 400, 600, 0, 600]], "nonzero")],
};

const shifts = Array.from({ length: 12 }, (_, i) => ({ page: i + 1, dx: -0.7, dy: -1.05, n: 40 }));
const plan = (over = {}) => planSession({ seed: 3, count: 120, shifts, io, ...over });

describe("planSession", () => {
  it("is rebuilt exactly from the seed, which is the only place the answers live", () => {
    expect(JSON.stringify(plan().trials)).toBe(JSON.stringify(plan().trials));
    expect(JSON.stringify(plan().trials)).not.toBe(JSON.stringify(plan({ seed: 4 }).trials));
  });

  it("carries every kind, so no session is missing its own controls", () => {
    const mix = {};
    for (const t of plan().trials) mix[t.kind] = (mix[t.kind] ?? 0) + 1;
    expect(mix.shipped).toBeGreaterThan(mix.catch);
    expect(mix.decoy).toBeGreaterThan(10);
    expect(mix.catch).toBeGreaterThan(5);
    expect(mix.twin).toBeGreaterThan(2);
    expect(mix.shipped + mix.decoy + mix.catch + mix.twin).toBe(120);
  });

  it("does not favour a panel, so pressing the same key every time scores half", () => {
    const answered = plan().trials.filter((t) => t.answer !== null);
    const left = answered.filter((t) => t.answer === 0).length;
    expect(Math.abs(left / answered.length - 0.5)).toBeLessThan(0.12);
  });

  it("puts the corrected rectangle in both panels of a twin, so there is nothing to be right about", () => {
    for (const t of plan().trials.filter((x) => x.kind === "twin")) {
      expect(t.slots[0]).toEqual(t.slots[1]);
      expect(t.answer).toBeNull();
    }
  });

  it("moves an as-shipped trial's other rectangle to exactly where the app draws it today", () => {
    for (const t of plan().trials.filter((x) => x.kind === "shipped")) {
      expect(t.slots[1 - t.answer]).toEqual([0, 0]);
    }
  });

  it("displaces a decoy the same distance as the correction, and never back towards it", () => {
    for (const t of plan().trials.filter((x) => x.kind === "decoy")) {
      const right = t.slots[t.answer];
      const other = t.slots[1 - t.answer];
      const mag = Math.hypot(right[0], right[1]);
      const moved = Math.hypot(other[0] - right[0], other[1] - right[1]);
      expect(moved).toBeCloseTo(mag, 6);
      // A decoy that landed near the as-shipped position would be an as-shipped
      // trial counted as the yardstick, which would flatter both numbers.
      expect(Math.hypot(other[0], other[1])).toBeGreaterThan(0.3 * mag);
    }
  });

  it("keeps both rectangles inside the window, so no trial is answerable by counting boxes", () => {
    for (const t of plan().trials) {
      const side = windowFor(t.box);
      const [, , w, h] = t.box;
      for (const [dx, dy] of t.slots) {
        expect(Math.abs(dx) + w / 2 + Math.abs(t.jitter[0])).toBeLessThan(side / 2);
        expect(Math.abs(dy) + h / 2 + Math.abs(t.jitter[1])).toBeLessThan(side / 2);
      }
    }
  });

  it("spreads over the pages that have a displacement rather than dwelling on a few", () => {
    expect(plan().pages).toBe(shifts.length);
  });

  it("refuses rather than shortening when there are not enough marks with ink under the box", () => {
    expect(() => planSession({ seed: 3, count: 120, shifts: shifts.slice(0, 1), io })).toThrow(/passed the ink floor/);
  });
});

/**
 * The other session: no choosing, only placing.
 *
 * The failure modes here are different in kind from the forced choice's, and
 * each assertion below is one of them:
 *
 * - if a rectangle could start near where it belongs, somebody could land on an
 *   answer by not moving, and "I left it alone" would be counted as agreement;
 * - if the starting directions leaned one way, the pull a hand exerts on its own
 *   landing would be baked into the residual as though it were a fact about the
 *   boxes;
 * - if the two showings of a repeated mark sat close together, the spread
 *   between them would measure memory rather than precision — and the residual
 *   is divided by that number;
 * - if the correction reached the page, none of it would mean anything at all.
 */
const nudge = (over = {}) => planNudge({ seed: 5, count: 60, shifts, io, ...over });

describe("planNudge", () => {
  it("is rebuilt exactly from the seed, since the correction is subtracted afterwards", () => {
    expect(JSON.stringify(nudge().trials)).toBe(JSON.stringify(nudge().trials));
    expect(JSON.stringify(nudge().trials)).not.toBe(JSON.stringify(nudge({ seed: 6 }).trials));
  });

  it("starts every rectangle the same distance out, so no placement is free", () => {
    for (const t of nudge().trials) {
      expect(Math.hypot(t.start[0], t.start[1])).toBeCloseTo(START_R, 6);
      // Well clear of both placements the forced choice would have offered — the
      // shipped box at nought and the correction about a unit from it — so
      // leaving the rectangle where it appeared is never an answer.
      expect(Math.hypot(t.start[0] - t.shift[0], t.start[1] - t.shift[1])).toBeGreaterThan(1);
    }
  });

  it("spreads the starting directions, so a hand's pull towards its start cancels", () => {
    const { trials } = nudge();
    const mx = trials.reduce((s, t) => s + t.start[0], 0) / trials.length;
    const my = trials.reduce((s, t) => s + t.start[1], 0) / trials.length;
    expect(Math.hypot(mx, my)).toBeLessThan(START_R * 0.25);
  });

  it("shows some marks twice, far enough apart that the second is a fresh judgement", () => {
    const { trials, repeats } = nudge();
    const seen = new Map();
    for (const t of trials) {
      if (!seen.has(t.id)) seen.set(t.id, []);
      seen.get(t.id).push(t);
    }
    const twice = [...seen.values()].filter((g) => g.length === 2);
    expect(twice.length).toBe(repeats);
    expect(repeats).toBeGreaterThan(2);
    for (const [a, b] of twice) {
      expect(b.i - a.i).toBeGreaterThanOrEqual(REPEAT_GAP);
      // Independent starts, or the pair measures whether somebody repeats a
      // gesture rather than whether they repeat a judgement.
      expect(a.start).not.toEqual(b.start);
    }
  });

  it("keeps the rectangle inside its window at the start, so no trial opens as a hunt", () => {
    for (const t of nudge().trials) {
      const side = windowFor(t.box);
      const [, , w, h] = t.box;
      expect(Math.abs(t.start[0]) + w / 2 + Math.abs(t.jitter[0])).toBeLessThan(side / 2);
      expect(Math.abs(t.start[1]) + h / 2 + Math.abs(t.jitter[1])).toBeLessThan(side / 2);
    }
  });

  it("adds up to what was asked for, and spreads over every page with a displacement", () => {
    const { trials, pages } = nudge();
    expect(trials.length).toBe(60);
    expect(trials.map((t, i) => t.i - i).every((d) => d === 0)).toBe(true);
    expect(pages).toBe(shifts.length);
  });

  it("carries which mark it means, so a trial is never about whichever one you picked", () => {
    // A crop of print holds several marks and often two of the same name. If the
    // trial cannot say which, a reader either guesses or places the rectangle on
    // the wrong one — and a placement on the wrong mark is a whole-letter error
    // that would be scored as a registration error. The identification has to
    // travel with the trial, not be recoverable from it later.
    const named = {
      marksFor: (page) =>
        io.marksFor(page).map((mk, k) => ({
          ...mk,
          lig: { text: "AB", letters: ["M0 0", "M1 1"] },
          nth: (k % 2) + 1,
          of: 2,
        })),
      inkFor: io.inkFor,
    };
    for (const t of planNudge({ seed: 5, count: 60, shifts, io: named }).trials) {
      expect(t.lig).toEqual({ text: "AB", letters: ["M0 0", "M1 1"] });
      expect(t.of).toBe(2);
      expect([1, 2]).toContain(t.nth);
    }
  });

  it("still says something about a mark the corpus placed inside no ligature", () => {
    // The fixture above has none of the identification fields, which is the
    // shape a mark drawn under a word but outside every ligature group arrives
    // in. The page must still be buildable from it: one of one, no letters, and
    // the builder says so in words rather than pointing at a tint that is not
    // there.
    for (const t of nudge().trials) {
      expect(t.lig).toBe(null);
      expect(t.nth).toBe(1);
      expect(t.of).toBe(1);
    }
  });

  it("refuses rather than shortening when there are not enough marks with ink under the box", () => {
    expect(() => planNudge({ seed: 5, count: 600, shifts: shifts.slice(0, 1), io })).toThrow(/passed the ink floor/);
  });
});

/**
 * Twenty pages whose corrections genuinely differ, which the twelve above do not
 * — they all carry the same displacement, because what they are there to exercise
 * is the walk. Choosing pages is arithmetic over the displacements themselves, so
 * it needs a fixture where the displacements vary, and vary in a shape a person
 * can check by eye: `dx` walks from -1.9 up to -0.0, and `dy` runs the other way.
 */
const varied = Array.from({ length: 20 }, (_, i) => ({
  page: i + 1,
  dx: -1.9 + i * 0.1,
  dy: -0.2 - i * 0.1,
  n: 40,
}));

describe("selectPages", () => {
  it("never returns a page that was held out, which is the whole point of holding one out", () => {
    // A sitting exists to say whether the correction works where it was not
    // fitted. One page from the fitted set leaking in does not merely dilute
    // that — it makes the claim untrue, and nothing downstream can detect it.
    const exclude = [3, 4, 5, 6, 7, 8, 9, 10];
    const got = selectPages({ shifts: varied, exclude, pages: 8 });
    expect(got).toHaveLength(8);
    for (const p of got) expect(exclude).not.toContain(p);
  });

  it("takes the ends rather than the middle, because the middle is the sample that already failed", () => {
    // The first sitting could not measure the correction's *size* because the
    // proposed move barely varied across its pages. A regression on a quantity
    // that does not vary has no leverage, so the estimate came out ±0.68 on a
    // number of interest around 0.1. Spanning the range is what buys it back.
    const chosen = selectPages({ shifts: varied, pages: 8 });
    const dx = chosen.map((p) => varied[p - 1].dx);
    const span = Math.max(...dx) - Math.min(...dx);
    const middle = varied.slice(6, 14).map((s) => s.dx);
    expect(span).toBeGreaterThan(Math.max(...middle) - Math.min(...middle));
    expect(span).toBeGreaterThan(1.5);
  });

  it("spans both axes, since a correction can be right across and wrong down", () => {
    const chosen = selectPages({ shifts: varied, pages: 8 });
    for (const k of ["dx", "dy"]) {
      const v = chosen.map((p) => varied[p - 1][k]);
      expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(1.5);
    }
  });

  it("gives the same list every time, or a banked sitting cannot be re-scored", () => {
    // The scorer replays the recorded list rather than re-running this, so a
    // wobble here would not corrupt an old reading — but it would mean two
    // builds of the "same" session were different sessions, which is the bug
    // that is hardest to see and hardest to believe once seen.
    const once = selectPages({ shifts: varied, pages: 7, exclude: [2, 19] });
    for (let i = 0; i < 5; i += 1) {
      expect(selectPages({ shifts: varied, pages: 7, exclude: [2, 19] })).toEqual(once);
    }
  });

  it("keeps every page when nothing is asked for, which is what every session did before", () => {
    expect(selectPages({ shifts: varied, pages: 0 })).toEqual(varied.map((s) => s.page));
    expect(selectPages({ shifts: varied, pages: 999 })).toEqual(varied.map((s) => s.page));
    expect(selectPages({ shifts: varied, pages: 4, spread: "all" })).toEqual(varied.map((s) => s.page));
  });

  it("narrows what planNudge may ask about, so the two agree on what a trial index means", () => {
    // The join that makes the whole scheme work: the pages come out of here and
    // go into the plan as its entire universe. If a page the selection excluded
    // could still appear in a trial, the recorded list would be a description of
    // the session rather than a definition of it, and replaying it would prove
    // nothing.
    const chosen = selectPages({ shifts: varied, pages: 6, exclude: [1, 20] });
    const byPage = new Map(varied.map((s) => [s.page, s]));
    const { trials } = planNudge({ seed: 9, count: 30, shifts: chosen.map((p) => byPage.get(p)), io });
    expect(new Set(trials.map((t) => t.page))).toEqual(new Set(chosen));
  });
});

/**
 * The refusals, on transcripts built to be wrong in one way each.
 *
 * Every other test in this package imports a module and checks a number. This one
 * runs the script, because what is worth holding here is not an estimator — it is
 * the four things the scorer will not do, and all four live in the top-level flow
 * where a `die()` ends the process. Extracting them into a lib to make them
 * importable would leave the tested copy and the running copy as two different
 * things, which is the failure the test exists to prevent.
 *
 * The failure they guard against is quiet and expensive. A sitting is half an hour
 * of the scarcest thing in this project, and every one of these mistakes produces a
 * *plausible* number rather than an error: answers about marks that were never on
 * the screen, answers about one placement rule filed against the other, a rate that
 * counts a defect in somebody else's print as our error. A wrong percentage looks
 * exactly like a right one, gets quoted into a register, and is argued from months
 * later by somebody who was not here.
 *
 * So the fixtures are built so the truth is a matter of construction: a row whose
 * match is convincing and whose search had room is in the ink population *by
 * definition*, and a transcript that claims otherwise must stop the run rather
 * than be read.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "score-mark-report.mjs");

/**
 * A fourth copy of the hash, written from the algorithm rather than copied from
 * the script. The instruments each carry their own on purpose — a shared helper
 * would let a change to it silently re-bless every ruling ever made — and this
 * copy is what makes that arrangement checkable instead of merely stated.
 */
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const RADIUS = 3;
const IOU = 0.55;

/**
 * Forty marks on one line of one page — one line rather than several so the line
 * grain clears its twenty-mark floor and the fallback rows are corrected by a fit
 * that actually ran, and one page so the page median exists.
 *
 * Twenty-four are in the ink population and sixteen are not, and the sixteen are
 * split between the two ways out of it: fifteen whose best match is unconvincing,
 * and one — `1:24` — whose match is excellent but which reached the edge of the
 * search window, so the true best may lie outside it and was never seen. That one
 * is the whole reason the population test is two clauses rather than one.
 */
const ROWS = Array.from({ length: 40 }, (_, k) => ({
  page: 1,
  k,
  line: 1,
  name: "kasra",
  box: [180 - k * 4, 40, 5.6, 3.6],
  ink: 0.1,
  dx: k === 24 ? RADIUS : 0.5,
  dy: -0.25,
  iou0: 0,
  iouBest: k <= 24 ? 0.8 : 0.2,
  phi0: 0,
  nullPhi: 0,
}));
const INK_IDS = ROWS.filter((r) => r.iouBest >= IOU && Math.abs(r.dx) !== RADIUS).map((r) => `${r.page}:${r.k}`);
const FALLBACK_IDS = ROWS.map((r) => `${r.page}:${r.k}`).filter((id) => !INK_IDS.includes(id));

let dir;
let rowsPath;
let fp;
let nth = 0;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-score-"));
  rowsPath = join(dir, "rows.json");
  const text = JSON.stringify(ROWS);
  writeFileSync(rowsPath, text);
  fp = fingerprint(text);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A transcript on disk, with the head the builder would have stamped. */
function sit(over = {}) {
  const doc = {
    built: "mark-report",
    rows: rowsPath,
    rowsFingerprint: fp,
    set: "placed",
    seed: 23,
    radius: RADIUS,
    iouFloor: IOU,
    pool: ROWS.length,
    of: ROWS.length,
    shown: 10,
    drawnBy: { ink: 10 },
    finished: true,
    seen: 10,
    said: [],
    ...over,
  };
  const path = join(dir, `sitting-${(nth += 1)}.json`);
  writeFileSync(path, JSON.stringify(doc));
  return path;
}

function run(...args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    return { code: 0, out, err: "" };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
}

/** An answer, with the population it really came from filled in by construction. */
const say = (id, kind, extra = {}) => ({
  id,
  kind,
  rule: INK_IDS.includes(id) ? "ink" : "line-tilt",
  page: 1,
  line: 1,
  name: "kasra",
  ...extra,
});

describe("what it refuses to read", () => {
  it("stops on a sitting made against different displacements", () => {
    const { code, err } = run(sit({ rowsFingerprint: "deadbeef" }));
    expect(code).toBe(2);
    expect(err).toMatch(/deadbeef/);
    expect(err).toMatch(/never on the screen/);
  });

  it("stops when an answer disagrees with the displacements about which rule drew it", () => {
    const id = INK_IDS[0];
    const { code, err } = run(sit({ said: [{ ...say(id, "placement", { by: [0.4, 0.1] }), rule: "line-tilt" }] }));
    expect(code).toBe(2);
    expect(err).toMatch(new RegExp(`${id}: says line-tilt, is ink`));
    expect(err).toMatch(/one option against the other/);
  });

  it("stops on an answer naming a mark the displacements do not have", () => {
    const { code, err } = run(sit({ said: [{ ...say(INK_IDS[0], "wrong-shape"), id: "1:999" }] }));
    expect(code).toBe(2);
    expect(err).toMatch(/1:999/);
    expect(err).toMatch(/hand-edited/);
  });

  it("stops on a file that is not one of these sittings at all", () => {
    const { code, err } = run(sit({ built: "mark-nudge" }));
    expect(code).toBe(2);
    expect(err).toMatch(/not a mark-report transcript/);
  });

  it("stops when the displacements it names are gone, and says the flag that fixes it", () => {
    const { code, err } = run(sit({ rows: join(dir, "moved-away.json") }));
    expect(code).toBe(2);
    expect(err).toMatch(/--rows/);
  });

  it("re-derives a rule the transcript never carried, and says it did", () => {
    const said = [{ ...say(INK_IDS[0], "wrong-shape"), rule: undefined }];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/1 answers carried no rule and were re-derived/);
    expect(out).toMatch(/── ink —/);
  });
});

describe("the two populations", () => {
  it("are reported apart and never summed", () => {
    const said = [say(INK_IDS[0], "wrong-shape"), say(FALLBACK_IDS[0], "wrong-shape")];
    const { code, out } = run(sit({ set: "mixed", shown: 20, seen: 20, drawnBy: { ink: 12, "line-tilt": 8 }, said }));
    expect(code).toBe(0);
    expect(out).toMatch(/── ink — the marks placed from their own ink ──/);
    expect(out).toMatch(/── line-tilt — the marks that inherited the printed line ──/);
    // Each population's denominator is its own share of the cards, not the sitting.
    expect(out).toMatch(/12 marks looked at/);
    expect(out).toMatch(/8 marks looked at/);
    expect(out).toMatch(/are reported apart above\. They are not\nsummed/);
    // No line anywhere adds the two together into one figure for the sitting.
    expect(out).not.toMatch(/of 20 gradable marks/);
  });

  it("puts a mark whose search reached the edge in the fallback set, however good its match", () => {
    // 1:24 matches at 0.8, well over the floor, and is still not placed from ink.
    expect(FALLBACK_IDS).toContain("1:24");
    const { code, out } = run(sit({ set: "fallback", drawnBy: { "line-tilt": 10 }, said: [say("1:24", "wrong-shape")] }));
    expect(code).toBe(0);
    expect(out).toMatch(/── line-tilt —/);
    expect(out).not.toMatch(/── ink —/);
  });
});

describe("what counts as our error", () => {
  it("takes a defect in the print out of the denominator, and prints the rate both ways", () => {
    const said = [
      say(INK_IDS[0], "placement", { by: [0.4, 0.1] }),
      say(INK_IDS[1], "print-defect", { note: "the alif is broken in the print" }),
    ];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    // One fault, ten cards, one of them ungradable: 1/9, and 1/10 counted in.
    expect(out).toMatch(/1 of 9 gradable marks — 11\.1%/);
    expect(out).toMatch(/the rate would read 10\.0%/);
    expect(out).toMatch(/the alif is broken in the print/);
  });

  it("leaves a banked answer in neither column", () => {
    const said = [say(INK_IDS[0], "exception", { note: "could not tell" })];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/0 of 10 gradable marks/);
    expect(out).toMatch(/1 more was banked as could-not-say/);
  });

  it("does not fail the run for bad news", () => {
    const said = INK_IDS.slice(0, 10).map((id) => say(id, "wrong-shape"));
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/10 of 10 gradable marks — 100\.0%/);
  });

  /**
   * A reader who thinks the print itself is wrong still puts the rectangle where they
   * think it belongs, so a mark carries both words at once — and most of the fourteen
   * called odd in the real sitting also carried a move. Taking such a mark out of the
   * denominator while leaving it in the numerator counts it as our error and refuses to
   * count it as an opportunity for one. It produced 112.9% and an interval of NaN to
   * NaN on a real transcript, which is at least absurd on its face; the same mistake
   * over a third of the cards would have looked like a measurement.
   */
  it("keeps a mark called odd in the print out of both ends of the rate, not just one", () => {
    const said = [
      say(INK_IDS[0], "placement", { by: [0.4, 0.1] }),
      // The same mark, both words. It must leave the rate entirely.
      say(INK_IDS[1], "placement", { by: [0.2, 0.2] }),
      say(INK_IDS[1], "print-defect", { note: "the tooth is missing here" }),
    ];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/1 of 9 gradable marks — 11\.1%/);
    expect(out).not.toMatch(/NaN/);
    // Counted in, both are faults over all ten — which is the other reading, and the
    // gap between the two is what that sentence exists to show.
    expect(out).toMatch(/the rate would read 20\.0%/);
  });
});

/**
 * The denominator is the count of marks put in front of somebody, and the sitting page
 * is the only thing that can know it. So the scorer takes it on trust — and it was
 * wrong once, in a way that was invisible until the percentages went over a hundred:
 * the page started reporting how much of the sitting was LEFT rather than how much of
 * it had happened, and a transcript arrived claiming nineteen marks looked at while
 * carrying answers about a hundred and fifteen.
 *
 * There is exactly one thing the scorer can check here without leaving the file, and
 * this is it. It is arithmetic rather than judgement, so it holds against instruments
 * that have not been written yet.
 */
describe("a denominator smaller than its own numerator", () => {
  it("is raised to the fewest marks the file can be describing, and says so", () => {
    const said = INK_IDS.slice(0, 6).map((id) => say(id, "wrong-shape"));
    const { code, out } = run(sit({ said, seen: 2 }));
    expect(code).toBe(0);
    expect(out).toMatch(/says it looked at 2 marks and says something about 6 of them/);
    expect(out).toMatch(/6 marks looked at/);
    expect(out).toMatch(/6 of 6 gradable marks — 100\.0%/);
    // Read as an upper bound, because the floor is the smallest denominator the file
    // can support and therefore the largest rate.
    expect(out).toMatch(/upper bound and not as a measurement/);
  });

  it("says nothing when the count is merely larger than the answers, which is normal", () => {
    const said = INK_IDS.slice(0, 6).map((id) => say(id, "wrong-shape"));
    const { code, out } = run(sit({ said, seen: 10 }));
    expect(code).toBe(0);
    expect(out).not.toMatch(/cannot both be true/);
    expect(out).toMatch(/6 of 10 gradable marks — 60\.0%/);
  });
});

describe("saying nothing is wrong", () => {
  it("does not count an affirmation as a fault", () => {
    const said = INK_IDS.slice(0, 10).map((id) => say(id, "looks-right"));
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/0 of 10 gradable marks/);
    expect(out).toMatch(/10 said outright that nothing was wrong · 0 passed in silence/);
  });

  it("keeps it out of the table of what was wrong", () => {
    const { code, out } = run(sit({ said: [say(INK_IDS[0], "looks-right")] }));
    expect(code).toBe(0);
    // A row reading "nothing wrong 1 — 10.0%" in that table is the misread this avoids.
    expect(out).not.toMatch(/nothing wrong with it/);
  });

  it("says how much of the denominator was passed in silence rather than affirmed", () => {
    const said = [say(INK_IDS[0], "looks-right"), say(INK_IDS[1], "wrong-shape")];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    // Ten looked at, two spoken about, so eight went by on Next alone.
    expect(out).toMatch(/1 said outright that nothing was wrong · 8 passed in silence/);
    expect(out).toMatch(/the rate leans on the passing/);
  });

  it("tells a sitting that predates the button from one that was skimmed", () => {
    const { code, out } = run(sit({ said: [say(INK_IDS[0], "wrong-shape")] }));
    expect(code).toBe(0);
    expect(out).toMatch(/Nothing here was affirmed out loud/);
    expect(out).toMatch(/before the affirmation button existed/);
  });

  it("prints a mark called fine and then faulted, and counts the fault", () => {
    const id = INK_IDS[0];
    const said = [say(id, "looks-right"), say(id, "placement", { by: [0.4, 0.1] })];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/1 of 10 gradable marks/);
    expect(out).toMatch(new RegExp(`1 mark was called fine and also faulted: ${id}`));
    expect(out).toMatch(/Counted as faults above/);
  });
});

describe("what the sitting can support", () => {
  it("bounds a clean result rather than zeroing it", () => {
    const { code, out } = run(sit({ shown: 60, seen: 60, drawnBy: { ink: 60 }, said: [say(INK_IDS[0], "print-defect", { note: "smudge" })] }));
    expect(code).toBe(0);
    // 3/59 — the bound a clean sixty actually carries, which is not zero.
    expect(out).toMatch(/bounds the rate at about 5\.1% — not at zero/);
    expect(out).toMatch(/not a clean bill of health/);
  });

  it("refuses a denominator it does not have, and prints both readings", () => {
    const said = [say(INK_IDS[0], "wrong-shape"), say(INK_IDS[1], "wrong-shape")];
    const { code, out } = run(sit({ seen: null, said }));
    expect(code).toBe(0);
    expect(out).toMatch(/does not record how far the reader got/);
    expect(out).toMatch(/Between 2 and 10 marks were looked at/);
  });

  it("says nothing about the population it did not draw from", () => {
    const { code, out } = run(sit({ said: [say(INK_IDS[0], "wrong-shape")] }));
    expect(code).toBe(0);
    expect(out).toMatch(/nothing whatever about the other population — see the fallback sitting/);
  });
});

describe("the distances, which are not the rate", () => {
  /**
   * The fixture that would have caught the scorer printing 0.000 on a sitting where
   * every mark had been dragged.
   *
   * One mark is settled in three goes — half a unit across, four tenths back, four
   * tenths out again — and a second is moved half a unit and left alone. Both end up
   * exactly half a unit from where we drew them, so the answer is half a unit, said
   * by two marks. Reading the goes instead gives four rows, two of which are the
   * reader changing their mind, and a median that is neither mark's answer.
   *
   * `to` is a running total measured from the uncorrected box, so each one here is
   * the row's own displacement plus the hand so far — which is what the sitting
   * writes, and what the subtraction in the scorer has to undo.
   */
  const NUDGED = INK_IDS[0];
  const ONCE = INK_IDS[1];
  const D = [0.5, -0.25]; // the displacement every ink row in the fixture carries
  const at = (hx, hy) => [D[0] + hx, D[1] + hy];

  it("gives every mark one row, however many goes it took to settle", () => {
    const said = [
      say(NUDGED, "placement", { by: [0.5, 0], to: at(0.5, 0) }),
      say(NUDGED, "placement", { by: [-0.4, 0], to: at(0.1, 0) }),
      say(NUDGED, "placement", { by: [0.4, 0], to: at(0.5, 0) }),
      say(ONCE, "placement", { by: [0.5, 0], to: at(0.5, 0) }),
    ];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    // Half a unit, not the 0.45 that medianing the four goes would have printed.
    expect(out).toMatch(/median 0\.500 · p90 0\.500 · worst 0\.500/);
    expect(out).toMatch(/across 0\.500 · down 0\.000 — medians, signed/);
    expect(out).toMatch(/2 marks, one row each, settled over 4 separate nudges and drags/);
    expect(out).toMatch(/never combined/);
  });

  it("prints the hand and the whole correction as two numbers under two sentences", () => {
    const said = [say(NUDGED, "placement", { by: [0.5, 0], to: at(0.5, 0) })];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    // The reader's own hand: half a unit across, nothing down.
    expect(out).toMatch(/hand moved the rectangle we drew[\s\S]*?across 0\.500 · down 0\.000/);
    // And the whole correction their answer implies, our own displacement included.
    expect(out).toMatch(/before any correction:\n {4}across 1\.000 · down -0\.250/);
    expect(out).toMatch(/the two\n {4}are never differenced/);
  });

  it("says so when a mark took several goes to settle", () => {
    const said = [
      say(NUDGED, "placement", { by: [0.1, 0], to: at(0.1, 0) }),
      say(NUDGED, "placement", { by: [0.1, 0], to: at(0.2, 0) }),
      say(NUDGED, "placement", { by: [0.1, 0], to: at(0.3, 0) }),
    ];
    const { code, out } = run(sit({ said }));
    expect(code).toBe(0);
    expect(out).toMatch(/a finding about the pad rather than about the print/);
  });

  it("measures the reader's own rectangle against where we drew ours", () => {
    // An ink-placed mark is drawn at its box plus its own displacement, so a reader
    // box built there is the case where we were right — zero apart, same size.
    const r = ROWS.find((x) => `${x.page}:${x.k}` === INK_IDS[0]);
    const at = [r.box[0] + r.dx, r.box[1] + r.dy, r.box[2], r.box[3]];
    const { code, out } = run(sit({ said: [say(INK_IDS[0], "intended-ink", { box: at })] }));
    expect(code).toBe(0);
    expect(out).toMatch(/centres apart — median 0\.000 units · worst 0\.000/);
    expect(out).toMatch(/their area over ours — median 1\.00×/);
  });
});

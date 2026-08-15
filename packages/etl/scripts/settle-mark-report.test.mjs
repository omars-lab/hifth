/**
 * The ruling a sitting turns into, on transcripts built to be wrong in one way each.
 *
 * The settling rule itself is held next door, in lib/mark-settle.test.mjs. What is
 * held here is everything the script does *around* it, and all of it is the kind of
 * mistake that produces a plausible document rather than an error: a distance
 * measured from the wrong origin, a denominator smaller than its own numerator, a
 * defect in somebody else's print written down as ours, two sittings taken against
 * different rectangles filed under one row.
 *
 * A ruling is the thing that outlives the hour that produced it. It gets committed,
 * quoted with a line number, and argued from by somebody who was not in the room —
 * so a number in it that is quietly the wrong number is expensive in a way a wrong
 * number in a terminal is not.
 *
 * The script is run rather than imported, the same choice the scorer's tests make
 * and for the same reason: the refusals live in the top-level flow where a `die()`
 * ends the process, and lifting them somewhere importable would leave the tested
 * copy and the running copy as two different things.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "settle-mark-report.mjs");
const ROOT = join(HERE, "../../..");

/**
 * A fifth copy of the hash, written from the algorithm rather than copied from the
 * script. The instruments each carry their own on purpose — a shared helper would
 * let a change to it silently re-bless every ruling ever made — and the copies in
 * the tests are what make that arrangement checkable instead of merely stated.
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
 * Ten marks on one line of one page. Marks 0-4 are placed from their own ink and
 * 5-9 are not, so both populations are present by construction rather than by a
 * threshold anybody has to trust; `1:5` is the one whose match is excellent and
 * whose search ran into the edge of the window, which is why the population test
 * has two clauses.
 *
 * The displacements are deliberately not round: every mark is drawn 0.5 across and
 * 0.25 up from the box we ship, which is what makes the two distances below
 * different numbers instead of the same number twice.
 */
const ROWS = Array.from({ length: 10 }, (_, k) => ({
  page: 1,
  k,
  line: 1,
  name: "fatha",
  box: [180 - k * 8, 40, 5.6, 3.6],
  ink: 0.1,
  dx: k === 5 ? RADIUS : 0.5,
  dy: -0.25,
  iou0: 0,
  iouBest: k <= 5 ? 0.8 : 0.2,
  phi0: 0,
  nullPhi: 0,
}));
const INK_IDS = ROWS.filter((r) => r.iouBest >= IOU && Math.abs(r.dx) !== RADIUS).map((r) => `${r.page}:${r.k}`);

let dir;
let rowsPath;
let fp;
let nth = 0;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "hifth-settle-"));
  rowsPath = join(dir, "rows.json");
  const text = JSON.stringify(ROWS);
  writeFileSync(rowsPath, text);
  fp = fingerprint(text);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A transcript on disk, with the head the sitting page would have stamped. */
function sit(over = {}) {
  const doc = {
    built: "mark-report",
    rows: rowsPath,
    rowsFingerprint: fp,
    set: "fallback",
    slice: "-p1of16-abc",
    seed: 23,
    radius: RADIUS,
    iouFloor: IOU,
    pool: ROWS.length,
    of: ROWS.length,
    shown: 10,
    finished: "2026-08-15T12:47:08.769Z",
    seen: 10,
    whole: true,
    said: [],
    ...over,
  };
  const path = join(dir, `sitting-${(nth += 1)}.json`);
  writeFileSync(path, JSON.stringify(doc));
  return path;
}

/** Always into the scratch directory: a test must never write a real ruling. */
function run(...args) {
  const out = join(dir, `ruling-${nth}.json`);
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args, "--out", out], { encoding: "utf8" });
    return { code: 0, out: stdout, err: "", ruling: JSON.parse(readFileSync(out, "utf8")) };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? "", err: e.stderr ?? "", ruling: null };
  }
}

const ev = (id, kind, extra = {}) => ({
  id,
  kind,
  page: 1,
  line: 1,
  name: "fatha",
  rule: INK_IDS.includes(id) ? "ink" : "line-tilt",
  ...extra,
});

describe("what it refuses to read", () => {
  it("stops on sittings taken against different rectangles", () => {
    const { code, err } = run(sit(), sit({ rowsFingerprint: "deadbeef" }));
    expect(code).toBe(2);
    expect(err).toMatch(/different displacements/);
    expect(err).toMatch(/two different rectangles under one row/);
  });

  it("stops when the displacements on disk are not the ones the sitting was taken against", () => {
    const moved = join(dir, "other-rows.json");
    writeFileSync(moved, JSON.stringify(ROWS.slice(0, 9)));
    const { code, err } = run(sit(), "--rows", moved);
    expect(code).toBe(2);
    expect(err).toMatch(/never on the screen/);
  });

  it("stops when an answer disagrees with the displacements about which rule drew it", () => {
    const said = [{ ...ev(INK_IDS[0], "placement", { by: [0.4, 0.1], to: [0.9, -0.15] }), rule: "line-tilt" }];
    const { code, err } = run(sit({ said }));
    expect(code).toBe(2);
    expect(err).toMatch(/says line-tilt, is ink/);
  });

  it("stops on an answer naming a mark the displacements do not have", () => {
    const { code, err } = run(sit({ said: [ev("1:999", "wrong-shape", { size: [7, 6], was: [5.6, 3.6] })] }));
    expect(code).toBe(2);
    expect(err).toMatch(/1:999/);
    expect(err).toMatch(/hand-edited/);
  });

  it("stops on a file that is not one of these sittings at all", () => {
    const { code, err } = run(sit({ built: "mark-nudge" }));
    expect(code).toBe(2);
    expect(err).toMatch(/not a mark-report transcript/);
  });
});

describe("the two distances, which are two different questions", () => {
  /**
   * `hand` is how far the reader moved the rectangle *we drew them*; `to` is measured
   * from the raw box and so carries our correction as well as theirs. The gap between
   * them is exactly the correction, never a disagreement between two instruments, and
   * reading it as one has already misled somebody here. The fixture makes the two
   * numbers differ by construction: every mark is drawn 0.5 across and 0.25 up.
   */
  it("keeps the reader's own hand apart from where they landed against what ships", () => {
    const id = INK_IDS[0];
    const { code, ruling } = run(sit({ said: [ev(id, "placement", { by: [-1, 0], to: [-0.5, -0.25] })] }));
    expect(code).toBe(0);
    const m = ruling.settledMarks[0];
    expect(m.box).toEqual([180, 40, 5.6, 3.6]);
    expect(m.drawn).toEqual([180.5, 39.75, 5.6, 3.6]);
    expect(m.to).toEqual([-0.5, -0.25]);
    expect(m.hand).toEqual([-1, 0]);
  });

  it("writes where the rectangle came to rest as a rectangle, so nobody adds offsets by hand", () => {
    const id = INK_IDS[0];
    const said = [
      ev(id, "placement", { by: [-1, 0], to: [-0.5, -0.25] }),
      ev(id, "wrong-shape", { size: [7, 6], was: [5.6, 3.6] }),
    ];
    const { ruling } = run(sit({ said }));
    expect(ruling.settledMarks[0].settled).toEqual([179.5, 39.75, 7, 6]);
  });

  it("leaves the resting place empty for a mark nobody moved", () => {
    const { ruling } = run(sit({ said: [ev(INK_IDS[0], "looks-right")] }));
    const m = ruling.settledMarks[0];
    expect(m.to).toBeNull();
    expect(m.hand).toBeNull();
    expect(m.settled).toBeNull();
    expect(m.fault).toBe(false);
  });
});

describe("the count that every rate is divided by", () => {
  /**
   * You cannot say something about a mark you never looked at. The sitting page got
   * this wrong once — it banked what was *left* rather than what had been *seen* —
   * and nothing caught it until the rates it fed went over a hundred per cent. Both
   * numbers are written down: what the page claimed, so a later reader can see what
   * the instrument said at the time, and the floor, which is what to divide by.
   */
  it("raises a count smaller than its own answers to the fewest the file can be describing", () => {
    const said = INK_IDS.slice(0, 4).map((id) => ev(id, "wrong-shape", { size: [7, 6], was: [5.6, 3.6] }));
    const { code, out, ruling } = run(sit({ said, seen: 2 }));
    expect(code).toBe(0);
    expect(out).toMatch(/says it looked at 2 and says something about 4/);
    expect(out).toMatch(/4 marks were put in front of somebody/);
    expect(ruling.sittings[0].seen).toBe(2);
    expect(ruling.sittings[0].looked).toBe(4);
    expect(ruling.sittings[0].spoke).toBe(4);
  });

  it("says nothing when the count is merely larger than the answers, which is normal", () => {
    const said = INK_IDS.slice(0, 4).map((id) => ev(id, "wrong-shape", { size: [7, 6], was: [5.6, 3.6] }));
    const { out, ruling } = run(sit({ said, seen: 10 }));
    expect(out).not.toMatch(/cannot both be/);
    expect(ruling.sittings[0].looked).toBe(10);
  });
});

describe("several sittings, and the marks they share", () => {
  it("lets the later sitting settle a mark both of them looked at", () => {
    const id = INK_IDS[0];
    const early = sit({
      finished: "2026-08-01T09:00:00.000Z",
      said: [ev(id, "placement", { by: [-1, 0], to: [-1, 0] })],
    });
    const late = sit({
      finished: "2026-08-09T09:00:00.000Z",
      said: [ev(id, "placement", { by: [0, -2], to: [0, -2] })],
    });
    // Handed to it in the wrong order on purpose: the sorting is the script's job.
    const { code, out, ruling } = run(late, early);
    expect(code).toBe(0);
    expect(ruling.marks).toBe(1);
    expect(ruling.settledMarks[0].to).toEqual([0, -2]);
    expect(ruling.settledMarks[0].goes).toBe(2);
    expect(out).toMatch(/2 sittings · 2 answers · 1 marks/);
    expect(ruling.sittings.map((s) => s.finished)).toEqual([
      "2026-08-01T09:00:00.000Z",
      "2026-08-09T09:00:00.000Z",
    ]);
  });

  it("walks the marks in the order the print lays them out", () => {
    const said = ["1:9", "1:2", "1:7"].map((id) => ev(id, "looks-right"));
    const { ruling } = run(sit({ said }));
    expect(ruling.settledMarks.map((m) => m.id)).toEqual(["1:2", "1:7", "1:9"]);
  });
});

describe("a defect in somebody else's print", () => {
  const defects = () => {
    const said = [
      ev("1:6", "print-defect", { why: "unsure", note: "Odd — I cannot say how" }),
      ev("1:6", "placement", { by: [-1, 0], to: [-1, 0] }),
      ev("1:7", "print-defect", { why: "unsure", note: "the tooth is missing here" }),
    ];
    return sit({ said });
  };

  it("counts it apart from a complaint about our rectangle, even on a mark carrying both", () => {
    const { code, out, ruling } = run(defects());
    expect(code).toBe(0);
    expect(ruling.defects).toBe(2);
    expect(ruling.faulted).toBe(1);
    expect(out).toMatch(/2 marks were called odd in the print/);
    expect(out).toMatch(/belongs in docs\/issues\.json/);
  });

  /**
   * The register is hand-edited, always. A script that wrote to it would be the
   * second thing in this repo claiming authorship of a register meant to have
   * exactly one, and the drift would be found by somebody reading a row nobody wrote.
   */
  it("drafts the register row on demand and never writes it anywhere", () => {
    const { out } = run(defects(), "--issues");
    expect(out).toMatch(/paste it by hand/);
    expect(out).toMatch(/"status": "open"/);
    // The pages and the marks are the whole reason anybody would keep the row.
    expect(out).toMatch(/Pages 1;/);
    expect(out).toMatch(/marks 1:6, 1:7;/);
    // The draft is dated by the sitting, not by the day somebody happened to run this.
    expect(out).toMatch(/print-oddities-called-out-by-eye-2026-08-15/);
  });

  /**
   * A draft in a shape the register cannot hold is worse than no draft: somebody
   * pastes it, the gate refuses it, and the fastest way out of that is to edit the
   * gate. So the draft is checked against the register's real vocabulary rather
   * than against a shape this file invented — and against the register itself,
   * because that is the document the vocabulary belongs to.
   */
  it("drafts it in the shape the register actually takes", () => {
    const { out } = run(defects(), "--issues");
    const row = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    const register = JSON.parse(readFileSync(join(ROOT, "docs/issues.json"), "utf8")).issues;

    // It indexes a numbered item in a document; it never states the finding alone.
    expect(row.source.file).toBe("docs/design/mark-registration.md");
    expect(row.source.item).toMatch(/numeral/);
    expect(register.some((r) => r.source?.file === row.source.file)).toBe(true);

    // Every other field is a word the register is already using somewhere.
    for (const key of ["status", "severity", "owner"]) {
      expect(register.map((r) => r[key])).toContain(row[key]);
    }
    // Only a person can hold the print up against another copy of it.
    expect(row.owner).toBe("user");
  });

  it("says how to get the draft when it was not asked for", () => {
    expect(run(defects()).out).toMatch(/Run again with --issues/);
  });
});

describe("bad news is not a broken build", () => {
  /**
   * A sitting that finds everything wrong has done its job. An exit code that failed
   * the build for it would teach everybody to stop sitting them, which is the one
   * outcome this whole apparatus cannot survive.
   */
  it("exits zero when every mark it settled carries a complaint, and says to check the instrument", () => {
    const said = INK_IDS.concat("1:6", "1:7").map((id) => ev(id, "placement", { by: [-1, 0], to: [-1, 0] }));
    const { code, out, ruling } = run(sit({ said }));
    expect(code).toBe(0);
    expect(ruling.faulted).toBe(ruling.marks);
    expect(out).toMatch(/a measurement of the sitting/);
    expect(out).toMatch(/selected for/);
  });

  it("does not say it about a handful, where everything-is-wrong is just a small number", () => {
    const said = INK_IDS.slice(0, 3).map((id) => ev(id, "placement", { by: [-1, 0], to: [-1, 0] }));
    expect(run(sit({ said })).out).not.toMatch(/a measurement of the sitting/);
  });
});

/**
 * There are two ways out of a sitting and until recently only one of them led here.
 * The served page banks every answer as it is given; handing over writes the same
 * answers to a file. The builder honours both, so a mark answered and never handed
 * over was dropped from the next deck and written down nowhere — invisible work, and
 * the more of it a reader does the worse it gets.
 *
 * What these hold is the arithmetic of reading both without double-reading either.
 */
describe("the answers that were banked as they were given", () => {
  /** A running log on disk: one banked answer per line, stamped when it arrived. */
  function log(...lines) {
    const path = join(dir, `banked-${(nth += 1)}.jsonl`);
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
    return path;
  }
  const bank = (t, payload) => ({ t, kind: "report", payload });

  it("settles a mark the log heard about and no hand-over ever carried", () => {
    const kept = ev(INK_IDS[0], "placement", { by: [-1, 0], to: [-1, 0] });
    const lost = ev(INK_IDS[1], "placement", { by: [0, -2], to: [0, -2] });
    const { code, ruling } = run(
      sit({ said: [kept] }),
      log(bank("2026-08-15T10:00:00.000Z", kept), bank("2026-08-15T11:00:00.000Z", lost)),
    );
    expect(code).toBe(0);
    expect(ruling.settledMarks.map((m) => m.id)).toEqual([INK_IDS[0], INK_IDS[1]]);
    expect(ruling.banked[0].only).toBe(1);
    expect(ruling.banked[0].added).toBe(1);
  });

  /**
   * The one that would have been silently wrong. How many goes a mark took is a
   * finding about the pad, not about the mark, and a mark answered once that comes
   * out of here having taken two goes is a finding nobody made.
   */
  it("counts a statement that arrived by both routes once, so a mark keeps its true number of goes", () => {
    const said = ev(INK_IDS[0], "placement", { by: [-1, 0], to: [-1, 0] });
    const { ruling } = run(sit({ said: [said] }), log(bank("2026-08-15T10:00:00.000Z", said)));
    expect(ruling.answers).toBe(1);
    expect(ruling.settledMarks[0].goes).toBe(1);
    expect(ruling.banked[0].added).toBe(0);
  });

  /**
   * A hand-over says only that its answers were given by the time it was handed over.
   * A banked one says exactly when. So an answer banked after the hand-over is the
   * later word on that mark, and it is the one that settles it.
   */
  it("lets an answer banked after the hand-over settle the mark", () => {
    const id = INK_IDS[0];
    const early = ev(id, "placement", { by: [-1, 0], to: [-1, 0] });
    const late = ev(id, "placement", { by: [0, -2], to: [-1, -2] });
    const { ruling } = run(
      sit({ finished: "2026-08-15T12:00:00.000Z", said: [early] }),
      log(bank("2026-08-15T11:00:00.000Z", early), bank("2026-08-15T13:00:00.000Z", late)),
    );
    expect(ruling.settledMarks[0].to).toEqual([-1, -2]);
    expect(ruling.settledMarks[0].goes).toBe(2);
  });

  /**
   * The log is the same hours arriving by the other route, never another hour in
   * front of the screen. Filed among the sittings it would double every denominator
   * anybody divides by, which is the failure this file exists to catch.
   */
  it("keeps the log out of the sittings, so no denominator counts the same hour twice", () => {
    const said = ev(INK_IDS[0], "placement", { by: [-1, 0], to: [-1, 0] });
    const { out, ruling } = run(sit({ said: [said] }), log(bank("2026-08-15T10:00:00.000Z", said)));
    expect(ruling.sittings).toHaveLength(1);
    expect(out).toMatch(/1 sitting · 1 answers · 1 marks/);
    expect(out).toMatch(/10 marks were put in front of somebody/);
  });

  /** No head, no fingerprint, nothing saying these answers are about today's rectangles. */
  it("refuses a running log with no hand-over beside it to check it against", () => {
    const said = ev(INK_IDS[0], "placement", { by: [-1, 0], to: [-1, 0] });
    const { code, err } = run(log(bank("2026-08-15T10:00:00.000Z", said)), "--rows", rowsPath);
    expect(code).toBe(2);
    expect(err).toMatch(/no head/);
  });

  /** A mark the displacements have never heard of is refused whichever route it took. */
  it("checks a banked answer against the displacements exactly as it checks a handed-over one", () => {
    const { code, err } = run(
      sit({ said: [] }),
      log(bank("2026-08-15T10:00:00.000Z", { ...ev(INK_IDS[0], "placement"), id: "1:99" })),
    );
    expect(code).toBe(2);
    expect(err).toMatch(/not in the displacements/);
  });
});

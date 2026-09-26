/**
 * Every grader checks itself against a known answer before it scores anything
 * real, and stops if the answer moved. Two things are proved here, for each of
 * the five graders:
 *
 *   - on the committed fixture it runs, says the self-test passed, and exits
 *     with the recorded code — so a clean clone with no caches can grade;
 *   - on a deliberately wrong fixture — the recorded verdict tampered with — it
 *     refuses, prints nothing to standard out, and exits 3, so a grader whose
 *     arithmetic drifted cannot ship a number.
 *
 * The wrong fixture is a copy of the real one in a scratch directory, pointed
 * at through the same environment variable the helper reads, so the committed
 * fixtures are never touched.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHILD_ENV, DIR_ENV, FIXTURES, GRADERS, SCRIPTS, recordOf, runCase } from "./lib/self-test.mjs";

/** Run a grader and keep both streams, whichever way it exits. */
const run = (name, args, env = {}) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS, GRADERS[name]), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** A grader's own fixture, resolved into real arguments, plus a scratch --out for the settler. */
const ownArgs = (name, extra = []) => {
  const c = recordOf(join(FIXTURES, name)).c;
  return [...c.args.map((a) => (a.startsWith("fixture:") ? join(FIXTURES, name, a.slice(8)) : a.startsWith("scripts:") ? join(SCRIPTS, a.slice(8)) : a)), ...extra];
};

describe("every grader carries a committed known answer", () => {
  for (const name of Object.keys(GRADERS)) {
    it(`${name}: the fixture is complete and small enough to read`, () => {
      const want = recordOf(join(FIXTURES, name));
      expect(want.stdout).not.toBeNull();
      expect(want.stdout.length).toBeGreaterThan(0);
      expect(Number.isInteger(want.code)).toBe(true);
      if (want.c.writes) expect(want.written).not.toBeNull();
      for (const a of want.c.args.filter((x) => x.startsWith("fixture:"))) {
        expect(readFileSync(join(FIXTURES, name, a.slice(8)), "utf8").length).toBeLessThan(64 * 1024);
      }
    });
  }
});

describe("on the committed fixture, the self-test passes and the grader goes on to score", () => {
  for (const name of Object.keys(GRADERS)) {
    it(`${name}`, () => {
      const tmp = mkdtempSync(join(tmpdir(), "hifth-self-test-real-"));
      try {
        const want = recordOf(join(FIXTURES, name));
        const got = run(name, ownArgs(name, want.c.writes ? ["--out", join(tmp, "out.json")] : []));
        expect(got.stderr).toContain(`self-test (${name}): the known fixture reproduces its recorded verdict`);
        expect(got.code).toBe(want.code);
        expect(got.stdout.length).toBeGreaterThan(0);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  }
});

describe("the recorded verdict is what the grader prints today", () => {
  for (const name of Object.keys(GRADERS)) {
    it(`${name}: running the case reproduces the record byte for byte`, () => {
      const dir = join(FIXTURES, name);
      const want = recordOf(dir);
      const got = runCase(join(SCRIPTS, GRADERS[name]), dir, want.c);
      expect(got.code).toBe(want.code);
      expect(got.stdout).toBe(want.stdout);
      if (want.c.writes) expect(got.written).toEqual(want.written);
    });
  }
});

describe("a deliberately wrong fixture makes the grader stop", () => {
  let wrong;
  beforeAll(() => {
    wrong = mkdtempSync(join(tmpdir(), "hifth-self-test-wrong-"));
    cpSync(FIXTURES, wrong, { recursive: true });
    for (const name of Object.keys(GRADERS)) {
      const c = recordOf(join(wrong, name)).c;
      const path = join(wrong, name, c.stdout);
      // The same number of lines, one figure changed: the kind of drift a
      // nudged floor or a re-counted bucket produces.
      writeFileSync(path, readFileSync(path, "utf8").replace(/100\.0%|\d+ marks|\d+ sitting/, "99.9%"));
    }
  });
  afterAll(() => rmSync(wrong, { recursive: true, force: true }));

  for (const name of Object.keys(GRADERS)) {
    it(`${name}: refuses with exit 3, scores nothing, and says how to re-record`, () => {
      const tmp = mkdtempSync(join(tmpdir(), "hifth-self-test-out-"));
      try {
        const want = recordOf(join(FIXTURES, name));
        const got = run(name, ownArgs(name, want.c.writes ? ["--out", join(tmp, "out.json")] : []), { [DIR_ENV]: wrong });
        expect(got.code).toBe(3);
        expect(got.stdout).toBe("");
        expect(got.stderr).toContain(`self-test (${name}): the known fixture no longer prints its recorded verdict`);
        expect(got.stderr).toContain("Nothing was scored");
        expect(got.stderr).toContain(`rebuild-grader-self-tests.mjs ${name}`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  }

  it("settle: a tampered written ruling stops it even when the printed verdict matches", () => {
    const dir = mkdtempSync(join(tmpdir(), "hifth-self-test-written-"));
    const tmp = mkdtempSync(join(tmpdir(), "hifth-self-test-out-"));
    try {
      cpSync(FIXTURES, dir, { recursive: true });
      const c = recordOf(join(dir, "settle")).c;
      const path = join(dir, "settle", c.writes);
      const doc = JSON.parse(readFileSync(path, "utf8"));
      doc.faulted += 1;
      writeFileSync(path, JSON.stringify(doc));
      const got = run("settle", ownArgs("settle", ["--out", join(tmp, "out.json")]), { [DIR_ENV]: dir });
      expect(got.code).toBe(3);
      expect(got.stdout).toBe("");
      expect(got.stderr).toContain("the ruling written for the known fixture is not the one on record");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("a grader with no fixture at all does not run", () => {
    const empty = mkdtempSync(join(tmpdir(), "hifth-self-test-none-"));
    try {
      const got = run("adjudication", ownArgs("adjudication"), { [DIR_ENV]: empty });
      expect(got.code).toBe(3);
      expect(got.stdout).toBe("");
      expect(got.stderr).toContain("a grader with no known answer does not run");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("the check leaves nothing behind and does not recurse", () => {
  it("the child run is marked so it does not spawn a grandchild", () => {
    const want = recordOf(join(FIXTURES, "adjudication"));
    const got = run("adjudication", ownArgs("adjudication"), { [CHILD_ENV]: "child" });
    expect(got.code).toBe(want.code);
    expect(got.stderr).not.toContain("self-test");
  });
});

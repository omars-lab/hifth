import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { secondTries, repeats } from "./second-tries.mjs";

const script = fileURLToPath(new URL("./second-tries.mjs", import.meta.url));

/** A made-up Playwright results file: one file, one group, three tests. */
function results({ flaky = true } = {}) {
  return {
    stats: { expected: 2, unexpected: 0, flaky: flaky ? 1 : 0, skipped: 0 },
    suites: [
      {
        title: "made-up.spec.ts",
        file: "made-up.spec.ts",
        specs: [
          {
            title: "opens the page",
            file: "made-up.spec.ts",
            line: 4,
            tests: [{ projectName: "desktop", status: "expected", results: [{ retry: 0, status: "passed" }] }],
          },
        ],
        suites: [
          {
            title: "the tools bar",
            file: "made-up.spec.ts",
            specs: [
              {
                title: "a pen picked twice stays picked",
                file: "made-up.spec.ts",
                line: 12,
                tests: [
                  {
                    projectName: "iphone",
                    status: flaky ? "flaky" : "expected",
                    results: flaky
                      ? [
                          { retry: 0, status: "timedOut" },
                          { retry: 1, status: "passed" },
                        ]
                      : [{ retry: 0, status: "passed" }],
                  },
                  { projectName: "android", status: "expected", results: [{ retry: 0, status: "passed" }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

test("a test that failed first and passed on its retry is named, with its project and place", () => {
  assert.deepEqual(secondTries(results()), [
    {
      project: "iphone",
      file: "made-up.spec.ts",
      line: 12,
      title: "the tools bar › a pen picked twice stays picked",
      first: "timedOut",
    },
  ]);
});

test("a run where every test passed on its first try names none", () => {
  assert.deepEqual(secondTries(results({ flaky: false })), []);
});

test("the push prints each second try and keeps it in the history", () => {
  const dir = mkdtempSync(join(tmpdir(), "second-tries-"));
  const file = join(dir, "results.json");
  const history = join(dir, "history.jsonl");
  writeFileSync(file, JSON.stringify(results()));
  const r = run(["--results", file, "--history", history, "--commit", "abc1234"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 browser test passed only on its second try/);
  assert.match(r.stdout, /iphone .*made-up\.spec\.ts:12 .*a pen picked twice stays picked/);
  assert.match(r.stdout, /first try: timedOut/);
  const kept = readFileSync(history, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].commit, "abc1234");
  assert.equal(kept[0].tests.length, 1);
});

test("a clean run says so in one line, and is kept so the history counts it", () => {
  const dir = mkdtempSync(join(tmpdir(), "second-tries-"));
  const file = join(dir, "results.json");
  const history = join(dir, "history.jsonl");
  writeFileSync(file, JSON.stringify(results({ flaky: false })));
  const r = run(["--results", file, "--history", history]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Every browser test passed on its first try/);
  assert.equal(readFileSync(history, "utf8").trim().split("\n").length, 1);
});

test("a test that keeps needing a second try says how often, out of the runs kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "second-tries-"));
  const flakyFile = join(dir, "flaky.json");
  const cleanFile = join(dir, "clean.json");
  const history = join(dir, "history.jsonl");
  writeFileSync(flakyFile, JSON.stringify(results()));
  writeFileSync(cleanFile, JSON.stringify(results({ flaky: false })));
  run(["--results", flakyFile, "--history", history]);
  run(["--results", cleanFile, "--history", history]);
  const r = run(["--results", flakyFile, "--history", history]);
  assert.match(r.stdout, /2 of the last 3 runs/);
});

test("repeats counts each test across the kept runs, most often first", () => {
  const t = { project: "iphone", file: "a.spec.ts", line: 1, title: "x" };
  const u = { project: "desktop", file: "b.spec.ts", line: 2, title: "y" };
  const rows = [{ tests: [t] }, { tests: [t, u] }, { tests: [] }];
  assert.deepEqual(
    repeats(rows).map((r) => [r.test.title, r.times]),
    [
      ["x", 2],
      ["y", 1],
    ],
  );
});

test("a results file that is missing is said out loud, not passed over in silence", () => {
  const dir = mkdtempSync(join(tmpdir(), "second-tries-"));
  const history = join(dir, "history.jsonl");
  const r = run(["--results", join(dir, "nope.json"), "--history", history]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /could not check for second tries/);
  assert.equal(existsSync(history), false);
});

test("--list prints the tests that needed a second try most often, from the history alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "second-tries-"));
  const file = join(dir, "results.json");
  const history = join(dir, "history.jsonl");
  writeFileSync(file, JSON.stringify(results()));
  run(["--results", file, "--history", history]);
  run(["--results", file, "--history", history]);
  const r = run(["--list", "--history", history]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /2 runs kept/);
  assert.match(r.stdout, /2× {2}iphone .*a pen picked twice stays picked/);
});

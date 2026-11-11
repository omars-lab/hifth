/**
 * A browser test file cannot change which runs it is part of without someone
 * looking (docs/design/build-and-test.md ①). The laptop and Firefox runs each
 * read a hand-kept list; a new file left off them was skipped there twice in
 * one week of November 2026, and nothing said so.
 *
 * Each test hands the real script a made-up answer from the test runner and a
 * made-up record, and reads what it says. Written before the script
 * (2026-11-11) and seen failing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("gate-e2e-runs.mjs", import.meta.url));

/** The test runner's own list, in the shape it prints: { runName: [files] }. */
function listing(runs) {
  const specs = [];
  for (const [projectName, files] of Object.entries(runs))
    for (const file of files) specs.push({ file, tests: [{ projectName }] });
  // Nested one level, the way the runner nests a file's tests under its suites.
  return { suites: [{ specs: [], suites: [{ specs }] }] };
}

function run({ runs, pitchRuns = {}, record, files, args = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-runs-"));
  const recordPath = join(dir, "runs.json");
  if (record) writeFileSync(recordPath, JSON.stringify({ files: record }));
  writeFileSync(join(dir, "list.json"), JSON.stringify(listing(runs)));
  writeFileSync(join(dir, "pitch.json"), JSON.stringify(listing(pitchRuns)));
  writeFileSync(join(dir, "files.json"), JSON.stringify(files ?? [...new Set([...Object.values(runs), ...Object.values(pitchRuns)].flat())]));
  const r = spawnSync(
    "node",
    [SCRIPT, "--list", join(dir, "list.json"), "--pitch-list", join(dir, "pitch.json"), "--files", join(dir, "files.json"), "--record", recordPath, ...args],
    { encoding: "utf8" },
  );
  return { status: r.status, out: r.stdout + r.stderr, recordPath };
}

const today = { phone: ["a.spec.ts", "b.spec.ts"], laptop: ["a.spec.ts"], firefox: ["a.spec.ts"] };
const recorded = { "a.spec.ts": ["firefox", "laptop", "phone"], "b.spec.ts": ["phone"] };

test("when every file runs where the record says, it passes", () => {
  const { status, out } = run({ runs: today, record: recorded });
  assert.equal(status, 0, out);
  assert.match(out, /OK/);
});

test("a new file is refused, with the runs it is in and the ones it is not", () => {
  const { status, out } = run({ runs: { ...today, phone: [...today.phone, "new.spec.ts"] }, record: recorded });
  assert.equal(status, 1, out);
  assert.match(out, /new\.spec\.ts/);
  assert.match(out, /runs in: phone/);
  assert.match(out, /not in: firefox, laptop/);
  // It says how to accept it, and where the lists are.
  assert.match(out, /--write/);
  assert.match(out, /playwright\.config\.ts/);
});

test("a file dropped from a run it used to be in is refused", () => {
  const { status, out } = run({ runs: { ...today, firefox: [] }, record: recorded });
  assert.equal(status, 1, out);
  assert.match(out, /a\.spec\.ts/);
  assert.match(out, /no longer in: firefox/);
});

test("a file added to a run is refused until the record says so", () => {
  const { status, out } = run({ runs: { ...today, laptop: ["a.spec.ts", "b.spec.ts"] }, record: recorded });
  assert.equal(status, 1, out);
  assert.match(out, /b\.spec\.ts/);
  assert.match(out, /now also in: laptop/);
});

test("a file that no run picks up is refused, and --write does not accept it", () => {
  const args = { runs: today, record: recorded, files: ["a.spec.ts", "b.spec.ts", "lost.spec.ts"] };
  const plain = run(args);
  assert.equal(plain.status, 1, plain.out);
  assert.match(plain.out, /lost\.spec\.ts/);
  assert.match(plain.out, /in no run/);
  const written = run({ ...args, args: ["--write"] });
  assert.equal(written.status, 1, written.out);
});

test("a record line for a file that is gone is refused", () => {
  const { status, out } = run({ runs: today, record: { ...recorded, "gone.spec.ts": ["phone"] } });
  assert.equal(status, 1, out);
  assert.match(out, /gone\.spec\.ts/);
});

test("the private pitch build's runs count too", () => {
  const { status, out } = run({
    runs: today,
    pitchRuns: { pitch: ["p.spec.ts"] },
    record: { ...recorded, "p.spec.ts": ["pitch"] },
  });
  assert.equal(status, 0, out);
});

test("--write records today's runs, files and runs in order, and then it passes", () => {
  const runs = { ...today, phone: ["new.spec.ts", ...today.phone] };
  const { status, out, recordPath } = run({ runs, record: recorded, args: ["--write"] });
  assert.equal(status, 0, out);
  const saved = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.deepEqual(Object.keys(saved.files), ["a.spec.ts", "b.spec.ts", "new.spec.ts"]);
  assert.deepEqual(saved.files["a.spec.ts"], ["firefox", "laptop", "phone"]);
  assert.deepEqual(saved.files["new.spec.ts"], ["phone"]);
});

test("the real record matches the real lists", () => {
  // No made-up input: the script asks the test runner itself.
  const r = spawnSync("node", [SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

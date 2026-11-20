// The launch goal page must name every open launch row, or a fresh session working from the
// page alone never sees it. Made-up rows only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { rowsTheGoalMisses } from "./goal-names-every-row.mjs";

const rows = [
  { id: "launch-made-up-open", status: "open", launch: true },
  { id: "launch-made-up-blocked", status: "blocked", launch: true },
  { id: "launch-made-up-fixed", status: "fixed", launch: true },
  { id: "not-for-launch", status: "open" },
];

test("names the open and blocked launch rows the page leaves out", () => {
  const page = "Sign-in (`launch-made-up-open`) is built.";
  assert.deepEqual(rowsTheGoalMisses(rows, page).map((r) => r.id), ["launch-made-up-blocked"]);
});

test("a fixed row, or one not for the launch, is never asked for", () => {
  const page = "`launch-made-up-open` and `launch-made-up-blocked`.";
  assert.deepEqual(rowsTheGoalMisses(rows, page), []);
});

test("a name inside a longer name does not count", () => {
  const page = "`launch-made-up-open-later` and `launch-made-up-blocked`.";
  assert.deepEqual(rowsTheGoalMisses(rows, page).map((r) => r.id), ["launch-made-up-open"]);
});

test("the command fails and lists what is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "goal-rows-"));
  writeFileSync(join(dir, "issues.json"), JSON.stringify({ issues: rows }));
  writeFileSync(join(dir, "goal.md"), "`launch-made-up-open`");
  const run = spawnSync(process.execPath, [
    new URL("./goal-names-every-row.mjs", import.meta.url).pathname,
    "--issues", join(dir, "issues.json"), "--goal", join(dir, "goal.md"),
  ], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /launch-made-up-blocked/);
  writeFileSync(join(dir, "goal.md"), "`launch-made-up-open` `launch-made-up-blocked`");
  const ok = spawnSync(process.execPath, [
    new URL("./goal-names-every-row.mjs", import.meta.url).pathname,
    "--issues", join(dir, "issues.json"), "--goal", join(dir, "goal.md"),
  ], { encoding: "utf8" });
  assert.equal(ok.status, 0);
});

test("run from another folder, it still reads this repo's register and goal page", () => {
  // The loop ran it from the main checkout while working in another working copy, and it
  // stopped on a missing file. Its own files are found from where the script sits.
  const elsewhere = mkdtempSync(join(tmpdir(), "goal-rows-cwd-"));
  const run = spawnSync(process.execPath, [
    new URL("./goal-names-every-row.mjs", import.meta.url).pathname,
  ], { encoding: "utf8", cwd: elsewhere });
  assert.doesNotMatch(run.stderr, /ENOENT/);
  assert.match(run.stdout, /goal page/);
});

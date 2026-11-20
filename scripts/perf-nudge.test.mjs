import { test } from "node:test";
import assert from "node:assert/strict";
import { findings, measuredCapGz, measuredGz } from "./lib/perf-nudge.mjs";

// The hook runs from the main checkout, but the size check it reads may have
// run in a worktree whose cap was raised since. 2026-11-19: the cap was 220 on
// the branch and 210 on main, so the reminder said "-9.7 KB of room left" on a
// passing check. The cap the check printed is the one that was applied.
test("reads the cap the size check printed, passing or failing", () => {
  assert.equal(measuredCapGz("gate:budget — OK (219.7 KB gz / 220 KB budget, +0.4 KB against the baseline)"), 220 * 1024);
  assert.equal(measuredCapGz("gate:budget — FAIL: 220.3 KB gz > 220 KB budget"), 220 * 1024);
  assert.equal(measuredCapGz("nothing about size here"), null);
});

test("a passing check near its own cap says the room against that cap", () => {
  const output = "gate:budget — OK (219.7 KB gz / 220 KB budget, +0.4 KB against the baseline)";
  const [near] = findings({ totalGz: measuredGz(output), capGz: measuredCapGz(output), output });
  assert.match(near.say, /against a 220\.0 KB cap: 0\.3 KB of room left/);
});

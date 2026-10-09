import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// An upright walk and a sideways walk are looked at side by side. Each run
// used to empty the one folder both wrote to, so the sideways run deleted the
// upright pictures before anyone had looked at them (2026-10-08).
const root = fileURLToPath(new URL("..", import.meta.url));

function plan(sideways) {
  const args = ["-s", "-n", "-C", root, "app-walk", "ROUTES=/hafs-kfqc/p1"];
  if (sideways) args.push("SIDEWAYS=1");
  return spawnSync("make", args, { encoding: "utf8" }).stdout;
}

test("a sideways walk empties only the sideways pictures", () => {
  const out = plan(true);
  assert.match(out, /shots\/walk\/side\b/);
  assert.doesNotMatch(out, /shots\/walk\/upright/);
  assert.doesNotMatch(out, /rm -rf \S*shots\/walk(\s|$)/m);
});

test("an upright walk empties only the upright pictures", () => {
  const out = plan(false);
  assert.match(out, /shots\/walk\/upright\b/);
  assert.doesNotMatch(out, /shots\/walk\/side/);
  assert.doesNotMatch(out, /rm -rf \S*shots\/walk(\s|$)/m);
});

// The simulator sometimes stops turning: asked to go sideways it says it has
// and stays upright, and the walk refuses every picture. A restart cures it,
// and it was needed two days running (2026-10-08, 2026-10-09), so a sideways
// walk restarts the simulator before it starts; an upright one has no need.
test("a sideways walk restarts the simulator before it opens the app", () => {
  const out = plan(true);
  const restart = out.search(/simctl shutdown \S+/);
  const boot = out.search(/simctl boot \S+/);
  const run = out.search(/WalkTests test/);
  assert.ok(restart >= 0 && boot > restart && run > boot, out);
});

test("an upright walk does not restart the simulator", () => {
  assert.doesNotMatch(plan(false), /simctl shutdown/);
});

// Two tests by name in one run used to hand xcodebuild a bare name it read as
// a build action, and the run stopped before testing anything (2026-10-08).
test("ONLY can name more than one test", () => {
  const out = spawnSync(
    "make",
    ["-s", "-n", "-C", root, "app-test", "ONLY=SmokeTests/testA SmokeTests/testB"],
    { encoding: "utf8" },
  ).stdout;
  assert.match(out, /-only-testing:HifthUITests-iOS\/SmokeTests\/testA\b/);
  assert.match(out, /-only-testing:HifthUITests-iOS\/SmokeTests\/testB\b/);
});

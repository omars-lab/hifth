/**
 * The pitch suite checks the private build's notes, and most faults a walk of
 * the demo finds have their test there. It needs a gitignored notes file, so
 * the push check runs it when the file is on this machine and says, in one
 * line, that it was skipped when it is not, rather than failing a push on a
 * machine that never had the notes.
 *
 * Read off a dry run of the push check, so it is what `make pre-push` would do.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const dryRun = (data) => execFileSync("make", ["-n", "-C", ROOT, "pre-push", `PITCH_DATA=${data}`], { encoding: "utf8" });

test("the push check runs the pitch suite when the private notes are here", () => {
  const plan = dryRun("package.json");
  assert.match(plan, /HIFTH_PITCH=1 .*playwright test --project=pitch/);
});

test("without the notes, the push check skips the pitch suite and says so", () => {
  const plan = dryRun("no/such/notes.json");
  assert.doesNotMatch(plan, /--project=pitch/);
  assert.match(plan, /no private pitch data/i);
});

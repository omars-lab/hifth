#!/usr/bin/env node
/**
 * Bank a manual validation result: stamp the ledger, regenerate the guide, and
 * print what the result is now allowed to change.
 *
 * The last minute of a fifteen-minute walkthrough is where results get lost —
 * you are on the phone, the answer is in your head, and the recording step is
 * "open a JSON file and edit four fields correctly". So it is one command. It
 * also refuses the two ways of half-recording: a verdict with no words, and an
 * id that does not exist (typing `make record CHECK=perf` and getting a silent
 * no-op is how a result evaporates).
 *
 * What it deliberately does NOT do is the `tunes` work. That is the step which
 * turns an expensive human result into a permanent automated one, and it needs
 * judgement — so the script prints the list and gets out of the way.
 *
 * Usage:
 *   node scripts/record-validation.mjs --check <id> --result "<the verdict>"
 *   node scripts/record-validation.mjs --check <id> --result "…" --status superseded
 *   node scripts/record-validation.mjs --check <id> --result "…" --on 2026-07-20
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { readLedger, LEDGER_PATH, ROOT } from "./validation-ledger.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const id = arg("check");
const result = arg("result");
const status = arg("status") ?? "done";
const on = arg("on") ?? new Date().toISOString().slice(0, 10);

const ledger = readLedger();
const check = (ledger.checks ?? []).find((c) => c.id === id);

if (!id || !check) {
  console.error(`\n  record — ${id ? `no check "${id}" in the ledger` : "which check?"}. Available:\n`);
  for (const c of ledger.checks ?? []) console.error(`    ${c.id.padEnd(28)} ${c.status}`);
  console.error(`\n  usage: make record CHECK=<id> RESULT='<the verdict, in words>'\n`);
  process.exit(2);
}

if (!result || !result.trim()) {
  console.error(
    `\n  record — "${id}" needs a RESULT. The verdict in words IS the artifact:\n` +
      `  a "done" with no result is indistinguishable from a check nobody ran.\n\n` +
      `  usage: make record CHECK=${id} RESULT='<what you saw, and what it decides>'\n`,
  );
  process.exit(2);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
  console.error(`\n  record — --on must be an ISO date (YYYY-MM-DD), got "${on}"\n`);
  process.exit(2);
}

const previous = check.status;
check.status = status;
check.verifiedOn = on;
check.result = result.trim();

// Rewrite the whole file rather than patching text: the ledger is machine-read
// by three renderers, and a hand-patched JSON that parses but has drifted
// formatting is a diff nobody reviews.
writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(`\n  ${check.title}`);
console.log(`  ${id}: ${previous} → ${status}, verified ${on}`);
console.log(`  result: ${check.result}\n`);

// The guide renders status and result, so it is stale the moment this runs —
// and gate:validation is about to say so. Regenerate it here rather than
// making a green build depend on remembering a second command.
const guide = spawnSync(process.execPath, [join(ROOT, "scripts", "build-validation-guide.mjs")], {
  stdio: "inherit",
});
if (guide.status !== 0) process.exit(guide.status ?? 1);

console.log(`\n  Now do what it tunes — this is what the check was bought for:\n`);
for (const t of check.tunes ?? []) console.log(`    ☐ ${t}`);
if (check.record) console.log(`\n    ☐ write it up in ${check.record}`);
console.log("");

const gate = spawnSync(process.execPath, [join(ROOT, "scripts", "gate-validation.mjs")], {
  stdio: "inherit",
});
process.exit(gate.status ?? 0);

#!/usr/bin/env node
/**
 * Run the machine half of the manual checks, and write down what happened.
 *
 * Six checks in this ledger need a human. Over eight research follow-ups, parts
 * of four of them stopped needing one: the GPL §6 offer is followed anonymously
 * by `make source-offer`, the two restatements of the KFGQPC terms are compared
 * by `gate:license-copy`, the banked edge verdicts are re-checked by
 * `gate:verified-edges`. Each of those discharges specific *steps* of a runbook
 * — never a whole check — and until now that was true only in a commit message.
 * The person holding the phone still walked every step.
 *
 * So a check may declare an `evidence` block naming one command, the step ids
 * that command discharges, and — required, and the point of the whole design —
 * the `residue` it cannot. This script runs those commands and writes one record
 * per check into docs/validation/evidence/<id>.json. The gate reads them into
 * its summary line; the guide strikes the covered steps off the card.
 *
 * Two rules make that safe rather than dangerous:
 *
 *   - **A run is written, never asserted.** The record carries the real exit
 *     code of the real command on this machine at this commit. There is no way
 *     to mark a step discharged except by running the thing.
 *   - **Exit 3 is "could not tell", and it does not strike anything.** A check
 *     whose network would not answer has proved nothing; treating that as a
 *     pass is how an automated run quietly claims to have done a human's job,
 *     which is the failure mode this feature introduces and must therefore
 *     close. See `outcomeOf` in validation-ledger.mjs.
 *
 * The records are committed. They are the same kind of artifact as a golden
 * image or a `verifiedOn` stamp — a fact about a run, worth keeping, and worth
 * diffing when it changes.
 *
 * Usage:
 *   make validate-auto                  every check that declares evidence
 *   make validate-auto CHECK=<id>       just one
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { join } from "node:path";
import { readLedger, evidencePath, EVIDENCE_DIR, outcomeOf, ROOT } from "./validation-ledger.mjs";

const argv = process.argv.slice(2);
const only = (() => {
  const i = argv.indexOf("--check");
  return i >= 0 ? argv[i + 1] : null;
})();

const checks = (readLedger().checks ?? []).filter((c) => c.evidence?.run);
const wanted = only ? checks.filter((c) => c.id === only) : checks;

if (!wanted.length) {
  console.error(
    only
      ? `\n  validate-auto — "${only}" declares no evidence. Checks that do:\n` +
          checks.map((c) => `    ${c.id}`).join("\n") +
          "\n"
      : `\n  validate-auto — no check declares an "evidence" block.\n`,
  );
  process.exit(2);
}

// Stamped into every record: which build the machine was actually looking at.
// A green record against an unknown commit answers a different question than
// the one anyone asked.
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();
const on = `${process.platform} · node ${process.version}`;

mkdirSync(EVIDENCE_DIR, { recursive: true });

console.log("");
const records = [];
for (const check of wanted) {
  const { run, covers = [], residue = [] } = check.evidence;
  console.log(`  ── ${check.id}`);
  console.log(`     $ ${run}\n`);

  // Through a shell, because `evidence.run` is written as the command a human
  // would type — `pnpm gate:license-copy` — and a runbook that says one thing
  // and runs another is the drift this whole file exists to prevent. stdio is
  // piped so the record can keep the tail; it is echoed back so the operator
  // sees the run rather than a spinner.
  //
  // One thing an `evidence.run` must NOT be is a `make` target: GNU make reports
  // every failed recipe as exit 2, which flattens the producer's own 1-vs-3
  // ("does not resolve" vs "could not tell") into one code and would let a
  // network timeout read as a verdict. Measured, not assumed — `make
  // source-offer` was the first thing this script ran.
  const proc = spawnSync(run, { shell: true, encoding: "utf8" });
  const output = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
  process.stdout.write(indent(output));

  const exit = proc.status ?? 1;
  const outcome = outcomeOf(exit);
  const record = {
    check: check.id,
    run,
    ranAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    commit,
    on,
    exit,
    outcome,
    // Copied from the ledger into the record on purpose: the record has to be
    // readable on its own, and it also has to be possible to notice that a
    // run's claims predate an edit to what the check claims to cover.
    covers,
    residue,
    // Enough to see why it failed without re-running it; not so much that a
    // verbose producer buries the record it belongs to.
    tail: tail(output, 12),
  };
  writeFileSync(evidencePath(check.id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  records.push(record);

  console.log(
    `     → ${outcome} (exit ${exit}) · ` +
      (outcome === "pass"
        ? `${covers.length} step(s) discharged`
        : `0 of ${covers.length} claimed step(s) discharged — they stay human`) +
      "\n",
  );
}

const green = records.filter((r) => r.outcome === "pass");
const discharged = green.reduce((n, r) => n + r.covers.length, 0);
const claimed = records.reduce((n, r) => n + r.covers.length, 0);
const stillHuman = records.reduce((n, r) => n + r.residue.length, 0);

console.log(`  ${"─".repeat(72)}`);
console.log(
  `  ${green.length}/${records.length} producers green · ` +
    `${discharged}/${claimed} runbook steps discharged · ${stillHuman} named residues still human`,
);
for (const r of records.filter((x) => x.outcome !== "pass")) {
  console.log(`    ${r.outcome === "unknown" ? "?" : "✗"} ${r.check} — ${r.run} (exit ${r.exit})`);
}
// The guide renders these records, so it is stale the moment this writes one —
// and gate:validation is about to say so. Regenerate it here for the same
// reason record-validation.mjs does: a green build should not depend on
// remembering a second command, and the phone should never be reading a page
// that disagrees with the terminal about who still has work to do.
const guide = spawnSync(process.execPath, [join(ROOT, "scripts", "build-validation-guide.mjs")], {
  stdio: "inherit",
});
if (guide.status !== 0) process.exit(guide.status ?? 1);

console.log(
  `\n  Nothing above discharges a residue; that is what the ${stillHuman} named lines are for.\n`,
);

// Deliberately exit 0 even when a producer failed. This is a reporting run, not
// a gate: the gate's job is to catch a ledger that lies about its evidence, and
// it does that from the records this wrote. A red producer is a real finding
// (today `make source-offer` is red because the repo is private — that IS the
// answer) and it belongs in a record, not in a broken build.

/** Last `n` non-blank lines, for the record's tail. */
function tail(text, n) {
  return text.split("\n").filter((l) => l.trim()).slice(-n);
}

function indent(text) {
  return text
    .split("\n")
    .map((l) => (l ? `     │ ${l}` : "     │"))
    .join("\n")
    .replace(/(\s*│)+$/, "\n");
}

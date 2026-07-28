#!/usr/bin/env node
/**
 * CI gate: the manual-validation ledger is well-formed, every outstanding human
 * check is actually followable, and no `done` result has gone stale.
 *
 * This gate deliberately does NOT fail on `pending` work. A pending check is a
 * fact about the project, not a broken build — failing on it would mean the tree
 * is red for weeks because someone has not held a phone yet, and a permanently
 * red gate teaches everyone to ignore it. What it fails on is the ledger lying:
 * a malformed entry, a `done` with no evidence, a recurring check whose result
 * has expired, a check that claims to tune nothing (which means we are paying a
 * human for a result and then banking none of it), or a pending human check with
 * no runbook — a check nobody can follow is a check that will not be run, and it
 * should not be able to sit in the register looking tracked.
 *
 * Pending work is *reported*, loudly, with what it blocks — so `pnpm gates`
 * doubles as the answer to "what is this project actually waiting on?".
 *
 * Also the terminal renderer for a runbook:
 *
 *   node scripts/gate-validation.mjs --check perf-verdict-on-device
 *
 * The runbook itself is never written here. It lives in the ledger, and the
 * guide (docs/validation/guide.html) renders the same source for the phone.
 */
import { existsSync } from "node:fs";
import {
  readLedger,
  ledgerHash,
  guideHash,
  needsRunbook,
  shotPath,
  readEvidence,
} from "./validation-ledger.mjs";

const ledger = readLedger();
const checks = ledger.checks ?? [];

const wanted = (() => {
  const i = process.argv.indexOf("--check");
  return i >= 0 ? process.argv[i + 1] : null;
})();
if (wanted) {
  printRunbook(wanted);
  process.exit(0);
}

const STATUSES = new Set(["pending", "done", "superseded"]);
const REQUIRED = ["id", "title", "why", "how", "owner", "status", "tunes"];

// Fixed clock source: the gate must give the same answer twice in a row, and
// CI runs at unpredictable times. Staleness is measured against the newest
// `verifiedOn` in the ledger — i.e. "has anything been validated since this
// expired?" — rather than against wall-clock now, which would flip the build
// red overnight with no commit in between.
const dates = checks.map((c) => c.verifiedOn).filter(Boolean).sort();
const asOf = dates.length ? dates[dates.length - 1] : null;

const errors = [];
const pending = [];
const stale = [];
const seen = new Set();

for (const check of checks) {
  const where = check.id ? `check "${check.id}"` : `check ${JSON.stringify(check).slice(0, 60)}`;

  for (const field of REQUIRED) {
    if (check[field] === undefined) errors.push(`${where}: missing "${field}"`);
  }
  if (check.id && seen.has(check.id)) errors.push(`duplicate id "${check.id}"`);
  if (check.id) seen.add(check.id);

  if (check.status && !STATUSES.has(check.status)) {
    errors.push(`${where}: status "${check.status}" is not one of ${[...STATUSES].join(", ")}`);
  }

  if (Array.isArray(check.tunes) && check.tunes.length === 0 && check.status !== "superseded") {
    errors.push(
      `${where}: tunes nothing. A manual check whose result changes no threshold, ` +
        `fixture or gate has to be re-run by hand forever — say what it feeds, or drop it.`,
    );
  }

  // A pending human check with no runbook is the failure this register was
  // built to stop: it looks tracked, and it will still be pending in six loops
  // because nobody can tell what to do with the phone in their hand.
  if (needsRunbook(check) && !(check.runbook?.steps ?? []).length) {
    errors.push(
      `${where}: pending, owned by a human, and has no "runbook.steps". Write the ` +
        `steps (do + expect) in the ledger — they render to the terminal, to ` +
        `docs/validation/guide.html, and into the validate skill.`,
    );
  }
  const stepIds = new Set();
  for (const [i, step] of (check.runbook?.steps ?? []).entries()) {
    if (step.id) {
      if (stepIds.has(step.id)) {
        errors.push(`${where}: two runbook steps share the id "${step.id}"`);
      }
      stepIds.add(step.id);
    }
    if (!step.do || !step.expect) {
      errors.push(
        `${where}: runbook.steps[${i}] needs both "do" and "expect". A step with no ` +
          `expectation cannot be failed, so it cannot be passed either.`,
      );
    }
    if (!step.why) {
      errors.push(
        `${where}: runbook.steps[${i}] has no "why". An expectation nobody can ` +
          `justify is one a tired reader waves through — say what the step buys.`,
      );
    }
    // A `shot` naming a file that is not there renders as a broken image on the
    // phone, which reads as a broken guide. The fix is one command, so name it.
    if (step.shot && !existsSync(shotPath(step.shot))) {
      errors.push(
        `${where}: runbook.steps[${i}] wants screenshot "${step.shot}", but ` +
          `docs/validation/shots/${step.shot}.png does not exist — run: make shots`,
      );
    }
  }

  // The evidence contract. An `evidence` block says a command discharges some
  // of a human's steps, which is the one thing in this register that can take
  // work *away* from the person holding the phone — so it is the one thing that
  // has to be hardest to get wrong. A `covers` that names a step which is not
  // there strikes nothing (or, worse, strikes the wrong line after a reorder),
  // and an `evidence` with no `residue` is a claim to have automated a manual
  // check entirely, which has never once been true here.
  if (check.evidence) {
    const ev = check.evidence;
    if (!ev.run) errors.push(`${where}: evidence has no "run" — name the command that produces it`);
    if (!(ev.covers ?? []).length) {
      errors.push(
        `${where}: evidence covers no steps. A producer that discharges nothing is a ` +
          `command to run, not evidence — put it in runbook.setup instead.`,
      );
    }
    if (!(ev.residue ?? []).length) {
      errors.push(
        `${where}: evidence declares no "residue". Say in words what the command ` +
          `cannot do. Every check here still needs a human for something, and an ` +
          `automated run that names no remainder is one claiming to have done ` +
          `their job.`,
      );
    }
    for (const id of ev.covers ?? []) {
      if (!stepIds.has(id)) {
        errors.push(
          `${where}: evidence covers "${id}", which is not a runbook step id. ` +
            `Give the step an "id" (ids, never positions — a reordered runbook ` +
            `must not silently re-point this). Steps with ids: ` +
            `${[...stepIds].join(", ") || "(none)"}`,
        );
      }
    }
  }

  if (check.status === "done") {
    if (!check.verifiedOn) errors.push(`${where}: done, but no "verifiedOn"`);
    if (!check.result) errors.push(`${where}: done, but no "result" — the verdict is the artifact`);

    if (check.staleAfterDays && check.verifiedOn && asOf) {
      const age = Math.round(
        (Date.parse(asOf) - Date.parse(check.verifiedOn)) / 86_400_000,
      );
      if (age > check.staleAfterDays) {
        stale.push(`${check.id}: last verified ${check.verifiedOn}, ${age}d ago (limit ${check.staleAfterDays}d)`);
      }
    }
  }

  if (check.status === "pending") {
    pending.push(check);
  }
}

// The guide is generated and committed, so it can drift from its source in a
// diff that looks innocent. Same rule the ETL shards live under: a committed
// artifact is only trustworthy if a gate proves it was regenerated.
const want = ledgerHash(checks);
const have = guideHash();
if (have === null) {
  errors.push(`docs/validation/guide.html is missing or unstamped — run: make guide`);
} else if (have !== want) {
  errors.push(
    `docs/validation/guide.html is stale (built from ${have}, ledger is ${want}) — run: make guide`,
  );
}

if (errors.length || stale.length) {
  console.error("gate:validation — FAIL\n");
  for (const e of errors) console.error(`  ${e}`);
  for (const s of stale) console.error(`  STALE — ${s}`);
  console.error("");
  process.exit(1);
}

console.log(`gate:validation — OK (${checks.length} checks, ledger well-formed)`);

if (pending.length) {
  console.log(`\n  ${pending.length} manual validation(s) outstanding — these are not build failures:`);
  for (const p of pending) {
    const blocks = (p.blocks ?? []).length ? ` → blocks ${p.blocks.join(", ")}` : "";
    console.log(`    · [${p.owner}] ${p.title}${blocks}`);
    console.log(`      make validate CHECK=${p.id}`);
  }
  console.log(`\n  Read one on your phone with "make guide"; record a result with "make record".`);
}

// What the machine has already taken off those runbooks. Printed with the
// outstanding list rather than separately because it answers the follow-up
// question to "what is this waiting on?" — namely "and how much of it still
// actually needs me?".
const producers = checks.filter((c) => c.evidence?.run);
if (producers.length) {
  const runs = producers.map((c) => ({ check: c, ran: readEvidence(c.id) }));
  const green = runs.filter((r) => r.ran?.outcome === "pass");
  const claimed = producers.reduce((n, c) => n + (c.evidence.covers ?? []).length, 0);
  const struck = green.reduce((n, r) => n + (r.check.evidence.covers ?? []).length, 0);
  const dates = runs.map((r) => r.ran?.ranAt).filter(Boolean).sort();
  const residues = producers.reduce((n, c) => n + (c.evidence.residue ?? []).length, 0);

  console.log(
    `\n  automated evidence: ${green.length}/${producers.length} producers green · ` +
      `${struck}/${claimed} runbook steps discharged` +
      (dates.length ? ` · last run ${dates[dates.length - 1].slice(0, 10)}` : "") +
      `\n  ${residues} named residue(s) no command can reach — those stay human by design.`,
  );
  for (const { check, ran } of runs) {
    if (ran?.outcome === "pass") continue;
    const mark = !ran ? "·" : ran.outcome === "unknown" ? "?" : "✗";
    const why = !ran ? "never run here" : `${ran.outcome} (exit ${ran.exit})`;
    console.log(`    ${mark} ${check.id} — ${check.evidence.run} → ${why}`);
  }
  // One command, not two: validate-auto regenerates the guide itself, because a
  // record it wrote and a guide nobody rebuilt is exactly the disagreement
  // between the terminal and the phone this feature exists to prevent.
  console.log(`\n  Refresh with "make validate-auto".`);
}

/**
 * Print one check's runbook. Wrapped at 76 columns because this is read in a
 * terminal beside the thing being tested, not scrolled.
 */
function printRunbook(id) {
  const check = checks.find((c) => c.id === id);
  if (!check) {
    console.error(`\n  No check "${id}" in the ledger. Available:\n`);
    for (const c of checks) console.error(`    ${c.id}  (${c.status})`);
    console.error("");
    process.exit(2);
  }

  const rb = check.runbook ?? {};
  const rule = "  " + "─".repeat(72);

  console.log(`\n  ${check.title}`);
  console.log(`  ${check.id} · ${check.status}${check.verifiedOn ? ` · verified ${check.verifiedOn}` : ""}`);
  if ((check.blocks ?? []).length) console.log(`  blocks: ${check.blocks.join(", ")}`);
  if (check.staleAfterDays) console.log(`  repeats: goes stale after ${check.staleAfterDays} days`);
  console.log(rule);
  console.log(wrap(check.why, "  "));

  section("What you need", rb.needs);
  if ((rb.setup ?? []).length) {
    console.log(`\n  Setup (here, on this machine)`);
    for (const s of rb.setup) {
      console.log(`\n    $ ${s.run}`);
      if (s.expect) console.log(wrap(`→ ${s.expect}`, "      "));
    }
  }
  // A step the machine has already done, on this tree, with a real exit code.
  // Only a `pass` strikes: a producer that could not tell (exit 3) has proved
  // nothing, and leaving the step for the human is the entire safeguard.
  const ran = check.evidence?.run ? readEvidence(check.id) : null;
  const struck = new Set(ran?.outcome === "pass" ? (check.evidence.covers ?? []) : []);
  if (check.evidence?.run) {
    console.log(`\n  Already done for you`);
    console.log(`\n    $ ${check.evidence.run}`);
    console.log(
      wrap(
        ran
          ? `→ ${ran.outcome} · ${ran.ranAt.slice(0, 10)} · ${ran.commit ?? "?"} · ${ran.on}` +
              (struck.size ? ` — ${struck.size} step(s) below are struck` : ` — nothing struck`)
          : `→ never run here. Run "make validate-auto" and every step below stays yours.`,
        "      ",
      ),
    );
    for (const r of check.evidence.residue ?? []) console.log(wrap(`still yours: ${r}`, "      ", 18));
  }

  if ((rb.steps ?? []).length) {
    console.log(`\n  Steps`);
    for (const [i, s] of rb.steps.entries()) {
      const done = s.id && struck.has(s.id);
      console.log("");
      console.log(wrap(`${String(i + 1).padStart(2)}. ${done ? "[machine] " : ""}${s.do}`, "    ", 8));
      if (done) {
        console.log(wrap(`skip it — ${check.evidence.run} did this on ${ran.ranAt.slice(0, 10)}`, "        "));
        continue;
      }
      console.log(wrap(`expect: ${s.expect}`, "        "));
      if (s.why) console.log(wrap(`why:    ${s.why}`, "        "));
      // A path, not a picture. The terminal cannot show it; the phone can, and
      // this is the line that tells you the phone would have been better here.
      if (s.shot) console.log(`        see:    docs/validation/shots/${s.shot}.png  (make guide)`);
    }
  }
  section("Reading the result", rb.reading);

  console.log(`\n  Record it`);
  console.log(`\n    ${rb.record ?? `make record CHECK=${check.id} RESULT='<the verdict>'`}`);
  console.log(`\n  Then do what it tunes — this is the step that makes it worth the cost:`);
  for (const t of check.tunes ?? []) console.log(wrap(`· ${t}`, "    ", 6));
  if (check.record) console.log(`\n  Written up in: ${check.record}`);
  console.log("");
}

function section(title, lines) {
  if (!(lines ?? []).length) return;
  console.log(`\n  ${title}`);
  for (const line of lines) {
    console.log("");
    console.log(wrap(`· ${line}`, "    ", 6));
  }
}

/** Word-wrap to 76 columns with a first-line indent and an optional hanging indent. */
function wrap(text, indent, hang = indent.length) {
  const width = 76 - indent.length;
  const hanging = " ".repeat(hang);
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out.map((l, i) => (i === 0 ? indent + l : hanging + l)).join("\n");
}

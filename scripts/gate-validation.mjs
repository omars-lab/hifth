#!/usr/bin/env node
/**
 * CI gate: the manual-validation ledger is well-formed, and no `done` result has
 * gone stale.
 *
 * This gate deliberately does NOT fail on `pending` work. A pending check is a
 * fact about the project, not a broken build — failing on it would mean the tree
 * is red for weeks because someone has not held a phone yet, and a permanently
 * red gate teaches everyone to ignore it. What it fails on is the ledger lying:
 * a malformed entry, a `done` with no evidence, a recurring check whose result
 * has expired, or a check that claims to tune nothing (which means we are paying
 * a human for a result and then banking none of it).
 *
 * Pending work is *reported*, loudly, with what it blocks — so `pnpm gates`
 * doubles as the answer to "what is this project actually waiting on?".
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LEDGER = join(ROOT, "docs", "validation", "ledger.json");

if (!existsSync(LEDGER)) {
  console.error(`gate:validation — FAIL: ledger missing at ${LEDGER}`);
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
const checks = ledger.checks ?? [];
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
  }
  console.log(`\n  Run them with the "validate" skill; record results in docs/validation/ledger.json.`);
}

/**
 * Shared reader for docs/validation/ledger.json.
 *
 * Three renderers read this file — the gate (terminal), the guide builder
 * (HTML), and the recorder — and a runbook that says one thing in the terminal
 * and another on the phone is worse than no runbook, because the disagreement
 * is silent. So the parsing, the hash, and the "is this check runnable" answer
 * live here once rather than three times.
 *
 * A fourth reader, scripts/validate-auto.mjs, runs each check's declared
 * `evidence.run` and writes what happened into docs/validation/evidence/. It
 * is the only writer of those files; everything here only reads them.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const LEDGER_PATH = join(ROOT, "docs", "validation", "ledger.json");
export const GUIDE_PATH = join(ROOT, "docs", "validation", "guide.html");
export const SHOTS_DIR = join(ROOT, "docs", "validation", "shots");
export const EVIDENCE_DIR = join(ROOT, "docs", "validation", "evidence");

/** Where a step's `shot` id lives on disk. Written by `make shots`, never by hand. */
export function shotPath(id) {
  return join(SHOTS_DIR, `${id}.png`);
}

/**
 * Where a check's evidence record lives. Derived from the id, never stored in
 * the ledger beside it — a path written down in two places is a path that can
 * disagree with itself, and this one is a pure function of the id.
 */
export function evidencePath(id) {
  return join(EVIDENCE_DIR, `${id}.json`);
}

/**
 * The last recorded run of a check's `evidence.run`, or null if it has never
 * been run here. Written only by scripts/validate-auto.mjs, from the real
 * command's real exit code — the same rule the screenshots live under, and for
 * the same reason: a hand-written pass is not evidence of anything.
 */
export function readEvidence(id) {
  const path = evidencePath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * How an evidence producer's exit code reads.
 *
 * 3 is "could not tell", not a pass — check-source-offer.mjs already draws that
 * distinction (a 404 is a verdict, a timeout is not), and it generalises: an
 * automated run that could not reach its subject must not strike a human step
 * off the runbook. Anything else non-zero is a fail.
 */
export function outcomeOf(exit) {
  if (exit === 0) return "pass";
  if (exit === 3) return "unknown";
  return "fail";
}

export function readLedger() {
  if (!existsSync(LEDGER_PATH)) {
    console.error(`ledger missing at ${LEDGER_PATH}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
}

/**
 * The slice of the ledger the guide renders — and therefore the slice whose
 * change makes a committed guide.html stale. Deliberately not the whole file:
 * editing the `$comment` block should not fail a build over a generated page
 * that does not show it.
 */
export function guidePayload(checks) {
  return checks.map((c) => ({
    id: c.id,
    title: c.title,
    why: c.why,
    owner: c.owner,
    status: c.status,
    blocks: c.blocks ?? [],
    staleAfterDays: c.staleAfterDays ?? null,
    tunes: c.tunes ?? [],
    verifiedOn: c.verifiedOn ?? null,
    result: c.result ?? null,
    runbook: c.runbook ?? null,
    evidence: c.evidence ?? null,
    // The run itself, not just the declaration — because the guide strikes
    // steps off the runbook based on it. A `make validate-auto` that turned a
    // step from human to discharged, with no `make guide` after it, would leave
    // a phone-readable page telling someone to do work the machine has done.
    // Only the fields the card shows: an output tail nobody renders should not
    // be able to fail a build for a stale guide.
    ran: (() => {
      const e = readEvidence(c.id);
      return e ? { run: e.run, ranAt: e.ranAt, outcome: e.outcome, covers: e.covers ?? [] } : null;
    })(),
  }));
}

/** Stable short hash of the rendered slice; baked into guide.html as data-ledger-hash. */
export function ledgerHash(checks) {
  return createHash("sha256")
    .update(JSON.stringify(guidePayload(checks)))
    .digest("hex")
    .slice(0, 12);
}

/** The hash guide.html was built from, or null if there is no guide (or no stamp). */
export function guideHash() {
  if (!existsSync(GUIDE_PATH)) return null;
  const html = readFileSync(GUIDE_PATH, "utf8");
  const m = html.match(/data-ledger-hash="([0-9a-f]+)"/);
  return m ? m[1] : null;
}

/** A check a human still has to run, and that therefore needs a followable runbook. */
export function needsRunbook(check) {
  return check.status === "pending" && check.owner === "user";
}

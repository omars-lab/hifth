/**
 * Shared reader for docs/validation/ledger.json.
 *
 * Three renderers read this file — the gate (terminal), the guide builder
 * (HTML), and the recorder — and a runbook that says one thing in the terminal
 * and another on the phone is worse than no runbook, because the disagreement
 * is silent. So the parsing, the hash, and the "is this check runnable" answer
 * live here once rather than three times.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const LEDGER_PATH = join(ROOT, "docs", "validation", "ledger.json");
export const GUIDE_PATH = join(ROOT, "docs", "validation", "guide.html");

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

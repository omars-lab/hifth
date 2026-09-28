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
import { parseHash } from "../packages/core/dist/index.js";

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
    brief: c.brief ?? null,
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

/* ── the short version ─────────────────────────────────────────────────── */
//
// The runbook is written for the person who needs every reason; the guide is
// opened by a person who needs to know what to do. On 2026-09-28 the owner
// opened it and called it "a huge wall of text" — 166 KB, every reason and file
// path in view. So a pending human check also carries a `brief`: the plain
// question, why it matters, what you need, how long, when it is done, and one
// short line per step. The guide leads with that and folds the rest.

export const BRIEF_PARTS = ["label", "ask", "what", "need", "time", "done"];
export const SHORT_MAX = 140;

/** Everything missing from a check's short version, as sentences. Empty when fine. */
export function briefProblems(check) {
  if (!needsRunbook(check)) return [];
  const where = `check "${check.id}"`;
  if (!check.brief) {
    return [
      `${where}: pending, owned by a person, and has no "brief" — the short version the ` +
        `guide leads with (${BRIEF_PARTS.join(", ")}). See the validate skill.`,
    ];
  }
  const out = [];
  for (const part of BRIEF_PARTS) {
    if (!check.brief[part]) out.push(`${where}: brief.${part} is missing.`);
  }
  for (const [i, step] of (check.runbook?.steps ?? []).entries()) {
    if (!step.short) out.push(`${where}: runbook.steps[${i}] has no "short" — one line the guide shows in place of the full step.`);
    else if (step.short.length > SHORT_MAX) {
      out.push(`${where}: runbook.steps[${i}].short is ${step.short.length} characters; keep it under ${SHORT_MAX}.`);
    }
    out.push(...linkProblems(step, `${where}: runbook.steps[${i}]`));
  }
  return out;
}

/* ── links into the app ─────────────────────────────────────────────────── */
//
// Owner, 2026-09-28: "visit this anchor, look for abc … if an anchor doesn't
// exist, why not, how can we add", with "a hosted anchor and a local host
// anchor". A step done in the app carries `open` — the address after the
// app's root, and what to look for once there — and the guide shows it twice:
// on the live site and on this laptop. A step with no link yet says so in
// `noLink`: why not, and what would add one. The address is read by the app's
// own router here, so a link the app would refuse fails the build check
// instead of quietly misleading a person.

export const LIVE_APP = "https://blog.bytesofpurpose.com/hifth/";
export const LAPTOP_APP = "http://localhost:5173/";
const ONLY = new Set(["live", "laptop"]);

/** Does the app open this address? `?a=b#/…` — the part after `#` is the router's. */
export function appOpens(path) {
  const hash = path.includes("#") ? path.slice(path.indexOf("#")) : "";
  if (hash === "" || hash === "#" || hash === "#/") return true; // the app's front page
  return parseHash(hash) !== null;
}

function linkProblems(step, where) {
  const out = [];
  if (step.open && step.noLink) out.push(`${where} has both "open" and "noLink"; keep the one that is true.`);
  if (step.open) {
    const { path, look, only, onlyWhy } = step.open;
    if (typeof path !== "string") out.push(`${where}: open.path is missing.`);
    else if (!appOpens(path)) out.push(`${where}: open.path "${path}" is an address the app would not open.`);
    if (!look) out.push(`${where}: open.look is missing — say what to look for once the link opens.`);
    if (only !== undefined && !ONLY.has(only)) out.push(`${where}: open.only must be "live" or "laptop".`);
    if (only && !onlyWhy) out.push(`${where}: open.onlyWhy is missing — say why only the ${only} link applies.`);
  }
  if (step.noLink) {
    if (!step.noLink.why) out.push(`${where}: noLink.why is missing — say why there is no link.`);
    if (!step.noLink.add) out.push(`${where}: noLink.add is missing — say what would add one, or that none is needed.`);
  }
  return out;
}

/* ── diagrams ──────────────────────────────────────────────────────────── */
//
// Written in Mermaid, drawn once to SVG by scripts/render-diagrams.mjs and
// committed, so the guide stays one file with no scripts that opens offline on
// a phone. The file name is a hash of the source: change the words and the
// picture has to be drawn again, and the gate says so.

export const DIAGRAMS_DIR = join(ROOT, "docs", "validation", "diagrams");

export function diagramKey(source) {
  return createHash("sha256").update(source).digest("hex").slice(0, 12);
}

export function diagramPath(source) {
  return join(DIAGRAMS_DIR, `${diagramKey(source)}.svg`);
}

const nodeId = (id) => id.replace(/[^a-zA-Z0-9]/g, "_");
const label = (s) => String(s).replace(/"/g, "'");

/**
 * The guide's opening picture: every check left, what it unlocks, and which
 * must come first. Built from the briefs, never written by hand, so it cannot
 * disagree with the cards under it.
 */
export function overviewDiagram(checks) {
  const left = checks.filter((c) => needsRunbook(c) && c.brief);
  const goals = [...new Set(left.map((c) => c.brief.unlocks).filter(Boolean))];
  const lines = ["flowchart LR"];
  goals.forEach((g, i) => lines.push(`  goal${i}("${label(g)}"):::goal`));
  if (goals.length) lines.push("  classDef goal fill:#2a2116,stroke:#f0a65a,color:#f0a65a");
  for (const c of left) {
    lines.push(`  ${nodeId(c.id)}["${label(c.brief.label)}<br/><small>${label(c.brief.time)}</small>"]`);
  }
  for (const c of left) {
    for (const first of c.brief.after ?? []) lines.push(`  ${nodeId(first)} --> ${nodeId(c.id)}`);
    if (c.brief.unlocks) lines.push(`  ${nodeId(c.id)} --> goal${goals.indexOf(c.brief.unlocks)}`);
  }
  return lines.join("\n");
}

/** Every diagram the guide will draw, as Mermaid source. */
export function guideDiagrams(checks) {
  return [overviewDiagram(checks), ...checks.filter(needsRunbook).map((c) => c.brief?.diagram).filter(Boolean)];
}

/** The drawn SVGs that exist on disk, by key. A missing one is simply absent. */
export function readDiagrams(sources) {
  const out = {};
  for (const src of sources) {
    const p = diagramPath(src);
    if (existsSync(p)) out[diagramKey(src)] = readFileSync(p, "utf8");
  }
  return out;
}

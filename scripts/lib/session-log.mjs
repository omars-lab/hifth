/**
 * The transcript of a co-working session: what a person did while working a
 * ledger check, written down as they did it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * `docs/validation/ledger.json` has always ended a check the same way: one
 * sentence of `result`, typed on the laptop after the walkthrough is over. That
 * sentence is the artifact and it is worth having — but it is written from
 * memory. A person walks ten steps on a phone over fifteen minutes, and
 * whatever they noticed at step four survives only if they were still holding
 * it at step ten. Everything else is gone, and nobody can tell afterwards
 * whether a check produced a thin result because there was nothing to say or
 * because the saying happened too late.
 *
 * A transcript fixes the ordering: the observation lands on disk while the step
 * is still in front of you, and the `result` sentence at the end becomes a
 * summary of a record rather than a feat of recall.
 *
 * ── What it is not ───────────────────────────────────────────────────────
 *
 * It is not a second ledger. The ledger stays the register — the verdict, the
 * date, the status — and a transcript is the working underneath one entry in
 * it, the way `docs/validation/evidence/` is the working underneath a machine
 * half. Nothing reads a transcript to decide whether a check passed.
 *
 * ── Why JSONL, appended ──────────────────────────────────────────────────
 *
 * One event per line, `O_APPEND`, flushed per write. A session is twenty
 * minutes of a scarce person's attention and the thing being defended against
 * is losing it — a closed laptop, a killed terminal, a browser tab that went
 * away. Append-only costs one line in the worst case. A rewritten JSON document
 * costs the file.
 *
 * The lines are also a diff a human can read, which matters the day somebody
 * asks how a verdict was arrived at.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../validation-ledger.mjs";

export const SESSIONS_DIR = join(ROOT, "docs", "validation", "sessions");

/**
 * One file per session, named so an `ls` sorts chronologically and a filename
 * says which check it belongs to without being opened.
 */
export function sessionPath(checkId, stamp) {
  return join(SESSIONS_DIR, `${stamp}-${checkId}.jsonl`);
}

/** `2026-08-12T0641` — date-sortable, filename-safe, minute resolution. */
export function stampNow(now = new Date()) {
  return now.toISOString().slice(0, 16).replace(/:/g, "").replace("T", "T");
}

export function ensureDir() {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Append one event. The timestamp is stamped here rather than accepted from the
 * caller: the browser posting these has its own clock, its own timezone, and no
 * particular reason to be right, and a transcript whose times came from two
 * sources cannot be read as a sequence.
 */
export function append(path, event) {
  ensureDir();
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  appendFileSync(path, `${line}\n`, "utf8");
  return line;
}

/**
 * Read a transcript back. A truncated last line — the exact thing an append-only
 * log exists to survive — is dropped rather than thrown on, because a session
 * that died mid-write is precisely when you most want to read the rest of it.
 */
export function readSession(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a half-written final line: everything before it is still good */
    }
  }
  return out;
}

/** Every transcript for a check, newest first. */
export function sessionsFor(checkId) {
  if (!existsSync(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(`-${checkId}.jsonl`))
    .sort()
    .reverse()
    .map((f) => join(SESSIONS_DIR, f));
}

/**
 * A transcript that was started and never banked — the thing to offer to resume
 * rather than silently starting a second one beside it. Two half-sessions for
 * one check is the worst outcome available here: neither is the record, and the
 * person who finds them later cannot tell which was the real attempt.
 */
export function openSessionFor(checkId) {
  for (const path of sessionsFor(checkId)) {
    const events = readSession(path);
    if (events.length && !events.some((e) => e.kind === "verdict")) return { path, events };
  }
  return null;
}

/**
 * What the transcript adds up to.
 *
 * Deliberately arithmetic only — counts, the notes in order, the last verdict.
 * It does not judge, score, or grade anything, and the session server shows this
 * and nothing else while a check is being worked. That restraint is load-bearing
 * for at least one check in the ledger: `placement-correction-by-eye` is a blind
 * forced choice whose whole validity rests on nobody, the worker included,
 * knowing how it is going while it is going. A progress bar is fine. A running
 * score would quietly turn the measurement into a training exercise.
 */
export function summarise(events) {
  const head = events.find((e) => e.kind === "session") ?? null;
  const steps = new Map();
  const notes = [];
  const observations = [];
  const artifacts = [];
  let verdict = null;

  for (const e of events) {
    if (e.kind === "step") steps.set(e.stepId ?? `#${e.index}`, e);
    else if (e.kind === "note") {
      // Notes are typed and retyped; the transcript keeps every version (it is
      // append-only) but the summary shows the last one per step, which is what
      // the person meant to leave behind.
      const at = notes.findIndex((n) => n.stepId === e.stepId);
      if (at >= 0) notes[at] = e;
      else notes.push(e);
    } else if (e.kind === "observation") observations.push(e);
    else if (e.kind === "artifact") artifacts.push(e);
    else if (e.kind === "verdict") verdict = e;
  }

  const done = [...steps.values()].filter((s) => s.state === "done");
  return {
    check: head?.check ?? null,
    startedAt: head?.t ?? events[0]?.t ?? null,
    lastAt: events.at(-1)?.t ?? null,
    commit: head?.commit ?? null,
    stepsDone: done.length,
    stepsTotal: head?.stepsTotal ?? steps.size,
    notes: notes.filter((n) => (n.text ?? "").trim()),
    observations: observations.length,
    artifacts,
    verdict,
  };
}

/**
 * The transcript as a paragraph a person can paste into `make record`.
 *
 * A starting point, never the verdict itself. The ledger's `result` is a
 * judgement — "the correction is supported", "two leaves disagreed" — and no
 * reduction over a log can produce one. What this saves is the retyping of what
 * you already wrote down, which is exactly the part that gets dropped when the
 * walkthrough has run long.
 */
export function draftResult(summary) {
  const bits = [];
  if (summary.stepsTotal) bits.push(`${summary.stepsDone}/${summary.stepsTotal} steps`);
  if (summary.observations) bits.push(`${summary.observations} recorded answers`);
  const head = bits.join(" · ");
  const body = summary.notes.map((n) => n.text.trim()).join(" · ");
  return [head, body].filter(Boolean).join(" — ");
}

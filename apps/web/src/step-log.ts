/**
 * The reader's last few steps, by name only, kept in memory for the problem
 * report (launch item 19). "Turned to another page ×12, then chose a verse"
 * tells us how the reader got to a fault; which page and which verse it was
 * does not belong in a report, so a step is one of a fixed list of names and
 * carries no number, no verse and nothing the reader wrote. The test checks
 * that no digit from the view ever reaches the names.
 *
 * Steps come from one place: each change of what the app is showing, which
 * the address router already sees (`useHashRouter.ts`), plus the moment the
 * app opens and the moment a link is followed into it. Nothing is written to
 * storage or sent anywhere; reloading the page empties it, as with the kept
 * errors (`fault-log.ts`).
 */

import type { AppState } from "@hifth/core";

/**
 * A step, as a short code. The words the report prints for each ("turned to
 * another page") live in the report (`STEP_WORDS` in `problem-report.ts`),
 * which loads only when the reader opens it: this file is in the start-up
 * script, and the sentences cost bytes every reader downloads.
 */
export type StepName =
  | "open"
  | "link"
  | "turn"
  | "verse"
  | "verses"
  | "unselect"
  | "follow"
  | "back"
  | "skin"
  | "desk";

export interface Step {
  /** When it last happened. */
  readonly at: number;
  readonly name: StepName;
  /** How many times in a row; a run of page turns is one line. */
  readonly count: number;
}

/** How many lines are kept. A report needs the way in, not the whole visit. */
export const STEP_LIMIT = 20;

const steps: Step[] = [];

export function noteStep(name: StepName, at: number = Date.now()): void {
  const last = steps.at(-1);
  if (last && last.name === name) {
    steps[steps.length - 1] = { name, at, count: last.count + 1 };
    return;
  }
  steps.push({ name, at, count: 1 });
  if (steps.length > STEP_LIMIT) steps.splice(0, steps.length - STEP_LIMIT);
}

// Kept short on purpose: this file is in the start-up script.
const depth = (s: AppState): number => (s.via ? 1 : 0) + (s.trail?.length ?? 0);
const lastAyah = (s: AppState["select"]): number | undefined => (s && "toAyah" in s ? s.toAyah : undefined);

/** What the reader did between two views, as step names. */
export function stepsBetween(prev: AppState | null, next: AppState): StepName[] {
  if (!prev) return [];
  const out: StepName[] = [];
  const a = prev.select;
  const b = next.select;
  const moved = depth(next) - depth(prev);
  if (moved) out.push(moved > 0 ? "follow" : "back");
  // A missing selection reads as undefined on both sides, so two empty ones match.
  else if (a?.surah !== b?.surah || a?.ayah !== b?.ayah || lastAyah(a) !== lastAyah(b))
    out.push(!b ? "unselect" : lastAyah(b) !== undefined ? "verses" : "verse");
  else if (prev.page !== next.page) out.push("turn");
  if (prev.skin !== next.skin) out.push("skin");
  if (prev.field !== next.field) out.push("desk");
  return out;
}

export function noteViewChange(prev: AppState | null, next: AppState, at: number = Date.now()): void {
  for (const name of stepsBetween(prev, next)) noteStep(name, at);
}

/** The kept steps, oldest first. A copy, so a caller cannot change the record. */
export function recentSteps(): readonly Step[] {
  return steps.slice();
}

export function clearSteps(): void {
  steps.length = 0;
}

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

export type StepName =
  | "opened the app"
  | "opened a link"
  | "turned to another page"
  | "chose a verse"
  | "chose several verses"
  | "let go of the verse"
  | "followed a link to another verse"
  | "went back along the trail"
  | "changed the colouring"
  | "changed the desk";

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

function depth(state: AppState): number {
  return (state.via ? 1 : 0) + (state.trail?.length ?? 0);
}

function sameSelect(a: AppState["select"], b: AppState["select"]): boolean {
  if (a === null || b === null) return a === b;
  const aTo = "toAyah" in a ? a.toAyah : undefined;
  const bTo = "toAyah" in b ? b.toAyah : undefined;
  return a.surah === b.surah && a.ayah === b.ayah && aTo === bTo;
}

/** What the reader did between two views, as step names. */
export function stepsBetween(prev: AppState | null, next: AppState): StepName[] {
  if (!prev) return [];
  const out: StepName[] = [];
  const before = depth(prev);
  const after = depth(next);
  if (after > before) out.push("followed a link to another verse");
  else if (after < before) out.push("went back along the trail");
  else if (!sameSelect(prev.select, next.select)) {
    if (next.select === null) out.push("let go of the verse");
    else if ("toAyah" in next.select && next.select.toAyah !== undefined) out.push("chose several verses");
    else out.push("chose a verse");
  } else if (prev.page !== next.page) out.push("turned to another page");
  if (prev.skin !== next.skin) out.push("changed the colouring");
  if (prev.field !== next.field) out.push("changed the desk");
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

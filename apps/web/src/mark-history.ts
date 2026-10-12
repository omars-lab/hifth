/**
 * Undo and redo for the reader's kept marks (docs/design/notes-style-toolbar.md
 * ③, the owner's pick on 2026-10-12): the bookmarks, the notes and mistake
 * marks, and the jumps. Each is kept as a whole set and every change writes the
 * whole set back, so one step is simply the set as it was and the set as it
 * became; taking it back writes the old set again.
 *
 * A change that opens a box to type in (a fresh pin) takes in what is saved
 * from that box, so one Undo takes the pin and its words off together, rather
 * than leaving an empty pin behind; and a pin closed empty leaves no step at
 * all, so Undo never brings back something that was never there for the
 * reader. Any other change that happens to reverse the one before it (a slip
 * marked, then rubbed out) is a step of its own: the reader did both.
 */
export type MarkStore = "bookmarks" | "notes" | "jumps";

export interface MarkStep {
  readonly store: MarkStore;
  readonly before: unknown;
  readonly after: unknown;
  /** The line the change was announced with, said again when it is undone or redone. */
  readonly said: string;
  /** Opens a box to type in: the next change to the same store joins this step. */
  readonly folds?: boolean;
}

export interface MarkHistory {
  readonly past: readonly MarkStep[];
  readonly future: readonly MarkStep[];
}

/** How a store tells Undo about a change: the set before, the set after, and what was said. */
export type Recorder = (before: unknown, after: unknown, said: string, opens?: boolean) => void;

/**
 * How a change is kept. `opens`: it opens a box to type in, and what the box
 * saves joins it. `unrecorded`: Undo does not hear it at all (a file loaded,
 * a bookmark's last-opened time).
 */
export interface CommitHow {
  readonly opens?: boolean;
  readonly unrecorded?: boolean;
}

export const NO_HISTORY: MarkHistory = { past: [], future: [] };

/** How many steps back Undo reaches. */
export const HISTORY_DEPTH = 100;

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/** A new change: it goes on the past, and whatever could have been redone is gone. */
export function recordStep(h: MarkHistory, step: MarkStep): MarkHistory {
  if (same(step.before, step.after)) return h;
  const last = h.past[h.past.length - 1];
  if (last?.folds && last.store === step.store && same(last.after, step.before)) {
    const joined: MarkStep = { store: step.store, before: last.before, after: step.after, said: step.said || last.said, ...(step.folds ? { folds: true } : {}) };
    const past = h.past.slice(0, -1);
    return { past: same(joined.before, joined.after) ? past : [...past, joined], future: [] };
  }
  return { past: [...h.past, step].slice(-HISTORY_DEPTH), future: [] };
}

/** The step to take back, and the history after it; null when there is nothing to undo. */
export function undoStep(h: MarkHistory): { step: MarkStep; history: MarkHistory } | null {
  const step = h.past[h.past.length - 1];
  if (!step) return null;
  return { step, history: { past: h.past.slice(0, -1), future: [step, ...h.future] } };
}

/** The step to do again, and the history after it; null when there is nothing to redo. */
export function redoStep(h: MarkHistory): { step: MarkStep; history: MarkHistory } | null {
  const step = h.future[0];
  if (!step) return null;
  return { step, history: { past: [...h.past, step], future: h.future.slice(1) } };
}

/** Whether a key press is meant for the box being typed in, not for the page's Undo. */
export function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

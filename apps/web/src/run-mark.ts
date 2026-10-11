/**
 * How the page shows which verse a "Play to" run is reciting, and where the
 * reader's choice is kept (docs/PLAN.md, item 57).
 *
 *   light  the verse's light moves with the recitation, one verse at a time,
 *          and comes back to the verse the run started from once it is over.
 *          The default: it is what a listener following along already expects
 *          from other Qur'an players, and there is only ever one mark.
 *   ring   the verse the run started from stays lit, and a ring goes round the
 *          verse being recited. Two marks, so the run's start is never lost.
 *
 * Either way the chosen verse itself does not move: moving it would stop the
 * recitation and open the verse's notes in the pitch build.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `turn-style.ts` keeps.
 */

export type RunMark = "light" | "ring";

/** In settings order. */
export const RUN_MARKS: readonly RunMark[] = ["light", "ring"];

/** Versioned: an option that later changes what it does gets a new key. */
export const RUN_MARK_KEY = "hifth.run.mark.v1";

function isRunMark(value: unknown): value is RunMark {
  return value === "light" || value === "ring";
}

/** The option this device chose, or the moving light when it never chose. */
export function savedRunMark(): RunMark {
  try {
    const stored = localStorage.getItem(RUN_MARK_KEY);
    return isRunMark(stored) ? stored : "light";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "light";
  }
}

export function rememberRunMark(choice: RunMark): void {
  try {
    localStorage.setItem(RUN_MARK_KEY, choice);
  } catch {
    /* nothing to do — see savedRunMark */
  }
}

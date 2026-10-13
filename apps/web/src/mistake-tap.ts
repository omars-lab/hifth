/**
 * What a tap on a word does under the Mistake pen, and where the reader's
 * choice is kept (docs/PLAN.md, item 103).
 *
 *   ask    the tap asks what went wrong: the harakat (pick the sign), the
 *          whole word, or another verse it went into; nothing is marked
 *          until the reader says (the owner, 2026-10-13; the default);
 *   quiet  the tap marks the whole word at once, and a second tap on it asks
 *          (page-toolbar-plan step 3, as first built on 2026-09-25).
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key
 * rather than retyping it — the discipline `mark-tools.ts` keeps.
 */

export type MistakeTap = "ask" | "quiet";

/** In settings order. */
export const MISTAKE_TAPS: readonly MistakeTap[] = ["ask", "quiet"];

/** Versioned: a choice that later changes what it does gets a new key. */
export const MISTAKE_TAP_KEY = "hifth.tools.mistake.v1";

export function savedMistakeTap(): MistakeTap {
  try {
    return localStorage.getItem(MISTAKE_TAP_KEY) === "quiet" ? "quiet" : "ask";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "ask";
  }
}

export function rememberMistakeTap(choice: MistakeTap): void {
  try {
    localStorage.setItem(MISTAKE_TAP_KEY, choice);
  } catch {
    /* nothing to do — see savedMistakeTap */
  }
}

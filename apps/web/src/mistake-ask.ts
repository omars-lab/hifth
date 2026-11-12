/**
 * How the Mistake pen's question is laid out, now that it asks the kind of
 * mistake as well as where (the owner, 2026-11-12, on the front page: a slip
 * might be the harakah, a letter said from the wrong place, or a tajweed rule
 * left out, not only the word). Three ways, built to be chosen by hand; the
 * one the owner picks becomes the default and the others stay as this setting.
 *
 *   steps  the kinds first, one button each; picking one shows its choices,
 *          with a way back (what the owner asked for);
 *   tabs   the kinds as tabs along the top, the picked one's choices under them;
 *   list   every choice at once, grouped by kind: the old question, with
 *          letters and rules added under it (the default until a pick, since
 *          it keeps every answer one tap away).
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type MistakeAsk = "steps" | "tabs" | "list";

/** In settings order. */
export const MISTAKE_ASKS: readonly MistakeAsk[] = ["steps", "tabs", "list"];

/** Versioned: a choice that later changes what it does gets a new key. */
export const MISTAKE_ASK_KEY = "hifth.tools.mistakeAsk.v1";

export const DEFAULT_MISTAKE_ASK: MistakeAsk = "list";

export function savedMistakeAsk(): MistakeAsk {
  try {
    const v = localStorage.getItem(MISTAKE_ASK_KEY);
    return (MISTAKE_ASKS as readonly string[]).includes(v ?? "") ? (v as MistakeAsk) : DEFAULT_MISTAKE_ASK;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember gets the default.
    return DEFAULT_MISTAKE_ASK;
  }
}

export function rememberMistakeAsk(choice: MistakeAsk): void {
  try {
    localStorage.setItem(MISTAKE_ASK_KEY, choice);
  } catch {
    /* nothing to do — see savedMistakeAsk */
  }
}

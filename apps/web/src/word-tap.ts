/**
 * What a second tap on a verse that is already lit does (decision
 * selection-drawer, open question ①).
 *
 * The owner asked on the drawer page whether a tap on a word gets a word
 * drawer stacked on top of the verse's. Both ways are built and the reader
 * picks in settings; today's way stays the default until the owner has tried
 * the other by hand.
 *
 *   off   today's way: a second tap on the lit verse puts it out.
 *   word  a second tap opens the word under the finger into its letters and
 *         signs, in a drawer stacked above the verse's drawer, which stays.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */

export type WordTap = "off" | "word";

/** In settings order. */
export const WORD_TAPS: readonly WordTap[] = ["off", "word"];

/** Versioned: an option that later changes what it does gets a new key. */
export const WORD_TAP_KEY = "hifth.word.tap.v1";

function isWordTap(value: unknown): value is WordTap {
  return value === "off" || value === "word";
}

/** The option this device chose, or today's way when it never chose. */
export function savedWordTap(): WordTap {
  try {
    const stored = localStorage.getItem(WORD_TAP_KEY);
    return isWordTap(stored) ? stored : "off";
  } catch {
    // Safari private mode throws on localStorage.
    return "off";
  }
}

export function rememberWordTap(choice: WordTap): void {
  try {
    localStorage.setItem(WORD_TAP_KEY, choice);
  } catch {
    /* nothing to do — see savedWordTap */
  }
}

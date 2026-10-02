/**
 * What a tap and a hold on a verse do, and where the reader's choice is kept.
 *
 * The owner settled this on 2026-10-01 (docs/design/verse-tap-and-hold.md):
 * all three options built, the reader picks in settings, C by default. The note
 * itself recommended A; switching the default is the one line in
 * `savedVerseGestures`.
 *
 *   a   a tap hides or shows the bars; a hold opens the verse menu, with Play
 *       to, Mark, Note and Copy added.
 *   b   a tap opens that fuller menu, and so does a hold; full screen is a
 *       button in the bottom line, with a small button left to come back.
 *   c   a tap opens today's menu, exactly as before; a hold opens a second,
 *       small menu beside the verse with the four new buttons. Full screen as
 *       in B.
 *
 * On a computer a click always opens the menu (a mouse has no natural hold),
 * and F switches full screen in every option.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `turn-style.ts` keeps.
 */

export type VerseGestures = "a" | "b" | "c";

/** In settings order. */
export const VERSE_GESTURES: readonly VerseGestures[] = ["a", "b", "c"];

/** Versioned: an option that later changes what it does gets a new key. */
export const VERSE_GESTURES_KEY = "hifth.verse.gestures.v1";

function isVerseGestures(value: unknown): value is VerseGestures {
  return value === "a" || value === "b" || value === "c";
}

/** The option this device chose, or C when it never chose. */
export function savedVerseGestures(): VerseGestures {
  try {
    const stored = localStorage.getItem(VERSE_GESTURES_KEY);
    return isVerseGestures(stored) ? stored : "c";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "c";
  }
}

export function rememberVerseGestures(choice: VerseGestures): void {
  try {
    localStorage.setItem(VERSE_GESTURES_KEY, choice);
  } catch {
    /* nothing to do — see savedVerseGestures */
  }
}

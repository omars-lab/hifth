/**
 * How a drawer shows what it sits on (docs/design/ayah-drawer.md ①).
 *
 * The owner asked on 2026-11-07 that it always be clear which drawer is open
 * and which sits on which: settings, then the verse, then the word. Both ways
 * are built and the reader picks in the info panel.
 *
 *   path  the word's drawer heads with the verse under it, as a button that
 *         steps back down to it, then "The parts of a word".
 *   tag   each drawer carries a small tag naming its level (Settings, Verse,
 *         Word), and the word's drawer is edged in the accent colour.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type DrawerMarks = "path" | "tag";

/** In settings order. */
export const DRAWER_MARKS: readonly DrawerMarks[] = ["path", "tag"];

/** Versioned: an option that later changes what it does gets a new key. */
export const DRAWER_MARKS_KEY = "hifth.drawer.marks.v1";

/** The option this device chose, or the path when it never chose. */
export function savedDrawerMarks(): DrawerMarks {
  try {
    return localStorage.getItem(DRAWER_MARKS_KEY) === "tag" ? "tag" : "path";
  } catch {
    // Safari private mode throws on localStorage: the default.
    return "path";
  }
}

export function rememberDrawerMarks(choice: DrawerMarks): void {
  try {
    localStorage.setItem(DRAWER_MARKS_KEY, choice);
  } catch {
    /* nothing to do — see savedDrawerMarks */
  }
}

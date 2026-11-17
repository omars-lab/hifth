/**
 * "The new layout" (the layout plan's item ②, docs/design/app-layout.md): one
 * switch that moves moving-through-the-book and how-the-page-is-shown onto the
 * page bar at the bottom. A rough build, off until it has been tried on an iPad
 * and a laptop:
 *
 *   today  the controls stay where they are (default)
 *   bar    the page label on the bar opens Go to; one page or two, the size
 *          buttons and Full screen sit on the bar beside the slider; the page
 *          turns are drawn as keyboard keys and name their key, so the pictures
 *          of keys leave the top bar. The slider itself does not change.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it: the discipline `jump-arrows.ts` keeps.
 */

export type NewLayout = "today" | "bar";

/** In settings order. */
export const NEW_LAYOUTS: readonly NewLayout[] = ["today", "bar"];

/** Versioned: a way that later changes what it does gets a new key. */
export const NEW_LAYOUT_KEY = "hifth.layout.v1";

/** What this device chose, or today's layout when it never chose. */
export function savedNewLayout(): NewLayout {
  try {
    return localStorage.getItem(NEW_LAYOUT_KEY) === "bar" ? "bar" : "today";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "today";
  }
}

export function rememberNewLayout(choice: NewLayout): void {
  try {
    localStorage.setItem(NEW_LAYOUT_KEY, choice);
  } catch {
    /* nothing to do: see savedNewLayout */
  }
}

/**
 * Where the page tools go in full screen on a phone or an upright iPad
 * (decision verse-tap-and-hold ①; backlog full-screen-keeps-tools). A laptop
 * and an iPad on its side keep them down the side (full-screen-tools.ts); a
 * screen too narrow for that put them away with the bars, so marking a mistake
 * meant leaving full screen first. Built three ways:
 *
 *   button  a round Tools button stays in the bottom corner, across from the
 *           way back; the tray it opens folds back once a tool is picked, so
 *           it never lies on the page's last lines (default)
 *   row     the bottom line stays, tools and all; only the top bar and the
 *           page slider go
 *   none    full screen puts them away with the other bars, as before
 *
 * Only the bottom line the app shows (C, the Tools tray) has a button to keep.
 * The two layouts that lost the phone-toolbar decision, A and B, are reached
 * only through the design page's own address (`?phonebar=a|b`), never by a
 * reader's setting; there "button" simply puts the tools away, as "none" does.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */

export type TouchFullTools = "button" | "row" | "none";

/** In settings order. */
export const TOUCH_FULL_TOOLS: readonly TouchFullTools[] = ["button", "row", "none"];

/** Versioned: an option that later changes what it does gets a new key. */
export const TOUCH_FULL_TOOLS_KEY = "hifth.full-screen.touch-tools.v1";

const DEFAULT: TouchFullTools = "button";

function isTouchFullTools(value: unknown): value is TouchFullTools {
  return value === "button" || value === "row" || value === "none";
}

/** The option this device chose, or the default when it never chose. */
export function savedTouchFullTools(): TouchFullTools {
  try {
    const stored = localStorage.getItem(TOUCH_FULL_TOOLS_KEY);
    return isTouchFullTools(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

export function rememberTouchFullTools(choice: TouchFullTools): void {
  try {
    localStorage.setItem(TOUCH_FULL_TOOLS_KEY, choice);
  } catch {
    /* nothing to do — see savedTouchFullTools */
  }
}

import type { ArrowShowing } from "@hifth/core";

/**
 * How the saved jump arrows show, and where the reader's choice is kept.
 *
 * The owner settled this on 2026-10-03 (docs/design/jump-arrows-options.md):
 * A, the arrows stay on the page, faint, is the default, and the reader can
 * pick B, only while the verse's list is open or the Jump tool is on, in
 * settings. Kept here rather than beside the jump record, whose own modules
 * may hold no way off the device.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `verse-gestures.ts` keeps.
 */

/** In settings order. */
export const ARROW_SHOWINGS: readonly ArrowShowing[] = ["stays", "asked"];

/** Versioned: a way that later changes what it does gets a new key. */
export const JUMP_ARROWS_KEY = "hifth.jump.arrows.v1";

function isArrowShowing(value: unknown): value is ArrowShowing {
  return value === "stays" || value === "asked";
}

/** The way this device chose, or staying when it never chose. */
export function savedArrowShowing(): ArrowShowing {
  try {
    const stored = localStorage.getItem(JUMP_ARROWS_KEY);
    return isArrowShowing(stored) ? stored : "stays";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "stays";
  }
}

export function rememberArrowShowing(choice: ArrowShowing): void {
  try {
    localStorage.setItem(JUMP_ARROWS_KEY, choice);
  } catch {
    /* nothing to do — see savedArrowShowing */
  }
}

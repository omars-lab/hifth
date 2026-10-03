/**
 * How the note box draws the parts a note can be about, from one harakah to
 * the whole Qur'an, and where the reader's choice is remembered.
 *
 * The owner asked on 2026-10-03 for every look to be kept, one chosen in
 * settings, while the pyramid is tried on a phone:
 *
 *   side   the stacked lines turned on their side: a row from the whole
 *          Qur'an, the longest, at the start to one harakah at the end; the
 *          one pointed at shows its letter in its middle, and its name sits
 *          under the row (default, the owner's latest ask).
 *   lines  short strokes stacked as a pyramid, the same way round.
 *   tall   the full pyramid, every part named on its slice.
 *   slim   the same pyramid in thin slices, the letter alone.
 *   steps  one row of bars, each taller than the one before it.
 *   trail  one line of letters, the current part spelled out.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it, as turn-style.ts does.
 */

export type ScopeLook = "side" | "lines" | "tall" | "slim" | "steps" | "trail";

/** In settings order: the default first. */
export const SCOPE_LOOKS: readonly ScopeLook[] = ["side", "lines", "tall", "slim", "steps", "trail"];

/** Versioned: a look that later changes what it does gets a new key. */
export const SCOPE_LOOK_KEY = "hifth.note.scope-look.v1";

function isScopeLook(value: unknown): value is ScopeLook {
  return SCOPE_LOOKS.includes(value as ScopeLook);
}

/** The look this device chose, or the lines on their side when it never chose. */
export function savedScopeLook(): ScopeLook {
  try {
    const stored = localStorage.getItem(SCOPE_LOOK_KEY);
    return isScopeLook(stored) ? stored : "side";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "side";
  }
}

export function rememberScopeLook(look: ScopeLook): void {
  try {
    localStorage.setItem(SCOPE_LOOK_KEY, look);
  } catch {
    /* nothing to do — see savedScopeLook */
  }
}

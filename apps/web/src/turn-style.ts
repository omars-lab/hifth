/**
 * How a page turn looks, and where the reader's choice is remembered.
 *
 * The owner settled this on 2026-09-26 (docs/decisions/page-turn-curl.md): three
 * turn styles, one chosen in settings, and the flat seam as the default.
 *
 *   seam   the flat seam (A) — a band sweeps over the page; no word moves.
 *   curl   the skeleton curl (B) — a leaf curls over carrying grey lines where
 *          words will be, and the real page settles in once it lies flat.
 *   lift   the shadow lift (D) — the page stays flat, a soft shadow lifts off the
 *          edge you turn from, and the page swaps under it.
 *
 * All three keep the rule the turn was built on: the drawn words never move
 * during a turn. Only what passes over them differs.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `pagebar-fisheye.ts` keeps.
 */

export type TurnStyle = "seam" | "curl" | "lift";

/** In settings order: the default first. */
export const TURN_STYLES: readonly TurnStyle[] = ["seam", "curl", "lift"];

/** Versioned: a style that later changes what it does gets a new key. */
export const TURN_STYLE_KEY = "hifth.turn.style.v1";

function isTurnStyle(value: unknown): value is TurnStyle {
  return value === "seam" || value === "curl" || value === "lift";
}

/** The style this device chose, or the flat seam when it never chose. */
export function savedTurnStyle(): TurnStyle {
  try {
    const stored = localStorage.getItem(TURN_STYLE_KEY);
    return isTurnStyle(stored) ? stored : "seam";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "seam";
  }
}

export function rememberTurnStyle(style: TurnStyle): void {
  try {
    localStorage.setItem(TURN_STYLE_KEY, style);
  } catch {
    /* nothing to do — see savedTurnStyle */
  }
}

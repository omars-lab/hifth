/**
 * Which side of the screen the pens stand on, on an iPad held sideways or a
 * computer, and where the reader's choice is kept (docs/PLAN.md, 95).
 *
 * The owner chose on 2026-10-12 (docs/design/notes-style-toolbar.md, ④): the
 * pens down the side and the Mark up button stay on the right by default, in
 * both languages, since most readers mark with the right hand. The other way,
 * both on the left and mirrored, is a setting, so a hafiz reading in Arabic can
 * try the screen fully mirrored.
 *
 * Its own module, free of React and CSS, as `pen-home.ts` is.
 */

export type PenSide = "right" | "left";

/** In settings order. */
export const PEN_SIDES: readonly PenSide[] = ["right", "left"];

/** Versioned: a side that later changes what it does gets a new key. */
export const PEN_SIDE_KEY = "hifth.pens.side.v1";

export function savedPenSide(): PenSide {
  try {
    return localStorage.getItem(PEN_SIDE_KEY) === "left" ? "left" : "right";
  } catch {
    // Safari private mode throws on localStorage; the default it is.
    return "right";
  }
}

export function rememberPenSide(side: PenSide): void {
  try {
    localStorage.setItem(PEN_SIDE_KEY, side);
  } catch {
    /* nothing to do — see savedPenSide */
  }
}

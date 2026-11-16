/**
 * A Back button beside the page slider (the layout plan's item ②): after a
 * jump, it returns to the page the reader left. A rough build behind a switch,
 * off until it has been tried on an iPad and a laptop.
 *
 * What counts as a jump is the distance, not the control that made it: the
 * slider, a juz marker, the Go-to panel and the revision map all land far from
 * where they started, and a page turn lands one page away (two, with the book
 * open at two pages). A hop from a verse to a look-alike is left to the trail
 * of beads, which already returns to the verse itself.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it: the discipline `jump-arrows.ts` keeps.
 */

export type SliderBack = "off" | "on";

/** In settings order. */
export const SLIDER_BACKS: readonly SliderBack[] = ["off", "on"];

/** Versioned: a way that later changes what it does gets a new key. */
export const SLIDER_BACK_KEY = "hifth.slider.back.v1";

/** The furthest a page turn moves: two pages, with the book open at two. */
const TURN_REACH = 2;

function isSliderBack(value: unknown): value is SliderBack {
  return value === "off" || value === "on";
}

/** What this device chose, or off when it never chose. */
export function savedSliderBack(): SliderBack {
  try {
    const stored = localStorage.getItem(SLIDER_BACK_KEY);
    return isSliderBack(stored) ? stored : "off";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "off";
  }
}

export function rememberSliderBack(choice: SliderBack): void {
  try {
    localStorage.setItem(SLIDER_BACK_KEY, choice);
  } catch {
    /* nothing to do: see savedSliderBack */
  }
}

/**
 * The page Back returns to after the reader moves from one page to another, or
 * null when there is nowhere to go back to.
 *
 * The first place left is the one kept: a second jump, or turning pages while
 * away, does not lose it. Arriving on it again, however that happens, clears it.
 */
export function placeAfterMove(place: number | null, from: number, to: number): number | null {
  if (to === from) return place;
  if (to === place) return null;
  if (place !== null) return place;
  return Math.abs(to - from) > TURN_REACH ? from : null;
}

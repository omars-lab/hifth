/**
 * Where the look-alike buttons go when there is no desk beside the page, and
 * where the reader's choice is kept (docs/design/lookalike-rows.md, ⑧).
 *
 * On a wide screen the buttons stand on the desk just outside the page's edge.
 * A page magnified to fill the window — a link or a hop lands at 155%, and on
 * the large iPad held upright that is the whole width — leaves no desk, and
 * the buttons used to reach in over the paper and stand on the top line's
 * first letters (walking the pitch, 2026-10-10). Both homes built for that are
 * kept, the owner's rule for a feature that could work more than one way:
 *
 *   bar    the bottom row, beside the trail of verses visited (the default);
 *   tools  the end of the tool row above the page, falling back to the bottom
 *          row when the tools live somewhere else.
 *
 * Its own module, free of React and CSS, as `pen-home.ts` is.
 */

export type RailHome = "bar" | "tools";

/** In settings order. */
export const RAIL_HOMES: readonly RailHome[] = ["bar", "tools"];

/** Versioned: a home that later changes what it does gets a new key. */
export const RAIL_HOME_KEY = "hifth.rail.home.v1";

/**
 * The narrowest desk the buttons stand on: a button is about 65px wide and
 * keeps a little air either side of it. Narrower, and they go to a bar.
 */
export const RAIL_DESK_MIN = 96;

/** Whether a desk this wide still holds the buttons beside the page. */
export function deskHoldsRail(deskWidth: number): boolean {
  return deskWidth > RAIL_DESK_MIN;
}

/**
 * The empty space either side of one page, at its magnification: what the
 * page leaves of its box, halved, since a page narrower than its box sits in
 * the middle of it (`clampView`). With the book closed to one page the box
 * runs the window's width, so this, not the desk, is the room beside the page.
 */
export function pageSlack(boxWidth: number, pageWidth: number, zoom: number): number {
  return Math.max(0, (boxWidth - pageWidth * zoom) / 2);
}

function isRailHome(value: unknown): value is RailHome {
  return value === "bar" || value === "tools";
}

/** The home this device chose, or the bottom row when it never chose. */
export function savedRailHome(): RailHome {
  try {
    const stored = localStorage.getItem(RAIL_HOME_KEY);
    return isRailHome(stored) ? stored : "bar";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "bar";
  }
}

export function rememberRailHome(choice: RailHome): void {
  try {
    localStorage.setItem(RAIL_HOME_KEY, choice);
  } catch {
    /* nothing to do — see savedRailHome */
  }
}

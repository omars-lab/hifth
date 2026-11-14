/**
 * Where the page tools go in full screen (decision verse-tap-and-hold ①, and
 * the notes-style toolbar's ⑤). The owner, on the app's page (2026-11-07):
 * "Where is the side tool bar?" Full screen put every bar away, the tools too,
 * so marking a mistake meant leaving it first. Built four ways:
 *
 *   side   the tools stay down the side of the window, beside the book (default)
 *   edge   they hide, and come back while the pointer rests at that side of
 *          the window, like the Mac's Dock set to hide itself
 *   dock   a small column of tool icons stays, and opens out under the pointer
 *          ("a small minimal icon dock that expands when we hover over it");
 *          a finger, with nothing to hover, opens it with a tap
 *   none   full screen puts them away with the other bars, as before
 *
 * Whichever side the pens stand on (pen-side.ts) is the side they keep.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */

export type FullScreenTools = "side" | "edge" | "dock" | "none";

/** In settings order. */
export const FULL_SCREEN_TOOLS: readonly FullScreenTools[] = ["side", "edge", "dock", "none"];

/** Versioned: an option that later changes what it does gets a new key. */
export const FULL_SCREEN_TOOLS_KEY = "hifth.full-screen.tools.v1";

const DEFAULT: FullScreenTools = "side";

function isFullScreenTools(value: unknown): value is FullScreenTools {
  return value === "side" || value === "edge" || value === "dock" || value === "none";
}

/** The option this device chose, or the default when it never chose. */
export function savedFullScreenTools(): FullScreenTools {
  try {
    const stored = localStorage.getItem(FULL_SCREEN_TOOLS_KEY);
    return isFullScreenTools(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

export function rememberFullScreenTools(choice: FullScreenTools): void {
  try {
    localStorage.setItem(FULL_SCREEN_TOOLS_KEY, choice);
  } catch {
    /* nothing to do — see savedFullScreenTools */
  }
}

/** How close to the window's edge, in pixels, the pointer brings hidden tools back. */
export const EDGE_REACH = 24;

/**
 * Whether the pointer, at `x` across a window `width` wide, rests close enough
 * to the tools' side to bring them back.
 */
export function nearTheirEdge(x: number, width: number, side: "left" | "right", reach = EDGE_REACH): boolean {
  return side === "left" ? x <= reach : x >= width - reach;
}

/**
 * Whether the pointer at (`x`, `y`) is still on the shown tools, or near
 * enough (`slack` pixels round them) that a hand moving between buttons does
 * not send them away.
 */
export function stillOnThem(x: number, y: number, box: { left: number; right: number; top: number; bottom: number }, slack = 24): boolean {
  return x >= box.left - slack && x <= box.right + slack && y >= box.top - slack && y <= box.bottom + slack;
}

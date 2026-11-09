/**
 * Where a verse's tools open: in a sheet of their own, or inside the verse's
 * drawer, under the row of tools (decision selection-drawer, open question ③).
 *
 * The owner asked five times on the drawer page for a tool to open inside the
 * drawer rather than as another pop-up. Both are built and the reader picks in
 * settings. The sheet stays the default until the owner has tried the drawer
 * by hand; switching the default is the one line in `savedDrawerTools`.
 *
 *   sheet   today's way: Same roots opens its own card, and the drawer steps
 *           aside while it is up.
 *   drawer  Same roots opens as a section inside the drawer, under the tools,
 *           and the drawer stays. The page moves the verse up clear of it.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `verse-gestures.ts` keeps.
 */

export type DrawerTools = "sheet" | "drawer";

/** In settings order. */
export const DRAWER_TOOLS: readonly DrawerTools[] = ["sheet", "drawer"];

/** Versioned: an option that later changes what it does gets a new key. */
export const DRAWER_TOOLS_KEY = "hifth.drawer.tools.v1";

function isDrawerTools(value: unknown): value is DrawerTools {
  return value === "sheet" || value === "drawer";
}

/** The option this device chose, or the sheet when it never chose. */
export function savedDrawerTools(): DrawerTools {
  try {
    const stored = localStorage.getItem(DRAWER_TOOLS_KEY);
    return isDrawerTools(stored) ? stored : "sheet";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "sheet";
  }
}

export function rememberDrawerTools(choice: DrawerTools): void {
  try {
    localStorage.setItem(DRAWER_TOOLS_KEY, choice);
  } catch {
    /* nothing to do — see savedDrawerTools */
  }
}

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

export type DrawerTools = "sheet" | "drawer" | "tabs";

/** In settings order. */
export const DRAWER_TOOLS: readonly DrawerTools[] = ["sheet", "drawer", "tabs"];

/** Versioned: an option that later changes what it does gets a new key. */
export const DRAWER_TOOLS_KEY = "hifth.drawer.tools.v1";

function isDrawerTools(value: unknown): value is DrawerTools {
  return value === "sheet" || value === "drawer" || value === "tabs";
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

/** A tool that opens inside the drawer, and so can be a tab. */
export type DrawerTab = "looks" | "listen" | "roots" | "share";

/** The order the tabs stand in, whatever order they were opened in. */
export const DRAWER_TABS: readonly DrawerTab[] = ["looks", "listen", "roots", "share"];

/**
 * The tab in front: the one the reader last picked while it stays open, or
 * else the last one open, so closing the front tab brings another forward.
 */
export function frontTab(open: readonly DrawerTab[], picked: DrawerTab | null): DrawerTab | null {
  if (picked && open.includes(picked)) return picked;
  return open.length ? open[open.length - 1]! : null;
}

/**
 * What pressing a tool's own button does with tabs: a closed tool opens in
 * front, an open one behind comes forward, and the one in front closes.
 */
export function pressTab(open: readonly DrawerTab[], picked: DrawerTab | null, tool: DrawerTab): "open" | "front" | "close" {
  if (!open.includes(tool)) return "open";
  return frontTab(open, picked) === tool ? "close" : "front";
}

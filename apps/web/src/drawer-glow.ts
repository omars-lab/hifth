/**
 * What the lit verse does while the pointer rests on its drawer (decision
 * selection-drawer, open question ②). The owner asked, on the drawer's page:
 * "when i hover over the drawer, can the relevant highlight glow?" — a quick
 * check of which verse the tools are about, without reading the verse number in
 * the drawer's head.
 *
 *   brighten  the verse's amber deepens while the pointer is on the drawer.
 *   ring      a darker amber edge rings each of the verse's lines.
 *   none      no change, as before.
 *
 * Only a mouse, a trackpad or a Pencil held above the screen counts: a finger
 * has no resting place, and a tap in the drawer must not leave the verse lit up.
 * The page's root carries the choice (`data-drawer-glow`) and, while a pointer
 * rests on the drawer, `data-drawer-hover`; the colours are in highlight.css.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key rather
 * than retyping it — the discipline `drawer-tools.ts` keeps.
 */

export type DrawerGlow = "brighten" | "ring" | "none";

/** In settings order. */
export const DRAWER_GLOWS: readonly DrawerGlow[] = ["brighten", "ring", "none"];

/** Versioned: an option that later changes what it does gets a new key. */
export const DRAWER_GLOW_KEY = "hifth.drawer.glow.v1";

const DEFAULT: DrawerGlow = "brighten";

function isDrawerGlow(value: unknown): value is DrawerGlow {
  return value === "brighten" || value === "ring" || value === "none";
}

/** The option this device chose, or the default when it never chose. */
export function savedDrawerGlow(): DrawerGlow {
  try {
    const stored = localStorage.getItem(DRAWER_GLOW_KEY);
    return isDrawerGlow(stored) ? stored : DEFAULT;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return DEFAULT;
  }
}

export function rememberDrawerGlow(choice: DrawerGlow): void {
  try {
    localStorage.setItem(DRAWER_GLOW_KEY, choice);
  } catch {
    /* nothing to do — see savedDrawerGlow */
  }
}

/** A pointer that can rest without pressing: anything but a finger. */
export function canRest(pointerType: string): boolean {
  return pointerType !== "touch";
}

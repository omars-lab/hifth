/**
 * Where the reading settings live (docs/design/ayah-drawer.md ①): one or two
 * pages, the size, tajweed and the language.
 *
 * The owner asked on 2026-11-07 for one settings button in the top bar, opening
 * a drawer that holds what the bar carries today. Both are built and the reader
 * picks in the info panel; the bar keeps its controls by default until the
 * owner has tried the drawer.
 *
 *   bar     today's way: each control sits in the top bar.
 *   drawer  one button in the bar; pressing it drops a drawer under the bar
 *           with the same controls, and pressing it again, or Escape, puts it
 *           away.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type SettingsAt = "bar" | "drawer";

/** In settings order. */
export const SETTINGS_ATS: readonly SettingsAt[] = ["bar", "drawer"];

/** Versioned: an option that later changes what it does gets a new key. */
export const SETTINGS_AT_KEY = "hifth.settings.at.v1";

/** The option this device chose, or the bar when it never chose. */
export function savedSettingsAt(): SettingsAt {
  try {
    return localStorage.getItem(SETTINGS_AT_KEY) === "drawer" ? "drawer" : "bar";
  } catch {
    // Safari private mode throws on localStorage: the default.
    return "bar";
  }
}

export function rememberSettingsAt(choice: SettingsAt): void {
  try {
    localStorage.setItem(SETTINGS_AT_KEY, choice);
  } catch {
    /* nothing to do — see savedSettingsAt */
  }
}

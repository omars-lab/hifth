/**
 * Pages of the app, switched by a row of icons along the bottom
 * (docs/design/app-pages.md ①).
 *
 * The owner asked on 2026-11-07 for page icons along the bottom, the way a Mac
 * app switches its views: the mushaf as the default page, settings as a page of
 * their own. Both ways are built and the reader picks in the info panel; the
 * row stays off by default until the owner has tried it.
 *
 *   off  today's way: one page, the mushaf; settings in the info panel.
 *   row  a row of page icons under everything else. The mushaf stays as it was
 *        left while another page is showing.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type AppPages = "off" | "row";

/** In settings order. */
export const APP_PAGES: readonly AppPages[] = ["off", "row"];

/** Versioned: an option that later changes what it does gets a new key. */
export const APP_PAGES_KEY = "hifth.app.pages.v1";

/** The option this device chose, or off when it never chose. */
export function savedAppPages(): AppPages {
  try {
    return localStorage.getItem(APP_PAGES_KEY) === "row" ? "row" : "off";
  } catch {
    // Safari private mode throws on localStorage: the default.
    return "off";
  }
}

export function rememberAppPages(choice: AppPages): void {
  try {
    localStorage.setItem(APP_PAGES_KEY, choice);
  } catch {
    /* nothing to do — see savedAppPages */
  }
}

/** A page of the app. The developer page exists only on the laptop's dev server. */
export type AppPage = "mushaf" | "settings" | "developer";

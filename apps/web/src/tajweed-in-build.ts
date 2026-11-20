/**
 * Whether this build carries the tajweed colours.
 *
 * The colours come from the quran-tajweed data (CC BY 4.0), and the written
 * permission asked for the store build (app-store-launch ④) is not in hand. The
 * owner chose on 2026-11-20 to keep the colours, with the reader's own switch
 * to turn them on and off (㊲); if the permission does not come, the store
 * build is made with `NO_TAJWEED=1`, which leaves out the button, the key, the
 * data and its credit. The website and the private build always keep them.
 *
 * Set by `VITE_NO_TAJWEED=1`. A literal, like the recitation's switch, so a
 * build without it drops every branch only the colours reach.
 */
declare const __TAJWEED__: boolean;

/** False only in a build made with VITE_NO_TAJWEED; true everywhere else, tests included. */
export const TAJWEED: boolean = typeof __TAJWEED__ !== "boolean" || __TAJWEED__;

/** The credit row that names the tajweed data, left out with it. */
export const TAJWEED_CREDIT = "https://github.com/cpfair/quran-tajweed";

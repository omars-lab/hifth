/**
 * Whether this build plays the recitation.
 *
 * The recitation streams from Quran.com's audio server, and Quran.com's terms
 * allow personal use only: no permission to stream it in a published app has
 * been given (docs/research/2026-11-17-store-terms.md). So the App Store build
 * leaves it out, every listen control with it, until one of the routes in that
 * write-up is in place (app-store-launch ⑥). The website and the private build
 * keep it; whether the website should is its own open question (⑥'s sibling, ㊻).
 *
 * Set by `VITE_NO_RECITATION=1`, which the store's public web build passes. A
 * literal, like the pitch switch, so a build without it drops the server's
 * address and the copy step can check that it did.
 */
declare const __RECITATION__: boolean;

/** False only in a build made with VITE_NO_RECITATION; true everywhere else, tests included. */
export const RECITATION: boolean = typeof __RECITATION__ !== "boolean" || __RECITATION__;

/** The credit row that names the recitation, left out with it. */
export const RECITATION_CREDIT = "https://quran.com";

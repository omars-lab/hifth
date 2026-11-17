/**
 * hifth.app's own pages that the app links to: support and privacy (launch
 * items 20, 29 and 43, docs/design/app-store-launch.md).
 *
 * Always the full address, in a browser and inside the iPad and Mac apps alike.
 * Inside the apps the page is served from the bundle and only web addresses
 * leave it, so a relative link would go nowhere; and in a browser the app may
 * be served from another host (the blog, a laptop), where hifth.app's pages do
 * not exist. Each page has an Arabic copy under /ar/, so the reader lands on
 * the one in the language they chose.
 */

import type { Lang } from "./lang";

/** hifth.app's front door. */
export const HIFTH_APP = "https://hifth.app";

export type SitePage = "support" | "privacy";

/** The page's address in the reader's language. Cloudflare serves it without .html. */
export function sitePageUrl(page: SitePage, lang: Lang): string {
  return `${HIFTH_APP}${lang === "ar" ? "/ar" : ""}/${page}`;
}

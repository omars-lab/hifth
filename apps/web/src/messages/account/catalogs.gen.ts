/* GENERATED — do not edit. Every locale's compiled catalog, keyed by id, each loaded on demand.
 * Source: apps/web/src/messages/account/*.json. Regenerate: `pnpm i18n:build`.
 * `gate:i18n` fails the build if this file and the catalogs disagree. */

import type { Catalog } from "./catalog.gen";
import type { LocaleId } from "../locales.gen";

/** Dynamic imports: this pack's words are read only by a part of the app
 *  that loads late, so they are fetched when it asks for them and never
 *  with the words every reader downloads at start-up. The service worker
 *  precaches every one, so they work offline. */
export const CATALOG_LOADERS: Readonly<
  Record<LocaleId, () => Promise<{ default: Catalog }>>
> = {
  ar: () => import("./account.ar.gen"),
  en: () => import("./account.en.gen"),
};

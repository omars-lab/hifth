/* GENERATED — do not edit. Every locale's compiled catalog, keyed by id, each loaded on demand.
 * Source: apps/web/src/messages/*.json. Regenerate: `pnpm i18n:build`.
 * `gate:i18n` fails the build if this file and the catalogs disagree. */

import type { Catalog } from "./catalog.gen";
import type { LocaleId } from "./locales.gen";

/** Dynamic imports, not static: each language is its own file, so a reader
 *  downloads only the one they read in (the two together were ~10 KB gz of
 *  start-up code). The one they open in is fetched before the first paint:
 *  index.html asks for it up front and main.tsx waits for it. The service
 *  worker precaches every one, so switching works offline. */
export const CATALOG_LOADERS: Readonly<
  Record<LocaleId, () => Promise<{ default: Catalog }>>
> = {
  ar: () => import("./ar.gen"),
  en: () => import("./en.gen"),
};

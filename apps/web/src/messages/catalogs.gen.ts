/* GENERATED — do not edit. Every locale's compiled catalog, keyed by id.
 * Source: apps/web/src/messages/*.json. Regenerate: `pnpm i18n:build`.
 * `gate:i18n` fails the build if this file and the catalogs disagree. */

import type { Catalog } from "./catalog.gen";
import type { LocaleId } from "./locales.gen";
import ar from "./ar.gen";
import en from "./en.gen";

/** Static imports, not dynamic: the chrome is a few KB and must be on screen
 *  at first paint, offline, with no request to wait on. */
export const CATALOGS: Readonly<Record<LocaleId, Catalog>> = {
  ar,
  en,
};

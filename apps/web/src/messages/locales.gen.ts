/* GENERATED — do not edit. The locales that have a catalog.
 * Source: apps/web/src/messages/*.json. Regenerate: `pnpm i18n:build`.
 * `gate:i18n` fails the build if this file and the catalogs disagree. */

/**
 * Discovered from apps/web/src/messages/*.json, so the directory is the single
 * source of truth for which locales exist. `lang.ts` derives `Lang` from this
 * and keys `LOCALES` by it — which is what makes a catalog dropped in without a
 * direction, a self-name and a rule-name order a compile error rather than a
 * locale that renders sideways.
 */
export const LOCALE_IDS = ["ar", "en"] as const;

export type LocaleId = (typeof LOCALE_IDS)[number];

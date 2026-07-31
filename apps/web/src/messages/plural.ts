/**
 * The whole of the i18n runtime. Twelve lines, and this is on purpose.
 *
 * ICU MessageFormat is compiled to TypeScript at build time by
 * `scripts/messages-compile.mjs`, so the only thing a message needs at runtime
 * is the choice between its plural cases. `Intl.PluralRules` is the browser's
 * own CLDR, which makes this file's job "look the answer up" rather than "carry
 * a table of plural rules for every language".
 *
 * Why the platform's CLDR and not a library's: Hifth is offline-first, and a
 * build installed on a phone may run for years without an update. Plural rules
 * vendored into the bundle would be frozen at build time; the browser's are
 * refreshed with the browser. `@messageformat/runtime` was measured at +55
 * bytes gz over this and rejected on exactly that ground, not on size.
 * docs/design/i18n.md §③.
 *
 * Measured, end to end: the migration moved the app from 101.2 KB gz to
 * 103.0 KB gz against a 150 KB `gate:budget` — +1.8 KB, and almost none of it
 * this file. The weight is the compiled catalogs, which say every key once per
 * locale where the hand-written table said it once per locale too, plus the
 * assembler that names each key a third time. A runtime ICU library would have
 * added 9.3–25.2 KB *on top of* the same catalogs.
 */

/** One `Intl.PluralRules` per locale. Constructing one is not free; the app
 *  announces on every hop, and an announcement is on the frame budget. */
const RULES = new Map<string, Intl.PluralRules>();

/**
 * ICU `{n, plural, …}`.
 *
 * Exact matches first — ICU's `=0` / `=1` are emitted as the numeric-string
 * keys "0" / "1", and an exact match outranks a category, which is what ICU
 * specifies. Then the CLDR category. `other` is the last resort and ICU
 * requires every plural to have one, so the fallback is a language's own words
 * and never another language's; `gate:i18n` refuses a message that omits a
 * category the locale actually has.
 */
export function plural(
  locale: string,
  value: number,
  cases: Readonly<Record<string, string>>,
): string {
  const exact = cases[String(value)];
  if (exact !== undefined) return exact;
  let rules = RULES.get(locale);
  if (!rules) RULES.set(locale, (rules = new Intl.PluralRules(locale)));
  return cases[rules.select(value)] ?? cases.other!;
}

/** ICU `{x, select, …}` — a branch, not an agreement. `other` is required. */
export function select(value: string, cases: Readonly<Record<string, string>>): string {
  return cases[value] ?? cases.other!;
}

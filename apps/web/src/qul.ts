/**
 * A deep link from the verse the reader is on to that verse's page in the
 * Quranic Universal Library (QUL, qul.tarteel.ai) — the "look this ayah up in
 * the big reference" affordance.
 *
 * QUL numbers its verse pages by the ayah's **absolute** position in the mus'haf
 * — the running count from the very first ayah, not the number within its surah
 * — so 1:1 is verse 1 and 2:1 is verse 8 (Al-Fatiha has seven ayat before it).
 * That number is `toAbsoluteAyah`, which the app already holds as a structural
 * constant checked against the Tanzil metadata; no new data is needed, and this
 * is a plain outbound link — nothing of QUL's is copied into the app.
 */
import { parseAyahKey, toAbsoluteAyah } from "@hifth/core";

/** The Quranic Universal Library, named once so a reader's label can use it. */
export const QUL_NAME = "QUL";

/**
 * The QUL page for one ayah, or null when the key is not a bare ayah (a word or
 * a range has no single verse page). Pure and deterministic.
 */
export function qulVerseUrl(key: string): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  return `https://qul.tarteel.ai/cms/verses/${toAbsoluteAyah(parsed.surah, parsed.ayah)}`;
}

/**
 * Canonical node-key grammar (spec §1).
 *
 * Loop 0 implements only the ayah-key formatter that the asset extractor needs
 * (`formatAyahKey`) plus a parser for that same form. The full grammar — word
 * ranges (`#w3-7`), roots (`root/ktb`), reserved namespaces (`hadith/…`) and
 * comparison/ordering — arrives in Loop 1 with property-based round-trip tests.
 */

import type { EditionId } from "./types.js";

export interface AyahKey {
  readonly kind: "ayah";
  readonly edition: EditionId;
  readonly surah: number;
  readonly ayah: number;
}

/** Build the canonical ayah key, e.g. `quran/hafs-kfqc/2:48`. */
export function formatAyahKey(edition: EditionId, surah: number, ayah: number): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah out of range: ${surah}`);
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new RangeError(`ayah out of range: ${ayah}`);
  }
  return `quran/${edition}/${surah}:${ayah}`;
}

const AYAH_KEY_RE = /^quran\/([^/]+)\/(\d+):(\d+)$/;

/** Parse an ayah key; returns null if it is not a bare ayah key. */
export function parseAyahKey(key: string): AyahKey | null {
  const m = AYAH_KEY_RE.exec(key);
  if (!m) return null;
  const [, edition, surahStr, ayahStr] = m;
  return {
    kind: "ayah",
    edition: edition as EditionId,
    surah: Number(surahStr),
    ayah: Number(ayahStr),
  };
}

/** Decode the source `number` attribute (surah*1000 + ayah) into {surah, ayah}. */
export function decodeAyahNumber(number: number): { surah: number; ayah: number } {
  return { surah: Math.floor(number / 1000), ayah: number % 1000 };
}

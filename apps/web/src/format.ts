/**
 * Display formatting for chrome (L3 concern — never in @hifth/core).
 *
 * Surah names and Arabic-Indic numerals are presentation, so they live in the
 * app, not the framework-free core. The name table is the canonical 114-surah
 * order; it is static reference data, not scripture content.
 */

import { parseAyahKey } from "@hifth/core";

const SURAH_NAMES_AR: readonly string[] = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف",
  "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
  "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون",
  "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان",
  "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح",
  "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة",
  "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون",
  "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح",
  "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ",
  "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج",
  "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى",
  "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر",
  "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
];

/** Surah name in Arabic for a 1-based surah number, or "" if out of range. */
export function surahName(surah: number): string {
  return SURAH_NAMES_AR[surah - 1] ?? "";
}

/** Render a number in Arabic-Indic digits (٠١٢…). */
export function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

/**
 * Human label for an ayah key, e.g. "البقرة · ٢:٤١". Returns null if the key is
 * not a bare ayah key.
 */
export function ayahLabel(key: string): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  const name = surahName(parsed.surah);
  const ref = `${toArabicDigits(parsed.surah)}:${toArabicDigits(parsed.ayah)}`;
  return name ? `${name} · ${ref}` : ref;
}

/** Bare ayah reference in Arabic-Indic digits, e.g. "٢:٤٧" (null if not an ayah key). */
export function ayahRef(key: string): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  return `${toArabicDigits(parsed.surah)}:${toArabicDigits(parsed.ayah)}`;
}

/**
 * Human label for a highlighted range, e.g. "البقرة · ٢:٤٧–٢:٤٨" (spec §9's menu
 * title). A one-ayah range reads as a plain ayah label. Returns null if either
 * endpoint is not a bare ayah key.
 */
export function rangeLabel(fromKey: string, toKey: string): string | null {
  if (fromKey === toKey) return ayahLabel(fromKey);
  const from = parseAyahKey(fromKey);
  const to = parseAyahKey(toKey);
  if (!from || !to) return null;
  const name = surahName(from.surah);
  const span = `${ayahRef(fromKey)}–${ayahRef(toKey)}`;
  return name ? `${name} · ${span}` : span;
}

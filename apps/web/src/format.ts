/**
 * Display formatting for chrome (L3 concern — never in @hifth/core).
 *
 * Surah names and numerals are presentation, so they live in the app, not the
 * framework-free core. The name tables are the canonical 114-surah order; they
 * are static reference data, not scripture content.
 *
 * Every function here takes an explicit `lang`. None of them defaults it, and
 * that is the point: a default would let a new call site render Arabic inside
 * an English sentence and still compile, which is exactly the class of bug the
 * hop rail's aria-label once had (Latin digits inside an Arabic phrase, found
 * only by an aria snapshot). With the parameter required, the compiler finds
 * every site the day a new one is written. The binding happens once, in
 * `i18n.tsx`, so components see already-bound formatters and cannot forget.
 */

import { parseAyahKey } from "@hifth/core";
import type { Lang } from "./lang";

/**
 * The 114 surah names in mushaf order. Exported because the jumper matches
 * against them (Loop 6a): `@hifth/core`'s `parseJump` takes the table as an
 * argument rather than owning it, the same injection the highlighter uses for
 * `labelFor` — names are presentation, and core stays framework- and
 * language-table-free.
 */
export const SURAH_NAMES_AR: readonly string[] = [
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

/**
 * The same 114 names romanised, for the English UI.
 *
 * These are **not vendored data** and have no SOURCES.md entry, because they
 * are not copied from anywhere: a surah name is a proper noun, and this is the
 * ordinary Anglicised spelling of each one — the form a hafiz reading English
 * will already have seen on a mus'haf spine. The apostrophes stand for ʿayn and
 * hamza; no macrons, because they would have to survive a phone keyboard in the
 * jumper's search field and they do not.
 *
 * The Arabic name is never replaced by this in the mushaf itself. It replaces
 * it only in chrome — the header of a sheet, a hop row, a jumper result — which
 * is the whole scope of the English UI (see i18n.tsx).
 */
export const SURAH_NAMES_EN: readonly string[] = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am",
  "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd",
  "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha",
  "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara",
  "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah",
  "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar",
  "Ghafir", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah",
  "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat",
  "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid",
  "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah", "As-Saf", "Al-Jumu'ah",
  "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk",
  "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil",
  "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba",
  "An-Nazi'at", "'Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin",
  "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr",
  "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin",
  "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat",
  "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh",
  "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas",
  "Al-Falaq", "An-Nas",
];

/** The name table a language reads by. Same length, same order, both times. */
export function surahNames(lang: Lang): readonly string[] {
  return lang === "en" ? SURAH_NAMES_EN : SURAH_NAMES_AR;
}

/** Surah name for a 1-based surah number, or "" if out of range. */
export function surahName(surah: number, lang: Lang): string {
  return surahNames(lang)[surah - 1] ?? "";
}

/**
 * Render a number in Arabic-Indic digits (٠١٢…).
 *
 * Takes a string too, and transliterates every digit in it while leaving the
 * rest alone — for the shapes that are not one number: a `YYYY-MM-DD` day stamp
 * keeps its hyphens and becomes «٢٠٢٦-٠٧-٣٠». The alternative was a second copy
 * of the digit table at the one call site that needed it.
 */
export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

/**
 * A number in the digits the UI language reads.
 *
 * The Arabic UI has always used Arabic-Indic digits everywhere, *including*
 * inside aria-labels — the half that is easy to forget, and the half a screen
 * reader mispronounces when it is missed. English gets Latin digits by the same
 * rule and for the same reason.
 */
export function digits(n: number, lang: Lang): string {
  return lang === "en" ? String(n) : toArabicDigits(n);
}

/**
 * Human label for a surah/ayah pair: "البقرة · ٢:٤١" / "Al-Baqarah · 2:41".
 *
 * The coordinate form, for callers that already hold the numbers — the jumper's
 * result rows, which are built from a parsed query and never see a key. It is
 * separate from `ayahLabel` because that one takes a *canonical* key
 * (`quran/<edition>/2:41`), and handing it a bare "2:41" returns null: a
 * silent, plausible-looking fallback to the raw string, which is exactly how
 * the jumper once printed Latin digits inside the Arabic UI.
 */
export function ayahLabelAt(surah: number, ayah: number, lang: Lang): string {
  const name = surahName(surah, lang);
  const ref = `${digits(surah, lang)}:${digits(ayah, lang)}`;
  return name ? `${name} · ${ref}` : ref;
}

/**
 * Human label for an ayah key: "البقرة · ٢:٤١" / "Al-Baqarah · 2:41". Returns
 * null if the key is not a bare ayah key.
 */
export function ayahLabel(key: string, lang: Lang): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  return ayahLabelAt(parsed.surah, parsed.ayah, lang);
}

/** Bare ayah reference, e.g. "٢:٤٧" / "2:47" (null if not an ayah key). */
export function ayahRef(key: string, lang: Lang): string | null {
  const parsed = parseAyahKey(key);
  if (!parsed) return null;
  return `${digits(parsed.surah, lang)}:${digits(parsed.ayah, lang)}`;
}

/**
 * Human label for a highlighted range, e.g. "البقرة · ٢:٤٧–٢:٤٨" (spec §9's menu
 * title). A one-ayah range reads as a plain ayah label. Returns null if either
 * endpoint is not a bare ayah key.
 */
export function rangeLabel(fromKey: string, toKey: string, lang: Lang): string | null {
  if (fromKey === toKey) return ayahLabel(fromKey, lang);
  const from = parseAyahKey(fromKey);
  const to = parseAyahKey(toKey);
  if (!from || !to) return null;
  const name = surahName(from.surah, lang);
  const span = `${ayahRef(fromKey, lang)}–${ayahRef(toKey, lang)}`;
  return name ? `${name} · ${span}` : span;
}

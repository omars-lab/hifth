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
import { LOCALES, type Lang } from "./lang";

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

/** The name table a language reads by. Same length, same order, both times.
 *  Which one is `LOCALES[lang].surahNames` rather than a test for "en", so a
 *  third locale has to say which script its reader looks for a surah in
 *  instead of silently inheriting Arabic. */
export function surahNames(lang: Lang): readonly string[] {
  return LOCALES[lang].surahNames === "romanised" ? SURAH_NAMES_EN : SURAH_NAMES_AR;
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
  return LOCALES[lang].digits === "latin" ? String(n) : toArabicDigits(n);
}

/**
 * The same rule, for text that *contains* numbers rather than being one.
 *
 * One caller today — the revision map's «يُسجَّل منذ ٢٠٢٦-٠٧-٣٠», where the
 * argument is a `YYYY-MM-DD` day stamp and the hyphens have to survive. It is
 * here rather than inlined there because the point of this module is that there
 * is exactly one place that knows which digits a language reads; a second
 * `lang === "ar" ? …` anywhere else is how the two drift.
 */
export function digitsIn(text: string, lang: Lang): string {
  return LOCALES[lang].digits === "latin" ? text : toArabicDigits(text);
}

/** Month names, in the reader's own language — Gregorian, the calendar the day
 *  stamp is written in. "Sept" is the four-letter form on purpose: it is how the
 *  month is abbreviated in running English prose, where the other elevens' three
 *  letters read as abbreviations and September's "Sep" reads as a typo. */
const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
] as const;
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

/** The English ordinal suffix for a day of the month: 1st, 2nd, 3rd, 4th … and
 *  the 11th–13th exception that catches a naive "last digit" rule. */
function ordinalEn(d: number): string {
  const tens = d % 100;
  if (tens >= 11 && tens <= 13) return "th";
  switch (d % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * A `YYYY-MM-DD` day stamp as a person would read it aloud: "Sept 1st, 2026" in
 * English, «١ سبتمبر ٢٠٢٦» in Arabic. The revision map's "active since" line is
 * the one caller — a stored ISO stamp is a fact for a computer, not a date a
 * reader recognises as *theirs*.
 *
 * It parses the stamp by hand rather than through `new Date(stamp)`: that
 * constructor reads a bare `YYYY-MM-DD` as UTC midnight, which is the day before
 * anywhere west of Greenwich, and the whole reason the record stores its own
 * day (`dayOf`) is to never let a timezone move a date. English writes the day
 * with an ordinal; Arabic writes a plain cardinal, which is how the month is
 * spoken in both. A stamp that is not three numbers is handed back untouched, so
 * a malformed value degrades to visible rather than throwing.
 */
export function longDay(stamp: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stamp);
  if (!m) return digitsIn(stamp, lang);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return digitsIn(stamp, lang);
  return LOCALES[lang].digits === "latin"
    ? `${MONTHS_EN[month - 1]} ${day}${ordinalEn(day)}, ${year}`
    : `${toArabicDigits(day)} ${MONTHS_AR[month - 1]} ${toArabicDigits(year)}`;
}

/**
 * A number to one decimal, in the digits *and the decimal mark* of the UI
 * language: "5.8" / «٥٫٨».
 *
 * `digits` is for integers, and handing it a fraction would have left a Latin
 * full stop standing inside Arabic-Indic numerals — the same half-transliterated
 * shape the aria-labels were caught in. Arabic writes the fraction with U+066B
 * ARABIC DECIMAL SEPARATOR, which is a different character from the full stop
 * and not something a caller should be spelling for itself.
 *
 * One caller today: the size of a pinned juz, the only fraction the chrome ever
 * prints. It is here rather than there for the reason the rest of this module
 * exists — one place knows which numerals a language reads.
 */
export function tenths(n: number, lang: Lang): string {
  const text = n.toFixed(1);
  return LOCALES[lang].digits === "latin" ? text : toArabicDigits(text).replace(".", "٫");
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

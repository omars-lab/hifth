/**
 * The chrome's vocabulary, in both languages, in one place.
 *
 * ## Why a hand-written table and not a library
 *
 * There are no plurals to negotiate, no dates, no currencies, and exactly two
 * languages — the whole of ICU MessageFormat would be dead weight in a bundle
 * `gate:budget` measures. What this app actually needs is the thing a library
 * cannot give it: a guarantee that no string is left behind. `Strings` is an
 * interface, so an entry added to `AR` and forgotten in `EN` is a type error at
 * build time, not an Arabic sentence in the middle of an English sheet at
 * runtime. That is the only enforcement this feature needs, and TypeScript was
 * already paying for it.
 *
 * Interpolation is by function rather than by `{placeholder}` for the same
 * reason: `hoppedTo(label, page)` cannot be called with the arguments in the
 * wrong order, and a signature change breaks both bundles at once.
 *
 * ## Numerals are part of the language
 *
 * Every count in the Arabic UI is Arabic-Indic, *including inside aria-labels* —
 * the hop rail once said «٣» to the eye and "three" to a screen reader, and the
 * only place the two spellings ever sat side by side was an aria snapshot. So
 * the bundles carry their own `num`, and no component formats a number itself.
 *
 * ## What is deliberately NOT here
 *
 * Scripture, licence attribution, and proper names of editions and tajweed
 * rules. See `lang.ts` for the reasoning; the short version is that translating
 * an attribution string would break `gate:license-copy`, and it should.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyLangToDocument,
  detectLang,
  dirOf,
  rememberLang,
  type Lang,
} from "./lang";
import {
  ayahLabel as fmtAyahLabel,
  ayahLabelAt as fmtAyahLabelAt,
  ayahRef as fmtAyahRef,
  rangeLabel as fmtRangeLabel,
  digits,
  toArabicDigits,
  surahName as fmtSurahName,
  surahNames,
} from "./format";

/** A hop rail bucket, and a root-lens/edition row. Kept structural on purpose:
 *  these unions are declared by the components that own the behaviour, and an
 *  index into these records stops compiling the day one of them gains a case. */
type Direction = "loop" | "earlier" | "later" | "root";
type NoticeKind = "capped" | "install-ios" | "install-prompt" | "best-effort";

/** One coach card: the glyph belongs to the component, the words to the language. */
export interface CoachStep {
  readonly title: string;
  readonly body: string;
}

/** An edition's proper names, when the UI language spells them differently. */
export interface EditionCopy {
  readonly label: string;
  readonly riwayah: string;
  readonly reason?: string;
}

export interface Strings {
  /* ---- formatters (bound to this language; components never pass `lang`) -- */
  /** A number in this language's digits. */
  num(n: number): string;
  /** The surah name table, for the jumper's matcher. */
  names: readonly string[];
  surahName(surah: number): string;
  /** "البقرة · ٢:٤١" / "Al-Baqarah · 2:41". */
  ayahLabel(key: string): string | null;
  /** The same label from the coordinates, for callers with no canonical key. */
  ayahAt(surah: number, ayah: number): string;
  /** "٢:٤٧" / "2:47". */
  ayahRef(key: string): string | null;
  /** "البقرة · ٢:٤٧–٢:٤٨" / "Al-Baqarah · 2:47–2:48". */
  rangeLabel(fromKey: string, toKey: string): string | null;

  /* ---- the language control itself ---------------------------------------- */
  /** What this language calls itself, in itself — never translated. */
  langName: string;
  langSectionTitle: string;
  langSectionNote: string;
  /** Accessible name of the switch, naming the language it moves to. */
  langSwitchTo(other: string): string;

  /* ---- chrome ------------------------------------------------------------- */
  about: string;
  pageWord: string;
  /**
   * "صفحة 7" / "Page 7" — the stage's accessible name and the page-turn
   * announcement. Latin digits in *both* languages, and deliberately so: the
   * page number is the one figure a reader reads off the printed mus'haf's
   * corner and types into the jumper, and the chrome's own `.numeric` treatment
   * has always shown it that way. The aria snapshots record «صفحة 7».
   */
  pageN(page: number): string;
  goTo: string;
  goToLong: string;
  mushaf: string;
  close: string;
  trail: string;

  /* ---- the page bar ------------------------------------------------------- */
  /** Accessible name of the bar itself — a landmark, so it can be skipped to. */
  pageBar: string;
  /** Accessible name of the range input inside it. */
  pageChoose: string;
  /**
   * "صفحة 7 من 604" / "Page 7 of 604" — the slider's readout, and the one place
   * the app says how long the book is. Latin digits on both numbers, following
   * `pageN`: they are page numbers, read off the corner of the printed page.
   */
  pageOfTotal(page: number, total: number): string;
  prevPage: string;
  nextPage: string;
  /**
   * How much of the print is actually in this build. Loop 4b vendors the rest;
   * until then the slider spans 604 pages of which three exist, and saying so
   * is the difference between a limitation and a lie.
   */
  pagesVendored(have: number, total: number): string;

  /* ---- announcements (the LiveAnnouncer channel) -------------------------- */
  firstPage: string;
  lastPage: string;
  /**
   * Said out loud when a scrub is let go on a page this build does not have and
   * lands on the closest one it does. It names where you *are*, not where you
   * aimed — a silent landing on a different page is the app lying about what it
   * did, which is the one thing the vendored-corpus gap must never become.
   */
  nearestPageN(page: number): string;
  selectionCleared: string;
  selected(label: string): string;
  highlighted(span: string): string;
  hoppedTo(label: string, page: number): string;
  backTo(label: string, page: number): string;
  /** Prefix distinguishing "someone sent me here" from "I jumped here". */
  arrivedVia(origin: "link" | "jump"): string;
  arrivedPage(origin: "link" | "jump", page: number): string;
  arrivedRange(origin: "link" | "jump", ref: string, page: number): string;
  arrivedAyah(origin: "link" | "jump", label: string, page: number): string;
  rangeUnavailable: string;
  ayahUnavailable: string;
  noConcordance: string;
  /** The footer's screen-reader-only summary of what the rail is offering. */
  railSummary(surah: string, links: number): string;

  /* ---- the stage ---------------------------------------------------------- */
  /** Accessible name of one ayah polygon: "الآية ٢:٤٨" / "Ayah 2:48". */
  ayahAria(label: string): string;
  stageLoading: string;
  stageFailed(page: number): string;

  /* ---- hop rail + popover ------------------------------------------------- */
  railGroup: string;
  railDirection: Readonly<Record<Direction, string>>;
  hopTitle: Readonly<Record<Direction, string>>;
  chipAria(direction: string, count: number): string;
  /** The hop sheet's own accessible name: its title and how many rows. */
  hopSheetAria(title: string, count: number): string;
  hopTo(label: string): string;
  twin: string;
  pageUnavailable: string;
  wordLevelPending: string;
  /** DiffView's "you are here" tag on the upper verse. */
  hereTag: string;

  /* ---- highlighted range -------------------------------------------------- */
  rangeAria(title: string, links: number): string;
  rangeEmpty: string;
  rangeFrom(refs: string): string;
  /** Separator between the source refs of a merged row. */
  refJoin: string;
  clearSelection: string;

  /* ---- trail beads + share ------------------------------------------------ */
  tapHint: string;
  beadBack(label: string): string;
  beadCurrent(label: string): string;
  shareTitle: string;
  shareTextTrail: string;
  shareTextRange: string;
  shareTextAyah: string;
  shareAriaTrail: string;
  shareAriaRange: string;
  shareAriaAyah: string;
  shareLabel: string;
  shareLabelTrail: string;
  shared: string;
  copied: string;
  copyFailed: string;

  /* ---- coach marks -------------------------------------------------------- */
  coachRegion: string;
  coachSteps: readonly CoachStep[];
  coachNext: string;
  coachDone: string;
  coachSkip: string;
  coachDoneAria: string;
  coachNextAria(next: number, total: number): string;

  /* ---- jumper ------------------------------------------------------------- */
  jumpInput: string;
  jumpPlaceholder: string;
  jumpEmpty: string;
  jumpResults: string;
  juzGroup: string;
  juzN(juz: number): string;
  surahN(surah: number): string;
  jumpStartsAt(label: string): string;

  /* ---- edition picker ----------------------------------------------------- */
  editionCurrent: string;
  editionNoTable: string;
  editionNoCounterpart: string;
  editionMapsTo(ref: string): string;
  editionFoot: string;
  /** Per-edition overrides; empty in Arabic, where core's own strings are it. */
  editionCopy: Readonly<Record<string, EditionCopy>>;

  /* ---- tajweed skin + legend ---------------------------------------------- */
  skinGroup: string;
  tajweed: string;
  beta: string;
  legendAria: string;
  legendTitle: string;
  legendCaveat: { readonly lead: string; readonly strong: string; readonly rest: string };
  legendNoneOnPage: string;
  legendCountOnPage(n: number, page: number): string;
  legendSelection: string;
  legendNoRules: string;
  tajweedCredit: string;
  /** Rule identity: the primary spelling for this language, and the other one. */
  ruleName(label: string, latin: string): { readonly primary: string; readonly secondary: string };

  /* ---- root lens ---------------------------------------------------------- */
  rootsTitle: string;
  rootsAria(count: number): string;
  rootsTrigger(count: number, curated: number): string;
  rootsEmpty: string;
  rootsPicked: string;
  rootsPickedNote: string;
  rootsSharedRoot: string;
  rootsHapax: string;
  rootsStats(ayahs: number, words: number): string;
  rootsTruncated(shown: number): string;
  rootsOccurrences(count: number): string;
  rootsUnavailable: string;
  rootsCredit: string;
  /** "نفس الصفحة" / "2 pages later" — page distance the way a hafiz says it. */
  distance(dPage: number): string;

  /* ---- offline notices ---------------------------------------------------- */
  notices: Readonly<
    Record<NoticeKind, { readonly title: string; readonly body: string; readonly action?: string }>
  >;
  dismissNotice: string;
  dismiss: string;

  /* ---- colophon ----------------------------------------------------------- */
  aboutTitle: string;
  aboutLede: string;
  aboutCaveat: string;
  licenceHead: string;
  licenceBody: string;
  sourceLink: string;
  devBuild: string;
  devBuildNote: string;
  sourcesHead: string;
  aboutFoot: string;

  /* ---- the revision map --------------------------------------------------- */
  /**
   * The sheet's title, and it is deliberately not "revision calendar". The record
   * behind it is a log of taps; a tap is evidence someone *looked at* an ayah and
   * not that they recited it. Naming the picture after what it can prove is the
   * whole difference between an instrument and a flattering one.
   */
  mapTitle: string;
  /** Said once, plainly, under the title. Never repeated per cell. */
  mapCaveat: string;
  /** The chip's accessible name — still says the page, then what it opens. */
  mapOpen(page: number): string;
  mapScopeGroup: string;
  scopePage: string;
  scopeHizb: string;
  scopeJuz: string;
  hizbN(hizb: number): string;
  /**
   * How much of the book this build actually holds, at the chosen scope. The
   * page bar's `pagesVendored` for divisions — same fact, same honesty, counted
   * in the unit on screen.
   */
  mapHeld(have: number, total: number, scope: "page" | "hizb" | "juz"): string;
  /**
   * "recording since 2026-07-14". The one line that keeps an emptied record from
   * reading as an idle one: iOS deletes script-writable storage after seven days
   * untouched, and a record that resets to empty says "you have revised nothing"
   * to someone about their own worship. A record that says how old it is cannot
   * tell that lie — an empty map dated this morning is visibly a new record.
   */
  mapSince(day: string): string;
  /**
   * The grid's own name. Sixty unlabelled squares inside a dialog are sixty
   * anonymous list items to a screen reader; naming the list is what separates
   * the map from the legend beside it, which is also a list of cells.
   */
  mapGrid: string;
  /** No IndexedDB at all — a private window, or a browser that refuses. */
  mapNoStore: string;
  mapLoading: string;
  /** Legend, and the three things a cell can be. */
  mapLegend: string;
  mapAbsent: string;
  mapNeverOpened: string;
  mapRecent: string;
  /** A cell's accessible name, one per state. */
  mapCellAbsent(label: string): string;
  mapCellNever(label: string): string;
  mapCellSeen(label: string, days: number): string;

  /* ---- the desktop spread and the controls a phone had no room for -------- */
  /**
   * The accessible name of the leaf facing the one you are reading. Structural,
   * not a caption: the panel's own visible text says what is or is not there, so
   * a label that repeated it would be read twice.
   */
  facingPage: string;
  /**
   * "صفحة 6 ليست في هذه النسخة" / "Page 6 is not in this build".
   *
   * Only pages 7, 9 and 19 are vendored and they are not adjacent, so today
   * every spread has one of these. Latin digits, following `pageN` and
   * `pageOfTotal`: it is a page number, read off the corner of a printed page.
   * Said in the document rather than through `LiveAnnouncer` — see PageSpread.
   */
  facingAbsent(page: number): string;
  /** What the arrow keys do. Desktop only; a phone cannot reach them at all. */
  keyPages: string;
  /** What `/` does. Same. */
  keyJump: string;
}

/* ------------------------------------------------------------------------- */
/* Arabic — the app's native tongue, and the wording every e2e aria snapshot  */
/* in e2e/__aria__ was recorded against.                                      */
/* ------------------------------------------------------------------------- */

/**
 * Exported for `i18n.test.tsx`, which walks both bundles looking for a string
 * that was never translated. Nothing else imports these — components read the
 * one the provider chose, never a bundle by name.
 */
export const AR: Strings = {
  num: (n) => digits(n, "ar"),
  names: surahNames("ar"),
  surahName: (s) => fmtSurahName(s, "ar"),
  ayahLabel: (k) => fmtAyahLabel(k, "ar"),
  ayahAt: (s, a) => fmtAyahLabelAt(s, a, "ar"),
  ayahRef: (k) => fmtAyahRef(k, "ar"),
  rangeLabel: (a, b) => fmtRangeLabel(a, b, "ar"),

  langName: "العربية",
  langSectionTitle: "اللغة",
  langSectionNote: "تتغيّر لغة الأزرار والقوائم فقط؛ المصحف ونصّ الآيات عربيّ دائمًا.",
  langSwitchTo: (other) => `التبديل إلى ${other}`,

  about: "عن حِفظ · الرخصة والمصادر",
  pageWord: "صفحة",
  pageN: (page) => `صفحة ${page}`,
  goTo: "اذهب إلى",
  goToLong: "اذهب إلى · سورة أو جزء أو آية",
  mushaf: "المصحف",
  close: "إغلاق",
  trail: "المسار",

  pageBar: "شريط الصفحات",
  pageChoose: "اختيار الصفحة",
  pageOfTotal: (page, total) => `صفحة ${page} من ${total}`,
  // The mus'haf's own direction, not the chrome's: the next page of a mus'haf
  // lies to the *left*, which is why ArrowLeft turns forward and why the next
  // button sits on the left edge of the bar in both languages.
  prevPage: "الصفحة السابقة",
  nextPage: "الصفحة التالية",
  pagesVendored: (have, total) =>
    `المتوفّر ${digits(have, "ar")} من ${digits(total, "ar")} صفحة`,

  firstPage: "أول صفحة متوفّرة",
  lastPage: "آخر صفحة متوفّرة",
  nearestPageN: (page) => `أقرب صفحة متوفّرة · صفحة ${page}`,
  selectionCleared: "أُلغي التحديد",
  selected: (label) => `حُدّدت ${label}`,
  highlighted: (span) => `ظُلّل ${span}`,
  // Page numbers here are Latin for the same reason `pageN` is — they name the
  // page in the corner of the printed mus'haf, and the chrome shows it that way.
  hoppedTo: (label, page) => `انتقلت إلى ${label} · صفحة ${page}`,
  backTo: (label, page) => `رجعت إلى ${label} · صفحة ${page}`,
  arrivedVia: (origin) => (origin === "jump" ? "انتقلت إلى" : "فُتح رابط ·"),
  arrivedPage: (origin, page) => `${AR.arrivedVia(origin)} صفحة ${page}`,
  arrivedRange: (origin, ref, page) => `${AR.arrivedVia(origin)} مقطع ${ref} · صفحة ${page}`,
  arrivedAyah: (origin, label, page) => `${AR.arrivedVia(origin)} ${label} · صفحة ${page}`,
  rangeUnavailable: "المقطع المطلوب غير متوفّر بعد",
  ayahUnavailable: "الآية المطلوبة غير متوفّرة بعد",
  noConcordance: "لا جدول مقابلة لهذه الطبعة بعد",
  railSummary: (surah, links) => `${surah} · ${digits(links, "ar")} روابط`,

  ayahAria: (label) => `الآية ${label}`,
  stageLoading: "…جاري التحميل",
  stageFailed: (page) => `تعذّر تحميل صفحة ${digits(page, "ar")}. أعد المحاولة.`,

  railGroup: "روابط الآية",
  railDirection: {
    loop: "متشابهات في السورة",
    earlier: "متشابهات في سور سابقة",
    later: "متشابهات في سور لاحقة",
    root: "جذر مشترك",
  },
  hopTitle: {
    loop: "متشابهات في السورة",
    earlier: "في سور سابقة",
    later: "في سور لاحقة",
    root: "بنفس الجذر",
  },
  chipAria: (direction, count) => `${direction} · ${digits(count, "ar")}`,
  hopSheetAria: (title, count) => `${title} · ${count}`,
  hopTo: (label) => `انتقل إلى ${label}`,
  twin: "توأم",
  pageUnavailable: "هذه الصفحة غير متوفّرة بعد",
  wordLevelPending: "الربط على مستوى الكلمة يصل مع الحزمة القادمة",
  hereTag: "هنا",

  rangeAria: (title, links) => `مقطع محدَّد · ${title} · ${links} روابط`,
  rangeEmpty: "لا روابط في هذا المقطع بعد",
  rangeFrom: (refs) => `من ${refs}`,
  refJoin: "، ",
  clearSelection: "إلغاء التحديد",

  tapHint: "المس آية على الصفحة لتحديدها",
  beadBack: (label) => `ارجع إلى ${label}`,
  beadCurrent: (label) => `الآية الحالية ${label} — المس للإلغاء`,
  shareTitle: "حفظ",
  shareTextTrail: "مسار مُتشابهات",
  shareTextRange: "مقطع",
  shareTextAyah: "آية",
  shareAriaTrail: "شارك المسار كرابط",
  shareAriaRange: "شارك هذا المقطع كرابط",
  shareAriaAyah: "شارك هذه الآية كرابط",
  shareLabel: "شارك",
  shareLabelTrail: "شارك المسار",
  shared: "تمت المشاركة",
  copied: "نُسخ الرابط",
  copyFailed: "تعذّر النسخ",

  coachRegion: "كيف تتنقّل",
  coachSteps: [
    { title: "المس آية", body: "يظهر شريط الروابط بجانبها: متشابهاتها، وعددها." },
    { title: "اضغط واسحب", body: "يتظلّل المقطع، وتفتح قائمته بروابط آياته مجموعة." },
    { title: "المس رقاقة", body: "تنتقل إلى الآية المشابهة، وتبقى خرزة في المسار للرجوع." },
  ],
  coachNext: "التالي",
  coachDone: "تمّ",
  coachSkip: "تخطَّ",
  coachDoneAria: "تمّ · إخفاء الشرح",
  coachNextAria: (next, total) =>
    `التالي · ${digits(next, "ar")} من ${digits(total, "ar")}`,

  jumpInput: "اسم السورة أو رقمها، أو ٢:٢٥٥، أو جزء ٩",
  jumpPlaceholder: "البقرة · ٢:٢٥٥ · جزء ٩",
  jumpEmpty: "لا مكان بهذا الاسم أو الرقم",
  jumpResults: "النتائج",
  juzGroup: "الأجزاء",
  juzN: (juz) => `الجزء ${digits(juz, "ar")}`,
  surahN: (surah) => `سورة ${digits(surah, "ar")}`,
  jumpStartsAt: (label) => `يبدأ من ${label}`,

  editionCurrent: "الحالي",
  editionNoTable: "لا جدول مقابلة بعد",
  editionNoCounterpart: "لا تقابلها آية في هذه الطبعة",
  editionMapsTo: (ref) => `تقابلها ${ref}`,
  editionFoot: "كل رابط يحمل طبعته؛ الانتقال بين الطبعات يمرّ بجدول المقابلة، لا بترقيم مشترك.",
  editionCopy: {},

  skinGroup: "مظهر الصفحة",
  tajweed: "تجويد",
  beta: "تجريبي",
  legendAria: "مفتاح ألوان التجويد",
  legendTitle: "مفتاح التجويد",
  legendCaveat: {
    lead: "هذه الطبقة ",
    strong: "تجريبية",
    rest:
      " حتى يعتمدها حافظ. وهي تُعلّم الآية كاملة بأبرز حكم فيها — لا الحرف نفسه — " +
      "لأنّ صفحات المصحف الحالية لا تحمل معرّفات للحروف بعد.",
  },
  legendNoneOnPage: "لا شيء في هذه الصفحة",
  legendCountOnPage: (n, page) => `${digits(n, "ar")} آية في صفحة ${digits(page, "ar")}`,
  legendSelection: "أحكام الآية المحددة",
  legendNoRules: "لا أحكام معروفة على هذه الآية.",
  tajweedCredit: "أحكام التجويد مأخوذة من quran-tajweed (Collin Fair)، رخصة CC BY 4.0.",
  ruleName: (label, latin) => ({ primary: label, secondary: latin }),

  rootsTitle: "الجذور",
  rootsAria: (count) => `الجذور · ${digits(count, "ar")}`,
  rootsTrigger: (count, curated) =>
    curated > 0
      ? `الجذور · ${digits(count, "ar")} · ${digits(curated, "ar")} مختارة`
      : `الجذور · ${digits(count, "ar")}`,
  rootsEmpty: "لا جذور معروفة لهذه الآية",
  rootsPicked: "مختارة",
  rootsPickedNote: "محقّقة يدويًا",
  rootsSharedRoot: "جذر مشترك",
  rootsHapax: "لا تتكرّر في المصحف",
  rootsStats: (ayahs, words) =>
    `${digits(ayahs, "ar")} آية · ${digits(words, "ar")} كلمة`,
  rootsTruncated: (shown) => `أقرب ${digits(shown, "ar")} مواضع فقط`,
  rootsOccurrences: (count) => `${digits(count, "ar")} كلمات`,
  rootsUnavailable: " · غير متوفّرة بعد",
  rootsCredit: "الجذور من",
  distance: (dPage) => {
    if (dPage === 0) return "نفس الصفحة";
    const n = Math.abs(dPage);
    const pages =
      n === 1
        ? "صفحة واحدة"
        : n === 2
          ? "صفحتان"
          : n <= 10
            ? `${digits(n, "ar")} صفحات`
            : `${digits(n, "ar")} صفحة`;
    return `${pages} ${dPage > 0 ? "بعد" : "قبل"}`;
  },

  notices: {
    capped: {
      title: "المساحة المتاحة لحفظ لا تكفي للعمل دون إنترنت",
      body:
        "المتصفّح لا يمنح هذا الموقع إلا مساحة صغيرة، فقد تُحذف الصفحات المحفوظة. " +
        "تحقّق من مساحة جهازك، ومن إعداد «مسح بيانات المواقع عند إغلاق كل النوافذ» في إعدادات الخصوصية.",
    },
    "install-ios": {
      title: "ثبّت حفظ ليبقى معك دون إنترنت",
      body:
        "من زر المشاركة في المتصفّح اختر «إضافة إلى الشاشة الرئيسية». " +
        "بدون تثبيت يمسح سفاري الصفحات المحفوظة بعد سبعة أيام من عدم الفتح.",
    },
    "install-prompt": {
      title: "ثبّت حفظ ليعمل دون إنترنت",
      body: "التثبيت يجعل الصفحات التي زرتها تبقى محفوظة على جهازك.",
      action: "ثبّت",
    },
    "best-effort": {
      title: "الحفظ دون إنترنت غير مضمون",
      body:
        "لم يمنح المتصفّح تخزينًا دائمًا، فقد يحذف الصفحات المحفوظة إذا ضاقت مساحة الجهاز. " +
        "تُحفظ الصفحة من جديد كلّما فتحتها ومعك إنترنت.",
    },
  },
  dismissNotice: "إخفاء التنبيه",
  dismiss: "إخفاء",

  aboutTitle: "عن حِفظ",
  aboutLede:
    "حِفظ آلة ملاحة في المصحف: تختار آية فينقلك إلى متشابهاتها. لا حساب ولا خادم ولا " +
    "تتبّع؛ الصفحات والبيانات تُحمَّل إلى جهازك.",
  aboutCaveat: "المصحف المطبوع هو المرجع. ما يعرضه حِفظ عونٌ على المراجعة، لا بديل عنها.",
  licenceHead: "الرخصة والمصدر",
  licenceBody:
    "برنامج حرّ برخصة GNU GPL الإصدار الثالث أو ما بعده: لك أن تدرسه وتعدّله وتنشره. " +
    "وهذه شيفرة هذه النسخة بعينها، لا فرعٌ قد يتغيّر:",
  sourceLink: "الشيفرة المصدرية",
  devBuild: "نسخة تطوير",
  devBuildNote: "هذه نسخة تطوير محلّية، فلا تقابلها إصدارة معيّنة؛ الرابط يفتح المستودع.",
  sourcesHead: "المصادر",
  aboutFoot: "الشروط الكاملة والإصدارات المثبَّتة في ملف SOURCES.md داخل المستودع:",

  // «ما فتحتَه» — what you opened. Not «مراجعتك»: the record cannot see a
  // recitation, only a tap, and a title claiming otherwise would be the app
  // stating something its data does not hold.
  mapTitle: "ما فتحتَه من المصحف",
  mapCaveat: "النقر دليل على أنّك فتحت الآية، لا على أنّك راجعتها.",
  mapOpen: (page) => `صفحة ${page} · ما فتحتَه من المصحف`,
  mapScopeGroup: "التقسيم",
  scopePage: "صفحة",
  scopeHizb: "حزب",
  scopeJuz: "جزء",
  hizbN: (hizb) => `الحزب ${digits(hizb, "ar")}`,
  mapHeld: (have, total, scope) => {
    const unit =
      scope === "page" ? "صفحة" : scope === "hizb" ? (have === 1 ? "حزب" : "حزبًا") : "جزءًا";
    return `المتوفّر ${digits(have, "ar")} من ${digits(total, "ar")} ${unit}`;
  },
  mapSince: (day) => `يُسجَّل منذ ${toArabicDigits(day)}`,
  mapGrid: "خريطة المصحف",
  mapNoStore: "لا يمكن حفظ السجلّ في هذا المتصفّح، فلا شيء هنا لعرضه.",
  mapLoading: "جارٍ فتح السجلّ…",
  mapLegend: "الدليل",
  mapAbsent: "غير متوفّر في هذه النسخة",
  mapNeverOpened: "متوفّر ولم يُفتح",
  mapRecent: "فُتح حديثًا",
  mapCellAbsent: (label) => `${label} · غير متوفّر في هذه النسخة`,
  mapCellNever: (label) => `${label} · لم يُفتح`,
  mapCellSeen: (label, days) =>
    days <= 0
      ? `${label} · فُتح اليوم`
      : days === 1
        ? `${label} · فُتح أمس`
        : `${label} · فُتح قبل ${digits(days, "ar")} يومًا`,

  facingPage: "الصفحة المقابلة",
  facingAbsent: (page) => `صفحة ${page} ليست في هذه النسخة`,
  keyPages: "تصفّح",
  keyJump: "انتقال",
};

/* ------------------------------------------------------------------------- */
/* English — the chrome only. Every proper noun that names scripture keeps its */
/* Arabic alongside wherever there is room for both.                          */
/* ------------------------------------------------------------------------- */

export const EN: Strings = {
  num: (n) => digits(n, "en"),
  names: surahNames("en"),
  surahName: (s) => fmtSurahName(s, "en"),
  ayahLabel: (k) => fmtAyahLabel(k, "en"),
  ayahAt: (s, a) => fmtAyahLabelAt(s, a, "en"),
  ayahRef: (k) => fmtAyahRef(k, "en"),
  rangeLabel: (a, b) => fmtRangeLabel(a, b, "en"),

  langName: "English",
  langSectionTitle: "Language",
  langSectionNote:
    "This changes the buttons and menus only. The mus'haf and the verse text are always Arabic.",
  langSwitchTo: (other) => `Switch to ${other}`,

  about: "About Hifth · licence and sources",
  pageWord: "Page",
  pageN: (page) => `Page ${page}`,
  goTo: "Go to",
  goToLong: "Go to · a surah, a juz, or an ayah",
  mushaf: "Mus'haf",
  close: "Close",
  trail: "Trail",

  pageBar: "Page bar",
  pageChoose: "Choose a page",
  pageOfTotal: (page, total) => `Page ${page} of ${total}`,
  // Not swapped for English. "Previous" and "next" here mean earlier and later
  // in the mus'haf, and the mus'haf runs right to left in both languages — the
  // bar is scripture furniture, so its edges keep the book's direction.
  prevPage: "Previous page",
  nextPage: "Next page",
  pagesVendored: (have, total) =>
    `${digits(have, "en")} of ${digits(total, "en")} pages available`,

  firstPage: "First available page",
  lastPage: "Last available page",
  nearestPageN: (page) => `Nearest available page · Page ${page}`,
  selectionCleared: "Selection cleared",
  selected: (label) => `Selected ${label}`,
  highlighted: (span) => `Highlighted ${span}`,
  hoppedTo: (label, page) => `Hopped to ${label} · page ${page}`,
  backTo: (label, page) => `Back at ${label} · page ${page}`,
  arrivedVia: (origin) => (origin === "jump" ? "Went to" : "Link opened ·"),
  arrivedPage: (origin, page) => `${EN.arrivedVia(origin)} page ${page}`,
  arrivedRange: (origin, ref, page) => `${EN.arrivedVia(origin)} passage ${ref} · page ${page}`,
  arrivedAyah: (origin, label, page) => `${EN.arrivedVia(origin)} ${label} · page ${page}`,
  rangeUnavailable: "That passage is not available yet",
  ayahUnavailable: "That ayah is not available yet",
  noConcordance: "No concordance table for that edition yet",
  railSummary: (surah, links) => `${surah} · ${links} links`,

  ayahAria: (label) => `Ayah ${label}`,
  stageLoading: "Loading…",
  stageFailed: (page) => `Could not load page ${page}. Try again.`,

  railGroup: "Links from this ayah",
  railDirection: {
    loop: "Similar verses in this surah",
    earlier: "Similar verses in earlier surahs",
    later: "Similar verses in later surahs",
    root: "Shared root",
  },
  hopTitle: {
    loop: "Similar in this surah",
    earlier: "In earlier surahs",
    later: "In later surahs",
    root: "Same root",
  },
  chipAria: (direction, count) => `${direction} · ${count}`,
  hopSheetAria: (title, count) => `${title} · ${count}`,
  hopTo: (label) => `Hop to ${label}`,
  twin: "twin",
  pageUnavailable: "This page is not available yet",
  wordLevelPending: "Word-level links arrive with the next data pack",
  hereTag: "here",

  rangeAria: (title, links) => `Highlighted passage · ${title} · ${links} links`,
  rangeEmpty: "No links in this passage yet",
  rangeFrom: (refs) => `from ${refs}`,
  refJoin: ", ",
  clearSelection: "Clear highlight",

  tapHint: "Tap an ayah on the page to select it",
  beadBack: (label) => `Back to ${label}`,
  beadCurrent: (label) => `Current ayah ${label} — tap to clear`,
  shareTitle: "Hifth",
  shareTextTrail: "A mutashabihat trail",
  shareTextRange: "A passage",
  shareTextAyah: "An ayah",
  shareAriaTrail: "Share the trail as a link",
  shareAriaRange: "Share this passage as a link",
  shareAriaAyah: "Share this ayah as a link",
  shareLabel: "Share",
  shareLabelTrail: "Share trail",
  shared: "Shared",
  copied: "Link copied",
  copyFailed: "Could not copy",

  coachRegion: "How to navigate",
  coachSteps: [
    { title: "Tap an ayah", body: "Its rail of links opens beside it: the similar verses, and how many." },
    { title: "Press and drag", body: "The passage is highlighted, and its links open as one merged list." },
    { title: "Tap a chip", body: "You hop to the similar verse, and a bead on the trail brings you back." },
  ],
  coachNext: "Next",
  coachDone: "Done",
  coachSkip: "Skip",
  coachDoneAria: "Done · hide the tips",
  coachNextAria: (next, total) => `Next · ${next} of ${total}`,

  jumpInput: "Surah name or number, or 2:255, or juz 9",
  jumpPlaceholder: "Al-Baqarah · 2:255 · juz 9",
  jumpEmpty: "No place by that name or number",
  jumpResults: "Results",
  juzGroup: "The thirty juz",
  juzN: (juz) => `Juz ${juz}`,
  surahN: (surah) => `Surah ${surah}`,
  jumpStartsAt: (label) => `Starts at ${label}`,

  editionCurrent: "current",
  editionNoTable: "No concordance table yet",
  editionNoCounterpart: "No matching ayah in that edition",
  editionMapsTo: (ref) => `Maps to ${ref}`,
  editionFoot:
    "Every link carries its edition. Moving between editions goes through a concordance table, never through shared numbering.",
  editionCopy: {
    "hafs-kfqc": {
      label: "Hafs · King Fahd Complex",
      riwayah: "Riwayat Hafs 'an 'Asim",
    },
    "warsh-libya": {
      label: "Warsh · Libyan Endowments",
      riwayah: "Riwayat Warsh 'an Nafi'",
      reason: "Licensed for non-commercial use only — needs permission first",
    },
    "qalun-libya": {
      label: "Qalun · Libyan Endowments",
      riwayah: "Riwayat Qalun 'an Nafi'",
      reason: "Licensed for non-commercial use only — needs permission first",
    },
    "hafs-indopak": {
      label: "Hafs · Indo-Pak script",
      riwayah: "Riwayat Hafs 'an 'Asim",
      reason: "No licensed page source yet",
    },
  },

  skinGroup: "Page appearance",
  tajweed: "Tajweed",
  beta: "beta",
  legendAria: "Tajweed colour key",
  legendTitle: "Tajweed key",
  legendCaveat: {
    lead: "This layer is ",
    strong: "in beta",
    rest:
      " until a hafiz signs it off. It marks the whole ayah with its most salient rule — " +
      "not the letter itself — because the mus'haf pages vendored so far carry no letter ids.",
  },
  legendNoneOnPage: "None on this page",
  legendCountOnPage: (n, page) => `${n} ${n === 1 ? "ayah" : "ayahs"} on page ${page}`,
  legendSelection: "Rules on the selected ayah",
  legendNoRules: "No rules known for this ayah.",
  tajweedCredit: "Tajweed rules from quran-tajweed (Collin Fair), licensed CC BY 4.0.",
  ruleName: (label, latin) => ({ primary: latin, secondary: label }),

  rootsTitle: "Roots",
  rootsAria: (count) => `Roots · ${count}`,
  rootsTrigger: (count, curated) =>
    curated > 0 ? `Roots · ${count} · ${curated} hand-picked` : `Roots · ${count}`,
  rootsEmpty: "No roots known for this ayah",
  rootsPicked: "Hand-picked",
  rootsPickedNote: "verified by hand",
  rootsSharedRoot: "Shared root",
  rootsHapax: "Occurs nowhere else in the Qur'an",
  rootsStats: (ayahs, words) =>
    `${ayahs} ${ayahs === 1 ? "ayah" : "ayahs"} · ${words} ${words === 1 ? "word" : "words"}`,
  rootsTruncated: (shown) => `Nearest ${shown} occurrences only`,
  rootsOccurrences: (count) => `${count} ${count === 1 ? "word" : "words"}`,
  rootsUnavailable: " · not available yet",
  rootsCredit: "Roots from",
  distance: (dPage) => {
    if (dPage === 0) return "Same page";
    const n = Math.abs(dPage);
    const pages = n === 1 ? "1 page" : `${n} pages`;
    return `${pages} ${dPage > 0 ? "later" : "earlier"}`;
  },

  notices: {
    capped: {
      title: "There is not enough room for Hifth to work offline",
      body:
        "The browser gives this site only a small amount of space, so saved pages may be deleted. " +
        "Check the free space on your device, and the «clear site data when all windows are closed» setting under privacy.",
    },
    "install-ios": {
      title: "Install Hifth so it stays with you offline",
      body:
        "From the browser's share button, choose «Add to Home Screen». " +
        "Without installing, Safari deletes saved pages after seven days without opening the app.",
      },
    "install-prompt": {
      title: "Install Hifth so it works offline",
      body: "Installing keeps the pages you have visited saved on your device.",
      action: "Install",
    },
    "best-effort": {
      title: "Offline storage is not guaranteed",
      body:
        "The browser did not grant persistent storage, so saved pages may be deleted if the device runs short. " +
        "Each page is saved again whenever you open it online.",
    },
  },
  dismissNotice: "Hide this notice",
  dismiss: "Hide",

  aboutTitle: "About Hifth",
  aboutLede:
    "Hifth is a navigation instrument for the mus'haf: pick an ayah and it takes you to its " +
    "mutashabihat. No account, no server, no tracking — the pages and the data are loaded onto your device.",
  aboutCaveat:
    "The printed mus'haf is the reference. What Hifth shows is an aid to revision, not a substitute for it.",
  licenceHead: "Licence and source",
  licenceBody:
    "Free software under the GNU GPL, version 3 or later: you may study it, change it and pass it on. " +
    "This is the source of this exact build, not a branch that may move:",
  sourceLink: "Source code",
  devBuild: "dev build",
  devBuildNote:
    "This is a local development build, so no released version corresponds to it; the link opens the repository.",
  sourcesHead: "Sources",
  aboutFoot: "Full terms and pinned versions are in SOURCES.md inside the repository:",

  mapTitle: "What you have opened",
  mapCaveat: "A tap is evidence you opened an ayah, not that you revised it.",
  mapOpen: (page) => `Page ${page} · what you have opened`,
  mapScopeGroup: "Division",
  scopePage: "Page",
  scopeHizb: "Hizb",
  scopeJuz: "Juz",
  hizbN: (hizb) => `Hizb ${hizb}`,
  mapHeld: (have, total, scope) =>
    `${have} of ${total} ${scope === "page" ? "pages" : scope === "hizb" ? "hizb" : "juz"} in this build`,
  mapSince: (day) => `Recording since ${day}`,
  mapGrid: "Map of the mus'haf",
  mapNoStore: "This browser cannot keep the record, so there is nothing here to show.",
  mapLoading: "Opening the record…",
  mapLegend: "Key",
  mapAbsent: "Not in this build",
  mapNeverOpened: "Here, never opened",
  mapRecent: "Opened recently",
  mapCellAbsent: (label) => `${label} · not in this build`,
  mapCellNever: (label) => `${label} · never opened`,
  mapCellSeen: (label, days) =>
    days <= 0
      ? `${label} · opened today`
      : days === 1
        ? `${label} · opened yesterday`
        : `${label} · opened ${days} days ago`,

  facingPage: "Facing page",
  facingAbsent: (page) => `Page ${page} is not in this build`,
  keyPages: "Pages",
  keyJump: "Go to",
};

const BUNDLES: Readonly<Record<Lang, Strings>> = { ar: AR, en: EN };

/** What every component reads: the language, its strings, and the way to move. */
export interface I18n {
  readonly lang: Lang;
  /** The *chrome's* direction. The stage and the diff pin their own. */
  readonly dir: "rtl" | "ltr";
  readonly t: Strings;
  readonly setLang: (lang: Lang) => void;
  /** The bundle for the language this one is not — for labelling the switch. */
  readonly other: Strings;
}

/*
 * The default is Arabic with an inert setter, and that is deliberate: a
 * component rendered outside the provider — which is every unit test in
 * `*.test.tsx` — must not depend on jsdom's `navigator.language` (it is
 * "en-US"). Those tests assert the Arabic wording, they were written before this
 * feature existed, and they should keep passing untouched. The provider lives in
 * `main.tsx`, one level above `<App />`, because it also owns the document's
 * `lang`/`dir`, which is not App's to set.
 */
const LangContext = createContext<I18n>({
  lang: "ar",
  dir: "rtl",
  t: AR,
  setLang: () => {},
  other: EN,
});

export function LangProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>(detectLang);

  // Keep the document in step. `lang` is the load-bearing half — it decides
  // which voice a screen reader reads the chrome in.
  useEffect(() => applyLangToDocument(lang), [lang]);

  const setLang = useCallback((next: Lang) => {
    rememberLang(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: dirOf(lang),
      t: BUNDLES[lang],
      setLang,
      other: BUNDLES[lang === "ar" ? "en" : "ar"],
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** The one hook. Named for what it is used for, not for what it holds. */
export function useT(): I18n {
  return useContext(LangContext);
}

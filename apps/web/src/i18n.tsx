/**
 * The chrome's vocabulary: one assembler, one bundle per language.
 *
 * ## Why this is no longer a hand-written table
 *
 * The module this replaced argued its own case, and the argument was correct for
 * what it knew:
 *
 * > There are no plurals to negotiate, no dates, no currencies, and exactly two
 * > languages — the whole of ICU MessageFormat would be dead weight in a bundle
 * > `gate:budget` measures.
 *
 * Two of those three premises did not survive contact. There *are* plurals: this
 * file used to carry
 *
 *     n === 1 ? "صفحة واحدة" : n === 2 ? "صفحتان"
 *       : n <= 10 ? `${digits(n)} صفحات` : `${digits(n)} صفحة`
 *
 * and Arabic's `few` is `n % 100 = 3..10`, not `n <= 10` — so 103 pages read as
 * «١٠٣ صفحة» where Arabic wants «١٠٣ صفحات», for 41 of the 603 distances the
 * mus'haf can produce. It compiled, it passed, and it was wrong in a way only a
 * hafiz would notice. And "exactly two languages" was a statement about today,
 * not about the app. Both are in docs/design/i18n.md §①–②.
 *
 * The bundle premise did survive, and it is the reason for the shape here. ICU
 * MessageFormat is the notation, but it is compiled to TypeScript by
 * `scripts/messages-compile.mjs` at build time; the parser is a devDependency and
 * ships nothing. The runtime is `messages/plural.ts`, twelve lines over the
 * browser's own `Intl.PluralRules` — **+180 bytes gzipped**. The whole migration
 * measured **+1.8 KB gz** (101.2 → 103.0 against a 150 KB budget), nearly all of
 * it the compiled catalogs. The batteries-included alternatives would have added
 * 9.3–25.2 KB on top of those same catalogs.
 *
 * ## Completeness is still a build-time guarantee
 *
 * The old guarantee was `Strings` as an interface implemented twice: a key in
 * `AR` missing from `EN` was a type error. That guarantee is intact and now
 * *stricter*, one layer down. Each locale's compiled module is declared
 * `const messages: Catalog`, so a key missing from `en.json` does not compile, an
 * extra key does not compile, and — new — a message that interpolates an argument
 * no locale declares does not compile either, because `Catalog` types the
 * argument *names*, not just how many there are.
 *
 * There is deliberately **no lookup and no fallback chain**. A missing key cannot
 * quietly render another language's words, because a missing key is not a
 * runtime condition at all. English inside an Arabic sheet is the failure this
 * whole design exists to prevent, and a fallback is that failure with a
 * reassuring name. `gate:i18n` guards what the compiler cannot see: that the
 * committed `.gen.ts` files match the catalogs, and that a plural covers every
 * CLDR category its own locale actually has.
 *
 * ## One assembler, not one bundle per language
 *
 * `buildStrings` is written once and runs for every locale. That is the part that
 * makes a third language cheap: adding Urdu is a JSON catalog plus a row in
 * `LOCALES`, not a re-typing of 134 interface members with a chance to get one
 * of them subtly wrong. It also means every locale is wired to `format.ts` the
 * same way, which is how the numeral rule below stays true.
 *
 * ## Numerals are part of the language
 *
 * Every count in the Arabic UI is Arabic-Indic, *including inside aria-labels* —
 * the hop rail once said «٣» to the eye and "three" to a screen reader, and the
 * only place the two spellings ever sat side by side was an aria snapshot. There
 * is exactly one authority for numerals, `format.ts`'s `digits()`, and the
 * message compiler *refuses* ICU's `#` and `{n, number}` so a second one cannot
 * appear. Messages that count therefore take two arguments: `{n}`, the number, to
 * choose the plural form with, and `{nText}`, the digits already rendered, to
 * print. A bare `{page}` is a raw number and comes out in Latin digits — the
 * deliberate exception, because a page number is read off the corner of the
 * printed mus'haf in both languages.
 *
 * ## What is deliberately NOT here
 *
 * Scripture, licence attribution, and the proper names of editions and tajweed
 * rules. See `lang.ts` for the reasoning and `editions.ts` for where the edition
 * names went; the short version is that translating an attribution string would
 * break `gate:license-copy`, and it should.
 *
 * The long form, and the checklist for adding a language: docs/design/i18n.md.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  LOCALES,
  applyLangToDocument,
  detectLang,
  dirOf,
  rememberLang,
  type Lang,
} from "./lang";
import { EDITION_COPY, type EditionCopy } from "./editions";
import {
  ayahLabel as fmtAyahLabel,
  ayahLabelAt as fmtAyahLabelAt,
  ayahRef as fmtAyahRef,
  rangeLabel as fmtRangeLabel,
  digits,
  digitsIn,
  surahName as fmtSurahName,
  surahNames,
} from "./format";
import type { Catalog } from "./messages/catalog.gen";
import { CATALOGS } from "./messages/catalogs.gen";

export type { EditionCopy };

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
  /** What this language calls itself, in itself — never translated, so it is not
   *  a message. It comes from `LOCALES`, where a new locale has to declare it. */
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
  /**
   * The end of the road, in whichever direction. Both name the page they
   * stopped on (`page-turning.md` §7 ④): "Last available page" alone tells a
   * reader that an arrow did nothing, and leaves them to guess where they are —
   * which, with three pages of 604 vendored, is a guess they will get wrong.
   */
  firstPage(page: number): string;
  lastPage(page: number): string;
  /**
   * Said out loud when a landing is not the one that was asked for: a scrub let
   * go on a page this build does not have, or a *turn* that stepped over one
   * (§7 ④ — the inventory is not the print). It names where you *are*, not
   * where you aimed — a silent landing on a different page is the app lying
   * about what it did, which is the one thing the vendored-corpus gap must
   * never become.
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
   * "صفحة 8 ليست في هذه النسخة" / "Page 8 is not in this build".
   *
   * Until Loop 4b only pages 7, 9 and 19 were vendored and they are not
   * adjacent, so every spread had one of these. All 604 now ship, so no spread
   * in `hafs-kfqc` reaches it; the string stays for the next edition, which will
   * arrive incomplete the way this one did. Latin digits, following `pageN` and
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
/* The assembler                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Bind one locale's catalog into the shape components read.
 *
 * Written once for every language, which is the whole point: the old file said
 * everything twice, so «صفحتان» and "2 pages" were two independent chances to
 * forget a rule. Here the only per-language facts are in the catalog and in
 * `LOCALES`, and the wiring — which formatter, which digits, which argument — is
 * stated once and cannot disagree with itself.
 *
 * The argument convention, in one place because it is easy to get subtly wrong:
 *
 *   - `n` / `count` / `ayahs` … — the raw number, for CLDR to select on. Never
 *     printed; the compiler rejects the `#` that would print it.
 *   - `nText` / `countText` … — `digits(n, lang)`, the thing that appears on
 *     screen and in the aria-label. One numeral authority, `format.ts`.
 *   - a bare number like `page` — printed as-is, i.e. Latin digits in every
 *     language. Only page numbers do this, and deliberately (see `pageN`).
 */
export function buildStrings(lang: Lang, m: Catalog): Strings {
  const locale = LOCALES[lang];
  const n = (value: number) => digits(value, lang);
  // ICU `select` cases are closed sets, so the app's own vocabulary is mapped to
  // them here rather than in every caller. "link" is spelled `other` because ICU
  // requires an `other` case and a second name for the same branch is a branch
  // that can drift.
  const via = (origin: "link" | "jump") =>
    m.arrivedVia({ origin: origin === "jump" ? "jump" : "other" });

  return {
    num: n,
    names: surahNames(lang),
    surahName: (s) => fmtSurahName(s, lang),
    ayahLabel: (k) => fmtAyahLabel(k, lang),
    ayahAt: (s, a) => fmtAyahLabelAt(s, a, lang),
    ayahRef: (k) => fmtAyahRef(k, lang),
    rangeLabel: (a, b) => fmtRangeLabel(a, b, lang),

    langName: locale.name,
    langSectionTitle: m.langSectionTitle,
    langSectionNote: m.langSectionNote,
    langSwitchTo: (other) => m.langSwitchTo({ other }),

    about: m.about,
    pageWord: m.pageWord,
    pageN: (page) => m.pageN({ page }),
    goTo: m.goTo,
    goToLong: m.goToLong,
    mushaf: m.mushaf,
    close: m.close,
    trail: m.trail,

    pageBar: m.pageBar,
    pageChoose: m.pageChoose,
    pageOfTotal: (page, total) => m.pageOfTotal({ page, total }),
    // Not swapped for a left-to-right chrome. "Previous" and "next" here mean
    // earlier and later in the mus'haf, and the mus'haf runs right to left in
    // every UI language — the bar is scripture furniture, so its edges keep the
    // book's direction. That is why this is one message and not two.
    prevPage: m.prevPage,
    nextPage: m.nextPage,
    pagesVendored: (have, total) => m.pagesVendored({ haveText: n(have), totalText: n(total) }),

    firstPage: (page) => m.firstPage({ page }),
    lastPage: (page) => m.lastPage({ page }),
    nearestPageN: (page) => m.nearestPageN({ page }),
    selectionCleared: m.selectionCleared,
    selected: (label) => m.selected({ label }),
    highlighted: (span) => m.highlighted({ span }),
    hoppedTo: (label, page) => m.hoppedTo({ label, page }),
    backTo: (label, page) => m.backTo({ label, page }),
    arrivedVia: via,
    arrivedPage: (origin, page) => m.arrivedPage({ via: via(origin), page }),
    arrivedRange: (origin, ref, page) => m.arrivedRange({ via: via(origin), ref, page }),
    arrivedAyah: (origin, label, page) => m.arrivedAyah({ via: via(origin), label, page }),
    rangeUnavailable: m.rangeUnavailable,
    ayahUnavailable: m.ayahUnavailable,
    noConcordance: m.noConcordance,
    railSummary: (surah, links) => m.railSummary({ surah, linksText: n(links) }),

    ayahAria: (label) => m.ayahAria({ label }),
    stageLoading: m.stageLoading,
    stageFailed: (page) => m.stageFailed({ pageText: n(page) }),

    railGroup: m.railGroup,
    railDirection: {
      loop: m["railDirection.loop"],
      earlier: m["railDirection.earlier"],
      later: m["railDirection.later"],
      root: m["railDirection.root"],
    },
    hopTitle: {
      loop: m["hopTitle.loop"],
      earlier: m["hopTitle.earlier"],
      later: m["hopTitle.later"],
      root: m["hopTitle.root"],
    },
    chipAria: (direction, count) => m.chipAria({ direction, countText: n(count) }),
    hopSheetAria: (title, count) => m.hopSheetAria({ title, count }),
    hopTo: (label) => m.hopTo({ label }),
    twin: m.twin,
    pageUnavailable: m.pageUnavailable,
    wordLevelPending: m.wordLevelPending,
    hereTag: m.hereTag,

    rangeAria: (title, links) => m.rangeAria({ title, links }),
    rangeEmpty: m.rangeEmpty,
    rangeFrom: (refs) => m.rangeFrom({ refs }),
    refJoin: m.refJoin,
    clearSelection: m.clearSelection,

    tapHint: m.tapHint,
    beadBack: (label) => m.beadBack({ label }),
    beadCurrent: (label) => m.beadCurrent({ label }),
    shareTitle: m.shareTitle,
    shareTextTrail: m.shareTextTrail,
    shareTextRange: m.shareTextRange,
    shareTextAyah: m.shareTextAyah,
    shareAriaTrail: m.shareAriaTrail,
    shareAriaRange: m.shareAriaRange,
    shareAriaAyah: m.shareAriaAyah,
    shareLabel: m.shareLabel,
    shareLabelTrail: m.shareLabelTrail,
    shared: m.shared,
    copied: m.copied,
    copyFailed: m.copyFailed,

    coachRegion: m.coachRegion,
    // Numbered rather than an array in the catalog: a translator editing JSON
    // has no way to see that element 2 of an array is the drag card, and a
    // reordered array would silently pair one language's title with another's
    // body. The numbers are the pairing.
    coachSteps: [
      { title: m["coachSteps.1.title"], body: m["coachSteps.1.body"] },
      { title: m["coachSteps.2.title"], body: m["coachSteps.2.body"] },
      { title: m["coachSteps.3.title"], body: m["coachSteps.3.body"] },
    ],
    coachNext: m.coachNext,
    coachDone: m.coachDone,
    coachSkip: m.coachSkip,
    coachDoneAria: m.coachDoneAria,
    coachNextAria: (next, total) => m.coachNextAria({ nextText: n(next), totalText: n(total) }),

    jumpInput: m.jumpInput,
    jumpPlaceholder: m.jumpPlaceholder,
    jumpEmpty: m.jumpEmpty,
    jumpResults: m.jumpResults,
    juzGroup: m.juzGroup,
    juzN: (juz) => m.juzN({ juzText: n(juz) }),
    surahN: (surah) => m.surahN({ surahText: n(surah) }),
    jumpStartsAt: (label) => m.jumpStartsAt({ label }),

    editionCurrent: m.editionCurrent,
    editionNoTable: m.editionNoTable,
    editionNoCounterpart: m.editionNoCounterpart,
    editionMapsTo: (ref) => m.editionMapsTo({ ref }),
    editionFoot: m.editionFoot,
    editionCopy: EDITION_COPY[lang],

    skinGroup: m.skinGroup,
    tajweed: m.tajweed,
    beta: m.beta,
    legendAria: m.legendAria,
    legendTitle: m.legendTitle,
    // Three messages and not one, because the middle third is inside a <strong>.
    // Markup in a translatable string is markup a translator can break.
    legendCaveat: {
      lead: m["legendCaveat.lead"],
      strong: m["legendCaveat.strong"],
      rest: m["legendCaveat.rest"],
    },
    legendNoneOnPage: m.legendNoneOnPage,
    legendCountOnPage: (count, page) =>
      m.legendCountOnPage({ n: count, nText: n(count), pageText: n(page) }),
    legendSelection: m.legendSelection,
    legendNoRules: m.legendNoRules,
    tajweedCredit: m.tajweedCredit,
    // A rule has one name written two ways — «إدغام» and "idgham" — and both
    // ship in both languages. Only the order changes, so this is a property of
    // the locale and never a string to translate.
    ruleName: (label, latin) =>
      locale.rulePrimary === "latin"
        ? { primary: latin, secondary: label }
        : { primary: label, secondary: latin },

    rootsTitle: m.rootsTitle,
    rootsAria: (count) => m.rootsAria({ countText: n(count) }),
    rootsTrigger: (count, curated) =>
      m.rootsTrigger({
        curated: curated > 0 ? "some" : "other",
        countText: n(count),
        curatedText: n(curated),
      }),
    rootsEmpty: m.rootsEmpty,
    rootsPicked: m.rootsPicked,
    rootsPickedNote: m.rootsPickedNote,
    rootsSharedRoot: m.rootsSharedRoot,
    rootsHapax: m.rootsHapax,
    rootsStats: (ayahs, words) =>
      m.rootsStats({ ayahs, words, ayahsText: n(ayahs), wordsText: n(words) }),
    rootsTruncated: (shown) => m.rootsTruncated({ shownText: n(shown) }),
    rootsOccurrences: (count) => m.rootsOccurrences({ count, countText: n(count) }),
    rootsUnavailable: m.rootsUnavailable,
    rootsCredit: m.rootsCredit,
    // Three messages, because they are three different jobs: the zero case is a
    // whole sentence, the count agrees with a number, and "before/after" wraps
    // the result. Composing them here is what lets a language put the direction
    // word first if its grammar wants to — the wrapper is a message, not a
    // template literal in this file.
    distance: (dPage) => {
      if (dPage === 0) return m.distanceSame;
      const away = Math.abs(dPage);
      const pages = m.distancePages({ n: away, nText: n(away) });
      return m.distanceRelative({ dir: dPage > 0 ? "later" : "other", pages });
    },

    notices: {
      capped: { title: m["notices.capped.title"], body: m["notices.capped.body"] },
      "install-ios": {
        title: m["notices.install-ios.title"],
        body: m["notices.install-ios.body"],
      },
      "install-prompt": {
        title: m["notices.install-prompt.title"],
        body: m["notices.install-prompt.body"],
        action: m["notices.install-prompt.action"],
      },
      "best-effort": {
        title: m["notices.best-effort.title"],
        body: m["notices.best-effort.body"],
      },
    },
    dismissNotice: m.dismissNotice,
    dismiss: m.dismiss,

    aboutTitle: m.aboutTitle,
    aboutLede: m.aboutLede,
    aboutCaveat: m.aboutCaveat,
    licenceHead: m.licenceHead,
    licenceBody: m.licenceBody,
    sourceLink: m.sourceLink,
    devBuild: m.devBuild,
    devBuildNote: m.devBuildNote,
    sourcesHead: m.sourcesHead,
    aboutFoot: m.aboutFoot,

    mapTitle: m.mapTitle,
    mapCaveat: m.mapCaveat,
    mapOpen: (page) => m.mapOpen({ page }),
    mapScopeGroup: m.mapScopeGroup,
    scopePage: m.scopePage,
    scopeHizb: m.scopeHizb,
    scopeJuz: m.scopeJuz,
    hizbN: (hizb) => m.hizbN({ hizbText: n(hizb) }),
    // "juz" is spelled `other` for the same reason "link" is above: ICU requires
    // an `other` case, and a fourth case that merely repeats the third is a
    // branch that can drift out of agreement with it.
    mapHeld: (have, total, scope) =>
      m.mapHeld({
        haveText: n(have),
        totalText: n(total),
        scope: scope === "juz" ? "other" : scope,
      }),
    // The day stamp is a string with hyphens in it, not a number, which is why
    // it goes through `digitsIn` rather than `digits` — «٢٠٢٦-٠٧-٣٠» keeps its
    // shape and the separators survive.
    mapSince: (day) => m.mapSince({ dayText: digitsIn(day, lang) }),
    mapGrid: m.mapGrid,
    mapNoStore: m.mapNoStore,
    mapLoading: m.mapLoading,
    mapLegend: m.mapLegend,
    mapAbsent: m.mapAbsent,
    mapNeverOpened: m.mapNeverOpened,
    mapRecent: m.mapRecent,
    mapCellAbsent: (label) => m.mapCellAbsent({ label }),
    mapCellNever: (label) => m.mapCellNever({ label }),
    // Not a plural: "today" and "yesterday" are not categories any CLDR rule
    // produces, they are three different sentences. So the app's own vocabulary
    // is mapped to a closed `select` here — the same move `via` makes above —
    // and only the third case carries a number.
    mapCellSeen: (label, days) =>
      m.mapCellSeen({
        label,
        when: days <= 0 ? "today" : days === 1 ? "yesterday" : "other",
        daysText: n(days),
      }),

    facingPage: m.facingPage,
    facingAbsent: (page) => m.facingAbsent({ page }),
    keyPages: m.keyPages,
    keyJump: m.keyJump,
  };
}

/**
 * Every language's bundle, built once at module load.
 *
 * Eager, not lazy: the constant strings are read out of the catalog here rather
 * than on every render, and there are two of them. `CATALOGS` is generated from
 * the files in `messages/`, so this map gains a language the moment a catalog
 * appears — nothing here is edited to add one.
 */
const BUNDLES: Readonly<Record<Lang, Strings>> = Object.fromEntries(
  Object.entries(CATALOGS).map(([id, catalog]) => [id, buildStrings(id as Lang, catalog)]),
) as Readonly<Record<Lang, Strings>>;

/**
 * Arabic and English by name, for `i18n.test.tsx`, which walks the bundles
 * looking for a string that was never translated. Nothing else imports these —
 * components read the one the provider chose, never a bundle by name.
 */
export const AR: Strings = BUNDLES.ar;
export const EN: Strings = BUNDLES.en;

/** Every language's bundle, for tests and for the language switch. */
export function stringsFor(lang: Lang): Strings {
  return BUNDLES[lang];
}

/** What every component reads: the language, its strings, and the way to move. */
export interface I18n {
  readonly lang: Lang;
  /** The *chrome's* direction. The stage and the diff pin their own. */
  readonly dir: "rtl" | "ltr";
  readonly t: Strings;
  readonly setLang: (lang: Lang) => void;
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
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** The one hook. Named for what it is used for, not for what it holds. */
export function useT(): I18n {
  return useContext(LangContext);
}

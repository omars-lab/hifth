import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ArrowShowing } from "@hifth/core";
import { useT } from "../i18n";
import { PenGuide } from "./PenGuide";
import { LOCALES } from "../lang";
import { LOCALE_IDS } from "../messages/locales.gen";
import { SOURCE_REPO, hasCommit, shortCommit, sourceUrl } from "../provenance";
import { TURN_STYLES, type TurnStyle } from "../turn-style";
import { VERSE_GESTURES, type VerseGestures } from "../verse-gestures";
import { DRAWER_TOOLS, type DrawerTools } from "../drawer-tools";
import { TOOL_HELPS, type ToolHelp } from "../tool-help";
import { SETTINGS_ATS, type SettingsAt } from "../settings-at";
import { APP_PAGES, type AppPages } from "../app-pages";
import { DRAWER_MARKS, type DrawerMarks } from "../drawer-marks";
import { WORD_TAPS, type WordTap } from "../word-tap";
import { RUN_MARKS, type RunMark } from "../run-mark";
import { RUN_FOLLOWS, rememberRunFollow, useRunFollow } from "../run-follow";
import { RUN_AHEADS, rememberRunAhead, useRunAhead } from "../run-ahead";
import { ARROW_SHOWINGS } from "../jump-arrows";
import { CARD_EDGES, rememberCardEdge, useCardEdge } from "../card-edge";
import { OPENING_TEXTS, rememberOpeningText, useOpeningText } from "../opening-text";
import { PITCH } from "../pitch/pitch";
import { LONG_VERSES, rememberLongVerse, useLongVerse } from "../long-verse";
import { CARD_ROOMS, rememberCardRoom, useCardRoom } from "../card-room";
import { LOOKALIKE_COMPARES, rememberLookalikeCompare, useLookalikeCompare } from "../lookalike-compare";
import { PASSAGE_ROWS, rememberPassageRows, usePassageRows } from "../passage-rows";
import { PASSAGE_HOPS, rememberPassageHop, usePassageHop } from "../passage-hop";
import { LOOKALIKE_ARROWS, rememberLookalikeArrows, useLookalikeArrows } from "../lookalike-arrows";
import { TURN_LANDINGS, rememberTurnLanding, useTurnLanding } from "../turn-landing";
import { OPEN_SIZES, rememberOpenSize, useOpenSize } from "../open-size";
import { UPRIGHT_AGAINS, rememberUprightAgain, useUprightAgain } from "../upright-again";
import { RIBBON_LENGTHS, rememberRibbonLength, useRibbonLength } from "../ribbon-length";
import { LOOKALIKE_PREVIEWS, rememberLookalikePreview, useLookalikePreview } from "../lookalike-preview";
import { RELATED_LISTS, rememberRelatedList, useRelatedList } from "../related-list";
import { MARK_TOOLS, type MarkTools } from "../mark-tools";
import { ERASER_PLACES, type EraserPlace } from "../eraser-place";
import { MISTAKE_TAPS, type MistakeTap } from "../mistake-tap";
import { PEN_HOMES, type PenHome } from "../pen-home";
import { TIP_PENS, type TipPens } from "../pen-ring";
import { PEN_SIDES, type PenSide } from "../pen-side";
import { RAIL_HOMES, type RailHome } from "../rail-home";
import { SCOPE_LOOKS, type ScopeLook } from "../scope-look";
import { ZOOM_ACROSSES, rememberZoomAcross, useZoomAcross } from "../zoom-across";
import { ZOOM_ANCHORS, rememberZoomAnchor, useZoomAnchor } from "../zoom-anchor";
import { NOTE_LEAVES, rememberNoteLeave, useNoteLeave } from "../note-leave";
import { UsageReadout } from "./UsageReadout";
import { RecitationShelf } from "./RecitationShelf";
import styles from "./Colophon.module.css";

interface ColophonProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Dismiss the sheet. */
  onClose: () => void;
  /** Whether the page bar spreads under the pointer (the graduated fisheye). */
  fisheye: boolean;
  /** Flip the spread on or off; the choice is remembered on this device. */
  onToggleFisheye: () => void;
  /** How a page turn looks — the reader's pick of three; remembered on this device. */
  turnStyle?: TurnStyle;
  onTurnStyle?: (style: TurnStyle) => void;
  /** What a tap and a hold on a verse do; remembered on this device. */
  verseGestures?: VerseGestures;
  onVerseGestures?: (choice: VerseGestures) => void;
  /** Where a verse's tools open, a card or inside its drawer; remembered on this device. */
  drawerTools?: DrawerTools;
  onDrawerTools?: (choice: DrawerTools) => void;
  /** Whether the line beside the page tools stays, or only each tool's label; remembered on this device. */
  toolHelp?: ToolHelp;
  onToolHelp?: (choice: ToolHelp) => void;
  /** Whether the reading settings sit in the bar or in one drawer; remembered on this device. */
  settingsAt?: SettingsAt;
  onSettingsAt?: (choice: SettingsAt) => void;
  /** Page icons along the bottom (app-pages.md ①). */
  appPages?: AppPages;
  onAppPages?: (choice: AppPages) => void;
  /** Stand as the settings page (app-pages.md ①): the switches fill the screen down to the row of page icons, with no backdrop, and the app's notes about itself stay in the panel. */
  asPage?: boolean;
  /** How a drawer shows what it sits on: a path, or a tag per level; remembered on this device. */
  drawerMarks?: DrawerMarks;
  onDrawerMarks?: (choice: DrawerMarks) => void;
  wordTap?: WordTap;
  onWordTap?: (choice: WordTap) => void;
  /** How the page shows the verse a "Play to" run is reciting; remembered on this device. */
  runMark?: RunMark;
  onRunMark?: (choice: RunMark) => void;
  /** Whether the saved jump arrows stay on the page; remembered on this device. */
  arrowShowing?: ArrowShowing;
  onArrowShowing?: (choice: ArrowShowing) => void;
  /** How a note draws the parts it can be about; remembered on this device. */
  scopeLook?: ScopeLook;
  onScopeLook?: (look: ScopeLook) => void;
  /** Note, Harakat and Word as three buttons or one; remembered on this device. */
  markTools?: MarkTools | undefined;
  onMarkTools?: ((shape: MarkTools) => void) | undefined;
  /** Where the eraser sits on a computer's bar; remembered on this device. */
  eraserPlace?: EraserPlace | undefined;
  onEraserPlace?: ((choice: EraserPlace) => void) | undefined;
  /** What a tap with the Mistake pen does; remembered on this device. */
  mistakeTap?: MistakeTap | undefined;
  onMistakeTap?: ((choice: MistakeTap) => void) | undefined;
  /** Where the page tools sit on a computer or an iPad held sideways; remembered on this device. */
  penHome?: PenHome | undefined;
  onPenHome?: ((home: PenHome) => void) | undefined;
  /** How the pens open at the pencil's tip; left out where there is no pencil. */
  tipPens?: TipPens | undefined;
  onTipPens?: ((choice: TipPens) => void) | undefined;
  /** The layout the page that explains the pencil's pens draws them in (PenGuide.tsx); on every device. */
  pensLayout?: TipPens | undefined;
  /** Where the look-alike chips go when a magnified page leaves no desk; remembered on this device. */
  penSide?: PenSide | undefined;
  onPenSide?: ((side: PenSide) => void) | undefined;
  railHome?: RailHome | undefined;
  onRailHome?: ((home: RailHome) => void) | undefined;
  /** Open the three tips strip. It no longer opens by itself (owner, 2026-09-25). */
  onShowTips?: () => void;
  /** Whether this screen can show two pages side by side. What a card does at the
      facing page's edge only means something then, so a phone is not asked. */
  spread?: boolean;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // Laid out, so the panel's own sections do not count while a page of it
  // (the pens, explained) stands in their place.
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => el.getClientRects().length > 0);
}

interface Credit {
  /** What this source gives the reader, in the reader's terms. */
  readonly what: string;
  /** Who made it — the name the licence asks us to carry. */
  readonly who: string;
  /** The licence, named exactly. */
  readonly licence: string;
  /** Where it lives. Mandatory for the corpus; useful for the rest. */
  readonly href: string;
}

/*
 * Every source Hifth is built on, with the name and licence its terms ask for.
 * Most of them ship bytes; one — the ligature corpus, last row — ships none.
 * What it gave is measurement: a rectangle per word, fitted onto our own pages
 * by `build-words.mjs`. Its licence asks for nothing at all, and it is credited
 * anyway, because a reader tapping a word is touching that corpus's work and a
 * row costs us a line. The other side of that is worth saying too: a courtesy
 * recorded as a courtesy can be changed, and one that has quietly hardened into
 * a supposed condition cannot. SOURCES.md marks which is which.
 *
 * Three of these are conditions, not courtesies:
 *   • the Quranic Arabic Corpus requires its source to be "clearly indicated"
 *     with a link to corpus.quran.com;
 *   • quran-tajweed is CC BY 4.0, whose attribution travels with the work;
 *   • the Tanzil metadata is CC BY, likewise — and it is credited even though
 *     Hifth ships none of its bytes, only numbers copied out of them, because
 *     the numbers are the work.
 * The mutashabihat licence asks for a mention "in your app or any other kind of
 * work" — SOURCES.md has promised this surface since Loop 4a. The full terms,
 * pins and hashes are in SOURCES.md; this is the reader-facing half.
 *
 * These rows are NOT authored here. Each one is declared verbatim in its
 * source's ```colophon fence in SOURCES.md, and `gate:license-copy` fails the
 * build if this array is not exactly that set — same string, same link, no
 * extras. Editing a licence line here alone will not ship; edit the fence and
 * bring this into line with it. The binding exists because these two files once
 * disagreed and only one of them was machine-read: the KFGQPC artwork was
 * credited as non-commercial for several loops, and nothing anywhere went red.
 */
const CREDITS: readonly Credit[] = [
  {
    what: "صفحات المصحف",
    who: "طباعة مجمع الملك فهد (KFGQPC)، عبر quran-svg / quranpedia",
    // Two licences layered, and only one of them constrains anyone: quran-svg's
    // own contribution (the polygon overlay and JSON) is CC0, which asks for
    // nothing; the Complex's terms are what a reader might need to know. Those
    // terms permit digital, web and software use — the reservation is on
    // printing physical masahif for commercial sale, which this app cannot do.
    // Said plainly because the earlier wording here, "non-commercial use only",
    // was the *Libyan Awqaf* edition's term, which Hifth does not vendor: it
    // told every reader the artwork was more restricted than it is.
    licence: "إتاحة حرّة للاستعمال الرقمي · الطبع التجاري محفوظ للمجمع",
    href: "https://github.com/quranpedia/quran-svg",
  },
  {
    what: "المتشابهات",
    who: "Quran Mutashabihat Data · Waqar Ahmed",
    licence: "استعمال حرّ مع ذكر المصدر",
    href: "https://github.com/Waqar144/Quran_Mutashabihat_Data",
  },
  {
    what: "الجذور والصرف",
    who: "Quranic Arabic Corpus · Kais Dukes، جامعة ليدز",
    licence: "GNU GPL",
    href: "http://corpus.quran.com",
  },
  {
    what: "أحكام التجويد",
    who: "quran-tajweed · Collin Fair",
    licence: "CC BY 4.0",
    href: "https://github.com/cpfair/quran-tajweed",
  },
  {
    what: "أقسام المصحف",
    who: "Tanzil Project",
    licence: "CC BY",
    href: "https://tanzil.net",
  },
  {
    what: "مواضع الكلمات",
    who: "Mushaf Database · قاعدة بيانات المصحف",
    licence: "صدقة جارية · إتاحة حرّة",
    href: "https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG",
  },
  {
    what: "التلاوة",
    who: "الشيخ محمد صديق المنشاوي · عبر مكتبة قرآن (quran.com)",
    licence: "إتاحة حرّة للاستماع · بثّ من مكتبة قرآن",
    href: "https://quran.com",
  },
];

/**
 * The colophon — what Hifth is, and the offer the GPL makes on its behalf.
 *
 * This sheet exists because publishing the app *conveys* it: the browser is
 * handed real copies of the JS and of `assets/roots/**`, a GPL-covered
 * derivative of the Quranic Arabic Corpus. §6 then owes the reader the
 * Corresponding Source for the build they are running — which is why the link
 * carries this bundle's commit (see `../provenance`) and not a branch name.
 * A licence notice nobody can reach is not a notice, so it lives one tap from
 * every screen rather than in a README.
 *
 * It is also where the other sources are credited. Two of their licences
 * require it, one asks for it, and the rest are here by choice; all of them are
 * named so a reader can see whose work they are holding without cloning
 * anything.
 *
 * Opened from the wordmark rather than a fifth header button: the chrome
 * already carries ⌖, ▤, the skin switch and its legend, and on a phone
 * one more control would compete with navigation for the thumb. The wordmark
 * was decoration; "about" is the one thing a wordmark is always allowed to be.
 *
 * The language switch lives here for the same arithmetic. `e2e/chrome-fit`
 * holds the header inside 320px with seventeen pixels to spare, and a sixth
 * control does not fit in seventeen pixels. This is also the right *kind* of
 * place: the language is chosen once and then forgotten, like the mus'haf and
 * unlike the skin. It sits at the top of the sheet rather than the bottom
 * because a reader who opened "about" in a language they cannot read needs the
 * switch before they need anything else on this page.
 *
 * A11y: EditionPicker's contract — modal dialog, focus in, Tab trapped, Escape
 * closes, focus restored to the wordmark.
 */
const SCOPE_LOOK_NAME: Record<ScopeLook, (t: ReturnType<typeof useT>["t"]) => string> = {
  side: (t) => t.scopeLookSide,
  lines: (t) => t.scopeLookLines,
  tall: (t) => t.scopeLookTall,
  slim: (t) => t.scopeLookSlim,
  steps: (t) => t.scopeLookSteps,
  trail: (t) => t.scopeLookTrail,
};

const MARK_TOOLS_NAME: Record<MarkTools, (t: ReturnType<typeof useT>["t"]) => string> = {
  three: (t) => t.markToolsThree,
  one: (t) => t.markToolsOne,
};

const ERASER_PLACE_NAME: Record<EraserPlace, (t: ReturnType<typeof useT>["t"]) => string> = {
  tools: (t) => t.eraserPlaceTools,
  undo: (t) => t.eraserPlaceUndo,
};

const MISTAKE_TAP_NAME: Record<MistakeTap, (t: ReturnType<typeof useT>["t"]) => string> = {
  ask: (t) => t.mistakeTapAsk,
  quiet: (t) => t.mistakeTapQuiet,
};

const PEN_HOME_NAME: Record<PenHome, (t: ReturnType<typeof useT>["t"]) => string> = {
  strip: (t) => t.penHomeStrip,
  float: (t) => t.penHomeFloat,
  bottom: (t) => t.penHomeBottom,
  side: (t) => t.penHomeSide,
};

const PEN_SIDE_NAME: Record<PenSide, (t: ReturnType<typeof useT>["t"]) => string> = {
  right: (t) => t.penSideRight,
  left: (t) => t.penSideLeft,
};

const RAIL_HOME_NAME: Record<RailHome, (t: ReturnType<typeof useT>["t"]) => string> = {
  bar: (t) => t.railHomeBar,
  tools: (t) => t.railHomeTools,
};

export function Colophon({
  open,
  onClose,
  fisheye,
  onToggleFisheye,
  turnStyle,
  onTurnStyle,
  verseGestures,
  onVerseGestures,
  drawerTools,
  onDrawerTools,
  toolHelp,
  onToolHelp,
  settingsAt,
  onSettingsAt,
  appPages,
  onAppPages,
  asPage = false,
  drawerMarks,
  onDrawerMarks,
  wordTap,
  onWordTap,
  runMark,
  onRunMark,
  arrowShowing,
  onArrowShowing,
  scopeLook,
  onScopeLook,
  markTools,
  onMarkTools,
  eraserPlace,
  onEraserPlace,
  mistakeTap,
  onMistakeTap,
  penHome,
  onPenHome,
  tipPens,
  onTipPens,
  pensLayout,
  penSide,
  onPenSide,
  railHome,
  onRailHome,
  onShowTips,
  spread = false,
}: ColophonProps): JSX.Element | null {
  const { t, dir, lang, setLang } = useT();
  const cardEdge = useCardEdge();
  const openingText = useOpeningText();
  const relatedList = useRelatedList();
  const longVerse = useLongVerse();
  const cardRoom = useCardRoom();
  const lookalikeCompare = useLookalikeCompare();
  const passageRows = usePassageRows();
  const passageHop = usePassageHop();
  const lookalikeArrows = useLookalikeArrows();
  const turnLanding = useTurnLanding();
  const openSize = useOpenSize();
  const uprightAgain = useUprightAgain();
  const ribbonLength = useRibbonLength();
  const runFollow = useRunFollow();
  const runAhead = useRunAhead();
  const zoomAnchor = useZoomAnchor();
  const zoomAcross = useZoomAcross();
  const noteLeave = useNoteLeave();
  const lookalikePreview = useLookalikePreview();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // The page that explains the pencil's pens stands in the panel's place
  // until Back; the panel is kept under it, so it comes back where it was.
  const [penGuide, setPenGuide] = useState(false);
  const penGuideOpener = useRef<HTMLButtonElement>(null);
  const scrolledTo = useRef(0);
  const openPenGuide = () => {
    scrolledTo.current = sheetRef.current?.scrollTop ?? 0;
    setPenGuide(true);
  };
  const closePenGuide = useCallback(() => setPenGuide(false), []);
  const wasPenGuide = useRef(false);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (sheet && penGuide) sheet.scrollTop = 0;
    if (sheet && !penGuide && wasPenGuide.current) {
      sheet.scrollTop = scrolledTo.current;
      penGuideOpener.current?.focus({ preventScroll: true });
    }
    wasPenGuide.current = penGuide;
  }, [penGuide]);
  // Closed from the pens' page, the panel opens next time as itself.
  useLayoutEffect(() => {
    if (!open) setPenGuide(false);
  }, [open]);

  // Takes the keyboard in the step that draws it, so a key pressed as it appears lands here, not on the page.
  useLayoutEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    restoreRef.current = opener;
    const sheet = sheetRef.current;
    // Opened by a link, nothing was pressed: focus the sheet itself, so a screen
    // reader still lands in it but no ring appears round a button nobody reached for.
    const byLink = !opener || opener === document.body;
    if (sheet) (byLink ? sheet : focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // A page, not a sheet: Tab walks on to the row of page icons under it.
      if (e.key !== "Tab" || asPage) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const el = document.activeElement;
      if (e.shiftKey && el === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && el === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, asPage],
  );

  if (!open) return null;

  return (
    <>
      {!asPage && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={asPage ? t.levelSettings : t.aboutTitle}
        dir={dir}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-page={penGuide ? "pens" : undefined}
        data-as={asPage ? "page" : undefined}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ۞
          </span>
          <h2 className={styles.title}>{asPage ? t.levelSettings : t.aboutTitle}</h2>
          {!asPage && (
            <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
              ✕
            </button>
          )}
        </header>
        {penGuide && pensLayout && (
          <div className={styles.page}>
            <PenGuide layout={pensLayout} marks={markTools ?? "one"} onBack={closePenGuide} />
          </div>
        )}

        {/* One button per language rather than one toggle. A single "switch to
            English" control is unreadable to the half of its audience that
            cannot read the label it is currently wearing, and `aria-pressed` on
            a two-state language control announces "pressed" for a thing that is
            not on or off. A radio group says every option in its own script, at
            once, and marks which one is live — which is also what makes it
            usable by someone who opened the app in the wrong language by
            accident. */}
        <section className={styles.block} aria-labelledby="colophon-lang">
          <h3 className={styles.subhead} id="colophon-lang">
            {t.langSectionTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-lang">
            {/* Driven by the registry, not by two hand-written buttons. Each
                name is written in its own language and marked as such, so a
                screen reader switches voice for the option it is offering
                rather than reading «العربية» through an English synthesiser —
                and each button names *itself* rather than "the other one",
                which is what stops the group from being a toggle wearing a
                radiogroup's clothes. */}
            {LOCALE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={lang === id}
                aria-label={lang === id ? undefined : t.langSwitchTo(LOCALES[id].name)}
                lang={id}
                onClick={() => setLang(id)}
              >
                {LOCALES[id].name}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.langSectionNote}</p>
        </section>

        {/* The page bar's spread-under-the-pointer. A single on/off switch rather
            than the language section's radio group: this is a two-state feature,
            so `aria-pressed` is the right semantics, and the state word beside the
            label carries the same fact for a sighted reader without relying on the
            button's fill alone. It lives with the language switch because both are
            device preferences chosen once and then forgotten — unlike the skin,
            which is opted into each session. */}
        <section className={styles.block} aria-labelledby="colophon-pagebar">
          <h3 className={styles.subhead} id="colophon-pagebar">
            {t.pagebarSectionTitle}
          </h3>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={fisheye}
            onClick={onToggleFisheye}
          >
            <span>{t.pagebarFisheyeLabel}</span>
            <span className={styles.toggleState}>{fisheye ? t.stateOn : t.stateOff}</span>
          </button>
          <p className={styles.note}>{t.pagebarFisheyeNote}</p>
        </section>

        {/* How a turn looks (page-turn-curl, decided 2026-09-26: all three kept,
            the reader picks). Three states, so a radio group like the language
            one, each button naming the style it offers. */}
        {turnStyle && onTurnStyle && (
          <section className={styles.block} aria-labelledby="colophon-turn">
            <h3 className={styles.subhead} id="colophon-turn">
              {t.turnSectionTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-turn">
              {TURN_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={turnStyle === style}
                  data-turn-style={style}
                  onClick={() => onTurnStyle(style)}
                >
                  {style === "seam" ? t.turnStyleSeam : style === "curl" ? t.turnStyleCurl : t.turnStyleLift}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.turnStyleNote}</p>
          </section>
        )}

        {/* What a tap and a hold on a verse do (docs/design/verse-tap-and-hold.md):
            three ways, so a radio group like the page turn's. */}
        {verseGestures && onVerseGestures && (
          <section className={styles.block} aria-labelledby="colophon-gestures">
            <h3 className={styles.subhead} id="colophon-gestures">
              {t.verseGesturesTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-gestures">
              {VERSE_GESTURES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={verseGestures === choice}
                  data-verse-gestures={choice}
                  onClick={() => onVerseGestures(choice)}
                >
                  {choice === "a" ? t.verseGesturesA : choice === "b" ? t.verseGesturesB : t.verseGesturesC}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.verseGesturesNote}</p>
          </section>
        )}

        {/* Where a verse's tools open (selection-drawer ③): both built, the
            card by default until the owner has tried the drawer by hand. */}
        {drawerTools && onDrawerTools && (
          <section className={styles.block} aria-labelledby="colophon-drawer-tools">
            <h3 className={styles.subhead} id="colophon-drawer-tools">
              {t.drawerToolsTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-drawer-tools">
              {DRAWER_TOOLS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={drawerTools === choice}
                  data-drawer-tools={choice}
                  onClick={() => onDrawerTools(choice)}
                >
                  {choice === "sheet" ? t.drawerToolsSheet : t.drawerToolsDrawer}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.drawerToolsNote}</p>
          </section>
        )}

        {/* The help for the page tools (ayah-drawer ①): each tool's label
            always, and the line beside the bar until the owner drops it. */}
        {toolHelp && onToolHelp && (
          <section className={styles.block} aria-labelledby="colophon-tool-help">
            <h3 className={styles.subhead} id="colophon-tool-help">
              {t.toolHelpTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-tool-help">
              {TOOL_HELPS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={toolHelp === choice}
                  data-tool-help={choice}
                  onClick={() => onToolHelp(choice)}
                >
                  {choice === "line" ? t.toolHelpLine : t.toolHelpHover}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.toolHelpNote}</p>
          </section>
        )}
        {/* Where the reading settings sit (ayah-drawer ①): each in the bar, or
            all in one drawer behind a button, until the owner has tried both. */}
        {settingsAt && onSettingsAt && (
          <section className={styles.block} aria-labelledby="colophon-settings-at">
            <h3 className={styles.subhead} id="colophon-settings-at">
              {t.settingsAtTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-settings-at">
              {SETTINGS_ATS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={settingsAt === choice}
                  data-settings-at={choice}
                  onClick={() => onSettingsAt(choice)}
                >
                  {choice === "bar" ? t.settingsAtBar : t.settingsAtDrawer}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.settingsAtNote}</p>
          </section>
        )}

        {/* Page icons along the bottom (app-pages ①): off, or a row that gives
            settings a page of their own, until the owner has tried it. */}
        {appPages && onAppPages && (
          <section className={styles.block} aria-labelledby="colophon-app-pages">
            <h3 className={styles.subhead} id="colophon-app-pages">
              {t.appPagesTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-app-pages">
              {APP_PAGES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={appPages === choice}
                  data-app-pages={choice}
                  onClick={() => onAppPages(choice)}
                >
                  {choice === "off" ? t.stateOff : t.stateOn}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.appPagesNote}</p>
          </section>
        )}

        {/* Which drawer sits on which (ayah-drawer ①): a path in the top one's
            head, or each one's level as a tag, until the owner has tried both. */}
        {drawerMarks && onDrawerMarks && (
          <section className={styles.block} aria-labelledby="colophon-drawer-marks">
            <h3 className={styles.subhead} id="colophon-drawer-marks">
              {t.drawerMarksTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-drawer-marks">
              {DRAWER_MARKS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={drawerMarks === choice}
                  onClick={() => onDrawerMarks(choice)}
                >
                  {choice === "path" ? t.drawerMarksPath : t.drawerMarksTag}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.drawerMarksNote}</p>
          </section>
        )}

        {/* What a second tap on the lit verse does (selection-drawer ①): both
            built, putting it out by default until the owner has tried the other. */}
        {wordTap && onWordTap && (
          <section className={styles.block} aria-labelledby="colophon-word-tap">
            <h3 className={styles.subhead} id="colophon-word-tap">
              {t.wordTapTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-word-tap">
              {WORD_TAPS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={wordTap === choice}
                  data-word-tap={choice}
                  onClick={() => onWordTap(choice)}
                >
                  {choice === "off" ? t.wordTapOff : t.wordTapWord}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.wordTapNote}</p>
          </section>
        )}

        {/* How the page shows the verse a "Play to" run is reciting
            (docs/PLAN.md, item 57): built two ways, the moving light first. */}
        {runMark && onRunMark && (
          <section className={styles.block} aria-labelledby="colophon-run-mark">
            <h3 className={styles.subhead} id="colophon-run-mark">
              {t.runMarkTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-run-mark">
              {RUN_MARKS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={runMark === choice}
                  data-run-mark={choice}
                  onClick={() => onRunMark(choice)}
                >
                  {choice === "light" ? t.runMarkLight : t.runMarkRing}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.runMarkNote}</p>
          </section>
        )}

        {/* What the page does when the reader turns away from a run while it
            plays (docs/PLAN.md, item 59): staying is the default; going back stays. */}
        <section className={styles.block} aria-labelledby="colophon-run-follow">
          <h3 className={styles.subhead} id="colophon-run-follow">
            {t.runFollowTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-run-follow">
            {RUN_FOLLOWS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={runFollow === choice}
                data-run-follow={choice}
                onClick={() => rememberRunFollow(choice)}
              >
                {choice === "stay" ? t.runFollowStay : t.runFollowBack}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.runFollowNote}</p>
        </section>

        {/* Where the zoom buttons grow the page from (docs/PLAN.md, item 66):
            the chosen verse is the default; the middle, as it was, stays. */}
        <section className={styles.block} aria-labelledby="colophon-zoom-anchor">
          <h3 className={styles.subhead} id="colophon-zoom-anchor">
            {t.zoomAnchorTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-zoom-anchor">
            {ZOOM_ANCHORS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={zoomAnchor === choice}
                data-zoom-anchor={choice}
                onClick={() => rememberZoomAnchor(choice)}
              >
                {choice === "verse" ? t.zoomAnchorVerse : t.zoomAnchorMiddle}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.zoomAnchorNote}</p>
        </section>

        {/* What zooming in keeps on the screen (docs/PLAN.md, item 100): the
            starts of the lines are the default; growing from the fold stays. */}
        <section className={styles.block} aria-labelledby="colophon-zoom-across">
          <h3 className={styles.subhead} id="colophon-zoom-across">
            {t.zoomAcrossTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-zoom-across">
            {ZOOM_ACROSSES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={zoomAcross === choice}
                data-zoom-across={choice}
                onClick={() => rememberZoomAcross(choice)}
              >
                {choice === "starts" ? t.zoomAcrossStarts : t.zoomAcrossFold}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.zoomAcrossNote}</p>
        </section>

        {/* How a note across the page's foot leaves (docs/PLAN.md, item 72):
            sliding away as the page comes down is the default; at once stays. */}
        <section className={styles.block} aria-labelledby="colophon-note-leave">
          <h3 className={styles.subhead} id="colophon-note-leave">
            {t.noteLeaveTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-note-leave">
            {NOTE_LEAVES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={noteLeave === choice}
                data-note-leave={choice}
                onClick={() => rememberNoteLeave(choice)}
              >
                {choice === "slide" ? t.noteLeaveSlide : t.noteLeaveAtOnce}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.noteLeaveNote}</p>
        </section>

        {/* How a run makes its next verse ready while one sounds (docs/PLAN.md,
            item 63): holding it in hand is the default; asking early and off stay. */}
        <section className={styles.block} aria-labelledby="colophon-run-ahead">
          <h3 className={styles.subhead} id="colophon-run-ahead">
            {t.runAheadTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-run-ahead">
            {RUN_AHEADS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={runAhead === choice}
                data-run-ahead={choice}
                onClick={() => rememberRunAhead(choice)}
              >
                {choice === "hold" ? t.runAheadHold : choice === "ask" ? t.runAheadAsk : t.runAheadOff}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.runAheadNote}</p>
        </section>

        {/* The surahs whose recitation is kept on this device (docs/PLAN.md,
            item 101), beside the setting for how the next verses are fetched. */}
        <RecitationShelf />

        {/* How the saved jump arrows show (docs/design/jump-arrows-options.md):
            the owner chose staying, and kept the other way as a choice. */}
        {arrowShowing && onArrowShowing && (
          <section className={styles.block} aria-labelledby="colophon-jump-arrows">
            <h3 className={styles.subhead} id="colophon-jump-arrows">
              {t.jumpArrowsTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-jump-arrows">
              {ARROW_SHOWINGS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={arrowShowing === choice}
                  data-jump-arrows={choice}
                  onClick={() => onArrowShowing(choice)}
                >
                  {choice === "stays" ? t.jumpArrowsStays : t.jumpArrowsAsked}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.jumpArrowsNote}</p>
          </section>
        )}

        {/* What a card over the facing page does at the page's outer edge
            (docs/design/knowledge-graph-commentary.md, item 26): the owner chose
            grabbing through on 2026-10-23, and the other two stay choosable. Only where two pages
            can face each other: on a phone there is no facing page to cover. */}
        {spread && (
        <section className={styles.block} aria-labelledby="colophon-card-edge">
          <h3 className={styles.subhead} id="colophon-card-edge">
            {t.cardEdgeTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-card-edge">
            {CARD_EDGES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={cardEdge === choice}
                data-card-edge={choice}
                onClick={() => rememberCardEdge(choice)}
              >
                {choice === "covers" ? t.cardEdgeCovers : choice === "clear" ? t.cardEdgeClear : t.cardEdgeTurns}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.cardEdgeNote}</p>
        </section>
        )}

        {/* How the two opening pages fill their paper (knowledge-graph-commentary.md,
            item 36): the owner's pick is the default, the other kept as a choice. */}
        <section className={styles.block} aria-labelledby="colophon-opening-text">
          <h3 className={styles.subhead} id="colophon-opening-text">
            {t.openingTextTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-opening-text">
            {OPENING_TEXTS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={openingText === choice}
                data-opening-text={choice}
                onClick={() => rememberOpeningText(choice)}
              >
                {choice === "large" ? t.openingTextLarge : t.openingTextEven}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.openingTextNote}</p>
        </section>

        {/* How many related verses a note lists before the reader asks
            (knowledge-graph-commentary.md, item 41): the line is the default,
            the whole list kept as a choice. Only the private build has notes. */}
        {PITCH && (
          <section className={styles.block} aria-labelledby="colophon-related-list">
            <h3 className={styles.subhead} id="colophon-related-list">
              {t.relatedListTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-related-list">
              {RELATED_LISTS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={relatedList === choice}
                  data-related-list={choice}
                  onClick={() => rememberRelatedList(choice)}
                >
                  {choice === "line" ? t.relatedListLine : t.relatedListAll}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.relatedListNote}</p>
          </section>
        )}

        {/* How a verse a little taller than the room above its note is shown
            whole (knowledge-graph-commentary.md, items 42 and 43): the page a
            little smaller is the default, the note a little shorter kept as a
            choice. Only the private build has notes. */}
        {PITCH && (
          <section className={styles.block} aria-labelledby="colophon-long-verse">
            <h3 className={styles.subhead} id="colophon-long-verse">
              {t.longVerseTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-long-verse">
              {LONG_VERSES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={longVerse === choice}
                  data-long-verse={choice}
                  onClick={() => rememberLongVerse(choice)}
                >
                  {choice === "smaller" ? t.longVerseSmaller : t.longVerseShorter}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.longVerseNote}</p>
          </section>
        )}

        {/* How a look-alike whose shared words come more than once is compared
            (knowledge-graph-commentary.md, item 49): every shared stretch
            marked is the default, the two side by side unmarked kept as a
            choice. */}
        <section className={styles.block} aria-labelledby="colophon-lookalike-compare">
          <h3 className={styles.subhead} id="colophon-lookalike-compare">
            {t.lookalikeCompareTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-lookalike-compare">
            {LOOKALIKE_COMPARES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={lookalikeCompare === choice}
                data-lookalike-compare={choice}
                onClick={() => rememberLookalikeCompare(choice)}
              >
                {choice === "every" ? t.lookalikeCompareEvery : t.lookalikeComparePlain}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.lookalikeCompareNote}</p>
        </section>

        {/* What a look-alike list does with a passage row when a verse inside
            it is listed too (knowledge-graph-commentary.md, item 47): all three
            ways built; the owner picked the verse under its passage, 2026-10-12. */}
        <section className={styles.block} aria-labelledby="colophon-passage-rows">
          <h3 className={styles.subhead} id="colophon-passage-rows">
            {t.passageRowsTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-passage-rows">
            {PASSAGE_ROWS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={passageRows === choice}
                data-passage-rows={choice}
                onClick={() => rememberPassageRows(choice)}
              >
                {choice === "both"
                  ? t.passageRowsBoth
                  : choice === "group"
                    ? t.passageRowsGroup
                    : t.passageRowsDrop}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.passageRowsNote}</p>
        </section>

        {/* Where a passage row's arrow lands (lookalike-rows.md, item 17): the
            owner picked the most-alike verse, 2026-10-12; the first verse stays. */}
        <section className={styles.block} aria-labelledby="colophon-passage-hop">
          <h3 className={styles.subhead} id="colophon-passage-hop">
            {t.passageHopTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-passage-hop">
            {PASSAGE_HOPS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={passageHop === choice}
                data-passage-hop={choice}
                onClick={() => rememberPassageHop(choice)}
              >
                {choice === "alike" ? t.passageHopAlike : t.passageHopFirst}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.passageHopNote}</p>
        </section>

        {/* Which way the look-alike signs' arrows point (knowledge-graph-commentary.md,
            item 8): the owner picked the book's way, 2026-10-12; the old way stays. */}
        <section className={styles.block} aria-labelledby="colophon-lookalike-arrows">
          <h3 className={styles.subhead} id="colophon-lookalike-arrows">
            {t.lookalikeArrowsTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-lookalike-arrows">
            {LOOKALIKE_ARROWS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={lookalikeArrows === choice}
                data-lookalike-arrows={choice}
                onClick={() => rememberLookalikeArrows(choice)}
              >
                {choice === "book" ? t.lookalikeArrowsBook : t.lookalikeArrowsReading}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.lookalikeArrowsNote}</p>
        </section>

        {/* Where a turn lands when the page opened bigger than the screen
            (docs/PLAN.md, item 97): the owner picked the top, 2026-10-13; the old way stays. */}
        <section className={styles.block} aria-labelledby="colophon-turn-landing">
          <h3 className={styles.subhead} id="colophon-turn-landing">
            {t.turnLandingTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-turn-landing">
            {TURN_LANDINGS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={turnLanding === choice}
                data-turn-landing={choice}
                onClick={() => rememberTurnLanding(choice)}
              >
                {choice === "top" ? t.turnLandingTop : t.turnLandingSame}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.turnLandingNote}</p>
        </section>

        {/* How big a verse's page opens on an upright screen (docs/PLAN.md, item 98):
            a little closer is the default; the whole page is the other way. */}
        <section className={styles.block} aria-labelledby="colophon-open-size">
          <h3 className={styles.subhead} id="colophon-open-size">
            {t.openSizeTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-open-size">
            {OPEN_SIZES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={openSize === choice}
                data-open-size={choice}
                onClick={() => rememberOpenSize(choice)}
              >
                {choice === "closer" ? t.openSizeCloser : t.openSizeWhole}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.openSizeNote}</p>
        </section>

        {/* How big the page is when the iPad comes back upright (docs/PLAN.md,
            item 99): the size it opened at is the default; whole is the other way. */}
        <section className={styles.block} aria-labelledby="colophon-upright-again">
          <h3 className={styles.subhead} id="colophon-upright-again">
            {t.uprightAgainTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-upright-again">
            {UPRIGHT_AGAINS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={uprightAgain === choice}
                data-upright-again={choice}
                onClick={() => rememberUprightAgain(choice)}
              >
                {choice === "opening" ? t.uprightAgainOpening : t.uprightAgainWhole}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.uprightAgainNote}</p>
        </section>

        {/* How long a bookmark's ribbon hangs (docs/PLAN.md, item 49): short,
            above the first line, is the default; the long one stays. */}
        <section className={styles.block} aria-labelledby="colophon-ribbon-length">
          <h3 className={styles.subhead} id="colophon-ribbon-length">
            {t.ribbonLengthTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-ribbon-length">
            {RIBBON_LENGTHS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={ribbonLength === choice}
                data-ribbon-length={choice}
                onClick={() => rememberRibbonLength(choice)}
              >
                {choice === "short" ? t.ribbonLengthShort : t.ribbonLengthLong}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.ribbonLengthNote}</p>
        </section>

        {/* What a closed look-alike row shows of the words the pair shares
            (docs/design/lookalike-rows.md, item 6): every way built, the picture
            the default. */}
        <section className={styles.block} aria-labelledby="colophon-lookalike-preview">
          <h3 className={styles.subhead} id="colophon-lookalike-preview">
            {t.lookalikePreviewTitle}
          </h3>
          <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-lookalike-preview">
            {LOOKALIKE_PREVIEWS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={styles.lang}
                aria-checked={lookalikePreview === choice}
                data-lookalike-preview={choice}
                onClick={() => rememberLookalikePreview(choice)}
              >
                {choice === "picture"
                  ? t.lookalikePreviewPicture
                  : choice === "count"
                    ? t.lookalikePreviewCount
                    : t.lookalikePreviewNone}
              </button>
            ))}
          </div>
          <p className={styles.note}>{t.lookalikePreviewNote}</p>
        </section>

        {/* How a note draws the parts it can be about (docs/design/scoped-notes.md,
            step 7): every look kept while they are tried, so a radio group too. */}
        {scopeLook && onScopeLook && (
          <section className={styles.block} aria-labelledby="colophon-scope-look">
            <h3 className={styles.subhead} id="colophon-scope-look">
              {t.scopeLookTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-scope-look">
              {SCOPE_LOOKS.map((look) => (
                <button
                  key={look}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={scopeLook === look}
                  data-scope-look={look}
                  onClick={() => onScopeLook(look)}
                >
                  {SCOPE_LOOK_NAME[look](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.scopeLookNote}</p>
          </section>
        )}
        {/* Note, Harakat and Word as three buttons or one (docs/design/notes-
            style-toolbar.md, ②): the one button built as a setting, three kept
            as the default (owner, 2026-10-12). Every layout has a tools bar. */}
        {markTools && onMarkTools && (
          <section className={styles.block} aria-labelledby="colophon-mark-tools">
            <h3 className={styles.subhead} id="colophon-mark-tools">
              {t.markToolsTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-mark-tools">
              {MARK_TOOLS.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={markTools === shape}
                  data-mark-tools-choice={shape}
                  onClick={() => onMarkTools(shape)}
                >
                  {MARK_TOOLS_NAME[shape](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.markToolsNote}</p>
          </section>
        )}
        {/* Where the eraser sits on a computer: last of the tools, the default
            since the owner's page comment of 2026-11-07, or beside Undo, where
            it was first built. A phone keeps it beside Undo. */}
        {eraserPlace && onEraserPlace && (
          <section className={styles.block} aria-labelledby="colophon-eraser-place">
            <h3 className={styles.subhead} id="colophon-eraser-place">
              {t.eraserPlaceTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-eraser-place">
              {ERASER_PLACES.map((place) => (
                <button
                  key={place}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={eraserPlace === place}
                  data-eraser-place-choice={place}
                  onClick={() => onEraserPlace(place)}
                >
                  {ERASER_PLACE_NAME[place](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.eraserPlaceNote}</p>
          </section>
        )}
        {/* What a tap with the Mistake pen does (docs/PLAN.md, item 103): ask
            what went wrong is the default the owner chose on 2026-10-13; the
            first way, mark at once, is kept as the other choice. */}
        {mistakeTap && onMistakeTap && (
          <section className={styles.block} aria-labelledby="colophon-mistake-tap">
            <h3 className={styles.subhead} id="colophon-mistake-tap">
              {t.mistakeTapTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-mistake-tap">
              {MISTAKE_TAPS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={mistakeTap === choice}
                  data-mistake-tap-choice={choice}
                  onClick={() => onMistakeTap(choice)}
                >
                  {MISTAKE_TAP_NAME[choice](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.mistakeTapNote}</p>
          </section>
        )}
        {/* Where the page tools sit (docs/design/notes-style-toolbar.md, ①): all
            three homes the study drew, kept while they are tried (owner,
            2026-10-05). Only on the layout that has the tools bar. */}
        {penHome && onPenHome && (
          <section className={styles.block} aria-labelledby="colophon-pen-home">
            <h3 className={styles.subhead} id="colophon-pen-home">
              {t.penHomeTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-pen-home">
              {PEN_HOMES.map((home) => (
                <button
                  key={home}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={penHome === home}
                  data-pen-home-choice={home}
                  onClick={() => onPenHome(home)}
                >
                  {PEN_HOME_NAME[home](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.penHomeNote}</p>
          </section>
        )}
        {/* How the pens open at the Apple Pencil's tip (pen-ring.ts): rings
            round it, or the row first built, kept as the other way. Only in
            the iPad app, the one place with a pencil to squeeze. */}
        {tipPens && onTipPens && (
          <section className={styles.block} aria-labelledby="colophon-tip-pens">
            <h3 className={styles.subhead} id="colophon-tip-pens">
              {t.tipPensTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-tip-pens">
              {TIP_PENS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={tipPens === choice}
                  data-tip-pens-choice={choice}
                  onClick={() => onTipPens(choice)}
                >
                  {choice === "rings" ? t.tipPensRings : t.tipPensRow}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.tipPensNote}</p>
          </section>
        )}
        {/* The pens the pencil opens, to try, each with its line (PenGuide.tsx).
            On every device: a reader without a pencil can still see what the
            pens are before buying one, and the tools are the same everywhere. */}
        {pensLayout && (
          <section className={styles.block} aria-labelledby="colophon-pen-guide">
            <h3 className={styles.subhead} id="colophon-pen-guide">
              {t.penGuideSection}
            </h3>
            <button ref={penGuideOpener} type="button" className={styles.toggle} onClick={openPenGuide} data-pen-guide-open="">
              <span>{t.penGuideOpen}</span>
            </button>
            <p className={styles.note}>{t.penGuideNote}</p>
          </section>
        )}
        {/* Which side the pens down the side and the Mark up button stand on
            (docs/PLAN.md, 95): the right by default, the left mirrored, the
            owner's pick of 2026-10-12. Only on the layout that has them. */}
        {penSide && onPenSide && (
          <section className={styles.block} aria-labelledby="colophon-pen-side">
            <h3 className={styles.subhead} id="colophon-pen-side">
              {t.penSideTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-pen-side">
              {PEN_SIDES.map((side) => (
                <button
                  key={side}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={penSide === side}
                  data-pen-side-choice={side}
                  onClick={() => onPenSide(side)}
                >
                  {PEN_SIDE_NAME[side](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.penSideNote}</p>
          </section>
        )}
        {/* Where the look-alike chips go when a magnified page leaves no desk
            beside it (docs/design/lookalike-rows.md, ⑧): both homes built,
            the bottom row by default. Only on the layout with a desk. */}
        {railHome && onRailHome && (
          <section className={styles.block} aria-labelledby="colophon-rail-home">
            <h3 className={styles.subhead} id="colophon-rail-home">
              {t.railHomeTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-rail-home">
              {RAIL_HOMES.map((home) => (
                <button
                  key={home}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={railHome === home}
                  data-rail-home-choice={home}
                  onClick={() => onRailHome(home)}
                >
                  {RAIL_HOME_NAME[home](t)}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.railHomeNote}</p>
          </section>
        )}
        {/* Where one page goes when a card opens beside it, the roots list or
            the share card (docs/design/lookalike-rows.md, ⑩ and ⑪): into the
            room the card leaves by default, or kept in the window's middle
            and drawn smaller. Only on the layout with a desk. */}
        {railHome && onRailHome && (
          <section className={styles.block} aria-labelledby="colophon-card-room">
            <h3 className={styles.subhead} id="colophon-card-room">
              {t.cardRoomTitle}
            </h3>
            <div className={styles.langRow} role="radiogroup" aria-labelledby="colophon-card-room">
              {CARD_ROOMS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  className={styles.lang}
                  aria-checked={cardRoom === choice}
                  data-card-room={choice}
                  onClick={() => rememberCardRoom(choice)}
                >
                  {choice === "aside" ? t.cardRoomAside : t.cardRoomSmaller}
                </button>
              ))}
            </div>
            <p className={styles.note}>{t.cardRoomNote}</p>
          </section>
        )}

        {/* The tips used to open on a device's first visit, above the page. The
            owner asked on 2026-09-25 that they wait to be asked for, so this is
            now the only way they appear. */}
        {onShowTips && (
          <section className={styles.block} aria-labelledby="colophon-tips">
            <h3 className={styles.subhead} id="colophon-tips">
              {t.tipsSectionTitle}
            </h3>
            <button type="button" className={styles.toggle} onClick={onShowTips}>
              <span>{t.tipsShow}</span>
            </button>
            <p className={styles.note}>{t.tipsNote}</p>
          </section>
        )}

        {/* The owner's own count of what gets used, kept on this device only
            (docs/design/feature-usage.md). */}
        <UsageReadout />

        {!asPage && (
          <>
        <p className={styles.lede}>{t.aboutLede}</p>
        <p className={styles.caveat}>{t.aboutCaveat}</p>

        <section className={styles.block}>
          <h3 className={styles.subhead}>{t.licenceHead}</h3>
          <p className={styles.body}>{t.licenceBody}</p>
          {/* The §6 offer itself. `rel` is belt-and-braces on a link that opens
              a code host: noopener/noreferrer cost nothing and the target is
              outside our control. */}
          <a
            className={styles.source}
            href={sourceUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.sourceLabel}>{t.sourceLink}</span>
            <span className={`${styles.commit} numeric`}>
              {hasCommit() ? shortCommit() : t.devBuild}
            </span>
          </a>
          {!hasCommit() && (
            /* A dev server corresponds to a working tree, which is not a thing
               anyone can be handed. Say that, rather than link to a commit that
               does not exist — the link above falls back to the repository. */
            <p className={styles.note}>{t.devBuildNote}</p>
          )}
          {/* Every page this project drew to decide something, served from this
              site so a reader can see the reasoning and not only the result —
              the CLAUDE.md tenet that a design is public or it is not published.
              Relative on purpose: the build stages docs/ beside the app
              (scripts/stage-docs.mjs), whichever host serves it. */}
          <a
            className={styles.source}
            href="./docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.sourceLabel}>{t.designsLink}</span>
          </a>
        </section>

        <section className={styles.block}>
          <h3 className={styles.subhead}>{t.sourcesHead}</h3>
          <ul className={styles.list}>
            {/* The rows stay Arabic in both languages, and pinned RTL with it.
                They are not copy: `gate:license-copy` binds every one of them
                byte-for-byte to a ```colophon fence in SOURCES.md, and an
                attribution that says something different depending on who is
                reading is an attribution nobody has actually made. So the row
                declares the language it is written in and lets the browser
                bidi-render the Latin names inside it, exactly as before. */}
            {CREDITS.map((credit) => (
              <li key={credit.href} className={styles.row} lang="ar" dir="rtl">
                <span className={styles.what}>{credit.what}</span>
                <a
                  className={styles.who}
                  href={credit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {credit.who}
                </a>
                <span className={styles.licence}>{credit.licence}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.foot}>
          {t.aboutFoot}{" "}
          <a className={styles.inline} href={SOURCE_REPO} target="_blank" rel="noopener noreferrer">
            {SOURCE_REPO.replace("https://", "")}
          </a>
        </p>
          </>
        )}
      </div>
    </>
  );
}

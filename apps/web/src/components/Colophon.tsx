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
import { DRAWER_GLOWS, type DrawerGlow } from "../drawer-glow";
import { BEATEN_OFFERS, type BeatenOffer } from "../beaten-offer";
import { FULL_SCREEN_TOOLS, type FullScreenTools } from "../full-screen-tools";
import { TOUCH_FULL_TOOLS, type TouchFullTools } from "../touch-full-tools";
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
import { LEFT_OFF_LOOKS, rememberLeftOffLook, useLeftOffLook } from "../left-off-look";
import { BOOKMARK_HANDS, rememberBookmarkHand, useBookmarkHand } from "../bookmark-hand";
import { LOOKALIKE_PREVIEWS, rememberLookalikePreview, useLookalikePreview } from "../lookalike-preview";
import { RELATED_LISTS, rememberRelatedList, useRelatedList } from "../related-list";
import { MARK_TOOLS, type MarkTools } from "../mark-tools";
import { ERASER_PLACES, type EraserPlace } from "../eraser-place";
import { MISTAKE_TAPS, type MistakeTap } from "../mistake-tap";
import { MISTAKE_ASKS, type MistakeAsk } from "../mistake-ask";
import { CALENDAR_LOOKS, type CalendarLook } from "../calendar-look";
import { SHARE_LOOKS, type ShareLook } from "../share-look";
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
  /** When a jump not made in a long while offers Beaten; remembered on this device. */
  beatenOffer?: BeatenOffer;
  onBeatenOffer?: (choice: BeatenOffer) => void;
  drawerGlow?: DrawerGlow;
  onDrawerGlow?: (choice: DrawerGlow) => void;
  fullScreenTools?: FullScreenTools | undefined;
  onFullScreenTools?: (choice: FullScreenTools) => void;
  /** The same on a phone or an upright iPad (touch-full-tools.ts); remembered on this device. */
  touchFullTools?: TouchFullTools | undefined;
  onTouchFullTools?: (choice: TouchFullTools) => void;
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
  /** How the Mistake pen's question is laid out; remembered on this device. */
  mistakeAsk?: MistakeAsk | undefined;
  onMistakeAsk?: ((choice: MistakeAsk) => void) | undefined;
  /** How the record's month draws each day; remembered on this device. */
  calendarLook?: CalendarLook | undefined;
  shareLook?: ShareLook | undefined;
  onShareLook?: ((choice: ShareLook) => void) | undefined;
  onCalendarLook?: ((choice: CalendarLook) => void) | undefined;
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

/** One setting the reader picks from: a heading, a row of radio buttons, a note.
    Each button carries `data-<data>` set to its choice, which the tests find it by.
    Written once on 2026-11-12, when the same block had been copied 35 times. */
function Choice<C extends string>({
  id,
  title,
  note,
  value,
  options,
  label,
  data,
  onPick,
}: {
  id: string;
  title: string;
  note: string;
  value: C;
  options: readonly C[];
  label: (choice: C) => string;
  data: string;
  onPick: (choice: C) => void;
}) {
  const head = `colophon-${id}`;
  return (
    <section className={styles.block} aria-labelledby={head}>
      <h3 className={styles.subhead} id={head}>
        {title}
      </h3>
      <div className={styles.langRow} role="radiogroup" aria-labelledby={head}>
        {options.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            className={styles.lang}
            aria-checked={value === choice}
            {...{ [`data-${data}`]: choice }}
            onClick={() => onPick(choice)}
          >
            {label(choice)}
          </button>
        ))}
      </div>
      <p className={styles.note}>{note}</p>
    </section>
  );
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

const CALENDAR_LOOK_NAME: Record<CalendarLook, (t: ReturnType<typeof useT>["t"]) => string> = {
  shades: (t) => t.calendarLookShades,
  rings: (t) => t.calendarLookRings,
  cards: (t) => t.calendarLookCards,
  dots: (t) => t.calendarLookDots,
};
const SHARE_LOOK_NAME: Record<ShareLook, (t: ReturnType<typeof useT>["t"]) => string> = {
  preview: (t) => t.shareLookPreview,
  tiles: (t) => t.shareLookTiles,
  plain: (t) => t.shareLookPlain,
};

const MISTAKE_ASK_NAME: Record<MistakeAsk, (t: ReturnType<typeof useT>["t"]) => string> = {
  steps: (t) => t.mistakeAskSteps,
  tabs: (t) => t.mistakeAskTabs,
  list: (t) => t.mistakeAskList,
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
  beatenOffer,
  onBeatenOffer,
  drawerGlow,
  onDrawerGlow,
  fullScreenTools,
  onFullScreenTools,
  touchFullTools,
  onTouchFullTools,
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
  mistakeAsk,
  onMistakeAsk,
  calendarLook,
  shareLook,
  onShareLook,
  onCalendarLook,
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
  const leftOffLook = useLeftOffLook();
  const bookmarkHand = useBookmarkHand();
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
        // The panel's name in a link (`?open=`), for the features-page check;
        // the settings page drawn from the same sheet is not that panel.
        data-panel={asPage ? undefined : "about"}
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
          <Choice id="turn" title={t.turnSectionTitle} note={t.turnStyleNote} value={turnStyle} options={TURN_STYLES} label={(style) => style === "seam" ? t.turnStyleSeam : style === "curl" ? t.turnStyleCurl : t.turnStyleLift} data="turn-style" onPick={onTurnStyle} />
        )}

        {/* What a tap and a hold on a verse do (docs/design/verse-tap-and-hold.md):
            three ways, so a radio group like the page turn's. */}
        {verseGestures && onVerseGestures && (
          <Choice id="gestures" title={t.verseGesturesTitle} note={t.verseGesturesNote} value={verseGestures} options={VERSE_GESTURES} label={(choice) => choice === "a" ? t.verseGesturesA : choice === "b" ? t.verseGesturesB : t.verseGesturesC} data="verse-gestures" onPick={onVerseGestures} />
        )}

        {/* Where a verse's tools open (selection-drawer ③): both built, the
            card by default until the owner has tried the drawer by hand. */}
        {drawerTools && onDrawerTools && (
          <Choice id="drawer-tools" title={t.drawerToolsTitle} note={t.drawerToolsNote} value={drawerTools} options={DRAWER_TOOLS} label={(choice) => choice === "sheet" ? t.drawerToolsSheet : t.drawerToolsDrawer} data="drawer-tools" onPick={onDrawerTools} />
        )}

        {/* When a jump not made in a long while offers Beaten (confusion-points
            ⑤): after six weeks by default, three months, or never. */}
        {beatenOffer && onBeatenOffer && (
          <Choice id="beaten-offer" title={t.beatenOfferTitle} note={t.beatenOfferNote} value={beatenOffer} options={BEATEN_OFFERS} label={(choice) => choice === "six-weeks" ? t.beatenOfferSixWeeks : choice === "three-months" ? t.beatenOfferThreeMonths : t.beatenOfferNever} data="beaten-offer" onPick={onBeatenOffer} />
        )}

        {/* What the lit verse does while the pointer rests on its drawer
            (selection-drawer ②): three built, the deeper colour by default. */}
        {drawerGlow && onDrawerGlow && (
          <Choice id="drawer-glow" title={t.drawerGlowTitle} note={t.drawerGlowNote} value={drawerGlow} options={DRAWER_GLOWS} label={(choice) => choice === "brighten" ? t.drawerGlowBrighten : choice === "ring" ? t.drawerGlowRing : t.drawerGlowNone} data="drawer-glow" onPick={onDrawerGlow} />
        )}

        {/* Where the tools go in full screen (verse-tap-and-hold ①, the
            notes-style toolbar's ⑤): four built, down the side by default. */}
        {touchFullTools && onTouchFullTools && (
          <Choice id="touch-full-tools" title={t.fullScreenToolsTitle} note={t.touchFullToolsNote} value={touchFullTools} options={TOUCH_FULL_TOOLS} label={(choice) => choice === "button" ? t.touchFullToolsButton : choice === "row" ? t.touchFullToolsRow : t.fullScreenToolsNone} data="touch-full-tools" onPick={onTouchFullTools} />
        )}
        {fullScreenTools && onFullScreenTools && (
          <Choice id="full-screen-tools" title={t.fullScreenToolsTitle} note={t.fullScreenToolsNote} value={fullScreenTools} options={FULL_SCREEN_TOOLS} label={(choice) => choice === "side" ? t.fullScreenToolsSide : choice === "edge" ? t.fullScreenToolsEdge : choice === "dock" ? t.fullScreenToolsDock : t.fullScreenToolsNone} data="full-screen-tools" onPick={onFullScreenTools} />
        )}

        {/* The help for the page tools (ayah-drawer ①): each tool's label
            always, and the line beside the bar until the owner drops it. */}
        {toolHelp && onToolHelp && (
          <Choice id="tool-help" title={t.toolHelpTitle} note={t.toolHelpNote} value={toolHelp} options={TOOL_HELPS} label={(choice) => choice === "line" ? t.toolHelpLine : t.toolHelpHover} data="tool-help" onPick={onToolHelp} />
        )}
        {/* Where the reading settings sit (ayah-drawer ①): each in the bar, or
            all in one drawer behind a button, until the owner has tried both. */}
        {settingsAt && onSettingsAt && (
          <Choice id="settings-at" title={t.settingsAtTitle} note={t.settingsAtNote} value={settingsAt} options={SETTINGS_ATS} label={(choice) => choice === "bar" ? t.settingsAtBar : t.settingsAtDrawer} data="settings-at" onPick={onSettingsAt} />
        )}

        {/* Page icons along the bottom (app-pages ①): off, or a row that gives
            settings a page of their own, until the owner has tried it. */}
        {appPages && onAppPages && (
          <Choice id="app-pages" title={t.appPagesTitle} note={t.appPagesNote} value={appPages} options={APP_PAGES} label={(choice) => choice === "off" ? t.stateOff : t.stateOn} data="app-pages" onPick={onAppPages} />
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
          <Choice id="word-tap" title={t.wordTapTitle} note={t.wordTapNote} value={wordTap} options={WORD_TAPS} label={(choice) => choice === "off" ? t.wordTapOff : t.wordTapWord} data="word-tap" onPick={onWordTap} />
        )}

        {/* How the page shows the verse a "Play to" run is reciting
            (docs/PLAN.md, item 57): built two ways, the moving light first. */}
        {runMark && onRunMark && (
          <Choice id="run-mark" title={t.runMarkTitle} note={t.runMarkNote} value={runMark} options={RUN_MARKS} label={(choice) => choice === "light" ? t.runMarkLight : t.runMarkRing} data="run-mark" onPick={onRunMark} />
        )}

        {/* What the page does when the reader turns away from a run while it
            plays (docs/PLAN.md, item 59): staying is the default; going back stays. */}
        <Choice id="run-follow" title={t.runFollowTitle} note={t.runFollowNote} value={runFollow} options={RUN_FOLLOWS} label={(choice) => choice === "stay" ? t.runFollowStay : t.runFollowBack} data="run-follow" onPick={rememberRunFollow} />

        {/* Where the zoom buttons grow the page from (docs/PLAN.md, item 66):
            the chosen verse is the default; the middle, as it was, stays. */}
        <Choice id="zoom-anchor" title={t.zoomAnchorTitle} note={t.zoomAnchorNote} value={zoomAnchor} options={ZOOM_ANCHORS} label={(choice) => choice === "verse" ? t.zoomAnchorVerse : t.zoomAnchorMiddle} data="zoom-anchor" onPick={rememberZoomAnchor} />

        {/* What zooming in keeps on the screen (docs/PLAN.md, item 100): the
            starts of the lines are the default; growing from the fold stays. */}
        <Choice id="zoom-across" title={t.zoomAcrossTitle} note={t.zoomAcrossNote} value={zoomAcross} options={ZOOM_ACROSSES} label={(choice) => choice === "starts" ? t.zoomAcrossStarts : t.zoomAcrossFold} data="zoom-across" onPick={rememberZoomAcross} />

        {/* How a note across the page's foot leaves (docs/PLAN.md, item 72):
            sliding away as the page comes down is the default; at once stays. */}
        <Choice id="note-leave" title={t.noteLeaveTitle} note={t.noteLeaveNote} value={noteLeave} options={NOTE_LEAVES} label={(choice) => choice === "slide" ? t.noteLeaveSlide : t.noteLeaveAtOnce} data="note-leave" onPick={rememberNoteLeave} />

        {/* How a run makes its next verse ready while one sounds (docs/PLAN.md,
            item 63): holding it in hand is the default; asking early and off stay. */}
        <Choice id="run-ahead" title={t.runAheadTitle} note={t.runAheadNote} value={runAhead} options={RUN_AHEADS} label={(choice) => choice === "hold" ? t.runAheadHold : choice === "ask" ? t.runAheadAsk : t.runAheadOff} data="run-ahead" onPick={rememberRunAhead} />

        {/* The surahs whose recitation is kept on this device (docs/PLAN.md,
            item 101), beside the setting for how the next verses are fetched. */}
        <RecitationShelf />

        {/* How the saved jump arrows show (docs/design/jump-arrows-options.md):
            the owner chose staying, and kept the other way as a choice. */}
        {arrowShowing && onArrowShowing && (
          <Choice id="jump-arrows" title={t.jumpArrowsTitle} note={t.jumpArrowsNote} value={arrowShowing} options={ARROW_SHOWINGS} label={(choice) => choice === "stays" ? t.jumpArrowsStays : t.jumpArrowsAsked} data="jump-arrows" onPick={onArrowShowing} />
        )}

        {/* What a card over the facing page does at the page's outer edge
            (docs/design/knowledge-graph-commentary.md, item 26): the owner chose
            grabbing through on 2026-10-23, and the other two stay choosable. Only where two pages
            can face each other: on a phone there is no facing page to cover. */}
        {spread && (
        <Choice id="card-edge" title={t.cardEdgeTitle} note={t.cardEdgeNote} value={cardEdge} options={CARD_EDGES} label={(choice) => choice === "covers" ? t.cardEdgeCovers : choice === "clear" ? t.cardEdgeClear : t.cardEdgeTurns} data="card-edge" onPick={rememberCardEdge} />
        )}

        {/* How the two opening pages fill their paper (knowledge-graph-commentary.md,
            item 36): the owner's pick is the default, the other kept as a choice. */}
        <Choice id="opening-text" title={t.openingTextTitle} note={t.openingTextNote} value={openingText} options={OPENING_TEXTS} label={(choice) => choice === "large" ? t.openingTextLarge : t.openingTextEven} data="opening-text" onPick={rememberOpeningText} />

        {/* How many related verses a note lists before the reader asks
            (knowledge-graph-commentary.md, item 41): the line is the default,
            the whole list kept as a choice. Only the private build has notes. */}
        {PITCH && (
          <Choice id="related-list" title={t.relatedListTitle} note={t.relatedListNote} value={relatedList} options={RELATED_LISTS} label={(choice) => choice === "line" ? t.relatedListLine : t.relatedListAll} data="related-list" onPick={rememberRelatedList} />
        )}

        {/* How a verse a little taller than the room above its note is shown
            whole (knowledge-graph-commentary.md, items 42 and 43): the page a
            little smaller is the default, the note a little shorter kept as a
            choice. Only the private build has notes. */}
        {PITCH && (
          <Choice id="long-verse" title={t.longVerseTitle} note={t.longVerseNote} value={longVerse} options={LONG_VERSES} label={(choice) => choice === "smaller" ? t.longVerseSmaller : t.longVerseShorter} data="long-verse" onPick={rememberLongVerse} />
        )}

        {/* How a look-alike whose shared words come more than once is compared
            (knowledge-graph-commentary.md, item 49): every shared stretch
            marked is the default, the two side by side unmarked kept as a
            choice. */}
        <Choice id="lookalike-compare" title={t.lookalikeCompareTitle} note={t.lookalikeCompareNote} value={lookalikeCompare} options={LOOKALIKE_COMPARES} label={(choice) => choice === "every" ? t.lookalikeCompareEvery : t.lookalikeComparePlain} data="lookalike-compare" onPick={rememberLookalikeCompare} />

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
        <Choice id="passage-hop" title={t.passageHopTitle} note={t.passageHopNote} value={passageHop} options={PASSAGE_HOPS} label={(choice) => choice === "alike" ? t.passageHopAlike : t.passageHopFirst} data="passage-hop" onPick={rememberPassageHop} />

        {/* Which way the look-alike signs' arrows point (knowledge-graph-commentary.md,
            item 8): the owner picked the book's way, 2026-10-12; the old way stays. */}
        <Choice id="lookalike-arrows" title={t.lookalikeArrowsTitle} note={t.lookalikeArrowsNote} value={lookalikeArrows} options={LOOKALIKE_ARROWS} label={(choice) => choice === "book" ? t.lookalikeArrowsBook : t.lookalikeArrowsReading} data="lookalike-arrows" onPick={rememberLookalikeArrows} />

        {/* Where a turn lands when the page opened bigger than the screen
            (docs/PLAN.md, item 97): the owner picked the top, 2026-10-13; the old way stays. */}
        <Choice id="turn-landing" title={t.turnLandingTitle} note={t.turnLandingNote} value={turnLanding} options={TURN_LANDINGS} label={(choice) => choice === "top" ? t.turnLandingTop : t.turnLandingSame} data="turn-landing" onPick={rememberTurnLanding} />

        {/* How big a verse's page opens on an upright screen (docs/PLAN.md, item 98):
            a little closer is the default; the whole page is the other way. */}
        <Choice id="open-size" title={t.openSizeTitle} note={t.openSizeNote} value={openSize} options={OPEN_SIZES} label={(choice) => choice === "closer" ? t.openSizeCloser : t.openSizeWhole} data="open-size" onPick={rememberOpenSize} />

        {/* How big the page is when the iPad comes back upright (docs/PLAN.md,
            item 99): the size it opened at is the default; whole is the other way. */}
        <Choice id="upright-again" title={t.uprightAgainTitle} note={t.uprightAgainNote} value={uprightAgain} options={UPRIGHT_AGAINS} label={(choice) => choice === "opening" ? t.uprightAgainOpening : t.uprightAgainWhole} data="upright-again" onPick={rememberUprightAgain} />

        {/* How long a bookmark's ribbon hangs (docs/PLAN.md, item 49): short,
            above the first line, is the default; the long one stays. */}
        <Choice id="ribbon-length" title={t.ribbonLengthTitle} note={t.ribbonLengthNote} value={ribbonLength} options={RIBBON_LENGTHS} label={(choice) => choice === "short" ? t.ribbonLengthShort : t.ribbonLengthLong} data="ribbon-length" onPick={rememberRibbonLength} />
        <Choice id="left-off-look" title={t.leftOffTitle} note={t.leftOffNote} value={leftOffLook} options={LEFT_OFF_LOOKS} label={(choice) => choice === "label" ? t.leftOffLabel : choice === "mark" ? t.leftOffMark : choice === "tabs" ? t.leftOffTabs : t.leftOffRibbons} data="left-off-look" onPick={rememberLeftOffLook} />
        <Choice id="bookmark-hand" title={t.bookmarkHandTitle} note={t.bookmarkHandNote} value={bookmarkHand} options={BOOKMARK_HANDS} label={(choice) => choice === "both" ? t.bookmarkHandBoth : choice === "pull" ? t.bookmarkHandPull : choice === "corner" ? t.bookmarkHandCorner : t.bookmarkHandClicks} data="bookmark-hand" onPick={rememberBookmarkHand} />

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
          <Choice id="scope-look" title={t.scopeLookTitle} note={t.scopeLookNote} value={scopeLook} options={SCOPE_LOOKS} label={(c) => SCOPE_LOOK_NAME[c](t)} data="scope-look" onPick={onScopeLook} />
        )}
        {/* Note, Harakat and Word as three buttons or one (docs/design/notes-
            style-toolbar.md, ②): the one button built as a setting, three kept
            as the default (owner, 2026-10-12). Every layout has a tools bar. */}
        {markTools && onMarkTools && (
          <Choice id="mark-tools" title={t.markToolsTitle} note={t.markToolsNote} value={markTools} options={MARK_TOOLS} label={(c) => MARK_TOOLS_NAME[c](t)} data="mark-tools-choice" onPick={onMarkTools} />
        )}
        {/* Where the eraser sits on a computer: last of the tools, the default
            since the owner's page comment of 2026-11-07, or beside Undo, where
            it was first built. A phone keeps it beside Undo. */}
        {eraserPlace && onEraserPlace && (
          <Choice id="eraser-place" title={t.eraserPlaceTitle} note={t.eraserPlaceNote} value={eraserPlace} options={ERASER_PLACES} label={(c) => ERASER_PLACE_NAME[c](t)} data="eraser-place-choice" onPick={onEraserPlace} />
        )}
        {/* What a tap with the Mistake pen does (docs/PLAN.md, item 103): ask
            what went wrong is the default the owner chose on 2026-10-13; the
            first way, mark at once, is kept as the other choice. */}
        {mistakeTap && onMistakeTap && (
          <Choice id="mistake-tap" title={t.mistakeTapTitle} note={t.mistakeTapNote} value={mistakeTap} options={MISTAKE_TAPS} label={(c) => MISTAKE_TAP_NAME[c](t)} data="mistake-tap-choice" onPick={onMistakeTap} />
        )}
        {/* How the Mistake pen's question is laid out, now that it asks the kind
            (a letter, a tajweed rule, as well as the harakat): three ways, kept
            while the owner tries them (2026-11-12). */}
        {mistakeAsk && onMistakeAsk && (
          <Choice id="mistake-ask" title={t.mistakeAskTitle} note={t.mistakeAskNote} value={mistakeAsk} options={MISTAKE_ASKS} label={(c) => MISTAKE_ASK_NAME[c](t)} data="mistake-ask-choice" onPick={onMistakeAsk} />
        )}
        {/* How the record's month draws a day (front-page comment, 2026-11-12:
            the calendar should be more appealing): three ways, kept while the
            owner tries them. */}
        {calendarLook && onCalendarLook && (
          <Choice id="calendar-look" title={t.calendarLookTitle} note={t.calendarLookNote} value={calendarLook} options={CALENDAR_LOOKS} label={(c) => CALENDAR_LOOK_NAME[c](t)} data="calendar-look-choice" onPick={onCalendarLook} />
        )}
        {/* How the share menu looks (front-page comment, 2026-11-12: the share
            menu is too plain): three ways, kept while the owner tries them. */}
        {shareLook && onShareLook && (
          <Choice id="share-look" title={t.shareLookTitle} note={t.shareLookNote} value={shareLook} options={SHARE_LOOKS} label={(c) => SHARE_LOOK_NAME[c](t)} data="share-look-choice" onPick={onShareLook} />
        )}
        {/* Where the page tools sit (docs/design/notes-style-toolbar.md, ①): all
            three homes the study drew, kept while they are tried (owner,
            2026-10-05). Only on the layout that has the tools bar. */}
        {penHome && onPenHome && (
          <Choice id="pen-home" title={t.penHomeTitle} note={t.penHomeNote} value={penHome} options={PEN_HOMES} label={(c) => PEN_HOME_NAME[c](t)} data="pen-home-choice" onPick={onPenHome} />
        )}
        {/* How the pens open at the Apple Pencil's tip (pen-ring.ts): rings
            round it, or the row first built, kept as the other way. Only in
            the iPad app, the one place with a pencil to squeeze. */}
        {tipPens && onTipPens && (
          <Choice id="tip-pens" title={t.tipPensTitle} note={t.tipPensNote} value={tipPens} options={TIP_PENS} label={(choice) => choice === "rings" ? t.tipPensRings : t.tipPensRow} data="tip-pens-choice" onPick={onTipPens} />
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
          <Choice id="pen-side" title={t.penSideTitle} note={t.penSideNote} value={penSide} options={PEN_SIDES} label={(c) => PEN_SIDE_NAME[c](t)} data="pen-side-choice" onPick={onPenSide} />
        )}
        {/* Where the look-alike chips go when a magnified page leaves no desk
            beside it (docs/design/lookalike-rows.md, ⑧): both homes built,
            the bottom row by default. Only on the layout with a desk. */}
        {railHome && onRailHome && (
          <Choice id="rail-home" title={t.railHomeTitle} note={t.railHomeNote} value={railHome} options={RAIL_HOMES} label={(c) => RAIL_HOME_NAME[c](t)} data="rail-home-choice" onPick={onRailHome} />
        )}
        {/* Where one page goes when a card opens beside it, the roots list or
            the share card (docs/design/lookalike-rows.md, ⑩ and ⑪): into the
            room the card leaves by default, or kept in the window's middle
            and drawn smaller. Only on the layout with a desk. */}
        {railHome && onRailHome && (
          <Choice id="card-room" title={t.cardRoomTitle} note={t.cardRoomNote} value={cardRoom} options={CARD_ROOMS} label={(choice) => choice === "aside" ? t.cardRoomAside : t.cardRoomSmaller} data="card-room" onPick={rememberCardRoom} />
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

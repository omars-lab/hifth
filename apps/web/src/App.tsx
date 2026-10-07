import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Adjacency,
  Concordance,
  bookmarksOnPage,
  clearSurah,
  dropBookmark,
  liftBookmark,
  mergeBookmarks,
  isMistake,
  addNote,
  editNote,
  markMistake,
  mistakeOn,
  pickMistakeSign,
  removeNote,
  restoreNote,
  addVerse,
  joinNote,
  changeScope,
  hizbOf,
  scopeContains,
  formatAyahKey,
  HIZB_STARTS,
  noteTitle,
  addScopedNote,
  editScopedNote,
  notesAbout,
  notesOfVerse,
  suggestNotes,
  verseDots as countVerseDots,
  confusionMarks as countConfusionMarks,
  markConfusion,
  removeLastTime,
  againConfusion,
  setConfusionState,
  removeConfusion,
  restoreConfusion,
  setDestination,
  allConfusions,
  dismissedConfusions,
  waslMarks,
  jumpArrows,
  arrowsShown,
  confusionsFrom,
  wordDiff,
  type ArrowShowing,
  type Confusion,
  type JumpEnd,
  type NoteScope,
  type ScopedNote,
  moveBookmark,
  openBookmark,
  parseBookmarkFile,
  renameBookmark,
  toBookmarkFile,
  DEFAULT_FIELD,
  MOUNTED_PAGE_CAP,
  Resolver,
  Roots,
  Tajweed,
  appKeyAction,
  editionMeta,
  hizbPageIndex,
  juzOf,
  AYAH_COUNTS,
  JUZ_STARTS,
  fromAbsoluteAyah,
  juzOfPage,
  juzPageIndex,
  keyToRef,
  parseAyahKey,
  toAbsoluteAyah,
  type PressKind,
  listTafsirProviders,
  registerTafsirProvider,
  type TafsirEntry,
  type TafsirProvider,
  refToKey,
  spreadBudget,
  type AdjacencyShard,
  type AppState,
  type AssetManifest,
  type AyahRange,
  type AyahRef,
  type AyahRootsShard,
  type Bookmark,
  type Note,
  type Edge,
  type FieldId,
  type JumpTarget,
  type MergedEdge,
  type RailChip,
  type RevisionScope,
  type RootHop,
  type RootIndexShard,
  type SkinId,
  spreadOf,
  openingAfter,
  type TajweedShard,
  type TajweedVocabulary,
  type WordIndex,
} from "@hifth/core";
import {
  loadManifest,
  pageUrl,
  loadRootAyahShard,
  loadRootBucket,
  loadShard,
  loadTajweedShard,
  loadTajweedVocabulary,
} from "./assets";
import { applyFieldToDocument, fieldFromHash } from "./field";
import { recordLook } from "./revision-store";
import { useT, type Strings } from "./i18n";
import { JumpPicker, type JumpChoice } from "./components/JumpPicker";
import { useHashRouter } from "./useHashRouter";
import { exposeToShell, nativeShare, shareBase } from "./native-bridge";
import { linksFor } from "./share-links";
import { DESKTOP_QUERY, TOUCH_QUERY, UPRIGHT_QUERY, useMediaQuery } from "./useMediaQuery";
import { useRoomForCards } from "./components/over-leaf";
import {
  PageStage,
  pageSpan,
  type Corner,
  type PageStageHandle,
  type PageTool,
  type VerseSpot,
  type WordRect,
} from "./components/PageStage";
import { PageToolbar, TOOL_KEYS, toolHint, toolName } from "./components/PageToolbar";
import { PenHomeBottom, PenHomeFloat, PenHomeSide, useSideRoom } from "./components/PenHomes";
import { PhoneToolbarA, PhoneToolbarB, PhoneToolbarC, phoneBarFromUrl } from "./components/PhoneToolbar";
import { rememberArrowShowing, savedArrowShowing } from "./jump-arrows";
// Opened by few readers and never before the page is up: loaded on first open.
import {
  useOpenedOnce,
  BookmarkDrawer,
  BookmarkShelf,
  Colophon,
  CropSheet,
  EditionPicker,
  NoteBox,
  NoteShelf,
  VerseNotes,
  JumpList,
  JumpShelf,
  RevisionMap,
  RootLens,
  WordPartsHost,
} from "./components/later";
import type { CropBox } from "./components/CropSheet";
import type { NoteAbout } from "./components/NoteBox";
import { PageSpread } from "./components/PageSpread";
import { EdgeGrabRails, type EdgeTurnDriver, type PeelPages } from "./components/EdgeGrabRails";
import { DesktopChrome } from "./components/DesktopChrome";
import { HopRail } from "./components/HopRail";
import { HopPopover } from "./components/HopPopover";
import { HighlightMenu } from "./components/HighlightMenu";
import { TrailBeads, type TrailBead } from "./components/TrailBeads";
import { ShareSheet } from "./components/ShareSheet";
import { OfflineNotice } from "./components/OfflineNotice";
import { Jumper } from "./components/Jumper";
import { CoachMarks } from "./components/CoachMarks";
import { BookmarkRibbons } from "./components/BookmarkRibbons";
import { UndoBar } from "./components/UndoBar";
import { NoteFollow } from "./components/NoteFollow";
import { useBookmarks, useConfusions, useNotes, useSeam } from "./useBookmarks";
import { LiveAnnouncer, useAnnouncer } from "./components/LiveAnnouncer";
import { RootLensTrigger } from "./components/RootLensTrigger";
import { PlayTrigger } from "./components/PlayTrigger";
import { DrawerTool, VerseDrawer } from "./components/VerseDrawer";
import { VerseMenu, type VerseMenuItem } from "./components/VerseMenu";
import { QulTrigger } from "./components/QulTrigger";
import { useVerseAudio, versesBetween } from "./audio";
// The private pitch layer (see src/pitch/pitch.ts). `PITCH` is a build-time
// constant that is false in every public build, so every guarded branch below is
// dead code the bundler drops, and the held-copy JSON those branches would load
// is gitignored and never deployed.
import {
  PITCH,
  loadPitchSurah,
  mergeShard,
  withBookRefs,
  introFor,
  makePitchProvider,
  loadPitchKey,
  type Commentator,
  type PitchSurah,
} from "./pitch/pitch";
// The one commentary drawer and its sources (decision `tafsir-provider`): the
// pitch's book is one source, a live public service another, and the drawer
// draws whichever is on without knowing which.
import { CommentarySheet, CommentaryTrigger } from "./components/CommentarySheet";
import { entryForAyah, indexEntries, introNote, noteFor } from "./tafsir/commentary";
import { LIVE_TAFSIR, LIVE_TAFSIR_ID, registerLiveTafsirProvider } from "./tafsir/quran-foundation";

/**
 * Whether this build has any commentary to show: the pitch's book, or a live
 * source the build was configured for. Both are fixed when the app is built, so
 * a public build with neither drops the drawer and everything only it reaches.
 */
const COMMENTARY = PITCH || LIVE_TAFSIR;
// Every surah's name carries an ⓘ that opens its introduction, in the pitch build.
const INTRO_SURAHS: ReadonlySet<number> = new Set(
  PITCH ? Array.from({ length: 114 }, (_, i) => i + 1) : [],
);
import { drawIntroBadges } from "./components/intro-badge";
import { drawVerseNumbers } from "./components/verse-numbers";
import { SkinToggle, TajweedLegend } from "./components/SkinToggle";
import { PageSlider } from "./components/PageSlider";
import { fisheyeEnabled, rememberFisheye } from "./pagebar-fisheye";
import { rememberTurnStyle, savedTurnStyle, type TurnStyle } from "./turn-style";
import { rememberVerseGestures, savedVerseGestures, type VerseGestures } from "./verse-gestures";
import { rememberPenHome, savedPenHome, type PenHome } from "./pen-home";
import { rememberScopeLook, savedScopeLook, type ScopeLook } from "./scope-look";
import { applyPen, rememberPen, savedPen, type Pen } from "./pen";
import styles from "./App.module.css";

// The app opens on page 7 (the mock's first curated page). Full page routing is
// Loop 3; here the page follows the selection through hops. The private pitch
// build instead opens on page 1 — al-Fātiḥah, the surah the demo is built around
// — so the first thing in the room is the page we polished.
const START_PAGE = PITCH ? 1 : 7;

/** `quran/…/2:47` → its spec-§7 ref, or null if it is not a bare ayah key. */
/** Whichever sheet over the foot of a phone reaches highest, or null when none does. */
function highestTop(...tops: readonly (number | null)[]): number | null {
  const open = tops.filter((top): top is number => top !== null);
  return open.length === 0 ? null : Math.min(...open);
}

function refOf(key: string): AyahRef | null {
  const parsed = parseAyahKey(key);
  return parsed ? { surah: parsed.surah, ayah: parsed.ayah } : null;
}

/**
 * The §7 `select` for a highlighted range: first→last ayah of the range's surah
 * (`2:47-2:48`). A one-ayah highlight degrades to the plain ayah form — there is
 * only one canonical link for it — and members outside the opening surah are
 * ignored, since the grammar's range form does not cross surahs.
 */
function rangeSelect(keys: readonly string[]): AyahRef | AyahRange | null {
  const refs = keys.map(refOf).filter((r): r is AyahRef => r !== null);
  if (refs.length === 0) return null;
  const surah = refs[0]!.surah;
  const ayahs = refs.filter((r) => r.surah === surah).map((r) => r.ayah);
  const from = Math.min(...ayahs);
  const to = Math.max(...ayahs);
  return to > from ? { surah, ayah: from, toAyah: to } : { surah, ayah: from };
}

/**
 * What each fore-edge shows as its corner lifts (#189): beneath the lifted leaf,
 * the same side of the next opening; on its back, the page that will lie on the
 * far side. The left edge pulls forward, so from (7, 8) it shows 10 beneath and
 * 9 on the back; the right edge pulls back, showing 5 beneath and 6 on the back.
 * Null where either page is not in the edition — that edge turns the old way.
 */
function peelPagesOf(
  edition: string,
  page: number,
  total: number,
  available: readonly number[],
): { left: PeelPages | null; right: PeelPages | null } {
  const { right } = spreadOf(page, total);
  if (right === null) return { left: null, right: null };
  const pair = (under: number, back: number): PeelPages | null =>
    available.includes(under) && available.includes(back)
      ? { under: pageUrl(edition, under), back: pageUrl(edition, back) }
      : null;
  return { left: pair(right + 3, right + 2), right: pair(right - 2, right - 1) };
}

export function App(): JSX.Element {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  // Adjacency shards, fetched on demand and cached for the session (Loop 4a:
  // the ETL writes all 114, one per surah, each a few KB gzipped).
  const [shards, setShards] = useState<ReadonlyMap<number, AdjacencyShard>>(new Map());
  // The private pitch payloads (The Study Quran commentary + curated roads),
  // one per surah, loaded only in the pitch build. Empty everywhere else.
  const [pitchSurahs, setPitchSurahs] = useState<ReadonlyMap<number, PitchSurah>>(
    new Map(),
  );
  // The book's key to its commentators' initials, so a note can say who they are.
  const [pitchKey, setPitchKey] = useState<ReadonlyMap<string, Commentator>>(() => new Map());
  useEffect(() => {
    if (PITCH) void loadPitchKey().then(setPitchKey);
  }, []);
  // Whether the commentary sheet is showing for the current selection.
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  // The commentary source the drawer reads, registered once. A held or loaded
  // book takes precedence over the open live service, until readers are offered
  // a choice between them. Null in a build with no commentary.
  const [commentarySource] = useState<TafsirProvider | null>(() => {
    if (!COMMENTARY) return null;
    if (PITCH) registerTafsirProvider(makePitchProvider());
    if (LIVE_TAFSIR) registerLiveTafsirProvider();
    const all = listTafsirProviders();
    return all.find((p) => p.source.id !== LIVE_TAFSIR_ID) ?? all[0] ?? null;
  });
  // Each surah's notes from that source, fetched on demand like the shards.
  const [commentaryBySurah, setCommentaryBySurah] = useState<ReadonlyMap<number, readonly TafsirEntry[]>>(
    new Map(),
  );
  // The verse whose note a link asked to see led by its surah's introduction
  // (`?open=context`); dropped the moment the reader moves to another verse.
  const [contextFor, setContextFor] = useState<string | null>(null);
  // Where the phone's short note starts, so the page can lift the verse above it.
  const [coverTop, setCoverTop] = useState<number | null>(null);
  // Where the open share tray starts on a phone; the page lifts the verse above
  // whichever of the two reaches higher.
  const [shareTop, setShareTop] = useState<number | null>(null);
  // Where an open roots or similar-verses list starts on a phone: it takes the
  // note's place, so the page lifts the verse above it the same way.
  const [listTop, setListTop] = useState<number | null>(null);
  // Where the hop chips floating over the page's top corner end, so the lift
  // above a phone note stops the verse's first line beneath them.
  const [railBottom, setRailBottom] = useState<number | null>(null);
  // Whether the phone note is grown over the whole page; the chips sit on the
  // short note's top row, and step back under a grown one.
  const [noteTall, setNoteTall] = useState(false);
  const [page, setPage] = useState(START_PAGE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // The drag-highlighted passage: its ayah keys in reading order (spec §3's
  // `onRangeSelect` payload), or null. Mutually exclusive with `selectedKey` —
  // a highlight replaces a selection and vice versa, so exactly one hop list
  // can be open at a time.
  const [selectedRange, setSelectedRange] = useState<readonly string[] | null>(null);
  const [trail, setTrail] = useState<TrailBead[]>([]);
  const [openDirection, setOpenDirection] = useState<RailChip["direction"] | null>(null);
  // Root lens (Loop 5) shards, in two waves: the selection's surah tells us
  // which roots it carries, and only then do we fetch the buckets holding those
  // roots' corpus-wide occurrence lists. `rootsOpen` is the ⬡ sheet.
  const [rootAyahShards, setRootAyahShards] = useState<
    ReadonlyMap<number, AyahRootsShard>
  >(new Map());
  const [rootBuckets, setRootBuckets] = useState<ReadonlyMap<number, RootIndexShard>>(
    new Map(),
  );
  const [rootsOpen, setRootsOpen] = useState(false);
  // The verse drawer's ×: put away until another verse is lit (selection = D).
  const [drawerAway, setDrawerAway] = useState(false);
  const putDrawerAway = useCallback(() => setDrawerAway(true), []);
  const drawerAwayRef = useRef(drawerAway);
  drawerAwayRef.current = drawerAway;
  // Loop 6a wayfinding sheets: "go to" (`/` or the ⌖ button) and the mushaf
  // picker. Both are modal, so at most one is up at a time in practice.
  const [jumperOpen, setJumperOpen] = useState(false);
  const [editionOpen, setEditionOpen] = useState(false);
  const [colophonOpen, setColophonOpen] = useState(false);
  // The revision map, opened from the page chip. Nothing here holds the record —
  // the sheet reads it itself, so a log of someone's worship is not sitting in
  // this component's state for every future feature to reach into.
  const [revisionOpen, setRevisionOpen] = useState(false);
  // Which scope the sheet should land on, when the opener cares. The page chip
  // does not — it leaves the reader wherever they last were — so it stays
  // `undefined` there; the swept-pack notice sends them to "juz", because the
  // shelf it is pointing at is only rendered at juz scope.
  const [revisionAt, setRevisionAt] = useState<RevisionScope | undefined>(undefined);
  /*
   * Is the tips strip up? It no longer opens by itself on a first visit (the
   * owner's call, 2026-09-25): it starts closed and opens only from the button
   * in settings, so a first open goes straight to the page.
   */
  const [coachUp, setCoachUp] = useState(false);

  const stageRef = useRef<PageStageHandle>(null);
  // The page's room, which the cards stand inside rather than over the bars.
  const roomRef = useRef<HTMLElement>(null);
  useRoomForCards(roomRef);
  /*
   * The facing leaf's handle — held for one reason only: magnification. When two
   * pages are open the reader magnifies the whole opening, so the stepper drives
   * this leaf to the same level as the live one and the two grow together. It is
   * *not* how the book is steered: hops and turns still go through the live stage
   * above (its ref), because a landing has to relocate the reader, and relocating
   * onto the facing leaf swaps the two roles anyway. So this ref carries zoom and
   * nothing else, and is null below the breakpoint, where there is no second leaf.
   */
  const facingStageRef = useRef<PageStageHandle>(null);
  /*
   * The open book's own element, so a page turn's fold can be portalled into it.
   *
   * The fold crosses the *whole book*, not one leaf: on a desktop opening both
   * leaves belong to the same sheet of paper, and a band that stopped at the
   * gutter would draw a turn of half a page (docs/design/page-transition.md
   * §3.5). The book and not the desk around it, either — the outer element runs
   * the width of the window, and a band given that would appear on empty field
   * before reaching the paper. Null below the breakpoint, where `PageSpread`
   * renders no wrapper at all and the stage sweeps its own single leaf instead.
   */
  const bookRef = useRef<HTMLDivElement | null>(null);
  /*
   * Is there room for an open mus'haf? Asked in JavaScript rather than left to
   * CSS because the answer decides a *mount*, not a style: each page is a
   * ~170 KB inline SVG, and a `display: none` facing leaf would still fetch it,
   * parse it and build a Highlighter for it. Desktop is where two pages are
   * affordable; a phone is precisely where they are not (PLAN follow-up ①).
   * The query and its arithmetic live in useMediaQuery.ts.
   */
  const desktop = useMediaQuery(DESKTOP_QUERY);
  /** Which of the three phone tool layouts is on trial (phone-toolbar, open). */
  const [phoneBar] = useState(() => phoneBarFromUrl(window.location.search));
  /*
   * One leaf or two — the reader's own answer, and the only thing the spread
   * consults (docs/design/desktop.md §8 ②, superseded mechanism).
   *
   * It used to be *derived*: past fit the book closed itself, and zoom lived on
   * the wheel. Three separate desyncs came out of that one derivation — the
   * facing leaf could be zoomed on its own, the mode survived a breakpoint
   * crossing while the zoom did not, and zooming *out* to 0.8 counted as "at
   * fit" and re-opened the book at a different size than it closed at. A state
   * with no gesture behind it cannot drift from a gesture.
   */
  // Until the reader picks, the screen's shape picks: one page on a screen
  // taller than it is wide (an iPad held upright), two on one wider than tall.
  // Upright, two pages were each half the screen wide with empty space above
  // and below them.
  const upright = useMediaQuery(UPRIGHT_QUERY);
  const touchScreen = useMediaQuery(TOUCH_QUERY);
  const [pageMode, setPageMode] = useState<"one" | "two">(() => (upright ? "one" : "two"));
  const pageModePickedRef = useRef(false);
  /*
   * What the paper is magnified to, for the chrome's readout.
   *
   * A mirror, not the source: the stage's `view` ref is the truth, and it is a
   * ref precisely so a pan does not re-render a 170 KB inline SVG's parent. This
   * is written only when something has *landed* — after a turn, a hop or a press
   * of the stepper — which is twice a gesture rather than sixty times a second,
   * and it is written with what the stage says it applied rather than with what
   * was asked for. See `withZoom` below for why that distinction is not
   * pedantic.
   */
  const [zoom, setZoom] = useState(1);
  /*
   * Whether there is a second leaf on screen right now — **not** which mode is
   * selected, and the difference is a defect this caught.
   *
   * `pageMode` is desktop furniture. It is real state at every width because the
   * reader's choice must survive a resize (defect ②), but below the breakpoint
   * nothing renders a spread, so its default of `"two"` describes a book that is
   * not there. Reading it alone withheld the hop's magnification on every phone
   * in the suite — a deep link landed at fit, which is exactly the reported
   * defect this loop exists to remove, inflicted on the platform that never had
   * it. So the question asked below is the one the rule is actually about.
   *
   * A live mirror rather than a dependency, because `stage` is memoised on `[]`
   * on purpose: it is a dependency of the effects that reset the zoom, and a
   * `stage` that changed identity with the mode would re-run them on every
   * toggle and every breakpoint crossing.
   */
  const bookOpenRef = useRef(false);
  bookOpenRef.current = desktop && pageMode === "two";
  /*
   * The fore-edge grab, wired to the one stage that owns turning.
   *
   * The rails live on the book because one of the two edges is the facing leaf,
   * a page the live stage never feels a pointer on (see `EdgeGrabRails`). Every
   * verb goes to `stageRef` — the live leaf — and never to the facing one: only
   * the live stage draws the fold, and a second band in the same book is the one
   * thing the transition design forbids. Memoised on `[]`, since `stageRef` is
   * stable and the verbs read `.current` at call time.
   */
  const edgeTurn = useMemo<EdgeTurnDriver>(
    () => ({
      begin: (step) => stageRef.current?.beginEdgeTurn(step),
      track: (dx) => stageRef.current?.trackEdgeTurn(dx),
      release: (dx, velocityX, held) => stageRef.current?.releaseEdgeTurn(dx, velocityX, held) ?? false,
      finish: (step) => {
        // The leaf is already over: this step lands, it does not play again.
        peelLandingRef.current = true;
        stageRef.current?.finishEdgeTurn(step);
      },
    }),
    [],
  );
  // On an open book an arrow, the wheel or a slider button turns the leaf the
  // way a hand does — the corner-pull's peel, played — so both pages of the new
  // opening land together (owner, 2026-09-28: the old turn swapped one page, showed
  // a mismatched pair, then swapped the other). The rails fill this in.
  const playTurnRef = useRef<((step: 1 | -1) => boolean) | null>(null);
  const peelLandingRef = useRef(false);
  /*
   * The stage's four imperative verbs, wrapped once, so that the readout above
   * cannot drift from the paper below it.
   *
   * The wrapping is the point. The three landing verbs do not agree on where
   * they leave the magnification — a turn and a deep link end at 1, a hop frames
   * its target at `DEFAULT_HOP_ZOOM` — and none of them reliably ends where it
   * aimed: a hop whose ayah has no box to frame does not zoom at all, and
   * `clampView` can refuse part of what any of them asks. So the level is read
   * back off the stage once the promise settles rather than predicted from the
   * call. Predicting is the version of this that looks correct at all seven call
   * sites and is wrong at three of them.
   *
   * Read *after* the await and not before, because a turn is 240 ms of animation
   * and a chrome that updated at the start of it would be describing a page the
   * reader has not arrived at yet.
   */
  const stage = useMemo(() => {
    // The facing leaf carries whatever the live leaf lands at, so the opening is
    // one magnification and never two. Read off the live stage rather than the
    // caller's request, because a turn ends at fit and a hop with the book open
    // ends at fit too (see `navigateTo` below) — mirroring the landed value keeps
    // the two leaves agreeing without this having to know which verb ran.
    // Each leaf of an open book grows away from the fold on its own side, which
    // it works out from its page (the `bound` prop). The ref is null unless the
    // book is open, so this is a no-op on a lone leaf.
    const mirrorFacing = (): void => {
      facingStageRef.current?.setZoom(stageRef.current?.zoomNow() ?? 1);
    };
    const settle = <T,>(work: Promise<T> | undefined, missing: T): Promise<T> =>
      (work ?? Promise.resolve(missing)).then((landed) => {
        setZoom(stageRef.current?.zoomNow() ?? 1);
        mirrorFacing();
        return landed;
      });
    return {
      /*
       * A hop frames its ayah at `DEFAULT_HOP_ZOOM` — except with the book open,
       * where it frames at fit instead.
       *
       * "Zoom needs one page" is a rule about the spread, not about the stepper,
       * and a hop that magnified the live leaf to 1.55 beside a facing leaf at 1
       * would put the two pages at different scales with the book still open —
       * which is the shape of the original complaint, arrived at down a different
       * path. The hop still *lands* on the ayah: `frameBboxToView` centres it
       * either way, and only the magnification is withheld.
       */
      navigateTo: (key: string, opts?: { pulse?: boolean; zoom?: number }) =>
        settle(
          stageRef.current?.navigateTo(key, {
            ...opts,
            ...(bookOpenRef.current && opts?.zoom === undefined ? { zoom: 1 } : {}),
          }),
          undefined,
        ),
      showPage: (next: number) => settle(stageRef.current?.showPage(next), undefined),
      turnTo: (next: number) => settle(stageRef.current?.turnTo(next), false),
      // Synchronous, because this one *is* the gesture: the stepper presses and
      // the paper has already moved by the time the handler returns. The facing
      // leaf gets the same asked-for level and clamps it against its own box, so
      // both leaves land on the rung the reader pressed even where their fits
      // differ; the readout follows the live leaf.
      //
      // With the book open, each leaf pins at its gutter edge so the opening
      // grows outward from the fold as one sheet rather than each leaf swelling
      // from its own middle — which crushed the fold and pushed the outer margins
      // off-screen. The live leaf can be either side of the opening (an even page
      // is the left-hand one), so the stage picks its own edge; on a lone leaf
      // there is no fold, so it grows from its centre.
      setZoom: (z: number) => {
        const applied = stageRef.current?.setZoom(z) ?? 1;
        facingStageRef.current?.setZoom(z);
        setZoom(applied);
      },
    };
  }, []);
  /*
   * Open or close the book — and start the opening at fit.
   *
   * Both leaves now magnify together (the reader asked for it, over the older
   * finding that two enlarged pages read as one column — see the decision that
   * reversed it). But the facing leaf mounts fresh at fit the instant the spread
   * appears, so if the live leaf carried a leftover magnification in, the two
   * would open at different sizes. Dropping to fit on open makes both leaves
   * agree from the first frame; the stepper then grows them together from there.
   * Closing keeps whatever the reader was at, because one leaf has nothing to
   * disagree with.
   */
  const handlePageMode = useCallback(
    (mode: "one" | "two") => {
      pageModePickedRef.current = true;
      setPageMode(mode);
      // The mirror moves now, not at the next render: a link that closes the
      // book (`?view=one`) lands its verse in the same step, and that landing
      // must already see one page, or it withholds the magnification.
      bookOpenRef.current = desktop && mode === "two";
      if (mode === "two") stage.setZoom(1);
    },
    [stage, desktop],
  );
  /*
   * Crossing the desktop breakpoint puts the paper back at fit, so the readout
   * goes back with it.
   *
   * This is defect ② of the three, and it is here rather than anywhere else
   * because the crossing is a *resize*, not a gesture: nothing in the stage
   * reports it, and the old code left the mode saying "closed to one leaf" while
   * the leaf underneath had quietly returned to `scale(1)`. Asking for 1 rather
   * than reading what happened to be there makes both sides of the question
   * agree by construction, whether or not the stage remounted on the way.
   */
  useEffect(() => {
    stage.setZoom(1);
  }, [desktop, stage]);
  // Turning the screen turns the book with it, until the reader has picked.
  useEffect(() => {
    if (pageModePickedRef.current) return;
    const mode = upright ? "one" : "two";
    setPageMode(mode);
    bookOpenRef.current = desktop && mode === "two";
    // Opened as the control opens it: both pages at fit, or they disagree.
    if (mode === "two") stage.setZoom(1);
  }, [upright, desktop, stage]);
  const { t, dir } = useT();
  const { message, announce } = useAnnouncer();

  // Per-verse recitation: one <audio> for the app, streamed from the public
  // Quran.com CDN (see audio.ts — nothing is held in the tree). A CDN failure is
  // said out loud, so a silent verse is never a mystery.
  const audio = useVerseAudio((k) =>
    announce(`${t.ayahLabel(k) ?? k} — ${t.audioUnavailable}`),
  );
  /*
   * The stepper's press, said out loud.
   *
   * Only this one of the three `setZoom` callers announces, and the split is
   * deliberate: the other two are consequences of something the reader already
   * did — opening the book, or resizing the window — and narrating a
   * consequence twice is how a reader learns to stop listening. A press of − or
   * + has no other outcome to hear.
   *
   * It says what *landed* rather than what was asked for, because `clampView`
   * can refuse part of a step near an edge, and a chrome that announces 250%
   * over paper sitting at 200% is worse than one that says nothing.
   */
  const handleZoom = useCallback(
    (z: number) => {
      stage.setZoom(z);
      announce(t.arrivedZoom(Math.round((stageRef.current?.zoomNow() ?? z) * 100)));
    },
    [stage, announce, t],
  );

  // Live mirror of the selection so event handlers (which close over a render's
  // value) can read the current one without re-subscribing or an impure updater.
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;
  // A newly lit verse brings its drawer back up, even after the last one's ×,
  // unless the reader arrived by a hop: on a phone the drawer rises over the bar
  // the trail lives in, and the one thing a hafiz wants after a hop is the way
  // back. A tap on the verse raises it as usual.
  const arrivedByHop = useRef(false);
  useEffect(() => {
    setDrawerAway(arrivedByHop.current);
    arrivedByHop.current = false;
  }, [selectedKey]);

  /*
   * Where the reader is, and where they are *going*.
   *
   * `page` is a committed fact — it changes when a page has actually landed on
   * the stage. A turn takes 240 ms, and during those 240 ms a second arrow press
   * must step from the page being turned to, not from the one still on screen:
   * otherwise holding ArrowLeft oscillates between two pages instead of walking
   * the book. `pendingPageRef` is that destination, and it is the number every
   * page-stepping decision is made against.
   *
   * Both are synced from `page` rather than written at each of the seven places
   * that call `setPage` — a deep link, a hop, a trail rewind and a scrub all
   * settle the reader somewhere, and any of them arriving mid-turn should reset
   * the destination to wherever they put us.
   */
  const pageRef = useRef(page);
  const pendingPageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
    pendingPageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  const resolver = useMemo(
    () => (manifest ? new Resolver(manifest) : null),
    [manifest],
  );

  // The routing table, rebuilt when a shard lands (addShard is a Map.set — the
  // rebuild is trivial and keeps chips/memos consistent via plain deps).
  const adjacency = useMemo(() => {
    if (!manifest) return null;
    const adj = new Adjacency(manifest.edition);
    // The pitch build adds the curated cross-references and meaning-jumps by
    // merging each surah's pitch edges into its base shard — including surahs
    // whose base shard is empty (al-Fātiḥah), which is why we walk the union.
    const surahs = new Set<number>(shards.keys());
    if (PITCH) for (const s of pitchSurahs.keys()) surahs.add(s);
    for (const surah of surahs) {
      const base = shards.get(surah);
      const pitch = PITCH ? pitchSurahs.get(surah)?.shard : undefined;
      const merged = pitch ? mergeShard(base, pitch) : base;
      if (merged) adj.addShard(surah, merged);
    }
    return adj;
  }, [manifest, shards, pitchSurahs]);

  // Fetch a surah's shard at most once per session; a null result (missing
  // file) still counts as requested so we don't hammer a broken deploy.
  const requestedShards = useRef(new Set<number>());
  const ensureShard = useCallback(
    (surah: number) => {
      if (!manifest || requestedShards.current.has(surah)) return;
      requestedShards.current.add(surah);
      void loadShard(manifest.edition, surah).then((shard) => {
        if (shard) setShards((m) => new Map(m).set(surah, shard));
      });
    },
    [manifest],
  );

  // The pitch surah for a selection, loaded at most once per session — the same
  // shape as `ensureShard`, but for the private held payload. A no-op (and fully
  // dead code) in every public build.
  const requestedPitch = useRef(new Set<number>());
  const ensurePitch = useCallback((surah: number) => {
    if (!PITCH || requestedPitch.current.has(surah)) return;
    requestedPitch.current.add(surah);
    void loadPitchSurah(surah).then((p) => {
      if (p) setPitchSurahs((m) => new Map(m).set(surah, p));
    });
  }, []);

  // A surah's notes from the commentary source, asked for at most once.
  const requestedNotes = useRef(new Set<number>());
  const ensureNotes = useCallback(
    (surah: number) => {
      if (!COMMENTARY || !commentarySource?.has(surah) || requestedNotes.current.has(surah)) return;
      requestedNotes.current.add(surah);
      void commentarySource.load(surah).then((entries) => {
        setCommentaryBySurah((m) => new Map(m).set(surah, entries));
      });
    },
    [commentarySource],
  );

  // On-demand load for the selection's surah (covers taps AND deep-link
  // restores — both go through setSelectedKey)…
  useEffect(() => {
    if (!selectedKey) return;
    const surah = parseAyahKey(selectedKey)?.surah;
    if (surah) {
      ensureShard(surah);
      ensurePitch(surah);
      ensureNotes(surah);
    }
  }, [selectedKey, ensureShard, ensurePitch, ensureNotes]);

  // …and for every surah the highlighted range touches (a range never spans
  // surahs today, but the loop costs nothing and is honest about the shape).
  useEffect(() => {
    if (!selectedRange) return;
    for (const key of selectedRange) {
      const surah = parseAyahKey(key)?.surah;
      if (surah) ensureShard(surah);
    }
  }, [selectedRange, ensureShard]);

  // The root lens over whatever root shards have landed (same rebuild-on-set
  // pattern as `adjacency`; a missing shard just means fewer families).
  const roots = useMemo(() => {
    if (!manifest) return null;
    const lens = new Roots(manifest.edition);
    for (const [surah, shard] of rootAyahShards) lens.addAyahShard(surah, shard);
    for (const [bucket, shard] of rootBuckets) lens.addRootShard(bucket, shard);
    return lens;
  }, [manifest, rootAyahShards, rootBuckets]);

  const requestedRootShards = useRef(new Set<number>());
  const requestedRootBuckets = useRef(new Set<number>());

  // Wave 1 — the selection's surah shard. Cheap and always worth having: it is
  // what tells the ⬡ trigger whether this ayah has any roots at all.
  useEffect(() => {
    if (!manifest || !selectedKey) return;
    const surah = parseAyahKey(selectedKey)?.surah;
    if (!surah || requestedRootShards.current.has(surah)) return;
    requestedRootShards.current.add(surah);
    void loadRootAyahShard(manifest.edition, surah).then((shard) => {
      if (shard) setRootAyahShards((m) => new Map(m).set(surah, shard));
    });
  }, [manifest, selectedKey]);

  // Wave 2 — the buckets, only once the sheet is actually open. A bucket is
  // tens of KB and holds every ayah of every root in it; fetching those for a
  // lens nobody opened would be the loop's biggest wasted byte.
  useEffect(() => {
    if (!manifest || !roots || !rootsOpen || !selectedKey) return;
    for (const bucket of roots.bucketsForKey(selectedKey)) {
      if (requestedRootBuckets.current.has(bucket)) continue;
      requestedRootBuckets.current.add(bucket);
      void loadRootBucket(manifest.edition, bucket).then((shard) => {
        if (shard) setRootBuckets((m) => new Map(m).set(bucket, shard));
      });
    }
  }, [manifest, roots, rootsOpen, selectedKey]);

  // Distinct roots on the selection — the ⬡ trigger's count (0 hides it).
  const rootCount = useMemo(() => {
    if (!roots || !selectedKey) return 0;
    return new Set(roots.rootsForKey(selectedKey).map((r) => r.r)).size;
  }, [roots, selectedKey]);

  // The open lens's families, nearest page first. Null = closed. Families whose
  // bucket is still in flight are simply absent, hence the loading flag.
  const rootFamilies = useMemo(
    () => (roots && rootsOpen && selectedKey ? roots.familiesForKey(selectedKey) : null),
    [roots, rootsOpen, selectedKey],
  );
  const rootsLoading = rootFamilies !== null && rootFamilies.length < rootCount;

  // The lens is about one ayah: moving the selection closes it (this covers
  // taps, hops, bead-backs and deep links in one line, without every handler
  // having to remember).
  useEffect(() => setRootsOpen(false), [selectedKey]);
  // Moving the selection also stops any recitation: the ▶ belongs to the verse
  // you are on, so a hop or a fresh tap should not leave the last one sounding.
  // `stopAudio` is stable, so this fires only when the selection actually moves.
  const stopAudio = audio.stop;
  useEffect(() => {
    stopAudio();
  }, [selectedKey, stopAudio]);
  // The note for the current selection, from whichever source is on; in the
  // pitch build led by the surah's introduction on any verse a link asked to
  // see in context.
  const commentaryEntry = useMemo(() => {
    if (!COMMENTARY || !commentarySource || !selectedKey) return null;
    const surah = parseAyahKey(selectedKey)?.surah;
    const entries = surah ? commentaryBySurah.get(surah) : undefined;
    if (!surah || !entries) return null;
    const intro = PITCH
      ? introFor(pitchSurahs.get(surah) ?? null, selectedKey, contextFor !== null && contextFor === selectedKey)
      : null;
    return noteFor(entryForAyah(indexEntries(entries), selectedKey), commentarySource.source, selectedKey, intro);
  }, [commentarySource, selectedKey, commentaryBySurah, pitchSurahs, contextFor]);
  const hasCommentary = commentaryEntry !== null;

  // The surah whose introduction is open by itself, from a press on its name
  // (owner, 2026-10-04); it gives way the moment the selection moves.
  const [introSurah, setIntroSurah] = useState<number | null>(null);
  const openIntro = useCallback(
    (surah: number) => {
      ensurePitch(surah);
      setIntroSurah(surah);
    },
    [ensurePitch],
  );
  const introLabel = useCallback((surah: number) => `${t.surahIntro}${t.sep}${t.surahName(surah)}`, [t]);
  // Only the pitch build makes the names buttons, so the public bundle drops the drawing.
  const paintIntro = useMemo(
    () => (PITCH ? (svg: SVGSVGElement) => drawIntroBadges(svg, INTRO_SURAHS, introLabel) : undefined),
    [introLabel],
  );
  const introSheet = useMemo(() => {
    if (!PITCH || introSurah === null || !commentarySource || !resolver) return null;
    const p = pitchSurahs.get(introSurah);
    if (!p || p.intro.length === 0) return null;
    return introNote(commentarySource.source, formatAyahKey(resolver.edition, introSurah, 1), {
      title: p.title,
      paragraphs: p.intro,
    });
  }, [introSurah, commentarySource, resolver, pitchSurahs]);
  useEffect(() => {
    setIntroSurah(null);
  }, [selectedKey]);

  // Each verse's number is a button that opens a menu of what to read on the
  // verse (pitch build; owner, 2026-10-04): its note, its similar verses, the
  // words from the same roots, its recitation, the surah's introduction. The
  // selected verse's number is washed. Pressing a number selects its verse,
  // and the note waits to be picked from the menu rather than opening behind it.
  // It is the same small menu a hold on a verse opens, with other lines.
  const [verseMenuAt, setVerseMenuAt] = useState<({ key: string; locate: () => VerseSpot | null } & VerseSpot) | null>(
    null,
  );
  const closeNumberMenu = useCallback(() => setVerseMenuAt(null), []);
  const pickedFromNumberRef = useRef<string | null>(null);
  const verseMenuLabel = useCallback((key: string) => t.verseMenu(key), [t]);
  const paintVerses = useMemo(
    () =>
      PITCH && resolver
        ? (svg: SVGSVGElement, words: WordIndex | null) =>
            drawVerseNumbers(svg, resolver.edition, words, selectedKey, verseMenuLabel)
        : undefined,
    [resolver, selectedKey, verseMenuLabel],
  );
  useEffect(() => {
    if (verseMenuAt && verseMenuAt.key !== selectedKey) setVerseMenuAt(null);
  }, [selectedKey, verseMenuAt]);

  // Moving the selection closes the commentary — except in the pitch build,
  // where a verse that carries a Study Quran note opens it on the tap itself.
  // The demo's whole point is «tap a verse, read the note»; making that a
  // second click on a footer button buried the moment. A verse with no note
  // still just closes it.
  useEffect(() => {
    const fromNumber = pickedFromNumberRef.current === selectedKey;
    if (!fromNumber) pickedFromNumberRef.current = null;
    setCommentaryOpen(PITCH && hasCommentary && !fromNumber);
  }, [selectedKey, hasCommentary]);

  useEffect(() => {
    if (contextFor !== null && contextFor !== selectedKey) setContextFor(null);
  }, [selectedKey, contextFor]);

  // Rail chips for the current selection (empty when nothing selected / no hops).
  const chips = useMemo(
    () => (adjacency && selectedKey ? adjacency.chipsForKey(selectedKey) : []),
    [adjacency, selectedKey],
  );

  // Loop 6a — the ⬡ merge. The rail's other chips are *directions* of one edge
  // type (≈↻ same surah, ≈← earlier, ≈→ later); `root` was an edge *type* wearing a
  // direction's clothes, and it wore the same glyph as the root lens while
  // promising something narrower. So the rail drops it and the lens adopts it:
  // the curated edges are pinned above the corpus families, marked as
  // hand-verified. One glyph, one place, one count. (See `RootLensTrigger`.)
  const railChips = useMemo(() => chips.filter((c) => c.direction !== "root"), [chips]);
  // A link's `?open=lookalikes` or `?open=roots`, held until the verse it names
  // is selected and its data has arrived. It is placed after the effect above
  // that closes the roots on every new selection, so on the render that
  // selects the verse, the close runs first and this opens it after. A link
  // for a verse with no look-alikes simply opens the verse; the reader moving
  // to another verse drops the request.
  const [pendingSheet, setPendingSheet] = useState<{
    panel: "lookalikes" | "roots";
    key: string;
  } | null>(null);
  useEffect(() => {
    if (!pendingSheet || !selectedKey) return;
    if (selectedKey !== pendingSheet.key) return setPendingSheet(null);
    // Both lookups exist before the verse's surah has loaded, so "ready" is
    // that surah's own file having arrived. One that never arrives leaves the
    // request waiting, harmlessly, until the reader moves.
    const surah = parseAyahKey(selectedKey)?.surah ?? 0;
    if (pendingSheet.panel === "roots") {
      if (!rootAyahShards.has(surah)) return;
      setRootsOpen(true);
    } else {
      if (!shards.has(surah) && !(PITCH && pitchSurahs.has(surah))) return;
      const first = railChips[0];
      if (first) setOpenDirection(first.direction);
    }
    setPendingSheet(null);
  }, [pendingSheet, selectedKey, rootAyahShards, shards, pitchSurahs, railChips]);
  const curatedRoots = useMemo(
    () => chips.find((c) => c.direction === "root")?.edges ?? [],
    [chips],
  );

  // The highlighted range's merged hop list (spec §9): every member's edges,
  // deduped by (target, type), hifz-ordered, each row naming its source ayah.
  const rangeHops = useMemo(
    () => (adjacency && selectedRange ? adjacency.hopsForRange(selectedRange) : []),
    [adjacency, selectedRange],
  );

  // Whether a hop target's page is vendored (drives the disabled state, Plan Q6).
  const canHop = useCallback(
    (toKey: string) => (resolver ? resolver.resolve(toKey) !== null : false),
    [resolver],
  );

  // The roads out of the open note: the edges the rail shows, plus The Study
  // Quran's own cross-references, which the rail leaves out because they are
  // linked by meaning, not wording (`withBookRefs`). Handed to the drawer so the
  // reading and the navigation live on one surface instead of the note covering
  // a rail.
  const commentaryRoads = useMemo(() => {
    if (!PITCH || !adjacency || !commentaryOpen || !selectedKey) return [];
    const at = parseAyahKey(selectedKey);
    const book = at ? pitchSurahs.get(at.surah)?.shard[String(at.ayah)] : undefined;
    return withBookRefs(adjacency.hopsForKey(selectedKey), book);
  }, [adjacency, commentaryOpen, selectedKey, pitchSurahs]);

  // Pages to keep mounted: the current page + the selection's vendored hop
  // targets (and the open note's), so a hop's tween has both endpoints ready
  // (spec DOM budget).
  const mountedPages = useMemo(() => {
    const pages = new Set<number>([page]);
    const hops = adjacency && selectedKey ? adjacency.hopsForKey(selectedKey) : [];
    for (const edge of [...hops, ...rangeHops, ...commentaryRoads]) {
      const loc = resolver?.resolve(edge.to);
      if (loc) pages.add(loc.page);
    }
    return [...pages];
  }, [page, adjacency, selectedKey, rangeHops, commentaryRoads, resolver]);

  // Prefetch shards for every surah visible on a mounted page, so the rail is
  // ready the moment an ayah is tapped.
  useEffect(() => {
    if (!manifest) return;
    for (const p of manifest.pages) {
      if (!mountedPages.includes(p.page)) continue;
      for (const poly of p.polygons) ensureShard(poly.surah);
    }
  }, [manifest, mountedPages, ensureShard]);

  // …and for the surahs the rail can send you to, which is a different set and
  // the one that matters for the hop (`docs/performance.md` ⑧). The loop above is
  // keyed on *pages*, so it fetches what is on screen; a mutashabihat edge is
  // by nature a resemblance across the mus'haf and usually points into another
  // surah entirely. The shard for the place the reader is one tap from going
  // was therefore the one shard nobody asked for, and the rail at the far end
  // of the hop drew empty until a fetch that started on arrival came back.
  //
  // `hopsForKey` and `rangeHops` are already computed for the rail, so this
  // costs the walk and nothing else; `ensureShard` is once-per-session and
  // remembers misses, so a shard that is already in flight or already failed
  // is not asked for twice. Targets on unvendored pages are prefetched too,
  // deliberately: `canHop` disables the chip today, but the shard is what makes
  // the *count* on the far side truthful the day Loop 4b vendors that page, and
  // filtering by `resolver` here would put the inventory's shape into a cache
  // decision where it does not belong.
  useEffect(() => {
    if (!adjacency) return;
    const hops = selectedKey ? adjacency.hopsForKey(selectedKey) : [];
    for (const edge of [...hops, ...rangeHops]) {
      const surah = parseAyahKey(edge.to)?.surah;
      if (surah) ensureShard(surah);
    }
  }, [adjacency, selectedKey, rangeHops, ensureShard]);

  /* ---- the tajweed skin (Loop 6a, spec §8) ------------------------------ */

  // Not persisted, deliberately: the skin is labelled beta until a hafiz signs
  // off, and a beta layer that silently restores itself on every cold start is
  // one a reader can forget they enabled. Opting in each session is the price of
  // shipping it early.
  const [skin, setSkin] = useState<SkinId>("plain");
  // Whether the page bar spreads apart under the pointer — the graduated fisheye
  // (option B, docs/decisions/page-bar.md). Persisted, and default on: it is the
  // behaviour the decision chose, so a fresh device gets it, and the colophon's
  // switch is only there to turn it off. Unlike the beta skin above, this is not
  // a layer a reader can be misled by — it changes how a control feels, not what
  // the mus'haf says — so restoring it on a cold start is a convenience, not a risk.
  const [fisheye, setFisheye] = useState<boolean>(() => fisheyeEnabled());
  const toggleFisheye = useCallback(() => {
    setFisheye((on) => {
      const next = !on;
      rememberFisheye(next);
      return next;
    });
  }, []);
  // How a page turn looks (docs/decisions/page-turn-curl.md, decided 2026-09-26):
  // the flat seam unless this device picked the curl or the shadow in settings.
  const [turnStyle, setTurnStyle] = useState<TurnStyle>(() => savedTurnStyle());
  const chooseTurnStyle = useCallback((style: TurnStyle) => {
    rememberTurnStyle(style);
    setTurnStyle(style);
  }, []);
  // What a tap and a hold on a verse do (docs/design/verse-tap-and-hold.md; a
  // setting since 2026-10-01, C unless this device picked another).
  const [verseGestures, setVerseGestures] = useState<VerseGestures>(() => savedVerseGestures());
  const chooseVerseGestures = useCallback((choice: VerseGestures) => {
    rememberVerseGestures(choice);
    setVerseGestures(choice);
  }, []);
  // How a note draws the parts it can be about (docs/design/scoped-notes.md,
  // step 7; a setting since 2026-10-03, the lines on their side by default).
  const [scopeLook, setScopeLook] = useState<ScopeLook>(() => savedScopeLook());
  const chooseScopeLook = useCallback((look: ScopeLook) => {
    rememberScopeLook(look);
    setScopeLook(look);
  }, []);
  // Where the page tools sit on the wide layout (docs/design/notes-style-toolbar.md,
  // ①; every home a setting since 2026-10-05, today's strip by default). Down
  // the side only where the margin holds it, else the bottom row's button.
  const [penHome, setPenHome] = useState<PenHome>(() => savedPenHome());
  const choosePenHome = useCallback((home: PenHome) => {
    rememberPenHome(home);
    setPenHome(home);
  }, []);
  const sideRoom = useSideRoom(desktop && penHome === "side");
  // While the margin is still unmeasured nothing is drawn, so the rail never
  // flashes over a book too wide for it.
  const penAt: PenHome | null = penHome !== "side" ? penHome : sideRoom === null ? null : sideRoom ? "side" : "bottom";
  // Full screen: every bar hidden, the page alone (the same note, all options).
  const [full, setFull] = useState(false);
  // The verse a hold opened the small menu on (option C), and where it is.
  const [verseMenu, setVerseMenu] = useState<{ key: string; around: DOMRect } | null>(null);
  const closeVerseMenu = useCallback(() => setVerseMenu(null), []);
  // The same small menu, for a hold on a printed corner (PLAN 27).
  const [cornerMenu, setCornerMenu] = useState<{ which: Corner; page: number; around: DOMRect } | null>(null);
  // A label's list of notes, opened from its menu, and the box of a note that
  // holds no verse (one made from a label), which has no pin to open it by.
  const [labelNotes, setLabelNotes] = useState<{ head: string; scope: NoteScope; around: DOMRect } | null>(null);
  const [labelNoteId, setLabelNoteId] = useState<string | null>(null);
  const [labelNoteFresh, setLabelNoteFresh] = useState(false);
  const closeCornerMenu = useCallback(() => setCornerMenu(null), []);
  // "Play to" is waiting for the verse to stop at: the verse it starts from.
  const playFromRef = useRef<string | null>(null);
  // The highlighter's pen (docs/design/highlight-texture-options.md ②, settled
  // 2026-09-30): green until this device picks another in the tools bar. It
  // colours the passage the highlighter paints.
  const [pen, setPen] = useState<Pen>(() => savedPen());
  useEffect(() => applyPen(pen), [pen]);
  const choosePen = useCallback((next: Pen) => {
    rememberPen(next);
    setPen(next);
  }, []);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tajweedShards, setTajweedShards] = useState<ReadonlyMap<number, TajweedShard>>(
    new Map(),
  );
  const requestedTajweed = useRef(new Set<number>());
  // The vocabulary the shards are written in. Separate state from the shards
  // because it is fetched once and they are fetched per surah — and because the
  // colour settings surface needs it whether or not any shard has landed: it
  // renders one row per rule, so it needs the rule list, not the spans.
  const [tajweedVocabulary, setTajweedVocabulary] = useState<TajweedVocabulary | null>(null);

  // Same rebuild-on-set pattern as `adjacency` and `roots`: a pure index over
  // whatever has landed, so a shard arriving late re-paints the page without any
  // imperative poke at the stage.
  const tajweed = useMemo(() => {
    if (!manifest) return null;
    const lens = new Tajweed(manifest.edition, tajweedVocabulary ?? undefined);
    for (const [surah, shard] of tajweedShards) lens.addShard(surah, shard);
    return lens;
  }, [manifest, tajweedShards, tajweedVocabulary]);

  // Fetched the moment the skin goes on, ahead of any shard: a shard whose rule
  // ids nothing can interpret paints nothing, so this is the round trip that
  // actually gates the first colour. Once, per session, ~500 bytes.
  useEffect(() => {
    if (!manifest || skin !== "tajweed" || tajweedVocabulary) return;
    void loadTajweedVocabulary(manifest.edition).then((v) => {
      if (v) setTajweedVocabulary(v);
    });
  }, [manifest, skin, tajweedVocabulary]);

  // Fetched only once the skin is actually on, and only for surahs on screen —
  // all 114 shards are ~240KB gzipped, and a reader who never opens the skin
  // should not pay a byte of it.
  useEffect(() => {
    if (!manifest || skin !== "tajweed") return;
    for (const p of manifest.pages) {
      if (!mountedPages.includes(p.page)) continue;
      for (const poly of p.polygons) {
        const surah = poly.surah;
        if (requestedTajweed.current.has(surah)) continue;
        requestedTajweed.current.add(surah);
        void loadTajweedShard(manifest.edition, surah).then((shard) => {
          if (shard) setTajweedShards((m) => new Map(m).set(surah, shard));
        });
      }
    }
  }, [manifest, mountedPages, skin]);

  // Every ayah key on the page in view, so the legend can say what is actually
  // in front of the reader rather than reciting seven colours in the abstract.
  const tajweedCounts = useMemo(() => {
    if (!tajweed) return new Map();
    const keys: string[] = [];
    for (const p of manifest?.pages ?? []) {
      if (p.page !== page) continue;
      for (const poly of p.polygons) keys.push(poly.key);
    }
    return tajweed.countsForKeys(keys);
  }, [tajweed, manifest, page]);

  // The selected ayah's rules, spelled out as text — the channel that works
  // with no colour vision at all.
  const tajweedSelection = useMemo(() => {
    if (!tajweed || !selectedKey) return null;
    return {
      label: t.ayahLabel(selectedKey) ?? selectedKey,
      marks: tajweed.marksForKey(selectedKey),
    };
  }, [tajweed, selectedKey, t]);

  // Every vendored page in order, each with an anchor ayah (its first polygon).
  // The stage navigates to *keys*, not to pages, so turning a page means asking
  // for the first ayah on it — which is also where reading resumes.
  const pageTurns = useMemo(() => {
    const anchors = new Map<number, string>();
    for (const p of manifest?.pages ?? []) {
      const first = p.polygons[0];
      if (first) anchors.set(p.page, first.key);
    }
    return { pages: [...anchors.keys()].sort((a, b) => a - b), anchors };
  }, [manifest]);

  // How long the book is, for the page bar's track. `EditionMeta.pages` is the
  // *print's* own count (604 for the Madani mus'haf) and is absent for editions
  // nobody has counted — in which case the bar spans what is vendored rather
  // than a plausible-looking guess, because a track that runs past the end of a
  // mus'haf is a worse lie than a short one.
  const totalPages = useMemo(() => {
    const declared = manifest ? editionMeta(manifest.edition)?.pages : undefined;
    return declared ?? pageTurns.pages[pageTurns.pages.length - 1] ?? 1;
  }, [manifest, pageTurns]);

  // The surah at each page's head — its anchor ayah's surah, the same
  // `polygons[0]` the turn anchors above use — built once so a drag, which asks
  // per value, reads a map rather than re-scanning the manifest each time.
  const surahByPage = useMemo(() => {
    const byPage = new Map<number, number>();
    for (const pm of manifest?.pages ?? []) {
      const surah = pm.polygons[0]?.surah;
      if (surah !== undefined) byPage.set(pm.page, surah);
    }
    return byPage;
  }, [manifest]);

  // The juz already *running* onto each page — the lowest juz with any ayah on
  // it — computed once, the same reason `juzStarts` is a table and not a lookup:
  // the caller is the page bar's scrub readout, asked for every value a dragged
  // thumb passes over, and `juzOfPage` walks every polygon on a page to answer.
  // Paid at load, an index per scrub after. On the four pages a juz seam cuts,
  // this is the juz *above* the seam; the juz that opens *below* it is
  // `juzStarts`, and naming a boundary page for both is the bar's decided answer.
  const runningByPage = useMemo(() => {
    const byPage = new Map<number, number>();
    for (const pm of manifest?.pages ?? []) {
      let lowest: number | null = null;
      for (const poly of pm.polygons) {
        const juz = juzOf(poly.surah, poly.ayah);
        if (lowest === null || juz < lowest) lowest = juz;
      }
      if (lowest !== null) byPage.set(pm.page, lowest);
    }
    return byPage;
  }, [manifest]);

  // Land on a page. The single navigation path for every way of turning one —
  // the arrow keys, the page bar's edge buttons, and letting go of its slider —
  // so there is one place where "the stage moved" and "the header changed" can
  // get out of step, rather than three. A *turn* moves your place: the
  // highlighted ayah and the hop trail belonged to the page you left, so a
  // landed turn clears them and the address falls back to the page's own anchor
  // (`p585`). A *jump* — scrub, juz, deep link — is a deliberate move to a page
  // and never carries a selection of its own, so it needs no clearing.
  //
  // `said` is what to announce on arrival. The slider passes a different string
  // when it had to snap, because a landing the reader did not ask for has to be
  // named out loud.
  //
  // `turn` says which of the two verbs this is. Stepping is a *turn*: one leaf's
  // worth of movement, and the fold that crosses says what was between the two
  // pages — a crease, a gap, or a hole where this build skipped what the print
  // has. Everything else — a scrub across half the mus'haf, a deep link, a hop —
  // is a *jump*, and a jump draws no fold at all, because a band crossing the
  // page would assert an adjacency that the reader did not travel through
  // (docs/design/page-transition.md §3.1).
  const goToPage = useCallback(
    (next: number, said?: string, turn = false) => {
      // Against the destination, not the visible page: two quick arrow presses
      // must be two steps, and the second one arrives while the first is still
      // in the air.
      if (next === pendingPageRef.current) return;
      const anchor = pageTurns.anchors.get(next);
      // No anchor means no vendored page — refuse rather than navigate to a
      // blank stage. Callers pick from `pageTurns.pages`, so this is the belt
      // to that braces.
      if (!anchor) return;
      setOpenDirection(null);
      pendingPageRef.current = next;
      announce(said ?? t.pageN(next));
      if (turn) {
        // The header follows the *landing*, not the request: `page` drives the
        // page chip, the leaf's resting edge and the announcer's next line, and
        // a turn that stalls or never arrives must leave all three saying where
        // the reader still is.
        void stage.turnTo(next).then((landed) => {
          if (pendingPageRef.current !== next) return; // a newer turn owns it
          if (landed) {
            setPage(next);
            // The place you were holding was on the page you just left. Drop it
            // as the leaf lands — atomically with the header — so the highlight,
            // the back-beads and the ayah in the URL all leave together and the
            // address becomes the page you are now on.
            setSelectedKey(null);
            setSelectedRange(null);
            setTrail([]);
          } else pendingPageRef.current = pageRef.current;
        });
        return;
      }
      setPage(next);
      // zoom 1 = the page as it sits, not a hop's close framing; no pulse,
      // because nothing here was selected.
      void stage.navigateTo(anchor, { pulse: false, zoom: 1 });
    },
    [pageTurns, announce, t],
  );

  // Bookmarks (docs/decisions/bookmark-fold.md, bookmark-admin.md): ribbons on
  // the page, a drawer per ribbon, and the tidy-up in the page map. Every change
  // is one core rule, then one whole-set write, then one announced line.
  const { bookmarks, commit: commitBookmarks } = useBookmarks(announce, t.bmNotSaved);
  // The red seam: where the reader left off, following the last page they stayed on.
  const seamPage = useSeam(page);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const drawerBookmark = bookmarks.find((b) => b.id === drawerId) ?? null;

  /** Where a bookmark dropped on `p` points: the selected ayah if it is on that page, else the page's first. */
  const bookmarkTarget = useCallback(
    (p: number): { key: string; page: number } | null => {
      if (!resolver) return null;
      if (selectedKey && resolver.resolve(selectedKey)?.page === p) return { key: selectedKey, page: p };
      const first = resolver.keysOnPage(p)[0];
      return first ? { key: first, page: p } : null;
    },
    [resolver, selectedKey],
  );

  // Where "move it" would put the open ribbon: the selected ayah when there is
  // one it is not already on, else the page on the stage when it sits elsewhere.
  // Null when neither would change anything, and the drawer then offers no move.
  const selectedAt = selectedKey && resolver ? resolver.resolve(selectedKey)?.page : undefined;
  const moveTarget =
    drawerBookmark && selectedKey && selectedAt !== undefined && selectedKey !== drawerBookmark.key
      ? { key: selectedKey, page: selectedAt }
      : drawerBookmark && drawerBookmark.page !== page
        ? bookmarkTarget(page)
        : null;

  const dropOn = useCallback(
    (p: number, key?: string) => {
      const at = key ? { key, page: p } : bookmarkTarget(p);
      if (!at) return;
      const name = t.ayahLabel(at.key) ?? t.pageN(p);
      const next = dropBookmark(bookmarks, { ...at, name }, Date.now());
      const made = next[next.length - 1]!;
      commitBookmarks(next, t.bmDropped(made.name));
      setFreshId(made.id);
      setDrawerId(made.id);
    },
    [bookmarkTarget, bookmarks, commitBookmarks, t],
  );

  // The page toolbar's tool (docs/design/page-toolbar-plan.md, step 1). The ref
  // is for the tap handlers below: a bookmark tap puts the tool down at once,
  // and the click that follows the same tap must already see it down.
  const [tool, setToolState] = useState<PageTool>("select");
  const toolRef = useRef<PageTool>("select");
  // A tool locked on (a double-click, or a long press on a phone) is not put
  // down after one use, so a run of notes costs one tap each. Picking any tool,
  // Escape, or a click on the locked one puts it down.
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const chooseTool = useCallback(
    (next: PageTool, lock = false) => {
      const keep = lock && next !== "select";
      if (toolRef.current === next && lockedRef.current === keep) return;
      toolRef.current = next;
      lockedRef.current = keep;
      setToolState(next);
      setLocked(keep);
      announce(keep ? t.toolLocked(toolName(t, next)) : t.toolOn(toolName(t, next)));
    },
    [announce, t],
  );
  /** After a tool used once: back to Select, unless the reader locked it on. */
  const putDownAfterUse = useCallback(() => {
    if (!lockedRef.current) chooseTool("select");
  }, [chooseTool]);
  // The bookmark tool is used once and put down: nobody drops five bookmarks in
  // a row (the plan's table, "after one use").
  const dropWithTool = useCallback(
    (p: number, key?: string) => {
      putDownAfterUse();
      dropOn(p, key);
    },
    [putDownAfterUse, dropOn],
  );

  const openFromShelf = useCallback(
    (id: string) => {
      const b = bookmarks.find((x) => x.id === id);
      if (!b) return;
      setRevisionOpen(false);
      commitBookmarks(openBookmark(bookmarks, id, Date.now()), t.bmOpen(b.name, b.page));
      goToPage(b.page, t.bmOpen(b.name, b.page));
    },
    [bookmarks, commitBookmarks, goToPage, t],
  );

  // Notes (docs/design/page-toolbar-plan.md, step 2): the note tool drops a
  // pin at a word and opens a box beside it; the pin stays and reopens the box.
  // Kept on the device beside the bookmarks, and carried in the same saved file
  // (note-persistence = B, note-export-shape = C).
  const {
    notes,
    scoped,
    commit: commitNotes,
    commitScoped,
    loadFile: loadNotesFile,
  } = useNotes(announce, t.bmNotSaved);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const openNote = notes.find((n) => n.id === noteOpenId) ?? null;
  // A pin just made by the note, harakat or word tool: its box offers the
  // notes it could join instead (scoped-notes-note-tool = C). Once it has
  // joined one, `joined` holds the notes as they were, for its Undo.
  const [freshNoteId, setFreshNoteId] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ before: readonly ScopedNote[]; freshId: string; pin: string } | null>(null);
  // Which page of this print a verse is on, so a note scoped to a page is offered only there.
  const pageOfKey = useCallback((key: string) => resolver?.resolve(key)?.page ?? null, [resolver]);
  /** The note a pin belongs to: its first pin carries the note's own id, the rest the id and the verse. */
  const noteOfPin = (pin: string) => scoped.find((s) => s.id === pin || pin.startsWith(`${s.id}~`)) ?? null;
  const scopeName = useCallback(
    (scope: NoteScope): string =>
      scope.type === "ayah"
      ? (t.ayahLabel(scope.key) ?? scope.key)
      : scope.type === "word"
      ? t.noteWordOf(t.ayahLabel(scope.key) ?? scope.key)
      : scope.type === "harakah"
      ? t.noteHarakahOf(t.ayahLabel(scope.key) ?? scope.key)
      : scope.type === "page"
      ? t.pageN(scope.page)
      : scope.type === "juz"
        ? t.juzN(scope.juz)
        : scope.type === "hizb"
          ? t.hizbN(scope.hizb)
          : scope.type === "surah"
            ? t.surahName(scope.surah)
            : t.noteWhole,
    [t],
  );
  // The page map's list of notes, the one worked on last first.
  const shelfItem = useCallback(
    (n: ScopedNote) => ({
      id: n.id,
      title: noteTitle(n) || t.noteUntitled,
      about: `${scopeName(n.scope)}${t.sep}${t.noteVerses(n.verses.length)}`,
    }),
    [t, scopeName],
  );
  const noteShelf = useMemo(
    () => [...scoped].sort((a, b) => b.usedAt - a.usedAt || a.id.localeCompare(b.id)).map(shelfItem),
    [scoped, shelfItem],
  );
  // The dot by a verse's number, for a verse in a note with no pin on it
  // (scoped-notes-verse-mark = A), and the list of its notes a tap on it opens.
  const verseDots = useMemo(() => countVerseDots(scoped), [scoped]);
  // The red mark by a verse the reader's memory jumped away from
  // (confusion-jumps, step 3): how many different verses it went to.
  const {
    confusions,
    device,
    commit: commitConfusions,
    loadFile: loadConfusionsFile,
  } = useConfusions(announce, t.bmNotSaved);
  const confusionMarks = useMemo(() => countConfusionMarks(confusions), [confusions]);
  // And the smaller one at the next pause sign after where each jump left
  // (step 8). The page knows where its pause signs are; the jumps stay here.
  const waslMarksOf = useCallback(
    (waslOf: (key: string, seam: number) => number | null) => waslMarks(confusions, waslOf),
    [confusions],
  );
  // The Jump tool (confusion-jumps, step 4). A drag let go away from any verse
  // asks where it went (`jumpAsking`), and "Another verse…" in that list hands
  // the question to the go-to box (`jumpNaming`). A jump just marked waits in
  // `jumpUndo` for its Undo, which takes back only that change: a time added,
  // a record deleted, a destination said.
  const [jumpAsking, setJumpAsking] = useState<{ from: JumpEnd; at: { top: number; bottom: number; x: number } } | null>(null);
  const [jumpNaming, setJumpNaming] = useState<JumpEnd | null>(null);
  // `kept` marks a dismissal, which the page map's Bring back can also take back.
  const [jumpUndo, setJumpUndo] = useState<{
    said: string;
    undo: (set: readonly Confusion[]) => Confusion[];
    kept?: boolean;
  } | null>(null);
  // A "not sure yet" jump being named from its row in the list: the next
  // destination picked fills it in rather than marking a new jump.
  const [jumpRenaming, setJumpRenaming] = useState<string | null>(null);
  const saveJump = useCallback(
    (from: JumpEnd, to: string | null) => {
      setJumpAsking(null);
      setJumpNaming(null);
      setJumpRenaming(null);
      const now = Date.now();
      const unsure = jumpRenaming ? confusions.find((c) => c.id === jumpRenaming) : undefined;
      if (unsure && to) {
        // The records it touches, as they were, to put back on Undo.
        const before = confusions.filter((c) => c.from.key === unsure.from.key);
        const next = setDestination(confusions, unsure.id, { key: to }, now);
        const mine = next.find((c) => c.from.key === unsure.from.key && c.to?.key === to);
        const said = t.jumpMarked(unsure.from.key, to, mine?.times.length ?? 1);
        commitConfusions(next, said);
        setJumpUndo({ said, undo: (s) => [...s.filter((c) => !before.some((b) => b.id === c.id)), ...before] });
        return;
      }
      const next = markConfusion(confusions, from, to ? { key: to } : null, now, device?.id ?? "");
      const mine = to
        ? next.find((c) => c.from.key === from.key && c.to?.key === to)
        : next.find((c) => !confusions.some((x) => x.id === c.id));
      if (!mine) return;
      const said = to ? t.jumpMarked(from.key, to, mine.times.length) : t.jumpMarkedUnsure(from.key);
      commitConfusions(next, said);
      setJumpUndo({ said, undo: (s) => removeLastTime(s, mine.id, Date.now()) });
    },
    [confusions, device, commitConfusions, t, jumpRenaming],
  );
  const undoJump = () => {
    if (!jumpUndo) return;
    commitConfusions(jumpUndo.undo(confusions), "");
    setJumpUndo(null);
  };
  const endJumpUndo = useCallback(() => setJumpUndo(null), []);
  // The page map lists a dismissed jump with its own Bring back, so once it
  // opens the Undo bar for that dismissal steps aside instead of sitting over
  // the very list it points to.
  useEffect(() => {
    if (revisionOpen) setJumpUndo((u) => (u?.kept ? null : u));
  }, [revisionOpen]);
  const onJump = useCallback(
    (jump: { from: JumpEnd; to: string | null; at: { top: number; bottom: number; x: number } }) => {
      if (jump.to) saveJump(jump.from, jump.to);
      else setJumpAsking({ from: jump.from, at: jump.at });
    },
    [saveJump],
  );
  const closeJumpAsking = useCallback(() => {
    setJumpAsking(null);
    setJumpRenaming(null);
  }, []);
  // A jump said from a verse's menu rather than drawn: the list opens by the
  // verse (or by the menu that was round it), with no seam word to keep.
  const askJumpFrom = useCallback((key: string, around?: DOMRect) => {
    const p = parseAyahKey(key);
    const box =
      around ??
      (p
        ? Array.from(document.querySelectorAll<SVGGraphicsElement>(`[id="verse-${toAbsoluteAyah(p.surah, p.ayah)}"]`))
            .map((el) => el.getBoundingClientRect())
            .find((r) => r.width > 0 && r.height > 0)
        : undefined);
    const at = box
      ? { top: box.top, bottom: box.bottom, x: box.left + box.width / 2 }
      : { top: window.innerHeight / 3, bottom: window.innerHeight / 3, x: window.innerWidth / 2 };
    setJumpAsking({ from: { key }, at });
  }, []);
  // The list a tap on a jump mark opens (confusion-jumps, step 6).
  const [jumpsAt, setJumpsAt] = useState<{ key: string; anchor: { top: number; bottom: number; x: number } } | null>(null);
  const openJumps = useCallback(
    (key: string, anchor: { top: number; bottom: number; x: number }) => setJumpsAt({ key, anchor }),
    [],
  );
  const closeJumps = useCallback(() => setJumpsAt(null), []);
  // The saved arrows on the page (step 10): they stay, faint, or show only
  // while you ask for them, as this device chose in settings.
  const [arrowShowing, setArrowShowing] = useState<ArrowShowing>(() => savedArrowShowing());
  const chooseArrowShowing = useCallback((choice: ArrowShowing) => {
    rememberArrowShowing(choice);
    setArrowShowing(choice);
  }, []);
  const allArrows = useMemo(() => jumpArrows(confusions), [confusions]);
  const shownArrows = useMemo(
    () => arrowsShown(allArrows, arrowShowing, { toolOn: tool === "jump", open: jumpsAt?.key ?? null }),
    [allArrows, arrowShowing, tool, jumpsAt],
  );
  // A dismissed jump leaves no mark, so it is listed apart, folded, with a
  // way to bring it back.
  const [jumpShelf, jumpsDismissed] = useMemo(() => {
    const item = (c: Confusion) => ({
      id: c.id,
      from: c.from.key,
      to: c.to?.key ?? null,
      times: c.times.length,
      lastAt: c.times[c.times.length - 1]!.at,
      beaten: c.state === "beaten",
    });
    return [allConfusions(confusions).map(item), dismissedConfusions(confusions).map(item)];
  }, [confusions]);
  const jumpRows = useMemo(
    () =>
      jumpsAt
        ? confusionsFrom(confusions, jumpsAt.key)
            .filter((c) => c.state !== "dismissed")
            .map((c) => {
              // Compare is offered only where the two verses share a run of
              // words to line up; a swapped order has none.
              const found = c.to ? adjacency?.hopsForKey(jumpsAt.key).find((h) => h.to === c.to!.key) : undefined;
              const edge = found && wordDiff(found, jumpsAt.key) ? found : undefined;
              return {
                id: c.id,
                to: c.to?.key ?? null,
                label: c.to ? (t.ayahLabel(c.to.key) ?? c.to.key) : t.jumpNotSure,
                times: c.times.length,
                lastAt: c.times[c.times.length - 1]!.at,
                beaten: c.state === "beaten",
                ...(edge ? { edge } : {}),
              };
            })
        : [],
    [jumpsAt, confusions, adjacency, t],
  );
  const againJump = (id: string) => {
    const c = confusions.find((x) => x.id === id);
    if (!c?.to) return;
    const next = againConfusion(confusions, id, Date.now(), device?.id ?? "");
    const said = t.jumpMarked(c.from.key, c.to.key, c.times.length + 1);
    commitConfusions(next, said);
    setJumpUndo({ said, undo: (s) => removeLastTime(s, id, Date.now()) });
  };
  const beatJump = (id: string, beaten: boolean) =>
    commitConfusions(setConfusionState(confusions, id, beaten ? "beaten" : "sometimes", Date.now()), "");
  const dismissJump = (id: string) => {
    const c = confusions.find((x) => x.id === id);
    if (!c) return;
    const said = c.to ? t.jumpDismissed(c.from.key, c.to.key) : t.jumpDismissedUnsure(c.from.key);
    commitConfusions(setConfusionState(confusions, id, "dismissed", Date.now()), said);
    if (jumpRows.length <= 1) closeJumps();
    setJumpUndo({ said, undo: (s) => setConfusionState(s, id, c.state, Date.now()), kept: true });
  };
  const bringBackJump = (id: string) =>
    commitConfusions(setConfusionState(confusions, id, "sometimes", Date.now()), "");
  const deleteJump = (id: string) => {
    const c = confusions.find((x) => x.id === id);
    if (!c) return;
    const said = c.to ? t.jumpDeleted(c.from.key, c.to.key) : t.jumpDeletedUnsure(c.from.key);
    commitConfusions(removeConfusion(confusions, id), said);
    // The last row gone, the list has nothing left to say.
    if (jumpRows.length <= 1) closeJumps();
    setJumpUndo({ said, undo: (s) => restoreConfusion(s, c) });
  };
  const [verseNotesAt, setVerseNotesAt] = useState<{ key: string; anchor: { top: number; bottom: number; x: number } } | null>(null);
  const openVerseNotes = useCallback(
    (key: string, anchor: { top: number; bottom: number; x: number }) => setVerseNotesAt({ key, anchor }),
    [],
  );
  const closeVerseNotes = useCallback(() => setVerseNotesAt(null), []);
  const verseNotes = useMemo(() => {
    if (!verseNotesAt) return [];
    const byId = new Map(noteShelf.map((s) => [s.id, s]));
    return notesOfVerse(scoped, verseNotesAt.key).flatMap((n) => byId.get(n.id) ?? []);
  }, [verseNotesAt, scoped, noteShelf]);
  const noteChoices = useMemo(() => {
    if (!openNote || openNote.id !== freshNoteId || joined) return null;
    const s = suggestNotes(
      scoped.filter((n) => n.id !== freshNoteId),
      openNote.key,
      pageOfKey,
    );
    if (s.offered.length === 0) return null;
    const named = (n: ScopedNote) => ({ id: n.id, title: noteTitle(n) || t.noteUntitled });
    return { offered: s.offered.map(named), more: s.more.map(named) };
  }, [openNote, freshNoteId, joined, scoped, pageOfKey, t]);
  const openFresh = useCallback((id: string) => {
    setJoined(null);
    setFreshNoteId(id);
    setNoteOpenId(id);
  }, []);
  const joinOpenNote = (intoId: string) => {
    const n = openNote;
    if (!n) return;
    const got = joinNote(scoped, n.id, intoId, Date.now(), pageOfKey);
    if (!got) return;
    commitScoped(got.notes, "");
    setJoined({ before: scoped, freshId: n.id, pin: got.pin });
    setNoteOpenId(got.pin);
  };
  // What the open pin's note is about, and the parts it could be about instead
  // (scoped-notes step 7): every part that holds its first verse, narrowest
  // first. Widening always works; narrowing past a verse it holds names that
  // verse and changes nothing, since the app never drops a verse to make a fit.
  // The verse the choices are drawn around: the note's first, or for a note
  // with no verse yet, the page open now when it lies inside, else where its part starts.
  const aboutAnchor = (of: (typeof scoped)[number]): string | null => {
    if (of.verses[0]) return of.verses[0].key;
    const here = resolver?.keysOnPage(page)[0] ?? null;
    if (!here || scopeContains(of.scope, here, pageOfKey)) return here;
    const edition = parseAyahKey(here)?.edition;
    const s = of.scope;
    if (s.type === "ayah" || s.type === "word" || s.type === "harakah") return s.key;
    if (s.type === "page") return resolver?.keysOnPage(s.page)[0] ?? null;
    const [surah, ayah] =
      s.type === "juz" ? JUZ_STARTS[s.juz - 1]! : s.type === "hizb" ? HIZB_STARTS[s.hizb - 1]! : s.type === "surah" ? [s.surah, 1] : [1, 1];
    return edition ? formatAyahKey(edition, surah, ayah) : null;
  };
  const aboutOf = (of: (typeof scoped)[number] | null): NoteAbout | null => {
    const key = of ? aboutAnchor(of) : null;
    const ref = key ? parseAyahKey(key) : null;
    if (!of || !key || !ref) return null;
    const page = pageOfKey(key);
    // The three narrowest need a verse to be part of, and a word or a harakah
    // needs the pin to be on one; without that they stand greyed in the pyramid.
    const s = of.scope;
    const spot = of.verses[0]?.spot;
    const verse = of.verses[0]?.key ?? (s.type === "ayah" || s.type === "word" || s.type === "harakah" ? s.key : null);
    const word = s.type === "word" || s.type === "harakah" ? s.word : (spot?.word ?? null);
    const mark = s.type === "harakah" ? s.mark : spot?.onHarakah && typeof spot.mark === "number" ? spot.mark : null;
    const tiers: [NoteScope | null, string, string][] = [
      [verse && word !== null && mark !== null ? { type: "harakah", key: verse, word, mark } : null, "H", t.noteTierHarakah],
      [verse && word !== null ? { type: "word", key: verse, word } : null, "W", t.noteTierWord],
      [verse ? { type: "ayah", key: verse } : null, "A", t.noteTierAyah],
      [page !== null ? { type: "page", edition: ref.edition, page } : null, "P", ""],
      [{ type: "hizb", hizb: hizbOf(ref.surah, ref.ayah) }, "Z", ""],
      [{ type: "juz", juz: juzOf(ref.surah, ref.ayah) }, "J", ""],
      [{ type: "surah", surah: ref.surah }, "S", ""],
      [{ type: "whole" }, "Q", t.noteTierWhole],
    ];
    // The same part has one id however its fields were ordered when it was saved.
    const idOf = (x: NoteScope) => JSON.stringify(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)));
    const parts = tiers.flatMap(([x]) => (x ? [x] : []));
    const narrow = s.type === "ayah" || s.type === "word" || s.type === "harakah";
    return {
      name: scopeName(s),
      ...(narrow ? { short: tiers.find(([x]) => x?.type === s.type)?.[2] ?? scopeName(s) } : {}),
      count: of.verses.length,
      current: idOf(s),
      options: tiers.flatMap(([x, letter, short], i) =>
        x
          ? [{ id: idOf(x), name: scopeName(x), short: short || scopeName(x), letter }]
          : i < 3
            ? [{ id: `none-${letter}`, name: short, short, letter, disabled: true }]
            : [],
      ),
      onPick: (id) => {
        const scope = parts.find((x) => idOf(x) === id);
        if (!scope || id === idOf(of.scope)) return null;
        const got = changeScope(scoped, of.id, scope, Date.now(), pageOfKey);
        if (!got.ok) {
          const [one] = got.outside;
          return t.noteOutside(t.ayahLabel(one!) ?? one!, got.outside.length, scopeName(scope));
        }
        commitScoped(got.notes, t.noteAboutNow(scopeName(scope)));
        return null;
      },
    };
  };
  const openAbout = aboutOf(openNote ? noteOfPin(openNote.id) : null);
  const undoJoin = () => {
    if (!joined) return;
    commitScoped(joined.before, "");
    openFresh(joined.freshId);
  };
  // A deleted note (or a cleared mistake) waits here for a few seconds so
  // "Undo" can put it back; `said` and `restored` are what the bar and the undo say.
  // A verse taken out of a note of several keeps `owner`, the note as it was, so
  // Undo puts the verse back in that note rather than making it a note of its own.
  const [deletedNote, setDeletedNote] = useState<{
    /** The pin taken out; none when the note deleted held no verse. */
    note?: Note;
    said: string;
    restored: string;
    owner?: ScopedNote;
    /** A note with no verse, deleted whole: Undo puts it back as it was. */
    whole?: ScopedNote;
  } | null>(null);

  const saveBookmarkFile = useCallback(() => {
    // The file carries the notes that gather verses and, apart from them, the
    // marked mistakes, which are still the old kind of note, and the jumps.
    const mistakes = notes.filter(isMistake);
    const file = toBookmarkFile(bookmarks, Date.now(), mistakes, [...scoped], confusions);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hifth-bookmarks.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [bookmarks, notes, scoped, confusions]);

  const loadBookmarkFile = useCallback(
    (text: string) => {
      const file = parseBookmarkFile(text);
      if (!file) {
        announce(t.bmLoadBad);
        return;
      }
      const merged = mergeBookmarks(bookmarks, file.bookmarks);
      const newBookmarks = merged.length - bookmarks.length;
      const newNotes = file.notes || file.scopedNotes ? loadNotesFile(file.notes ?? [], file.scopedNotes ?? []) : 0;
      const newJumps = file.confusions ? loadConfusionsFile(file.confusions) : 0;
      // Say what the file brought; "nothing new" only when it brought nothing at all.
      const parts = [
        ...(newBookmarks > 0 ? [t.bmLoaded(newBookmarks)] : []),
        ...(newNotes > 0 ? [t.noteLoaded(newNotes)] : []),
        ...(newJumps > 0 ? [t.jumpLoaded(newJumps)] : []),
      ];
      commitBookmarks(merged, parts.length > 0 ? parts.join(t.sep) : t.bmLoaded(0));
    },
    [announce, bookmarks, commitBookmarks, loadNotesFile, loadConfusionsFile, t],
  );

  // Unfolding a corner lifts every bookmark on the page at once, with no
  // question first; the bookmarks it lifted wait here for a few seconds so one
  // tap on "Undo" puts them back (docs/decisions/bookmark-fold.md, 2026-09-25).
  const [unfolded, setUnfolded] = useState<{ lifted: Bookmark[]; said: string } | null>(null);
  const unfold = useCallback(
    (p: number) => {
      const lifted = bookmarksOnPage(bookmarks, p);
      if (lifted.length === 0) return;
      const gone = new Set(lifted.map((b) => b.id));
      const said = t.bmUnfolded(lifted.length);
      commitBookmarks(
        bookmarks.filter((b) => !gone.has(b.id)),
        said,
      );
      if (drawerId && gone.has(drawerId)) setDrawerId(null);
      setUnfolded({ lifted, said });
    },
    [bookmarks, commitBookmarks, drawerId, t],
  );
  const undoUnfold = () => {
    if (!unfolded) return;
    const held = new Set(bookmarks.map((b) => b.id));
    commitBookmarks([...bookmarks, ...unfolded.lifted.filter((b) => !held.has(b.id))], t.bmRestored);
    setUnfolded(null);
  };
  const endUndo = useCallback(() => setUnfolded(null), []);

  // The note tool's tap: pin a fresh note, put the tool down (it is used once,
  // like the bookmark tool) and open the box to type in.
  const placeNote = useCallback(
    (at: { page: number; key: string; word: number | null; x: number; y: number }) => {
      const next = addNote(notes, at, Date.now());
      commitNotes(next, "");
      putDownAfterUse();
      openFresh(next[next.length - 1]!.id);
    },
    [notes, commitNotes, putDownAfterUse, openFresh],
  );
  // The harakat tool's click: pin a note on the sign the magnifier rings, and
  // open the box. The tool stays up, so the next sign is one more click.
  const pickSignNote = useCallback(
    (at: { page: number; key: string; word: number; mark: number; x: number; y: number }) => {
      const next = addNote(notes, at, Date.now());
      commitNotes(next, "");
      openFresh(next[next.length - 1]!.id);
    },
    [notes, commitNotes, openFresh],
  );
  // The word tool's tap opens the word into its parts; a part picked drops a
  // note on it (a sign, or the whole word).
  const [wordOpen, setWordOpen] = useState<{ page: number; key: string; word: number; rect: WordRect } | null>(
    null,
  );
  // The crop tool's box, in the page's own units, while its sheet is open.
  const [crop, setCrop] = useState<CropBox | null>(null);
  const pickWordPart = (at: {
    x: number;
    y: number;
    mark?: number | null;
    marks?: readonly number[];
    letter?: number;
  }) => {
    const w = wordOpen;
    setWordOpen(null);
    if (!w) return;
    const next = addNote(notes, { page: w.page, key: w.key, word: w.word, ...at }, Date.now());
    commitNotes(next, "");
    openFresh(next[next.length - 1]!.id);
  };
  /** Put focus back on a pin after its box closes, so the keyboard is not lost. */
  const focusPin = (id: string) =>
    requestAnimationFrame(() =>
      document.querySelector<SVGElement>(`[data-note-id="${CSS.escape(id)}"]`)?.focus(),
    );
  // Closing keeps what was typed; a note closed empty was never written, and
  // goes away without a word.
  const closeNote = (text: string) => {
    const n = openNote;
    setNoteOpenId(null);
    setFreshNoteId(null);
    setJoined(null);
    // The harakat and word tools stay up for the next sign; the note tool is
    // used once, unless it is locked on.
    if (toolRef.current !== "sign" && toolRef.current !== "word") putDownAfterUse();
    if (!n) return;
    if (text.trim() === "") {
      commitNotes(removeNote(notes, n.id), "");
      return;
    }
    const next = editNote(notes, n.id, text, Date.now());
    if (next.some((x, i) => x !== notes[i])) commitNotes(next, t.noteSaved);
    focusPin(n.id);
  };
  // A new note about a juz, surah or page starts empty and with no verse; it is
  // kept only once something is typed in it.
  const closeLabelNotes = useCallback(() => setLabelNotes(null), []);
  const newNoteAbout = useCallback(
    (scope: NoteScope) => {
      const next = addScopedNote(scoped, scope, Date.now());
      commitScoped(next, "");
      setLabelNoteId(next[next.length - 1]!.id);
      setLabelNoteFresh(true);
    },
    [commitScoped, scoped],
  );
  const labelNote = scoped.find((s) => s.id === labelNoteId) ?? null;
  const closeLabelNote = (text: string) => {
    const n = labelNote;
    setLabelNoteId(null);
    setLabelNoteFresh(false);
    if (!n) return;
    if (text.trim() === "" && labelNoteFresh) {
      commitScoped(scoped.filter((s) => s.id !== n.id), "");
      return;
    }
    const next = editScopedNote(scoped, n.id, text, Date.now());
    if (next.some((x, i) => x !== scoped[i])) commitScoped(next, t.noteSaved);
  };
  const deleteLabelNote = () => {
    const n = labelNote;
    setLabelNoteId(null);
    setLabelNoteFresh(false);
    if (!n) return;
    commitScoped(scoped.filter((s) => s.id !== n.id), t.noteDeleted);
    if (!labelNoteFresh) setDeletedNote({ said: t.noteDeleted, restored: t.noteRestored, whole: n });
  };
  const deleteNote = () => {
    const n = openNote;
    setNoteOpenId(null);
    setFreshNoteId(null);
    setJoined(null);
    if (!n) return;
    const owner = noteOfPin(n.id);
    if (owner && owner.verses.length > 1) {
      commitNotes(removeNote(notes, n.id), t.noteVerseTakenOut);
      setDeletedNote({ note: n, said: t.noteVerseTakenOut, restored: t.noteRestored, owner });
      return;
    }
    commitNotes(removeNote(notes, n.id), t.noteDeleted);
    setDeletedNote({ note: n, said: t.noteDeleted, restored: t.noteRestored });
  };
  const undoDelete = () => {
    if (!deletedNote) return;
    if (deletedNote.whole) {
      commitScoped([...scoped, deletedNote.whole], deletedNote.restored);
      setDeletedNote(null);
      return;
    }
    const { owner, note } = deletedNote;
    if (!note) return;
    const verse = owner?.verses.find((v) => v.key === note.key);
    if (owner && verse) {
      // Back into the same note; or, if the note has gone since, the note as it was.
      const kept = scoped.some((s) => s.id === owner.id);
      commitScoped(
        kept ? addVerse(scoped, owner.id, verse, Date.now(), pageOfKey) : [...scoped, owner],
        deletedNote.restored,
      );
      setDeletedNote(null);
      return;
    }
    commitNotes(restoreNote(notes, note), deletedNote.restored);
    setDeletedNote(null);
  };
  const endNoteUndo = useCallback(() => setDeletedNote(null), []);

  // The mistake tool (docs/design/page-toolbar-plan.md, step 3): a tap marks a
  // word in a quiet red and the tool stays up for the next one; a tap on a
  // word already marked opens the sign picker. A mistake is a note of kind
  // "correction", so it is kept and saved with the notes (notes-export = C).
  const [pickingId, setPickingId] = useState<string | null>(null);
  const picking = notes.find((n) => n.id === pickingId) ?? null;
  const markWord = useCallback(
    (at: { page: number; key: string; word: number; x: number; y: number }) => {
      const held = mistakeOn(notes, at.page, at.key, at.word);
      if (held) {
        setPickingId(held.id);
        return;
      }
      commitNotes(markMistake(notes, at, Date.now()), t.mistakeMarked(t.ayahLabel(at.key) ?? at.key));
      // Into the revision record too, so the calendar can show where the reader
      // slips. Only on the first tap: picking the sign or clearing the mark
      // later is the same slip, not another one.
      void recordLook({ key: at.key, page: at.page, slip: true });
    },
    [notes, commitNotes, t],
  );
  const pickSign = (mark: number | null, name: string | null) => {
    const n = picking;
    setPickingId(null);
    if (!n) return;
    commitNotes(
      pickMistakeSign(notes, n.id, mark, Date.now()),
      name ? t.mistakeSignPicked(name) : t.mistakeWordPicked,
    );
  };
  const clearMistake = () => {
    const n = picking;
    setPickingId(null);
    if (!n) return;
    commitNotes(removeNote(notes, n.id), t.mistakeCleared);
    setDeletedNote({ note: n, said: t.mistakeCleared, restored: t.mistakeRestored });
  };
  const noteLabel = useCallback((n: Note) => t.notePin(t.ayahLabel(n.key) ?? n.key), [t]);

  const ribbonsFor = (p: number) => (
    <BookmarkRibbons
      bookmarks={bookmarksOnPage(bookmarks, p)}
      onDrop={() => dropOn(p)}
      onUnfold={() => unfold(p)}
      onOpen={setDrawerId}
      freshId={freshId}
      seam={seamPage === p}
      aside={tool === "sign" || tool === "word"}
    />
  );

  // Where one page's worth of movement lands, or null if it lands nowhere.
  //
  // "The next page" means the next page we actually *have*: this walks
  // `pageTurns.pages` — the **inventory**, not the print. With 7, 9 and 19
  // vendored that meant 7 → 9, stepping clean over page 8, and every turn in the
  // shipped build crossed a gap. Loop 4b vendored all 604, so the inventory and
  // the print now agree and the walk is `page ± 1` everywhere. It stays a walk
  // because the inventory is the thing that is true — the next edition arrives
  // partial the way this one did, and `page ± 1` would then be a guess.
  //
  // It is its own function, rather than a step inside `stepPage`, because the
  // dragged turn has to ask the question without answering it — a fold under a
  // finger is drawn for the pair it *would* land on, and that is this walk and
  // no other. Two implementations of "the next page we have" would be two
  // answers the moment 4b changes the inventory, and the one the reader would
  // notice is a fold that draws a crease and then lands on a hole.
  const pageAfter = useCallback(
    (step: 1 | -1): number | null => {
      const { pages } = pageTurns;
      if (pages.length === 0) return null;
      // From the destination, so a held arrow walks the book rather than
      // bouncing off the page that has not finished turning yet.
      const here = pendingPageRef.current;
      // With two pages open a turn moves a whole opening: one page from 5 is 6,
      // already open beside it, so the turn would play and change nothing.
      if (bookOpenRef.current) return openingAfter(here, step, pages);
      const at = pages.indexOf(here);
      const i = at === -1 ? 0 : Math.min(pages.length - 1, Math.max(0, at + step));
      const next = pages[i]!;
      return next === here ? null : next;
    },
    [pageTurns],
  );

  // Move one page — and say where it landed if that is not the page next door
  // (`page-turning.md` §7 ④). The sibling `handleScrubTo` below already got this
  // right, and this is the same string for the same reason: a landing the reader
  // did not ask for has to be named out loud.
  const stepPage = useCallback(
    (step: 1 | -1) => {
      if (pageTurns.pages.length === 0) return;
      const here = pendingPageRef.current;
      const next = pageAfter(step);
      if (peelLandingRef.current) peelLandingRef.current = false;
      else if (bookOpenRef.current && next !== null && playTurnRef.current?.(step)) return;
      if (next === null) {
        // Naming the page matters most here, where nothing moved: without it
        // the reader has a gesture that did nothing and no idea where they are.
        announce(step > 0 ? t.lastPage(here) : t.firstPage(here));
        return;
      }
      const nextDoor = bookOpenRef.current ? (here % 2 === 0 ? here - 1 : here) + 2 * step : here + step;
      goToPage(next, next === nextDoor ? undefined : t.nearestPageN(next), true);
    },
    [pageAfter, pageTurns, announce, t, goToPage],
  );

  /*
   * Where each juz opens in this build — thirty entries, computed once.
   *
   * Once, because the caller is a wheel. `juzPageIndex` walks every polygon on
   * every page, and a reader flicking `Shift`+wheel through the book would pay
   * that scan per flick; memoised on the manifest it is paid at load and every
   * jump after it is an array index.
   */
  const juzStarts = useMemo(() => juzPageIndex(manifest?.pages ?? []), [manifest]);
  /** The same for the sixty hizbs, so the magnifier can mark where each begins. */
  const hizbStarts = useMemo(() => hizbPageIndex(manifest?.pages ?? []), [manifest]);

  // Where a page sits in the book, for the page bar's scrub readout: its surah
  // (above), the juz already *running* onto it, and the juz that *begins* on it
  // if one does. The bar names a boundary page for both — "juz 3 → 4" — which is
  // the decided answer (docs/decisions/page-bar.md §"which juz is a boundary
  // page"), so it is handed both numbers and lets the shared boundary rule
  // (`labelBoth`) decide when to show one and when to show two. On the 600 pages
  // no seam cuts, `beginsHere` is `null` unless the juz opens at the very top, in
  // which case it equals `running` and the rule collapses to one number anyway.
  // A juz no page vendored never appears: `runningByPage` skips a page with no
  // ayahs, and `beginsHere` is only set from an opening this build actually holds.
  const pageContext = useCallback(
    (p: number): { surah: number; running: number; beginsHere: number | null } | null => {
      const surah = surahByPage.get(p);
      const running = runningByPage.get(p);
      if (surah === undefined || running === undefined) return null;
      let beginsHere: number | null = null;
      for (let i = 0; i < juzStarts.length; i++) {
        if (juzStarts[i] === p) {
          beginsHere = i + 1;
          break;
        }
      }
      return { surah, running, beginsHere };
    },
    [surahByPage, runningByPage, juzStarts],
  );

  // Open a juz from its marker: a tap on the bar's detent jumps to the page that
  // juz opens on and says so, exactly as the juz jump and the map cell do. A
  // jump, not a turn — `goToPage`'s third argument stays false, so no fold is
  // drawn across a move the reader did not travel page by page. A juz this build
  // did not vendor has no opening and no marker, so this is only ever asked of a
  // juz that has one; the guard is the belt to that brace.
  const goToJuz = useCallback(
    (juz: number) => {
      const opens = juzStarts[juz - 1];
      if (opens === null || opens === undefined) return;
      goToPage(opens, t.arrivedJuz(juz, opens));
    },
    [juzStarts, t, goToPage],
  );

  /*
   * Jump a whole juz — `Shift`+wheel over either leaf.
   *
   * The question is asked **in pages, not in juz numbers**: the next opening
   * strictly past where we are, in the direction of travel. That one phrasing
   * disposes of three special cases at once. A leaf can carry the end of one juz
   * and the start of the next — page 22 is both juz 1's last and juz 2's first —
   * and a jump computed as `here + 1` would land on the page it started from and
   * do nothing, silently. A build can be missing a juz entirely (`null`), and
   * this simply passes over it rather than dead-ending. And "back" from the
   * middle of a juz lands on that juz's own opening, which is the rule every
   * media player uses for a track and the one a reader already expects.
   *
   * A jump, not a turn: `goToPage`'s third argument stays false, so no fold is
   * drawn. A band crossing from page 22 to page 42 would assert an adjacency the
   * reader did not travel through (`page-transition.md` §3.1).
   */
  const stepJuz = useCallback(
    (step: 1 | -1) => {
      const at = pendingPageRef.current;
      let want: number | null = null;
      // `juzStarts` is ascending by construction, so the first match walking
      // the right way is the nearest one.
      for (let i = 0; i < juzStarts.length; i++) {
        const juz = step > 0 ? i + 1 : juzStarts.length - i;
        const opens = juzStarts[juz - 1];
        if (opens === null || opens === undefined) continue;
        if (step > 0 ? opens > at : opens < at) {
          want = juz;
          break;
        }
      }
      if (want === null) {
        // Nothing moved, so say where they still are — the same reason
        // `stepPage` names the page when it refuses.
        announce(t.juzEdge(juzOfPage(at, manifest?.pages ?? []) ?? 1));
        return;
      }
      goToPage(juzStarts[want - 1]!, t.arrivedJuz(want, juzStarts[want - 1]!));
    },
    [juzStarts, manifest, announce, t, goToPage],
  );

  // The slider hands back both numbers: where it landed and where the thumb was
  // let go. They differ whenever the reader aimed into the un-vendored gap, and
  // when they do the announcement names the page they actually got.
  const handleScrubTo = useCallback(
    (landed: number, asked: number) => {
      const said = landed === asked ? undefined : t.nearestPageN(landed);
      // Snapping back onto the page already showing moves nothing, so `goToPage`
      // would say nothing — and silence is the wrong answer to a drag across
      // half the mus'haf. Say where they are.
      if (landed === page) {
        if (said) announce(said);
        return;
      }
      goToPage(landed, said);
    },
    [goToPage, page, announce, t],
  );

  // The origin ayah keeps its breadcrumb until the trail is empty.
  const breadcrumbKey = trail.length > 0 ? trail[trail.length - 1]!.key : null;

  // Tapping the same ayah again clears it (toggle); otherwise select it. The
  // announcement is a side effect, so it lives outside the state updater (React
  // may invoke updaters twice in dev to check purity — announcing there would
  // fire the toggle branch spuriously). We read the live value via a ref.
  const handleSelect = useCallback(
    (key: string) => {
      // Under the bookmark tool a tap on an ayah drops the ribbon at that ayah
      // instead of selecting it.
      if (toolRef.current === "bookmark") {
        const at = resolver?.resolve(key)?.page;
        if (at !== undefined) dropWithTool(at, key);
        return;
      }
      // Under the note, harakat, word and mistake tools the stage pins a note,
      // takes a sign, opens the word or marks it instead (`onPlaceNote`,
      // `onPickSign`, `onOpenWord`, `onMarkWord`).
      if (toolRef.current !== "select" && toolRef.current !== "highlight") return;
      setOpenDirection(null);
      setSelectedRange(null); // a tap replaces a highlight — never both at once
      // A lit verse whose drawer is down (after a hop, or its ×) is asking for
      // its tools, not to be put out: raise the drawer and keep the light.
      if (selectedKeyRef.current === key && drawerAwayRef.current) {
        setDrawerAway(false);
        return;
      }
      const toggledOff = selectedKeyRef.current === key;
      setSelectedKey(toggledOff ? null : key);
      announce(toggledOff ? t.selectionCleared : t.selected(t.ayahLabel(key) ?? key));
      // The revision record, and the reason this sits inside the toggle branch:
      // the second tap on the same ayah means "dismiss", and counting it as a
      // second look would double the score of every ayah the reader changed
      // their mind about. Fire and forget — a lost row is not worth a hitch in
      // the gesture, and `recordLook` never rejects.
      const loc = toggledOff ? null : resolver?.resolve(key);
      if (loc) void recordLook({ key, page: loc.page });
    },
    [announce, dropWithTool, resolver, t],
  );

  // A press on a verse's number: select the verse (unless it already is) and
  // open the menu beside the number. Only where a tap on a verse selects it.
  const openVerseMenu = useCallback(
    (key: string, locate: () => VerseSpot | null) => {
      if (toolRef.current !== "select" && toolRef.current !== "highlight") return;
      const spot = locate();
      if (!spot) return;
      pickedFromNumberRef.current = key;
      if (selectedKeyRef.current !== key) handleSelect(key);
      else setCommentaryOpen(false);
      setVerseMenuAt({ key, locate, ...spot });
    },
    [handleSelect],
  );
  const verseMenuItems = useMemo((): VerseMenuItem[] => {
    if (!PITCH || !verseMenuAt || verseMenuAt.key !== selectedKey) return [];
    const key = verseMenuAt.key;
    const items: VerseMenuItem[] = [];
    if (hasCommentary)
      items.push({
        caption: commentarySource ? `${t.vdCommentary}${t.sep}${commentarySource.source.label}` : t.vdCommentary,
        glyph: "✎",
        onPick: () => setCommentaryOpen(true),
      });
    for (const chip of railChips)
      items.push({
        caption: `${t.railDirection[chip.direction]}${t.sep}${t.num(chip.count)}`,
        // The rail's own sign: "looks like" with a small mark for which way.
        glyph: chip.glyph,
        onPick: () => setOpenDirection(chip.direction),
      });
    if (rootCount > 0)
      items.push({
        caption: t.vdRoots,
        glyph: "⬡",
        onPick: () => setRootsOpen(true),
      });
    items.push({
      caption: audio.phaseFor(key) === "playing" ? t.vdPause : t.vdListen,
      glyph: audio.phaseFor(key) === "playing" ? "⏸" : "▶",
      onPick: () => audio.toggle(key),
    });
    const surah = parseAyahKey(key)?.surah;
    if (surah && INTRO_SURAHS.has(surah))
      items.push({
        caption: t.surahIntro,
        glyph: "ⓘ",
        onPick: () => openIntro(surah),
      });
    return items;
  }, [verseMenuAt, selectedKey, hasCommentary, commentarySource, railChips, rootCount, audio, openIntro, t]);

  // A marquee released over ayahs (Loop 5). The passage replaces the selection —
  // one open hop list at a time — and the stage keeps the amber marks while L3
  // holds the keys the merged hop list is built from.
  const handleSelectRange = useCallback(
    (fromKey: string, toKey: string, keys: readonly string[]) => {
      // In Read mode nothing a hand does on the page opens anything.
      if (keys.length === 0 || toolRef.current === "read") return;
      setOpenDirection(null);
      setSelectedKey(null);
      setSelectedRange(keys);
      const span =
        fromKey === toKey
          ? (t.ayahLabel(fromKey) ?? fromKey)
          : `${t.ayahLabel(fromKey) ?? fromKey}–${t.ayahLabel(toKey) ?? toKey}`;
      announce(t.highlighted(span));
      // One event for the whole passage, not one per ayah: a marquee across
      // twelve ayahs is a single look, and counting it twelve times would let
      // one drag outweigh a page read carefully.
      const loc = resolver?.resolve(fromKey);
      if (loc) void recordLook({ key: fromKey, endKey: toKey, page: loc.page });
    },
    [announce, resolver, t],
  );

  /**
   * A run of words settled inside the selected ayah (word-D) — said out loud as
   * the *outcome*, never as the selection.
   *
   * "You selected «ذكر نعمتي»" would be the app reading scripture back at the
   * reader through a UI string, which is the one thing the word feature is built
   * not to do; "seven similar places" is the answer they dragged for. It changes
   * no state: the band is already on the page and the ayah is still the
   * selection, so this is a question asked and answered, not a navigation.
   *
   * The roots are handed in rather than looked up inside `Adjacency`, which holds
   * no root shards — without them a shared-root edge lands in `unplaced` (nobody
   * asked the roots) instead of silently passing, and the count would overstate
   * what the run actually matched.
   */
  const handleSelectWords = useCallback(
    (wordKey: string) => {
      if (!adjacency || toolRef.current === "read") return;
      const hops = adjacency.hopsForWords(
        wordKey,
        roots ? { roots: roots.rootsForWords(wordKey) } : {},
      );
      announce(t.wordHops(hops.about.length, hops.unplaced.length));
    },
    [adjacency, roots, announce, t],
  );

  // Forward hop: push the origin onto the trail, move to the target, pulse.
  // `origin` overrides the breadcrumb source — a merged range hop leaves from the
  // range member that actually produced the edge, not from the whole highlight.
  // Go to a verse, leaving a bead on the trail to come back by. A hop along an
  // edge is this; so is a tap on a verse the pitch note's prose cites.
  const hopTo = useCallback(
    (to: string, origin?: string) => {
      if (!resolver) return;
      const toLoc = resolver.resolve(to);
      if (!toLoc) return; // unvendored — the button is disabled, defensive here
      const fromKey = origin ?? selectedKey;
      const fromLoc = fromKey ? resolver.resolve(fromKey) : null;
      if (fromKey && fromLoc) {
        setTrail((beads) => [...beads, { key: fromKey, page: fromLoc.page }]);
      }
      setOpenDirection(null);
      setSelectedRange(null);
      arrivedByHop.current = to !== selectedKey;
      setSelectedKey(to);
      setPage(toLoc.page);
      announce(t.hoppedTo(t.ayahLabel(to) ?? to, toLoc.page));
      void stage.navigateTo(to, { pulse: true });
    },
    [resolver, selectedKey, announce, t],
  );
  // Following a note: its verses one at a time, in mus'haf order. Going to one
  // is a hop without the bead: the bar is the way back, not the trail.
  const [following, setFollowing] = useState<{ id: string; at: number } | null>(null);
  const showVerse = useCallback(
    (key: string) => {
      const loc = resolver?.resolve(key);
      if (!loc) return;
      setOpenDirection(null);
      setSelectedRange(null);
      arrivedByHop.current = key !== selectedKey;
      setSelectedKey(key);
      setPage(loc.page);
      announce(t.hoppedTo(t.ayahLabel(key) ?? key, loc.page));
      void stage.navigateTo(key, { pulse: true });
    },
    [resolver, selectedKey, announce, t],
  );
  const followNote = useCallback(
    (id: string, at = 0) => {
      const key = scoped.find((n) => n.id === id)?.verses[at]?.key;
      if (!key) return;
      setRevisionOpen(false);
      setFollowing({ id, at });
      showVerse(key);
    },
    [scoped, showVerse],
  );
  // A note with a verse is followed; one with none (made from a label) opens its words.
  const openNoteOf = useCallback(
    (id: string) => {
      if (scoped.find((n) => n.id === id)?.verses.length === 0) {
        setRevisionOpen(false);
        setLabelNoteId(id);
        setLabelNoteFresh(false);
        return;
      }
      followNote(id);
    },
    [followNote, scoped],
  );
  // A row in the page map's list of jumps goes to the verse the jump left from.
  const goToJumpFrom = useCallback(
    (from: string) => {
      setRevisionOpen(false);
      showVerse(from);
    },
    [showVerse],
  );
  const stopFollowing = useCallback(() => setFollowing(null), []);
  const followed = following ? scoped.find((n) => n.id === following.id) : undefined;

  const handleHop = useCallback(
    (edge: Edge, origin?: string) => hopTo(edge.to, origin),
    [hopTo],
  );

  // Bead-back: rewind to a trail origin (pops everything after it) — same path.
  const handleBeadBack = useCallback(
    (index: number) => {
      const target = trail[index];
      if (!target) return;
      setTrail((beads) => beads.slice(0, index));
      setOpenDirection(null);
      arrivedByHop.current = target.key !== selectedKey;
      setSelectedKey(target.key);
      setPage(target.page);
      announce(t.backTo(t.ayahLabel(target.key) ?? target.key, target.page));
      void stage.navigateTo(target.key, { pulse: true });
    },
    [trail, selectedKey, announce, t],
  );

  const handleClearCurrent = useCallback(() => {
    setOpenDirection(null);
    setSelectedKey(null);
    setSelectedRange(null);
    announce(t.selectionCleared);
  }, [announce, t]);

  // A root-lens row hops like any other edge — the lens already carries the
  // target's page and direction, so it maps straight onto the §6 Edge shape and
  // reuses one navigation path (trail bead, pulse, announcement).
  const handleRootHop = useCallback(
    (hop: RootHop) =>
      handleHop({
        type: "shared-root",
        to: hop.key,
        page: hop.page,
        dir: { dSurah: hop.dSurah, dPage: hop.dPage, sameJuz: hop.sameJuz },
      }),
    [handleHop],
  );

  // A merged range row hops from the member that produced the edge (its diff's
  // "here"), so the trail bead points at a real ayah, not at the passage.
  const handleRangeHop = useCallback(
    (edge: MergedEdge) => handleHop(edge, edge.from),
    [handleHop],
  );

  /* ---- the field (?field=) ---------------------------------------------- */

  // The desk the mus'haf lies on. It comes from the link and from nowhere else
  // — there is deliberately no control for it (packages/core/src/field.ts says
  // why), so this is state only so that it can be *kept*: the hash is rewritten
  // on every hop, and a field that was not re-serialized would vanish from the
  // address bar the first time the reader touched anything.
  //
  // Seeded from the URL rather than the default, because `main.tsx` has already
  // painted the document from the same reading and React must agree with what
  // is on screen.
  const [field, setField] = useState<FieldId>(() => fieldFromHash(window.location.hash));

  useEffect(() => {
    applyFieldToDocument(field);
  }, [field]);

  // The current view as a spec-§7 AppState — what the URL encodes and Share
  // serializes. `via` is the immediate breadcrumb origin; `trail` is the rest of
  // the chain (all but the top, which is `via`) so a deep link restores both.
  const currentState = useMemo<AppState | null>(() => {
    if (!resolver) return null;
    const edition = resolver.edition;
    // A highlighted range serializes through the §7 range form (`2:47-2:48`);
    // a single ayah through the plain form. Never both — they are exclusive.
    const select = selectedRange
      ? rangeSelect(selectedRange)
      : selectedKey
        ? refOf(selectedKey)
        : null;
    // Only when it is not the default: every link this app hands out would
    // otherwise carry `field=tan`, which says nothing and invites the reader to
    // think the desk is part of the address.
    const desk = field === DEFAULT_FIELD ? {} : { field };
    if (!select) {
      return { edition, select: null, page, ...desk };
    }
    const trailRefs = trail
      .map((b) => keyToRef(b.key))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const via = trailRefs.length > 0 ? trailRefs[trailRefs.length - 1] : undefined;
    const rest = trailRefs.slice(0, -1);
    return {
      edition,
      select,
      ...desk,
      ...(via ? { via } : {}),
      ...(rest.length > 0 ? { trail: rest } : {}),
    };
  }, [resolver, selectedKey, selectedRange, page, trail, field]);

  /*
   * What a tap and a hold on a verse do (docs/design/verse-tap-and-hold.md),
   * by the reader's setting:
   *
   *   A  a tap hides or shows the bars; a hold opens the fuller drawer.
   *   B  a tap or a hold opens the fuller drawer.
   *   C  a tap opens the drawer as before; a hold opens the small menu.
   *
   * On a computer a click always opens the drawer, so A's tap does not hide the
   * bars there: the bars cover nothing on a wide screen, and F switches full
   * screen instead. A held mouse button still does what a hold does.
   */
  const lightVerse = useCallback(
    (key: string, drawerUp: boolean) => {
      setOpenDirection(null);
      setSelectedRange(null);
      setDrawerAway(!drawerUp);
      if (selectedKeyRef.current !== key) {
        // A new verse raises its drawer; the small menu wants it down.
        arrivedByHop.current = !drawerUp;
        setSelectedKey(key);
        announce(t.selected(t.ayahLabel(key) ?? key));
        const loc = resolver?.resolve(key);
        if (loc) void recordLook({ key, page: loc.page });
      }
    },
    [announce, resolver, t],
  );
  // Recite a run of verses and say which: "Playing Al-Baqarah · 2:1 to 2:286".
  const playBetween = useCallback(
    (from: string, to: string) => {
      const run = versesBetween(from, to);
      if (run.length === 0) return;
      audio.playRun(run);
      const first = run[0]!;
      const last = run[run.length - 1]!;
      const lastName = t.ayahLabel(last) ?? last;
      const sameSurah = parseAyahKey(first)?.surah === parseAyahKey(last)?.surah;
      announce(t.playingRun(t.ayahLabel(first) ?? first, sameSurah ? (t.ayahRef(last) ?? lastName) : lastName));
    },
    [announce, audio, t],
  );
  const handleVerse = useCallback(
    (key: string, how: PressKind) => {
      const tooled = toolRef.current !== "select" && toolRef.current !== "highlight";
      // "Play to" is waiting: this verse is where the run stops.
      const from = playFromRef.current;
      if (from && !tooled) {
        playFromRef.current = null;
        playBetween(from, key);
        return;
      }
      if (tooled || how === "key") {
        handleSelect(key);
        return;
      }
      if (how === "hold") {
        if (verseGestures === "c") {
          lightVerse(key, false);
          const id = (() => {
            const p = parseAyahKey(key);
            return p ? `verse-${toAbsoluteAyah(p.surah, p.ayah)}` : null;
          })();
          const shape = id
            ? Array.from(document.querySelectorAll<SVGGraphicsElement>(`[id="${id}"]`))
                .map((el) => el.getBoundingClientRect())
                .find((r) => r.width > 0 && r.height > 0)
            : undefined;
          if (shape) setVerseMenu({ key, around: shape });
        } else lightVerse(key, true);
        return;
      }
      if (verseGestures === "a" && !desktop) {
        setFull((f) => !f);
        return;
      }
      handleSelect(key);
    },
    [announce, desktop, handleSelect, lightVerse, playBetween, verseGestures],
  );

  // The four things the fuller drawer (A, B) and the small menu (C) add.
  const startPlayTo = useCallback(
    (key: string) => {
      playFromRef.current = key;
      setDrawerAway(true);
      announce(t.playToPick);
    },
    [announce, t],
  );
  const markVerse = useCallback((key: string) => handleSelectRange(key, key, [key]), [handleSelectRange]);
  const noteOnVerse = useCallback(
    (key: string) => {
      const loc = resolver?.resolve(key);
      const p = parseAyahKey(key);
      if (!loc || !p) return;
      // The pin goes at the middle of the verse, in the page's own units.
      const shape = Array.from(
        document.querySelectorAll<SVGGraphicsElement>(`[id="verse-${toAbsoluteAyah(p.surah, p.ayah)}"]`),
      ).find((el) => el.getBoundingClientRect().width > 0);
      const box = shape?.getBBox();
      setDrawerAway(true);
      placeNote({
        page: loc.page,
        key,
        word: null,
        x: box ? box.x + box.width / 2 : 0,
        y: box ? box.y + box.height / 2 : 0,
      });
    },
    [placeNote, resolver],
  );
  // The verse's name and its link; never its words.
  const copyVerse = useCallback(
    (key: string) => {
      if (!currentState) return;
      const name = t.ayahLabel(key) ?? key;
      const text = `${name} — ${linksFor(currentState, "", shareBase()).site}`;
      void navigator.clipboard?.writeText(text).then(
        () => announce(t.copiedLink(name)),
        () => undefined,
      );
    },
    [announce, currentState, t],
  );

  // Restore a parsed deep link through the SAME select/navigateTo path a live
  // hop uses (spec §7: no separate deep-link logic to drift). Rebuilds the trail
  // from `trail`+`via`, sets the selection, and pans to it.
  // `origin` only chooses the wording of the announcement — a jump lands by the
  // same code as a shared link, and must keep doing so.
  const restoreState = useCallback(
    (state: AppState, origin: "link" | "jump" = "link") => {
      if (!resolver) return;
      const edition = resolver.edition;
      // A *link* says which desk it wants, and says it by omission too: pasting a
      // plain link while sitting on a dark field puts you back on the default,
      // because that link is a whole view and it does not include one. A *jump*
      // is a move inside the session and inherits the desk it was made from —
      // which is also why `handleJump` need not thread the field through.
      if (origin === "link") setField(state.field ?? DEFAULT_FIELD);
      // A panel the link asks for (`?open=`), opened as its own button opens
      // it. The address then goes back to naming only the view, because
      // `currentState` never carries a panel.
      if (origin === "link" && state.open) {
        const panel = state.open;
        if (panel === "jump") setJumperOpen(true);
        else if (panel === "about") setColophonOpen(true);
        else if (panel === "key") setLegendOpen(true);
        else if (panel === "editions") setEditionOpen(true);
        else if (panel === "tips") setCoachUp(true);
        else if (panel === "lookalikes" || panel === "roots") {
          // The verse's own sheets wait for the verse: see `pendingSheet`.
          if (state.select) setPendingSheet({ panel, key: refToKey(edition, state.select) });
        } else if (panel === "commentary" || panel === "context") {
          // The verse's note opens on the selection itself in the pitch build
          // (see the effect on `selectedKey`); `context` also leads it with the
          // surah's introduction, on whichever verse the link names.
          if (PITCH && state.select && panel === "context") {
            setContextFor(refToKey(edition, state.select));
          }
        } else {
          setRevisionAt(panel === "shelf" ? "juz" : undefined);
          setRevisionOpen(true);
        }
      }
      // A tool the link puts in hand (`?tool=`), named by its button's word;
      // the harakat button is the code's `sign` tool.
      // One page or two (`?view=`), as the chrome's switch sets it; a phone has
      // one page whatever it is set to.
      if (origin === "link" && state.view) handlePageMode(state.view);
      if (origin === "link" && state.tool) chooseTool(state.tool === "harakat" ? "sign" : state.tool);
      // Rebuild the trail beads from the link's trail + via (oldest → newest).
      const chain = [...(state.trail ?? []), ...(state.via ? [state.via] : [])];
      const beads: TrailBead[] = [];
      for (const ref of chain) {
        const key = refToKey(edition, ref);
        const loc = resolver.resolve(key);
        if (loc) beads.push({ key, page: loc.page });
      }
      setTrail(beads);
      setOpenDirection(null);

      if (state.select === null) {
        setSelectedKey(null);
        setSelectedRange(null);
        // A page link (`#/hafs-kfqc/p9`) has to move the stage, not just the
        // header. Setting `page` alone renumbered the chrome while the reader
        // kept looking at whatever page was already mounted — the one case
        // where the app said one thing and showed another.
        if (state.page) {
          setPage(state.page);
          announce(t.arrivedPage(origin, state.page));
          void stage.showPage(state.page);
        }
        return;
      }

      // A range link (`2:47-2:48`) restores the highlight + its merged menu, on
      // the same path the gesture takes — expand it to its member keys.
      if ("toAyah" in state.select) {
        const { surah, ayah, toAyah } = state.select;
        const keys: string[] = [];
        for (let a = ayah; a <= toAyah; a++) keys.push(refToKey(edition, { surah, ayah: a }));
        const head = resolver.resolve(keys[0]!);
        if (!head) {
          setSelectedKey(null);
          setSelectedRange(null);
          announce(t.rangeUnavailable);
          return;
        }
        setSelectedKey(null);
        setSelectedRange(keys);
        setPage(head.page);
        announce(t.arrivedRange(origin, `${surah}:${ayah}-${toAyah}`, head.page));
        // No pulse: the stage paints the passage from `rangeKeys`, and a drag
        // leaves no single-verse mark on the first verse, so a link must not
        // either — the two roads land on one look.
        void stage.navigateTo(keys[0]!, { pulse: false });
        return;
      }

      const key = refToKey(edition, state.select);
      const loc = resolver.resolve(key);
      if (!loc) {
        // Link points at an un-vendored ayah — keep the trail, don't pan to a ghost.
        setSelectedKey(null);
        setSelectedRange(null);
        announce(t.ayahUnavailable);
        return;
      }
      setSelectedRange(null);
      setSelectedKey(key);
      setPage(loc.page);
      announce(t.arrivedAyah(origin, t.ayahLabel(key) ?? key, loc.page));
      void stage.navigateTo(key, { pulse: true });
    },
    [resolver, announce, t, chooseTool, handlePageMode],
  );

  // What a held corner offers: the page, the surah or the juz it names, each
  // played whole, its link copied or shared, and the page bookmarked or the
  // surah and juz opened where they start. A link to a surah or a juz is a link
  // to its first verse; a link never carries the words.
  const cornerItems = useCallback(
    (which: Corner, page: number, around: DOMRect): { name: string; items: VerseMenuItem[] } | null => {
      if (!resolver) return null;
      const edition = resolver.edition;
      const span = pageSpan(resolver, page);
      if (!span) return null;
      const key = (surah: number, ayah: number) => refToKey(edition, { surah, ayah });
      let name: string;
      let first: { surah: number; ayah: number };
      let last: { surah: number; ayah: number };
      if (which === "page") {
        name = t.pageN(page);
        ({ first, last } = span);
      } else if (which === "surah") {
        const s = span.first.surah;
        name = t.surahName(s);
        first = { surah: s, ayah: 1 };
        last = { surah: s, ayah: AYAH_COUNTS[s - 1]! };
      } else {
        const j = juzOf(span.first.surah, span.first.ayah);
        name = t.juzN(j);
        const [s, a] = JUZ_STARTS[j - 1]!;
        first = { surah: s, ayah: a };
        const next = JUZ_STARTS[j];
        last = next
          ? fromAbsoluteAyah(toAbsoluteAyah(next[0], next[1]) - 1)
          : { surah: 114, ayah: AYAH_COUNTS[113]! };
      }
      const state: AppState =
        which === "page" ? { edition, select: null, page } : { edition, select: first };
      const url = linksFor(state, "", shareBase()).site;
      const copy = () =>
        void navigator.clipboard?.writeText(`${name} — ${url}`).then(
          () => announce(t.copiedLink(name)),
          () => undefined,
        );
      const share = async () => {
        const data = { title: t.shareTitle, text: name, url };
        if (nativeShare(data)) return;
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (typeof nav.share === "function") {
          try {
            await nav.share(data);
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
          }
        }
        copy();
      };
      // The notes about this part (docs/design/scoped-notes.md, step 6): those
      // about it or a part inside it, and those holding one of its verses.
      const scope: NoteScope =
        which === "page"
          ? { type: "page", edition, page }
          : which === "surah"
            ? { type: "surah", surah: first.surah }
            : { type: "juz", juz: juzOf(first.surah, first.ayah) };
      const about = notesAbout(scoped, scope, pageOfKey);
      const items: VerseMenuItem[] = [
        { caption: t.cornerPlay, onPick: () => playBetween(key(first.surah, first.ayah), key(last.surah, last.ayah)) },
        which === "page"
          ? { caption: t.vdBookmark, onPick: () => dropOn(page) }
          : { caption: t.cornerStart, onPick: () => restoreState({ edition, select: first }, "jump") },
        ...(about.length > 0
          ? [{ caption: t.cornerNotes(about.length), onPick: () => setLabelNotes({ head: t.cornerNotesHead(which, name), scope, around }) }]
          : []),
        { caption: t.cornerNewNote, onPick: () => newNoteAbout(scope) },
        { caption: t.vdCopy, onPick: copy },
        { caption: t.vdShare, onPick: () => void share() },
      ];
      return { name, items };
    },
    [announce, dropOn, newNoteAbout, pageOfKey, playBetween, resolver, restoreState, scoped, t],
  );
  const cornerMenuOf = cornerMenu ? cornerItems(cornerMenu.which, cornerMenu.page, cornerMenu.around) : null;

  // Gate cold-open restore on the resolver: a deep link parsed before the
  // manifest loads must not be dropped (restoreState no-ops without a resolver).
  useHashRouter(currentState, restoreState, resolver !== null);
  // The Mac shell's Page menu turns the page through this; nothing outside
  // the shell can see it.
  useEffect(() => exposeToShell({ stepPage }), [stepPage]);

  // A jump lands through `restoreState` — the same path a live hop and a
  // cold-opened link take (spec §7; Loop 3's record says why a second navigation
  // path drifts). It also leaves a bead: "go to الكهف" is as undoable as a chip,
  // so the chain is the existing trail plus the ayah we are leaving.
  const handleJump = useCallback(
    (target: JumpTarget) => {
      if (!resolver) return;
      const chain = [...trail.map((b) => b.key), ...(selectedKey ? [selectedKey] : [])]
        .map(keyToRef)
        .filter((r): r is AyahRef => r !== null);
      const via = chain.length > 0 ? chain[chain.length - 1] : undefined;
      const rest = chain.slice(0, -1);
      restoreState(
        {
          edition: resolver.edition,
          select: { surah: target.surah, ayah: target.ayah },
          ...(via ? { via } : {}),
          ...(rest.length > 0 ? { trail: rest } : {}),
        },
        "jump",
      );
    },
    [resolver, trail, selectedKey, restoreState],
  );

  // The cross-edition mapping table. Empty today — only `hafs-kfqc` is vendored
  // — and deliberately not filled with an identity guess: with no table, a
  // position does not travel (spec §1 forbids cross-edition index arithmetic).
  // The picker shows that, per row, instead of hiding the gap.
  const concordance = useMemo(() => new Concordance(), []);

  // Unreachable today (the only vendored edition is the current one, and the
  // picker disables its own row), so this is the seam rather than a feature:
  // when a second mushaf is vendored, this is where the switch lands, and it
  // refuses rather than guesses while the table is missing.
  const handleEditionSelect = useCallback(
    (edition: string) => {
      setEditionOpen(false);
      const mapped = selectedKey ? concordance.map(selectedKey, edition) : null;
      announce(mapped ? (t.ayahLabel(mapped) ?? mapped) : t.noConcordance);
    },
    [selectedKey, concordance, announce, t],
  );

  // The app-level keyboard map (arrows = pages, `/` = the jumper), applied
  // through core's `appKeyAction` — the precedence ladder and its reasoning live
  // there, tested, so this listener only has to describe the DOM honestly.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const action = appKeyAction({
        key: e.key,
        modified: e.altKey || e.ctrlKey || e.metaKey,
        defaultPrevented: e.defaultPrevented,
        inTextField:
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          el?.isContentEditable === true,
        // Any open sheet owns the keyboard while it is up — it is modal, and its
        // own Escape/Tab handling is the contract. Asking the DOM instead of
        // OR-ing this loop's flags keeps that true for sheets other loops add.
        // A panel that says it is not modal — the note card beside the spread,
        // which leaves the page in use — does not: the arrows still turn.
        inDialog: document.querySelector('[role="dialog"]:not([aria-modal="false"])') !== null,
        // The polygons live inside the page <svg>; Loop 3 gives them the arrows.
        onAyah: el?.closest?.("svg") != null,
      });
      if (!action) return;
      e.preventDefault();
      if (action.kind === "jumper") {
        setJumperOpen(true);
        return;
      }
      // Escape off a focused ayah (§7 ⑤). Blur rather than move focus anywhere
      // in particular: focus goes back to `BODY`, which is exactly the state
      // `onAyah: false` describes, so the very next arrow reaches rule 6 and
      // turns the page. Sending it to the stage instead would leave a focus
      // ring on a thing the reader did not ask to select.
      if (action.kind === "release") {
        el?.blur?.();
        // The same Escape puts the verse drawer away: it is marked handled
        // here, so the drawer's own listener never sees it.
        setDrawerAway(true);
        return;
      }
      stepPage(action.step);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepPage]);

  // The page toolbar's keys: V, H and B by their place on the keyboard, and
  // Escape to put a tool down. Desktop only, like the bar, and never while the
  // reader is typing or a sheet is open — the same fences as the map above.
  useEffect(() => {
    if (!desktop) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el?.isContentEditable === true ||
        document.querySelector('[role="dialog"]') !== null
      )
        return;
      if (e.key === "Escape") {
        if (toolRef.current !== "select") chooseTool("select");
        return;
      }
      const next = TOOL_KEYS[e.code];
      if (!next) return;
      e.preventDefault();
      // The letter of a locked tool leaves it locked.
      chooseTool(next, next === toolRef.current && lockedRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktop, chooseTool]);

  // F switches full screen and Escape leaves it, on any keyboard, with the same
  // fences as the maps above.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el?.isContentEditable === true ||
        document.querySelector('[role="dialog"]') !== null
      )
        return;
      if (e.code === "KeyF") {
        e.preventDefault();
        setFull((f) => !f);
      } else if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const fullSaid = useRef(false);
  useEffect(() => {
    if (full === fullSaid.current) return;
    fullSaid.current = full;
    announce(full ? t.fullScreenOn : t.fullScreenOff);
  }, [full, announce, t]);

  const openChip = railChips.find((c) => c.direction === openDirection) ?? null;
  /*
   * Which side of the desk the ayah's sheets land on, when the book is open.
   *
   * On a spread the ayah's sheets (the hop list, the highlighted passage's
   * menu, the root lens, and in the pitch build the commentary) are all *about*
   * one ayah, and they open on the **opposite** leaf from that ayah — press on
   * the right-hand page and the card lands on the left, press on the left and it
   * lands on the right. That is the one thing a card must never do: cover the
   * verse it is about. This is Option D of the ayah-drawer decision
   * (docs/design/ayah-drawer.md). It was briefly graduated as Option C
   * (same leaf, so the card sits beside the verse it belongs to), but building
   * that live showed the flaw a still drawing hid: on a surah that fills its own
   * leaf — al-Fātiḥah is the whole demo — a same-leaf card wide enough to read
   * lands on top of the verse, and because the script runs right-to-left it
   * hides where each line begins. Opening on the facing leaf keeps the pressed
   * verse fully visible with its tools across the gutter, so C and D are this
   * one memo with its returns swapped, and D is the one that keeps the promise.
   * The side is physical, not logical — the leaf is on a physical side of the
   * gutter whatever language the chrome reads in — which is why this is not left
   * to the sheets' `dir`. Below the breakpoint, or with the book closed to one
   * leaf, there is no second leaf, and `null` lets the sheet keep its
   * chrome-direction default (a phone's bottom sheet, or a single leaf's corner
   * card). A range is anchored by its first ayah — the ayah the reader started
   * from. A surah's introduction, opened from its name with no verse picked, is
   * anchored by the surah's first verse, on the page its name heads; with no
   * anchor it came up from the foot like a phone's card and lifted its page out
   * of line with the facing one. Opened from a verse's number pages past the
   * surah's start, the first verse is not on the spread, so the picked verse
   * places it instead; with neither, it floated past the book's edge.
   */
  const sheetSide = useMemo<"left" | "right" | null>(() => {
    if (!desktop || pageMode !== "two" || !resolver) return null;
    const { right, left } = spreadOf(page, totalPages);
    const sideOf = (anchor: string | null | undefined) => {
      const loc = anchor ? resolver.resolve(anchor) : null;
      if (loc?.page === right) return "left";
      if (loc?.page === left) return "right";
      return null;
    };
    const picked = selectedRange?.[0] ?? selectedKey;
    return introSheet ? (sideOf(formatAyahKey(resolver.edition, introSurah!, 1)) ?? sideOf(picked)) : sideOf(picked);
  }, [desktop, pageMode, resolver, introSheet, introSurah, selectedRange, selectedKey, page, totalPages]);
  const selectedSurah = selectedKey ? parseAyahKey(selectedKey)?.surah : null;

  // The sheets that load on first open are mounted from their first opening on,
  // so their files are not fetched before anyone asks and a sheet that keeps
  // state between openings still does (see components/later.tsx).
  const rootsMounted = useOpenedOnce(rootFamilies !== null);
  const editionMounted = useOpenedOnce(editionOpen);
  const colophonMounted = useOpenedOnce(colophonOpen);
  const revisionMounted = useOpenedOnce(revisionOpen);
  const drawerMounted = useOpenedOnce(drawerBookmark !== null);

  /* The look-alike chips. One rail, placed by whoever renders it: the stage's
     corner on a phone, the desk beside the live page above the breakpoint. */
  const hopRail = (beside?: "left" | "right") => (
    <HopRail
      chips={railChips}
      openDirection={openDirection}
      onOpenChip={(chip) =>
        setOpenDirection((d) => (d === chip.direction ? null : chip.direction))
      }
      // The pitch note for a left-leaf verse lands on the right, over the
      // rail's corner; the chips cross to the left while it is up. Beside the
      // book there is no corner to share: the note rises over the other leaf.
      crossed={!beside && COMMENTARY && commentaryOpen && hasCommentary && sheetSide === "right"}
      onBand={setRailBottom}
      beside={beside}
      seat={beside || noteTall ? null : highestTop(coverTop, shareTop, listTop)}
    />
  );

  return (
    // The chrome reads in the UI language's direction — every offset in the
    // stylesheet is a logical property, so the flip is the whole change. What
    // does *not* flip is below: the stage, the rail and the trail are pinned
    // RTL because they are furniture around a mus'haf, not around a sentence.
    <div className={styles.app} dir={dir} data-full={full || undefined}>
      <header className={styles.chrome}>
        {/* The wordmark is the colophon's opener. Publishing this app conveys
            it (GPL §6), so the source offer and the four source credits have to
            be reachable from the running page — and the chrome already carries
            ⌖, ▤, the skin switch and its legend. A fifth button would
            take thumb-width from navigation to say "about"; the wordmark was
            decoration, and "about" is what a wordmark is always allowed to be. */}
        <button
          type="button"
          className={styles.brand}
          aria-label={t.about}
          aria-haspopup="dialog"
          onClick={() => setColophonOpen(true)}
        >
          {/* The name and the tagline follow the UI language: «حفظ · مِلاحة
              للحُفّاظ» in Arabic, "Hifth · Navigation for huffaz" in English. The
              wordmark is chrome, not scripture — the note under the language
              switch already promises only the mus'haf and the verse text stay
              Arabic — and English prose throughout the app (the colophon, its
              title) already calls it "Hifth". No `lang`/`dir` override here, so
              each inherits the header's own direction. The golden images are
              recorded in Arabic (playwright's default locale), so the wordmark
              there is unchanged; `lang.spec.ts` is where the English wordmark is
              asserted. */}
          <span className={styles.mark} aria-hidden="true">
            {t.wordmark}
          </span>
          <span className={styles.tagline}>{t.tagline}</span>
        </button>
        {/* The chip already meant *where am I*; pressing it now also answers
            *where have I been*. It opens the revision map rather than a sixth
            header button because the chrome has no room for one — `e2e/chrome-fit`
            holds this header inside 320px with seventeen pixels to spare, which
            is the same constraint that put the colophon behind the wordmark. It
            still shows the page, unchanged, at the same width. */}
        <button
          type="button"
          className={styles.pageId}
          aria-label={t.mapOpen(page)}
          aria-haspopup="dialog"
          onClick={() => {
            setRevisionAt(undefined);
            setRevisionOpen(true);
          }}
        >
          <span className={styles.pageLabel}>{t.pageWord}</span>
          <span className={`${styles.pageNum} numeric`}>{t.num(page)}</span>
        </button>
        {/* Wayfinding lives in the chrome because it is always available: the
            keyboard has `/`, and a touch device needs something to press. */}
        <button
          type="button"
          className={styles.chromeBtn}
          aria-label={t.goToLong}
          aria-haspopup="dialog"
          onClick={() => setJumperOpen(true)}
        >
          ⌖
        </button>
        <button
          type="button"
          className={styles.chromeBtn}
          aria-label={t.mushaf}
          aria-haspopup="dialog"
          onClick={() => setEditionOpen(true)}
        >
          ▤
        </button>
        {/* The skin switch sits in the chrome, next to the other always-on
            controls: it is a way of *reading* the page, not a per-selection
            action, and its beta badge has to be visible before it is used. */}
        <SkinToggle
          skin={skin}
          onChange={setSkin}
          onOpenLegend={() => setLegendOpen(true)}
        />
        {/* The controls a phone had no room for — the language switch (buried in
            the colophon sheet because the header has seventeen pixels of slack
            at 320px) and the keyboard map (which a phone cannot reach at all).
            Hidden by CSS below the breakpoint, so it costs this row nothing:
            `display: none` keeps it out of both the intrinsic width and the
            accessibility tree, which is what chrome-fit and the aria snapshots
            measure. See docs/decisions/desktop-vs-mobile.md rows 3 and 13. */}
        <DesktopChrome
          pageMode={pageMode}
          onPageMode={handlePageMode}
          zoom={zoom}
          onZoom={handleZoom}
        />
        {/* No install button here. There used to be one, and it was a ~126px
            text pill in a row that could not afford 126px on any phone — on
            Android, the one platform where it ever rendered, it was the single
            largest thing in the chrome. It also said nothing OfflineNotice does
            not already say better: the `install-prompt` notice fires the same
            `promptInstall()`, gives the reason (the pages you visited stay on
            your device), and can be dismissed. A permanent navigation row is
            the wrong lane for a promo that disappears the moment it is used. */}
      </header>

      {/* Offline durability, when there is something honest to say about it:
          a capped quota, a missing install, a denied persist(). Silent when
          storage is persisted — the good case earns no chrome.

          Held while the coach strip is up. Both are strips in the layout, and
          both were right to be: neither may cover an ayah. Stacked they cost
          226px on a 412×839 phone — the stage drops from 713px to 487px, a
          third of it, on exactly the visit where a reader is deciding what
          this app is. So they take turns, and the teaching goes first: one
          asks for a tap now, the other warns about eviction that may never
          come.

          Always held in the pitch build: it is shown to visitors in a room,
          who are judging the page, and storage that may be cleared next week is
          nothing they need to hear about. */}
      <OfflineNotice
        hold={coachUp || PITCH}
        onShowPacks={() => {
          setRevisionAt("juz");
          setRevisionOpen(true);
        }}
      />

      {/* The three verbs, once, in the layout rather than over the page — the
          first tap it teaches has to land while the strip is still up. */}
      <CoachMarks
        ready={resolver !== null}
        open={coachUp}
        onDismiss={() => setCoachUp(false)}
      />

      {/* Pinned RTL, in both languages. The mus'haf is read right-to-left, the
          page-turn convention follows it (Loop 1's decision), and the hop rail
          anchors to `inset-inline-start` — under an LTR chrome the rail would
          swap to the side the reader's thumb is not on and the arrow keys would
          argue with the page. */}
      {/* Its own row above the book, not floated over it: floated, it sat on
          the page's first line. */}
      {resolver && desktop && penAt === "strip" && <PageToolbar tool={tool} locked={locked} onTool={chooseTool} pen={pen} onPen={choosePen} />}
      {resolver && desktop && penAt === "float" && <PenHomeFloat tool={tool} locked={locked} onTool={chooseTool} pen={pen} onPen={choosePen} />}
      {resolver && desktop && penAt === "side" && <PenHomeSide tool={tool} locked={locked} onTool={chooseTool} pen={pen} onPen={choosePen} />}
      {resolver && !desktop && phoneBar === "a" && <PhoneToolbarA tool={tool} locked={locked} onTool={chooseTool} />}
      <main
        ref={roomRef}
        className={styles.main}
        dir="rtl"
        /* The bookmark tool's tap on a page's margin, where there is no ayah to
           hear it. A tap on an ayah has already been taken by `handleSelect`,
           which put the tool down, so this sees "select" and does nothing. */
        onClick={(e) => {
          if (toolRef.current !== "bookmark") return;
          const leaf = (e.target as Element).closest?.("[data-page]");
          const p = Number(leaf?.getAttribute("data-page"));
          if (p > 0) dropWithTool(p);
        }}
      >
        {resolver && (
          <>
            {/* At desktop width the stage is one leaf of an open mus'haf: the
                lower page number on the right, the next page to its left, and
                the facing leaf drawn as *absent* when this build does not hold
                it — which for hafs-kfqc is now never, since Loop 4b vendored all
                604. Below the breakpoint this renders the stage alone and
                nothing else changes. docs/design/desktop.md. */}
            <PageSpread
              enabled={desktop}
              page={page}
              total={totalPages}
              available={pageTurns.pages}
              bookRef={bookRef}
              /* `desktop &&` is belt and braces — below the breakpoint the
                 spread renders its child alone and never reads this. It stays
                 because the mode is now the reader's own standing answer rather
                 than a flag a gesture sets: it survives a trip down to phone
                 width and back, which is what an explicit control should do, and
                 which is exactly why the guard has to be here rather than in the
                 state. */
              solo={desktop && pageMode === "one"}
              /* The grabbable fore-edges. Only above the breakpoint is there a
                 book with two outer edges to grab; the phone still turns by
                 swiping the leaf itself, so it gets no rails and keeps its
                 gesture. */
              /* The look-alike chips, on the desk just outside the live page's
                 outer edge rather than out at the window's corner. */
              beside={(side) => hopRail(side)}
              // By the chosen verse's page, the side its note does not cover.
              besideSide={sheetSide === "left" ? "right" : sheetSide === "right" ? "left" : undefined}
              edgeRails={
                desktop ? (
                  <EdgeGrabRails
                    driver={edgeTurn}
                    aside={tool === "sign" || tool === "word"}
                    peel={manifest ? peelPagesOf(manifest.edition, page, totalPages, pageTurns.pages) : undefined}
                    turnStyle={turnStyle}
                    opening={page}
                    playRef={playTurnRef}
                  />
                ) : undefined
              }
              renderFacing={(facing) => (
                /* The facing leaf gets its own stage rather than a second
                   visible host inside the current one: PageStage's whole
                   correctness argument is that there is exactly one imperative
                   write path to one visible host, and two transforms inside it
                   is a bigger change than two instances beside each other.
                   Its ref carries one thing only — magnification, so the opening
                   grows as a pair (`facingStageRef`). It is still not how the
                   book is *steered*: a hop or a turn goes through the live stage,
                   and a landing on this leaf would relocate the reader here
                   anyway, at which point the two swap roles through `page`.
                   Handlers are shared so an ayah on the facing leaf is as
                   tappable as one on this leaf. */
                <PageStage
                  key={facing}
                  ref={facingStageRef}
                  resolver={resolver}
                  page={facing}
                  total={totalPages}
                  mountedPages={[facing]}
                  /* Its share of the book's DOM budget, not a budget of its
                     own: two stages each holding the full cap is a desktop
                     reader holding twice what a phone reader does, silently
                     (`docs/performance.md` ④). It asks for one page and never
                     receives hop targets, so its share is the smaller one. */
                  pageBudget={spreadBudget().facing}
                  label={t.pageN(facing)}
                  selectedKey={selectedKey}
                  breadcrumbKey={breadcrumbKey}
                  rangeKeys={selectedRange}
                  onSelect={handleVerse}
                  onCornerHold={setCornerMenu}
                  onSelectRange={handleSelectRange}
                  /* Both leaves, unlike `dragToTurn`: a word run is a question
                     about the ayah that is selected, and on a spread that ayah
                     is as often printed on this leaf as on the other one. */
                  onSelectWords={handleSelectWords}
                  onTurn={stepPage}
                  /* Both leaves, for the same reason `onTurn` is on both: a
                     wheel over the facing page that did nothing would read as a
                     dead half of the book. */
                  onJuzTurn={stepJuz}
                  /* The wheel, yes; a drag, no. Only the stage App holds a ref
                     to can be handed a tracked band, and a second fold drawn
                     into the same book is the one thing §3.4 forbids. */
                  dragToTurn={false}
                  bound
                  tool={tool}
                  notes={notes}
                  noteLabel={noteLabel}
                  verseDots={verseDots}
                  verseDotLabel={t.verseInNotes}
                  paintIntro={paintIntro}
                  onOpenIntro={openIntro}
                  paintVerses={paintVerses}
                  onOpenVerseMenu={openVerseMenu}
                  confusionMarks={confusionMarks}
                  confusionMarkLabel={t.jumpsFrom}
                  waslMarksOf={waslMarksOf}
                  waslMarkLabel={t.jumpsAtWasl}
                  jumpArrows={shownArrows}
                  jumpArrowLabel={t.jumpArrowLabel}
                  jumpArrowEnd={t.jumpArrowEnd}
                  onJump={onJump}
                  onOpenVerseNotes={openVerseNotes}
                  onOpenJumps={openJumps}
                  onPlaceNote={placeNote}
                  onOpenNote={setNoteOpenId}
                  onMarkWord={markWord}
                onPickSign={pickSignNote}
                onOpenWord={setWordOpen}
                onCrop={setCrop}
                  labelFor={(key) => t.ayahAria(t.ayahLabel(key) ?? key)}
                  skin={skin}
                  tajweedLookup={tajweed?.lookup ?? null}
                  overlay={ribbonsFor(facing)}
                />
              )}
            >
              <PageStage
                ref={stageRef}
                coverTop={highestTop(coverTop, shareTop, listTop)}
                railBottom={railBottom}
                resolver={resolver}
                page={page}
                total={totalPages}
                mountedPages={mountedPages}
                /* Only on a spread is there a second leaf to share with; below
                   the breakpoint this stage is the whole book, so it is the
                   whole budget. */
                pageBudget={desktop ? spreadBudget().reading : MOUNTED_PAGE_CAP}
                label={t.pageN(page)}
                selectedKey={selectedKey}
                introSurah={introSheet ? introSurah : null}
                breadcrumbKey={breadcrumbKey}
                rangeKeys={selectedRange}
                onSelect={handleVerse}
                onCornerHold={setCornerMenu}
                onSelectRange={handleSelectRange}
                onSelectWords={handleSelectWords}
                /* Every turn ends where the arrow keys end — one `stepPage`, so
                   a wheel turn, a dragged turn and a keyed turn cannot drift
                   apart. Both stages get it: on a spread the facing leaf is as
                   much the book as this one, and a wheel over it that did
                   nothing would read as a dead half of the page. */
                onTurn={stepPage}
                onJuzTurn={stepJuz}
                /* And the drag needs to know where it *would* land before it
                   lands, so the fold under the finger is drawn for the pair the
                   release will actually produce — the inventory's pair. With
                   7/9/19 that was not `page ± 1`; with all 604 vendored it is,
                   and this stays because the next edition will be partial. */
                turnTargetOf={pageAfter}
                labelFor={(key) => t.ayahAria(t.ayahLabel(key) ?? key)}
                skin={skin}
                tajweedLookup={tajweed?.lookup ?? null}
                overlay={ribbonsFor(page)}
                /* On the desktop spread the page turns by its fore-edge, not by
                   a swipe across its middle: the edge rails drive the fold, and
                   the stage's own swipe-to-turn is off so a drag through the
                   text is free to pan and select. The phone keeps the swipe —
                   it has no rails and no edge to spare — and so does one page
                   on a touch screen, such as a large iPad held upright: one
                   page has no rails either, and a finger expects to swipe. */
                dragToTurn={!desktop || (pageMode === "one" && touchScreen)}
                /* Only the live stage turns pages, and only on a desktop
                   spread does the fold belong to something wider than it. */
                foldTarget={desktop ? bookRef : null}
                turnStyle={turnStyle}
                bound={desktop && pageMode === "two"}
                tool={tool}
                notes={notes}
                noteLabel={noteLabel}
                verseDots={verseDots}
                verseDotLabel={t.verseInNotes}
                paintIntro={paintIntro}
                onOpenIntro={openIntro}
                paintVerses={paintVerses}
                onOpenVerseMenu={openVerseMenu}
                confusionMarks={confusionMarks}
                confusionMarkLabel={t.jumpsFrom}
                waslMarksOf={waslMarksOf}
                waslMarkLabel={t.jumpsAtWasl}
                jumpArrows={shownArrows}
                jumpArrowLabel={t.jumpArrowLabel}
                jumpArrowEnd={t.jumpArrowEnd}
                onJump={onJump}
                onOpenVerseNotes={openVerseNotes}
                onOpenJumps={openJumps}
                onPlaceNote={placeNote}
                onOpenNote={setNoteOpenId}
                onMarkWord={markWord}
                onPickSign={pickSignNote}
                onOpenWord={setWordOpen}
                onCrop={setCrop}
              />
            </PageSpread>
            {/* On a phone the chips float in the stage's top corner. Above the
                breakpoint the spread places them itself, on the desk beside the
                live page (`beside`, above). */}
            {!desktop && hopRail()}
            <HopPopover
              chip={openChip}
              fromKey={selectedKey}
              side={sheetSide}
              canHop={canHop}
              onHop={handleHop}
              onClose={() => setOpenDirection(null)}
              onCover={setListTop}
            />
            <HighlightMenu
              rangeKeys={selectedRange}
              hops={rangeHops}
              side={sheetSide}
              canHop={canHop}
              onHop={handleRangeHop}
              shareState={currentState}
              onClear={handleClearCurrent}
              // Dismissing the menu drops the highlight with it: a wash with no
              // menu would be a dead end (nothing re-opens it but a fresh drag).
              onClose={() => setSelectedRange(null)}
            />
            {rootsMounted && (
              <Suspense fallback={null}>
                <RootLens
                  families={rootFamilies}
                  loading={rootsLoading}
                  side={sheetSide}
                  curated={curatedRoots}
                  canHop={canHop}
                  onHop={handleRootHop}
                  onHopEdge={handleHop}
                  onClose={() => setRootsOpen(false)}
                  onCover={setListTop}
                />
              </Suspense>
            )}
            {COMMENTARY && (
              <CommentarySheet
                // One drawer for a verse at a time: a chip's list or the root
                // lens takes the note's place, and closing it brings the note
                // back (commentaryOpen stays true underneath). Both used to
                // stack, squeezing the page on a phone and hiding the list
                // under the note on a spread. A long press's menu waits the
                // same way where the note is a card over the page's foot.
                entry={
                  openChip || rootsOpen || verseMenuAt || (verseMenu && !sheetSide)
                    ? null
                    : (introSheet ?? (commentaryOpen ? commentaryEntry : null))
                }
                side={sheetSide}
                roads={introSheet ? [] : commentaryRoads}
                canHop={canHop}
                onHop={handleHop}
                onGo={hopTo}
                onCover={setCoverTop}
                onTall={setNoteTall}
                onClose={() => (introSheet ? setIntroSurah(null) : setCommentaryOpen(false))}
                creditNote={PITCH ? t.pitchCredit : undefined}
                sigla={pitchKey}
                back={
                  breadcrumbKey && !introSheet
                    ? {
                        label: t.ayahLabel(breadcrumbKey) ?? breadcrumbKey,
                        onBack: () => handleBeadBack(trail.length - 1),
                      }
                    : null
                }
              />
            )}
          </>
        )}
      </main>

      <Jumper
        open={jumperOpen || jumpNaming !== null}
        onJump={(target) => {
          if (!jumpNaming) return handleJump(target);
          if (!resolver) return;
          saveJump(jumpNaming, formatAyahKey(resolver.edition, target.surah, target.ayah));
        }}
        onClose={() => {
          setJumperOpen(false);
          setJumpNaming(null);
          setJumpRenaming(null);
        }}
      />
      {jumpAsking && (
        <JumpPicker
          head={t.jumpWhere(jumpAsking.from.key)}
          anchor={jumpAsking.at}
          choices={jumpChoices(adjacency?.hopsForKey(jumpAsking.from.key) ?? [], jumpAsking.from.key, t)}
          notSure={t.jumpNotSure}
          another={t.jumpAnother}
          onPick={(to) => saveJump(jumpAsking.from, to)}
          onNotSure={() => saveJump(jumpAsking.from, null)}
          onAnother={() => {
            setJumpNaming(jumpAsking.from);
            setJumpAsking(null);
          }}
          onClose={closeJumpAsking}
        />
      )}
      {/* CC BY 4.0's condition, discharged where a reader can see it — the
          licence the rule spans ship under requires the credit to travel with
          the work, not just with the repo. */}
      <TajweedLegend
        open={legendOpen}
        counts={tajweedCounts}
        page={page}
        selection={tajweedSelection}
        credit={{
          text: t.tajweedCredit,
          href: "https://github.com/cpfair/quran-tajweed",
        }}
        onClose={() => setLegendOpen(false)}
      />
      {editionMounted && (
        <Suspense fallback={null}>
          <EditionPicker
            open={editionOpen}
            current={manifest?.edition ?? ""}
            currentKey={selectedKey}
            concordance={concordance}
            onSelect={handleEditionSelect}
            onClose={() => setEditionOpen(false)}
          />
        </Suspense>
      )}
      {colophonMounted && (
        <Suspense fallback={null}>
          <Colophon
            open={colophonOpen}
            onClose={() => setColophonOpen(false)}
            fisheye={fisheye}
            onToggleFisheye={toggleFisheye}
            turnStyle={turnStyle}
            onTurnStyle={chooseTurnStyle}
            verseGestures={verseGestures}
            onVerseGestures={chooseVerseGestures}
            arrowShowing={arrowShowing}
            onArrowShowing={chooseArrowShowing}
            scopeLook={scopeLook}
            onScopeLook={chooseScopeLook}
            penHome={desktop ? penHome : undefined}
            onPenHome={desktop ? choosePenHome : undefined}
            onShowTips={() => {
              setColophonOpen(false);
              setCoachUp(true);
            }}
          />
        </Suspense>
      )}
      {/* `onGoToPage` is the app's own page-turner, handed over unchanged: a
          press on a map cell is a jump, and everything a jump owes — refusing an
          unvendored page, cancelling one in flight, saying where it landed —
          already lives in `goToPage`. A second route to a page would be a second
          announcer, and the two would drift. */}
      {revisionMounted && (
        <Suspense fallback={null}>
          <RevisionMap
            open={revisionOpen}
            onClose={() => setRevisionOpen(false)}
            pages={manifest?.pages ?? []}
            edition={manifest?.edition ?? ""}
            totalPages={totalPages}
            page={page}
            onGoToPage={goToPage}
            openAt={revisionAt}
          >
            <BookmarkShelf
              bookmarks={bookmarks}
              onOpen={openFromShelf}
              onClearSurah={(surah) => {
                const next = clearSurah(bookmarks, surah);
                commitBookmarks(next, t.bmCleared(bookmarks.length - next.length));
              }}
              onClearAll={() => commitBookmarks([], t.bmCleared(bookmarks.length))}
              onSave={saveBookmarkFile}
              hasNotes={notes.length > 0 || confusions.length > 0}
              onLoad={loadBookmarkFile}
            />
            <NoteShelf notes={noteShelf} onFollow={openNoteOf} />
            <JumpShelf jumps={jumpShelf} dismissed={jumpsDismissed} onGo={goToJumpFrom} onBringBack={bringBackJump} />
          </RevisionMap>
        </Suspense>
      )}

      {drawerMounted && (
        <Suspense fallback={null}>
          <BookmarkDrawer
            bookmark={drawerBookmark}
            moveLabel={moveTarget ? (t.ayahLabel(moveTarget.key) ?? t.pageN(moveTarget.page)) : null}
            onRename={(name) => {
              if (!drawerBookmark) return;
              const next = renameBookmark(bookmarks, drawerBookmark.id, name, Date.now());
              const renamed = next.find((b) => b.id === drawerBookmark.id);
              if (renamed && renamed.name !== drawerBookmark.name)
                commitBookmarks(next, t.bmRenamed(renamed.name));
              setDrawerId(null);
            }}
            onMoveHere={() => {
              if (!drawerBookmark || !moveTarget) return;
              commitBookmarks(
                moveBookmark(bookmarks, drawerBookmark.id, moveTarget, Date.now()),
                t.bmMoved(drawerBookmark.name, moveTarget.page),
              );
              setDrawerId(null);
            }}
            onLift={() => {
              if (!drawerBookmark) return;
              commitBookmarks(liftBookmark(bookmarks, drawerBookmark.id), t.bmLifted(drawerBookmark.name));
              setDrawerId(null);
            }}
            onAddAnother={() => {
              if (drawerBookmark) dropOn(drawerBookmark.page);
            }}
            onClose={() => setDrawerId(null)}
          />
        </Suspense>
      )}

      {/* Pinned RTL with the stage, and for the same reason: the trail reads
          oldest-to-newest in the mus'haf's own direction, and its beads sit
          under the rail they came from. */}
      {/* A row of its own above the bottom line while following a note: it
          takes its height from the page, so it covers no tool and no verse. */}
      {following && followed && (
        <NoteFollow
          title={noteTitle(followed) || t.noteUntitled}
          words={followed.text.split("\n").slice(1).join("\n").trim()}
          at={Math.min(following.at, followed.verses.length - 1)}
          count={followed.verses.length}
          onStep={(at) => followNote(followed.id, at)}
          onStop={stopFollowing}
        />
      )}
      <footer className={styles.trail} aria-label={t.trail} dir="rtl" data-keep-clear="">
        {resolver && desktop && penAt === "bottom" && <PenHomeBottom tool={tool} locked={locked} onTool={chooseTool} pen={pen} onPen={choosePen} />}
        {resolver && !desktop && phoneBar === "b" && <PhoneToolbarB tool={tool} locked={locked} onTool={chooseTool} />}
        {resolver && !desktop && phoneBar === "c" && <PhoneToolbarC tool={tool} locked={locked} onTool={chooseTool} pen={pen} onPen={choosePen} />}
        <TrailBeads
          trail={trail}
          currentKey={selectedKey}
          onBeadBack={handleBeadBack}
          onClearCurrent={handleClearCurrent}
          hint={
            tool === "read" || (!desktop && phoneBar !== "c" && tool !== "select")
              ? toolHint(t, tool, true)
              : // The pitch build's tap opens a Study Quran note, and this line
                // is all a first visit is told (the tips open only from
                // settings), so it says so, in the app's language. Only the
                // book's name is pitch copy; dropped from the public build
                // with PITCH. A mouse is told to click, a finger to tap.
                PITCH
                ? touchScreen
                  ? t.tapForNote("Study Quran")
                  : t.clickForNote("Study Quran")
                : undefined
          }
        />
        {verseGestures !== "a" && (
          <button type="button" className={styles.fullBtn} onClick={() => setFull(true)}>
            {t.fullScreen}
          </button>
        )}
        {/* Screen-reader-only summary of what the rail is offering. It used to
            read «السورة 2 · 1 روابط» — the surah as a bare number a listener has
            no way to map back to a name, and Latin digits inside an Arabic
            phrase. Every other label in the app says «البقرة» and «٢:٤٨»; the
            one string nobody could see was the one that drifted. */}
        {selectedSurah && (
          <span className="sr-only">
            {t.railSummary(t.surahName(selectedSurah), chips.length)}
          </span>
        )}
      </footer>

      {/* The verse's tools, in one drawer over the bar and the slider (selection
          = D). It steps aside while a sheet it opened is up, and comes back when
          that sheet closes; its × or Escape puts it away until the next verse.
          The number's menu is one of those: it lists the same things, so the
          two never show at once. */}
      <VerseDrawer
        label={selectedKey ? (t.ayahLabel(selectedKey) ?? selectedKey) : null}
        open={
          selectedKey !== null &&
          !drawerAway &&
          !full &&
          (tool === "select" || tool === "highlight") &&
          !rootsOpen &&
          !commentaryOpen &&
          !introSheet &&
          openDirection === null &&
          verseMenuAt === null
        }
        onClose={putDrawerAway}
      >
        <PlayTrigger
          selectedKey={selectedKey}
          label={selectedKey ? (t.ayahLabel(selectedKey) ?? selectedKey) : null}
          phase={audio.phaseFor(selectedKey)}
          onToggle={audio.toggle}
          caption={audio.phaseFor(selectedKey) === "playing" ? t.vdPause : t.vdListen}
        />
        {COMMENTARY && (
          <CommentaryTrigger
            source={commentarySource?.source.label ?? ""}
            has={hasCommentary}
            open={commentaryOpen}
            onToggle={() => setCommentaryOpen((o) => !o)}
            caption={t.vdCommentary}
          />
        )}
        <RootLensTrigger
          count={rootCount}
          curated={curatedRoots.length}
          open={rootsOpen}
          onToggle={() => setRootsOpen((o) => !o)}
          caption={t.vdRoots}
        />
        <ShareSheet
          state={selectedKey ? currentState : null}
          hasTrail={trail.length > 0}
          pitch={PITCH}
          onCover={setShareTop}
        />
        {selectedKey && (
          <DrawerTool
            glyph="⚑"
            caption={t.vdBookmark}
            label={t.vdBookmarkAria(t.ayahLabel(selectedKey) ?? selectedKey)}
            onClick={() => {
              const at = resolver?.resolve(selectedKey)?.page;
              if (at !== undefined) dropOn(at, selectedKey);
            }}
          />
        )}
        <QulTrigger
          selectedKey={selectedKey}
          label={selectedKey ? (t.ayahLabel(selectedKey) ?? selectedKey) : null}
          caption={t.vdQul}
        />
        {/* The fuller drawer of options A and B: what C keeps for its hold. */}
        {selectedKey && verseGestures !== "c" && (
          <>
            <DrawerTool glyph="⏭" caption={t.vdPlayTo} label={t.vdPlayToAria(t.ayahLabel(selectedKey) ?? selectedKey)} onClick={() => startPlayTo(selectedKey)} />
            <DrawerTool glyph="✎" caption={t.vdMark} label={t.vdMarkAria(t.ayahLabel(selectedKey) ?? selectedKey)} onClick={() => markVerse(selectedKey)} />
            <DrawerTool glyph="✍" caption={t.vdNote} label={t.vdNoteAria(t.ayahLabel(selectedKey) ?? selectedKey)} onClick={() => noteOnVerse(selectedKey)} />
            <DrawerTool glyph="⧉" caption={t.vdCopy} label={t.vdCopyAria(t.ayahLabel(selectedKey) ?? selectedKey)} onClick={() => copyVerse(selectedKey)} />
            <DrawerTool glyph="↝" caption={t.vdJump} label={t.vdJumpAria(t.ayahLabel(selectedKey) ?? selectedKey)} onClick={() => askJumpFrom(selectedKey)} />
          </>
        )}
      </VerseDrawer>

      {verseMenu && (
        <VerseMenu
          name={t.verseMore(t.ayahLabel(verseMenu.key) ?? verseMenu.key)}
          around={verseMenu.around}
          onClose={closeVerseMenu}
          items={[
            { caption: t.vdPlayTo, onPick: () => startPlayTo(verseMenu.key) },
            { caption: t.vdMark, onPick: () => markVerse(verseMenu.key) },
            { caption: t.vdNote, onPick: () => noteOnVerse(verseMenu.key) },
            { caption: t.vdCopy, onPick: () => copyVerse(verseMenu.key) },
            // Straight to "where did it take you?", with no arrow to draw: the
            // phone's way in, where a finger is already resting on the verse.
            { caption: t.vdJump, onPick: () => askJumpFrom(verseMenu.key, verseMenu.around) },
          ]}
        />
      )}
      {cornerMenu && cornerMenuOf && (
        <VerseMenu
          name={t.verseMore(cornerMenuOf.name)}
          around={cornerMenu.around}
          onClose={closeCornerMenu}
          items={cornerMenuOf.items}
        />
      )}
      {/* The way back from full screen, for B and C; A's way back is a tap. */}
      {full && verseGestures !== "a" && (
        <button type="button" className={styles.showBars} onClick={() => setFull(false)}>
          {t.showBars}
        </button>
      )}

      {/* The bottom-most chrome, and the second way through the book after the
          jumper: a track the length of the whole mus'haf with a page turn on
          each edge. Pinned RTL like the stage and the trail — page 1 is on the
          right, and the button that moves forward is on the left. */}
      <PageSlider
        total={totalPages}
        available={pageTurns.pages}
        page={page}
        onStep={stepPage}
        onGoTo={handleScrubTo}
        onJuzTap={goToJuz}
        juzStarts={juzStarts}
        hizbStarts={hizbStarts}
        pageContext={pageContext}
        fisheye={fisheye}
      />

      {PITCH && verseMenuAt && verseMenuItems.length > 0 && (
        <VerseMenu
          name={t.verseMenu(verseMenuAt.key)}
          around={verseMenuAt.around}
          clear={verseMenuAt.clear}
          follow={verseMenuAt.locate}
          items={verseMenuItems}
          onClose={closeNumberMenu}
          stacked
        />
      )}

      {verseNotesAt && verseNotes.length > 0 && (
        <Suspense fallback={null}>
          <VerseNotes
            head={t.verseInNotes(verseNotesAt.key, verseNotes.length)}
            notes={verseNotes}
            anchor={verseNotesAt.anchor}
            onFollow={(id) => {
              const key = verseNotesAt.key;
              closeVerseNotes();
              followNote(id, Math.max(0, scoped.find((n) => n.id === id)?.verses.findIndex((v) => v.key === key) ?? 0));
            }}
            onClose={closeVerseNotes}
          />
        </Suspense>
      )}

      {jumpsAt && jumpRows.length > 0 && (
        <Suspense fallback={null}>
          <JumpList
            head={t.jumpList(jumpsAt.key)}
            fromKey={jumpsAt.key}
            rows={jumpRows}
            anchor={jumpsAt.anchor}
            onGo={(to) => {
              const from = jumpsAt.key;
              closeJumps();
              hopTo(to, from);
            }}
            onAgain={againJump}
            onBeaten={beatJump}
            onDismiss={dismissJump}
            onDelete={deleteJump}
            onSayWhere={(id) => {
              const from = jumpsAt.key;
              closeJumps();
              askJumpFrom(from);
              setJumpRenaming(id);
            }}
            onClose={closeJumps}
          />
        </Suspense>
      )}

      {labelNotes && (
        <Suspense fallback={null}>
          <VerseNotes
            head={labelNotes.head}
            notes={notesAbout(scoped, labelNotes.scope, pageOfKey).map(shelfItem)}
            anchor={{ top: labelNotes.around.top, bottom: labelNotes.around.bottom, x: labelNotes.around.left + labelNotes.around.width / 2 }}
            onFollow={(id) => {
              setLabelNotes(null);
              openNoteOf(id);
            }}
            onClose={closeLabelNotes}
          />
        </Suspense>
      )}
      {labelNote && (
        <Suspense fallback={null}>
          <NoteBox
            key={labelNote.id}
            note={labelNote}
            label={scopeName(labelNote.scope)}
            about={aboutOf(labelNote)}
            scopeLook={scopeLook}
            onClose={closeLabelNote}
            onDelete={deleteLabelNote}
          />
        </Suspense>
      )}
      {openNote && (
        <Suspense fallback={null}>
          <NoteBox
            key={openNote.id}
            note={openNote}
            label={t.ayahLabel(openNote.key) ?? openNote.key}
            about={openAbout}
            scopeLook={scopeLook}
            deleteLabel={(noteOfPin(openNote.id)?.verses.length ?? 0) > 1 ? t.noteVerseOut : undefined}
            onClose={closeNote}
            onDelete={deleteNote}
            choices={noteChoices}
            onJoin={joinOpenNote}
            joined={
              joined && joined.pin === openNote.id
                ? { said: t.noteJoined(t.ayahLabel(openNote.key) ?? openNote.key), onUndo: undoJoin }
                : null
            }
          />
        </Suspense>
      )}
      {crop && manifest && (
        <Suspense fallback={null}>
          <CropHost key={`${crop.page}:${crop.x}:${crop.y}`} manifest={manifest} box={crop} onClose={() => setCrop(null)} />
        </Suspense>
      )}
      {wordOpen && manifest && (
        <Suspense fallback={null}>
          <WordPartsHost
            key={`${wordOpen.key}#${wordOpen.word}`}
            manifest={manifest}
            page={wordOpen.page}
            verseKey={wordOpen.key}
            word={wordOpen.word}
            label={t.ayahLabel(wordOpen.key) ?? wordOpen.key}
            anchor={() => wordOpen.rect}
            mode="note"
            docked
            onPick={(mark, _name, at) => pickWordPart({ ...at, mark })}
            onPickMany={(marks, at) => pickWordPart({ ...at, marks })}
            onPickLetter={(letter, at) => pickWordPart({ ...at, letter })}
            onClose={() => setWordOpen(null)}
          />
        </Suspense>
      )}
      {picking && manifest && picking.word !== null && (
        <Suspense fallback={null}>
          <WordPartsHost
            key={picking.id}
            manifest={manifest}
            page={picking.page}
            verseKey={picking.key}
            word={picking.word}
            label={t.ayahLabel(picking.key) ?? picking.key}
            anchor={() => {
              const r = [...document.querySelectorAll(`[data-mistake-word="${CSS.escape(picking.id)}"]`)]
                .map((el) => el.getBoundingClientRect())
                .find((b) => b.width > 0);
              return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
            }}
            mode="mistake"
            chosen={picking.mark ?? null}
            onPick={(mark, name) => pickSign(mark, name)}
            onClear={clearMistake}
            onClose={() => setPickingId(null)}
          />
        </Suspense>
      )}
      {unfolded ? (
        <UndoBar said={unfolded.said} onUndo={undoUnfold} onDone={endUndo} />
      ) : jumpUndo ? (
        <UndoBar key={jumpUndo.said} said={jumpUndo.said} onUndo={undoJump} onDone={endJumpUndo} />
      ) : (
        deletedNote && <UndoBar said={deletedNote.said} onUndo={undoDelete} onDone={endNoteUndo} />
      )}
      <LiveAnnouncer message={message} />
    </div>
  );
}

/**
 * The verses a jump from `from` most likely went to, for the list that asks:
 * its look-alikes, once each, the word-for-word twins first.
 */
function jumpChoices(hops: readonly Edge[], from: string, t: Strings): JumpChoice[] {
  const seen = new Set<string>([from]);
  const twins: JumpChoice[] = [];
  const rest: JumpChoice[] = [];
  for (const h of hops) {
    if (seen.has(h.to) || !parseAyahKey(h.to)) continue;
    seen.add(h.to);
    const choice = { key: h.to, label: t.ayahLabel(h.to) ?? h.to, ...(h.twin ? { about: t.jumpTwin } : {}) };
    (h.twin ? twins : rest).push(choice);
  }
  return [...twins, ...rest];
}

/** The crop tool's sheet, given the page's drawing and its size. */
function CropHost({
  manifest,
  box,
  onClose,
}: {
  manifest: AssetManifest;
  box: CropBox;
  onClose: () => void;
}): JSX.Element {
  const [, , w, h] = (manifest.pages.find((p) => p.page === box.page)?.viewBox ?? "0 0 345 550")
    .split(/\s+/)
    .map(Number);
  return (
    <CropSheet
      box={box}
      pageSrc={pageUrl(manifest.edition, box.page)}
      pageSize={{ w: w || 345, h: h || 550 }}
      onClose={onClose}
    />
  );
}

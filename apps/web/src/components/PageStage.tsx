import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import {
  clampView,
  clampZoom,
  easeInOutCubic,
  foldBetween,
  formatWordKey,
  frameBboxToView,
  isViewportIntent,
  isWordShard,
  leafSideOf,
  lerpView,
  marqueeRect,
  nextIntent,
  nextWheelTurn,
  normalizeWheelDelta,
  retainPages,
  MOUNTED_PAGE_CAP,
  parseAyahKey,
  turnCommit,
  viewFitsAcross,
  Highlighter,
  WordIndex,
  DEFAULT_HOP_ZOOM,
  WHEEL_GAP_MS,
  WHEEL_TURN_REST,
  type Fold,
  type PointerIntent,
  type Resolver,
  type SkinId,
  type StageFit,
  type TajweedLookup,
  type View,
  type WheelTurnState,
} from "@hifth/core";
import { loadPageSvg, loadWordShard } from "../assets";
import { useT } from "../i18n";
import styles from "./PageStage.module.css";

interface PageStageProps {
  resolver: Resolver;
  /** The page currently shown. */
  page: number;
  /**
   * How many pages the print has, so a leaf can say which of its edges is free.
   *
   * It has to be passed rather than assumed: `leafSideOf` needs the page count
   * to refuse a page the edition does not have, and the stage is edition-blind
   * by design — it is handed a resolver and a number, and 604 is a fact about
   * hafs-kfqc, not about stages.
   */
  total: number;
  /**
   * Pages to keep mounted, **most wanted first** — the current page, then the
   * selection's hop targets in rail order, which is hifz order.
   *
   * A request, not an instruction: past `pageBudget` the tail is dropped
   * (`retainPages`). The order matters because of what gets dropped — with the
   * whole print vendored a densely connected ayah's fan-out is longer than any
   * phone should hold, and the pages worth keeping are the ones the reader is
   * likeliest to tap.
   */
  mountedPages: readonly number[];
  /**
   * How many pages this stage may hold at once. Defaults to the whole DOM
   * budget; a leaf of an open spread is given its share of it (`spreadBudget`),
   * because two stages each holding the full cap is a book holding twice what a
   * phone does. `docs/backlog.md` ③ ④.
   */
  pageBudget?: number;
  /** Human label for the a11y region, e.g. "Page 7". */
  label: string;
  /** The currently selected ayah key (controlled by L3), or null. */
  selectedKey: string | null;
  /** The origin ayah to mark with the breadcrumb group (persists across hops). */
  breadcrumbKey: string | null;
  /** Fired when the user taps an ayah polygon. */
  onSelect: (key: string) => void;
  /**
   * Fired when a marquee drag releases over ayahs (spec §3 `onRangeSelect`).
   * `keys` is the contiguous run the highlighter resolved, in reading order;
   * `fromKey`/`toKey` are its endpoints — the range link form (spec §7).
   */
  onSelectRange?: (fromKey: string, toKey: string, keys: readonly string[]) => void;
  /**
   * Fired when a word run inside the selected ayah releases (word-C): the
   * `…/2:48#w3-7` key, and the ayah it refines.
   *
   * Separate from `onSelectRange` because it answers a different question with a
   * different vocabulary — a range of *ayahs* the reader swept across, against a
   * run of *words* inside the one they already chose — and separate from
   * `onSelect` because the ayah has not changed: dropping to words is a descent
   * into the current selection, not a new one, and routing it through `onSelect`
   * would put a `#w` key into `selectedKey`, which the highlighter resolves as an
   * ayah and would clear.
   *
   * Fired on every settled run, from the finger and from the keyboard alike: a
   * drag says it once on release, an arrow key says it on each step, because each
   * step is a finished statement about a different set of words. App answers it
   * out loud with the *outcome* — how many places the run is about — never with
   * the words themselves.
   */
  onSelectWords?: (wordKey: string, ayahKey: string) => void;
  /** Human label for an ayah key (surah name), for per-polygon aria-label. */
  labelFor: (key: string) => string;
  /** Fired with the selected ayah's on-screen bbox so the rail can position. */
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  /**
   * Fired when a gesture over the stage asks for a page turn: `1` for the next
   * page, `-1` for the previous (`page-turning.md` §4, §7 ③).
   *
   * The stage decides *whether a gesture meant a turn* — that is a fact about
   * the gesture, and the stage is the only thing holding the surface it happened
   * on — and App decides *what turning means*, because "the next page" is a fact
   * about the inventory, which the stage does not have. Same seam the arrow keys
   * already use: all three end in `stepPage`, so a wheel turn, a dragged turn and
   * a keyed turn cannot drift apart.
   *
   * It was `onWheelTurn` until the drag gesture landed and asked the identical
   * question. The old name described the one caller rather than the seam, and a
   * second caller is exactly the moment that difference starts to cost.
   */
  onTurn?: (step: 1 | -1) => void;
  /**
   * Which page a turn in this direction would land on, or `null` for none.
   *
   * Needed only by the *dragged* turn, and only because a fold has an appearance
   * before it has a destination. The band the finger is pushing has to be drawn
   * on the frame it appears, and what it looks like — crease, gap, hole
   * (`foldBetween`) — is a fact about the **pair** of pages it spans. When only
   * 7, 9 and 19 were vendored, a forward drag from page 7 landed on 9 and had to
   * draw a `hole`; guessing `7 → 8` would have drawn a `crease` and then swapped
   * it for a hole at release, which is the fold contradicting itself mid-gesture.
   * Loop 4b vendored all 604, so for `hafs-kfqc` the inventory's pair and
   * `page ± 1` now agree everywhere — which makes this prop's fallback correct
   * rather than redundant, and it stays for the next partial edition.
   *
   * The wheel never needed this because a wheel turn is decided and drawn in the
   * same instant — it asks `onTurn` and the answer comes back through `turnTo`.
   * A dragged turn is the reader holding the question open for as long as they
   * like, and the picture has to be right for all of it.
   *
   * Absent, the stage falls back to `page ± 1` clamped to the print. That is the
   * right guess for a complete edition and the wrong one for a partial inventory
   * — so it is a fallback, not the design.
   */
  turnTargetOf?: (step: 1 | -1) => number | null;
  /**
   * May a sideways drag on *this* stage turn the page? Default yes.
   *
   * The one caller that says no is the facing leaf of a desktop spread, and the
   * reason is structural rather than a preference. A tracked turn ends by handing
   * its band to `runTurn`, and `runTurn` only runs on the stage App holds a ref
   * to — so on the facing leaf the band would have nobody to hand to, while the
   * live stage drew a *second* band into the same `foldTarget`. Two folds on one
   * book is precisely what §3.4's "one fold, ever" forbids.
   *
   * The wheel is unaffected and stays live on both leaves: it commits in the
   * same instant it is decided and never holds a band open, so it has no
   * hand-over to fail.
   */
  dragToTurn?: boolean;
  /**
   * Fired when this stage crosses between *showing the page* and *reading into
   * it* — `true` at or below fit, `false` above. Only on a flip, never per frame.
   *
   * The stage is the only thing that knows its own zoom, and it must stay the
   * only thing: `view` is a ref precisely so a pan does not re-render a 170 KB
   * inline SVG's parent, and a callback carrying `z` would hand that ref back to
   * React sixty times a second. A boolean that changes twice a gesture is a fact
   * about the reading, not about the frame.
   *
   * The one caller is the desktop spread, which closes to a single leaf above
   * fit (`docs/design/desktop.md` §8 ②). Below the breakpoint nobody passes it.
   *
   * "At or below" and not "at": zooming *out* past fit shows less of the page,
   * not more of one page, so it is not the reader asking to be closer to
   * anything. `MIN_ZOOM` is 0.8 and that whole range belongs on the near side.
   */
  onFitChange?: (atFit: boolean) => void;
  /**
   * The applied skin (Loop 6a, spec §8). L3 owns the choice; the stage owns the
   * Highlighters, so it is the one that can apply it to every mounted page.
   */
  skin?: SkinId;
  /**
   * Rule lookup for the tajweed skin, or null while its shards are still in
   * flight. Passing it through keeps L2 ignorant of the shard format — the
   * highlighter takes a function, exactly like `labelFor`.
   */
  tajweedLookup?: TajweedLookup | null;
  /**
   * Where to draw the fold, when this stage is one leaf of an open spread.
   *
   * Absent (the phone) the band is a sibling of `.layer` inside the stage and
   * sweeps the leaf. On a desktop spread a turn that leaves the opening changes
   * **both** panels, so the band has to sweep the whole book — and the element
   * that is the whole book is `PageSpread`'s, not this one's. Passing the node
   * in rather than lifting the turn out keeps the state machine in one place:
   * the stage is the only thing that knows when a page has painted, and a fold
   * whose timing lived elsewhere would have to be told.
   *
   * `docs/design/page-transition.md` §3.5, decision row 21.
   */
  foldTarget?: RefObject<HTMLElement | null> | null;
}

/** What App can drive imperatively on the stage. */
export interface PageStageHandle {
  /** Pan/zoom to an ayah, mounting its page if needed. Resolves when landed. */
  navigateTo: (key: string, opts?: { pulse?: boolean; zoom?: number }) => Promise<void>;
  /**
   * Show a whole page, centered and unzoomed, mounting it if needed.
   *
   * Separate from navigateTo because a page link (`#/hafs-kfqc/p9`) names no
   * ayah: there is nothing to frame, pulse, or select, and faking a target
   * would land the reader mid-page on an ayah they never asked for.
   */
  showPage: (page: number) => Promise<void>;
  /**
   * **Turn** to a page: draw what is between the two, then land.
   *
   * Distinct from `showPage`, and the distinction is the whole point of the
   * fold. A turn is continuous reading and the two pages have a relationship in
   * the print — `foldBetween` says which one. A hop or a scrub is a relocation
   * and has none, so it must not draw a band: a fold between page 19 and page 7
   * would claim they are neighbours. Only the caller can tell the two apart,
   * which is why this is a second verb rather than a flag on the first
   * (`docs/design/page-transition.md` §4.1).
   *
   * Resolves `true` only if the page actually landed. A destination that never
   * mounts leaves the reader where they were — the band retreats the way it
   * came — so the caller must not move the header until this says so. Landing
   * on an unmounted page paints sunk paper where scripture should be, and a
   * reader who does not look closely has been shown a blank mus'haf page (§5.3).
   */
  turnTo: (page: number) => Promise<boolean>;
}

/** The three states of a fold that is actually drawn; `"none"` draws nothing. */
type FoldKind = Exclude<Fold, "none">;
/** Which way the band travels. Forward is toward the later page. */
type TurnDir = "forward" | "back";

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 5;

/**
 * How far above 1 counts as "not at fit" — see `onFitChange`.
 *
 * Not `> 1` exactly. Zoom is multiplicative and every landing is a RAF tween, so
 * the last frames before a hop settles at 1 arrive as 1.0000003 and a bare `> 1`
 * would report a reader into and back out of a zoom they never asked for. One
 * part in a thousand is far below a wheel tick (1.2^1.2 ≈ 1.25) and far above
 * anything a lerp leaves behind.
 */
const FIT_EPSILON = 1e-3;

/**
 * How much 100 px of `ctrl`+wheel zooms — `page-turning.md` §7 ③.
 *
 * Multiplicative, not additive: `z' = z · RATIO^(−Δy/100)`. Zoom is perceived
 * as a ratio, so a step that adds a constant is coarse near 1× and imperceptible
 * near 5×, and the same wheel travel has to mean the same *proportion* of a
 * change at either end or the reader learns the gesture twice.
 *
 * 1.2 per 100 px is roughly what a browser's own zoom step feels like, and one
 * mouse notch (100 px in pixel mode) lands there exactly. What it replaces is
 * @use-gesture's bridge, which was `1 + Δy/100` scaled by the *current* zoom:
 * one notch was +40%, two was 2.0×, and three saturated MAX_ZOOM — a reader
 * aiming for a comfortable read got a wall of ink in three clicks. The 100 is
 * hard-coded in the library (`PINCH_WHEEL_RATIO`) with no option to change it,
 * which is why this is a listener rather than a config value.
 */
const WHEEL_ZOOM_PER_100PX = 1.2;

interface MountedPage {
  host: HTMLDivElement;
  svg: SVGSVGElement;
  hl: Highlighter;
}

/**
 * A word run being dragged out inside the selected ayah (word-C).
 *
 * Mutable and held in a ref rather than in state: it changes on every frame of
 * a stroke, and a gesture must never cost a render. `anchor` is null until the
 * page's shard has landed and the first point has been resolved to a word —
 * which is why the *point* is carried here too, rather than being turned into an
 * index at the moment the finger reports it.
 */
interface WordRun {
  /** The ayah being refined — the canonical key, not the `#w` one. */
  readonly key: string;
  readonly edition: string;
  readonly page: number;
  /** Where the finger is now, in SVG user units. */
  point: { x: number; y: number };
  /** The word the hold landed on. Fixed once set; the drag moves `cursor`. */
  anchor: number | null;
  cursor: number | null;
  /** Whether the finger has already lifted (see `trackWords`). */
  done: boolean;
}

/**
 * PageStage — the multi-page SVG mount surface and the imperative pan/zoom +
 * hop-tween owner (spec L2). React owns the chrome and page *lifecycle* (fetch,
 * mount, evict per the DOM budget), but never re-renders on pan/zoom or during a
 * hop: one `view` model is written straight to the current host's transform, in
 * gestures and in the RAF tween alike, so children never reconcile and the two
 * write paths can't fight (a finger-down mid-hop cancels the tween and takes
 * over). The Highlighter is the only owner of SVG geometry; there is one per
 * mounted page.
 */
export const PageStage = forwardRef<PageStageHandle, PageStageProps>(function PageStage(
  {
    resolver,
    page,
    total,
    mountedPages,
    pageBudget = MOUNTED_PAGE_CAP,
    label,
    selectedKey,
    breadcrumbKey,
    onSelect,
    onSelectRange,
    onSelectWords,
    labelFor,
    onSelectionRect,
    onTurn,
    turnTargetOf,
    dragToTurn = true,
    onFitChange,
    skin = "plain",
    tajweedLookup = null,
    foldTarget = null,
  },
  ref,
): JSX.Element {
  const { t } = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef(new Map<number, MountedPage>());
  /** Mounts still in flight, so concurrent callers share one fetch (see ensurePage). */
  const pendingRef = useRef(new Map<number, Promise<MountedPage | null>>());
  /** `pagesRef`'s keys in use order, most recent first — the LRU side of `retainPages`. */
  const lruRef = useRef<number[]>([]);
  const currentPageRef = useRef<number>(page);
  /**
   * Set once a navigateTo has decided which page is visible. A cold-opened deep
   * link calls navigateTo while the initial-mount effect is still awaiting its
   * own ensurePage, and both end in setCurrentPage — so whichever *fetch* won
   * decided what the reader saw. That made a shared link land on page 7 or on
   * page 9 depending on the network. navigateTo is an explicit request and the
   * mount effect is a default, so the request wins regardless of timing.
   */
  const navigatedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  /*
   * Which page the error banner is about, when that is not the `page` prop.
   *
   * A turn that never arrives deliberately leaves the reader where they were —
   * App does not commit `page` until `turnTo` resolves true (§5.3) — so the
   * banner would otherwise name the page still on screen and say it failed to
   * load. Null means "the prop", which is every other error path: those all run
   * after App has already moved the chrome.
   */
  const [errorPage, setErrorPage] = useState<number | null>(null);

  // Latest callbacks without retriggering effects.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectRangeRef = useRef(onSelectRange);
  onSelectRangeRef.current = onSelectRange;
  const onSelectWordsRef = useRef(onSelectWords);
  onSelectWordsRef.current = onSelectWords;
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;
  const labelForRef = useRef(labelFor);
  labelForRef.current = labelFor;
  const onSelectionRectRef = useRef(onSelectionRect);
  onSelectionRectRef.current = onSelectionRect;
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  const turnTargetOfRef = useRef(turnTargetOf);
  turnTargetOfRef.current = turnTargetOf;
  const dragToTurnRef = useRef(dragToTurn);
  dragToTurnRef.current = dragToTurn;
  // `applyTransform` runs on every animation frame of every gesture and holds an
  // empty dependency list to stay that cheap, so the one thing it reports out
  // has to reach it the same way everything else does.
  const onFitChangeRef = useRef(onFitChange);
  onFitChangeRef.current = onFitChange;
  const atFitRef = useRef(true);
  // The wheel's accumulator (core owns the rule; this is just where it lives
  // between events), and the two things the zoom branch needs to notice a
  // gesture starting and ending — a wheel has no `first`/`last` of its own.
  const wheelTurnRef = useRef<WheelTurnState>(WHEEL_TURN_REST);
  const wheelZoomAtRef = useRef(-Infinity);
  const wheelSettleRef = useRef<number | null>(null);
  // Read by mountPage, which runs async and must not close over a stale skin.
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const tajweedRef = useRef(tajweedLookup);
  tajweedRef.current = tajweedLookup;
  // Same reason: mountPage decides a leaf's free edge after an await.
  const totalRef = useRef(total);
  totalRef.current = total;
  // And the same reason again, for the one mark that is owed to a page the
  // reader is not on. See the breadcrumb effect below for what went wrong.
  const breadcrumbRef = useRef(breadcrumbKey);
  breadcrumbRef.current = breadcrumbKey;

  /*
   * The fold. Its *existence* is React state — a band that is not crossing does
   * not exist in the DOM — and everything after that is imperative, for the same
   * reason pan and zoom are: a re-render per animation frame is a re-render of a
   * 170 KB inline SVG's parent. Two renders per turn, one to insert and one to
   * remove, and the 240 ms in between is a CSS transition on `transform`.
   *
   * `foldRef` mirrors the state for the ref callback, which runs during commit
   * and needs to know which way the band is travelling before the effect queue.
   * `turnRef` is the generation counter that makes interruption a *re-target*
   * rather than a second fold: any awaiting step of an older turn sees a bumped
   * number and drops out, leaving the newer turn the only owner of the one band
   * (§3.4 rule 1). `armedRef` is what stops a re-target restarting the sweep
   * from the screen edge — the band continues from wherever it is.
   */
  const [fold, setFold] = useState<{ kind: FoldKind; dir: TurnDir } | null>(null);
  const foldRef = useRef<{ kind: FoldKind; dir: TurnDir } | null>(null);
  const foldElRef = useRef<HTMLDivElement | null>(null);
  const armedRef = useRef(false);
  const turnRef = useRef(0);
  const foldTargetRef = useRef(foldTarget);
  foldTargetRef.current = foldTarget;
  /*
   * The turn the finger is currently holding open (`page-transition.md` §3.2,
   * `tracking`). Null whenever no drag has latched `"turn"`.
   *
   * `step` and `dir` are fixed at the frame the ladder latched and never
   * re-derived: the classifier already decided this stroke is a turn and which
   * way it goes, and a thumb that curves back past its own start must not flip
   * the band around — that is the page changing its mind under a finger that is
   * still down. `drawn` is false for the turns that are real but invisible
   * (reduced motion, a crease on a spread), which still commit on release; the
   * band is the picture, not the gesture.
   */
  const dragTurnRef = useRef<{
    gen: number;
    step: 1 | -1;
    dir: TurnDir;
    drawn: boolean;
  } | null>(null);

  /*
   * The skin swap itself: classes on and classes off, on every mounted page.
   * No geometry is read or written here — that is the whole promise of spec §8,
   * and `geometrySignature` in @hifth/core is what holds it to it. Cheap enough
   * to run synchronously on toggle (a page is ~15 polygons), which is what makes
   * "instant" in the exit criterion true rather than aspirational.
   */
  useEffect(() => {
    for (const mp of pagesRef.current.values()) mp.hl.setSkin(skin, tajweedLookup);
  }, [skin, tajweedLookup]);

  // The one imperative transform. Gestures and the hop tween both write here.
  const view = useRef<View>({ x: 0, y: 0, z: 1 });
  // What the current stroke turned out to mean, latched by `nextIntent` (core
  // gestures.ts), plus where a marquee started in SVG user units. Refs, not
  // state: a gesture must never cost a render.
  const intentRef = useRef<PointerIntent>("none");
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * The word run being dragged out inside the selected ayah (word-C), or null.
   *
   * `anchor` is the word the hold landed on and does not move; `cursor` follows
   * the finger. Held as the *print's* indices — the same numbers the `#w` key
   * carries — so the key is formed by naming them rather than by translating
   * anything, and both ends stay meaningful if the drag runs backwards.
   */
  const wordRunRef = useRef<WordRun | null>(null);
  /**
   * `<edition>/<page>` → its word shard, once fetched; `null` marks a page whose
   * shard missed, so a second long-press does not re-ask the network for a file
   * that is not there. Kept here rather than on `MountedPage` because a shard
   * outlives the mount: the LRU may drop a page's DOM while the reader is still
   * hopping around it, and 3.6 KB of numbers is not worth re-fetching for that.
   */
  const wordShardsRef = useRef(new Map<string, WordIndex | null>());
  /** Shard fetches in flight, so a fast second press shares the first's request. */
  const wordPendingRef = useRef(new Map<string, Promise<WordIndex | null>>());
  const tweenRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  /*
   * The stage and the page inside it, last time anyone asked.
   *
   * Cached rather than read per frame on purpose. `clampView` needs four
   * numbers, all four come from layout, and reading layout inside a RAF tween or
   * a drag handler is a read straight after a write to the very element being
   * measured — the forced-synchronous-layout shape the perf budget exists to
   * keep out. None of the four can change without a gesture, a hop or a resize
   * starting first, so they are measured when one does (`measureFit`) and reused
   * for the frames in between.
   */
  const fitRef = useRef<StageFit | null>(null);

  /**
   * Measure the stage box and the current page's laid-out box.
   *
   * The *layer* is the stage box that matters, not the stage itself: the layer
   * is the element the host is laid out in, so the layer's top-left is where
   * `translate3d(0,0)` puts the page, and the clamp has to speak the same
   * coordinates the transform does. The stage's own padding is outside it, which
   * is exactly why it stays a gutter and never gets eaten by a pan.
   *
   * `offsetWidth`/`offsetHeight`, not `clientWidth`/`clientHeight`: the leaf now
   * has a border (its edge — PageStage.module.css) and the transform scales the
   * *border* box. The padding box is 2×2px smaller, so measuring it hands
   * `clampView` a leaf smaller than the one on screen: at rest that is 2px off
   * centre, and in the overflow regime it is 4px of scripture that slides under
   * the fold and cannot be panned back.
   */
  const measureFit = useCallback((): StageFit | null => {
    const layer = layerRef.current;
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!layer || !cur) return null;
    const box = layer.getBoundingClientRect();
    const fit: StageFit = {
      contentWidth: cur.host.offsetWidth,
      contentHeight: cur.host.offsetHeight,
      stageWidth: box.width,
      stageHeight: box.height,
    };
    fitRef.current = fit;
    return fit;
  }, []);

  const applyTransform = useCallback(() => {
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!cur) return;
    // Every write goes through the clamp, not just the ones that compute a
    // target. A hop that lands correctly and a drag that then shoves the page
    // into the void is not a fixed stage; and the tween's own intermediate
    // frames are lerped between two legal views at a zoom that is neither of
    // theirs, which is legal for neither.
    const fit = fitRef.current;
    if (fit) view.current = clampView(view.current, fit);
    const { x, y, z } = view.current;
    cur.host.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
    // Reported from here rather than from the gesture handlers because this is
    // the one place every view change passes through — a wheel, a pinch, a hop's
    // tween and the reset a page turn does all end up writing this transform,
    // and a fit signal that three of the four knew about would be worse than
    // none. Guarded on the flip, so a re-render is owed twice per zoom and not
    // once per frame.
    const atFit = z <= 1 + FIT_EPSILON;
    if (atFit !== atFitRef.current) {
      atFitRef.current = atFit;
      onFitChangeRef.current?.(atFit);
    }
  }, []);

  /*
   * The cached fit is only as true as the box it was measured from.
   *
   * Everything else re-measures at the start of a gesture, which is correct
   * while the leaf's box is something only the window can change. It stopped
   * being that when the spread learned to close above fit: the leaf widens to
   * the whole desk *because* of a zoom, so the frame after the flip would clamp
   * against the narrow box it just stopped having — the page pinned to an edge
   * that is no longer where the clamp thinks it is, until the next wheel tick
   * happened to fix it.
   *
   * Observing the layer rather than reacting to the prop keeps this a fact about
   * geometry: a window resize is the same event and was silently in the same
   * position before, one gesture behind the truth.
   */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (measureFit()) applyTransform();
    });
    ro.observe(layer);
    return () => ro.disconnect();
  }, [measureFit, applyTransform]);

  const cancelTween = useCallback(() => {
    if (tweenRef.current !== null) {
      cancelAnimationFrame(tweenRef.current);
      tweenRef.current = null;
      startTimeRef.current = null;
    }
  }, []);

  /**
   * Zoom to `nz` while keeping whatever is under (`ox`, `oy`) — viewport
   * coordinates — exactly where it is. Every zoom on this stage lands here:
   * two-finger pinch, `ctrl`+wheel, and nothing else. That is deliberate, and
   * it is the second half of the fix below.
   *
   * **The *layer*, not the stage — `page-turning.md` §7 ⑨.**
   *
   * `view.x/y` are layer-relative: the layer is the element the host is laid
   * out in, so `translate3d(0,0)` puts the page at the layer's top-left and
   * `measureFit` reads that box and no other. Converting a gesture's origin
   * against the *stage* rect measures from one box into coordinates belonging
   * to another, and the difference is the stage's own padding — a gutter that
   * is deliberately outside the layer.
   *
   * The error is not constant, which is why it read as rounding: the anchor
   * arithmetic is `px − (px − x)·k`, so an origin off by `d` lands the page off
   * by `d·(1 − k)`. At rest it is zero. It grows with the zoom, and it grows in
   * the direction that pulls the page out from under the finger holding it.
   *
   * Measured before the fix at a 1.0 → 1.4 zoom: (0.0, −6.4) px on a 390 × 844
   * phone — `16 × (k − 1)` to the pixel, one `--stage-pad`. Zero horizontally
   * because §2.4 drops the padding on the leaf's bound side, and zero on both
   * axes at 1440 × 900 because the spread neutralises the padding entirely.
   * That is the whole reason it survived six loops: the defect was live on the
   * acceptance device and absent on the one a laptop shows you.
   *
   * Having *one* function is what keeps that fix fixed. When ctrl+wheel was
   * taken off @use-gesture's pinch path (§7 ③) it needed the same arithmetic,
   * and a second copy of it is a second place for the stage rect to creep back
   * in — silently, on a phone, where nobody is looking.
   */
  const zoomAbout = useCallback(
    (nz: number, ox: number, oy: number, base: { z: number; x: number; y: number }) => {
      const layer = layerRef.current;
      if (!layer) return;
      const rect = layer.getBoundingClientRect();
      const px = ox - rect.left;
      const py = oy - rect.top;
      const k = nz / base.z;
      view.current.z = nz;
      view.current.x = px - (px - base.x) * k;
      view.current.y = py - (py - base.y) * k;
      applyTransform();
    },
    [applyTransform],
  );

  /**
   * Read a duration token in ms.
   *
   * Every duration in this component comes through here rather than from a
   * constant, and that is the whole of the reduced-motion story: `tokens.css`
   * already sets `--dur-fast`, `--dur-med` and `--dur-hop` to `0ms` under
   * `prefers-reduced-motion: reduce`, so "no fold, no fade, no tween" is one
   * media query in one file instead of a preference read in three components.
   * A zero here is not "animate instantly" — the callers branch on it and skip
   * inserting the band entirely, because a band that appears and vanishes inside
   * one frame is a flash, which is worse than nothing (§5.1).
   */
  const durationMs = useCallback((token: string, fallback: number): number => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
    return Number.isFinite(ms) ? ms : fallback;
  }, []);

  const hopDurationMs = useCallback((): number => durationMs("--dur-hop", 460), [durationMs]);

  /** RAF-tween `view` from its current value to `target`. Interruptible. */
  const tweenTo = useCallback(
    (target: View): Promise<void> => {
      cancelTween();
      measureFit();
      const from = { ...view.current };
      const duration = hopDurationMs();
      if (duration <= 0) {
        view.current = target;
        applyTransform();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const step = (now: number) => {
          if (startTimeRef.current === null) startTimeRef.current = now;
          const t = Math.min(1, (now - startTimeRef.current) / duration);
          view.current = lerpView(from, target, easeInOutCubic(t));
          applyTransform();
          if (t < 1) {
            tweenRef.current = requestAnimationFrame(step);
          } else {
            view.current = target;
            applyTransform();
            tweenRef.current = null;
            startTimeRef.current = null;
            resolve();
          }
        };
        tweenRef.current = requestAnimationFrame(step);
      });
    },
    [applyTransform, cancelTween, hopDurationMs, measureFit],
  );

  /** Switch the visible page: toggle host visibility, re-point the transform. */
  const setCurrentPage = useCallback(
    (next: number) => {
      for (const [p, mp] of pagesRef.current) {
        mp.host.style.display = p === next ? "block" : "none";
      }
      currentPageRef.current = next;
    },
    [],
  );

  /**
   * Say what phase of a turn the stage is in, on the stage element itself.
   *
   * Written imperatively and deliberately absent from the JSX below: this is a
   * fact about an animation in flight, and putting it in React state would cost
   * a render at each of the four moments a turn passes through. Nothing in the
   * app styles off it — it is here so a test can watch a turn stall or retreat,
   * which are the two states that are otherwise invisible in a screenshot.
   */
  const setTurnPhase = useCallback((phase: string | null): void => {
    const stage = stageRef.current;
    if (!stage) return;
    if (phase) stage.dataset.turn = phase;
    else delete stage.dataset.turn;
  }, []);

  /**
   * Where the band sits at the three moments of a crossing, in physical px.
   *
   * Physical, not logical: the band enters on the side the finger would push it
   * from, and `loop-1.md` pins that to the *book's* direction, which does not
   * change when the UI language does. Read off the offsetParent rather than a
   * token so one element is correct whether it is sweeping a phone's single leaf
   * or a desktop spread's two (§3.5).
   */
  const sweepOf = useCallback((el: HTMLElement, dir: TurnDir) => {
    const span = el.parentElement?.clientWidth ?? 0;
    const width = el.offsetWidth;
    return {
      enter: dir === "forward" ? -width : span,
      exit: dir === "forward" ? span : -width,
      middle: (span - width) / 2,
    };
  }, []);

  /** Move the band, or place it with no transition when `ms` is 0. */
  const moveFold = useCallback((el: HTMLElement, x: number, ms: number): void => {
    el.style.transition = ms > 0 ? `transform ${ms}ms var(--ease-hop)` : "none";
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  }, []);

  /**
   * Put the band in the DOM at its entry edge — on insert, and only on insert.
   *
   * A ref callback rather than an effect because it runs during commit, before
   * the browser paints: an effect would let the band paint for one frame at
   * `translateX(-100%)` of whatever width the *previous* state had. The
   * `armedRef` guard is what makes a second turn a **re-target**: an existing
   * band keeps its position and is simply given a new destination, which is how
   * a turn interrupted at 100 ms continues rather than jumping back to the edge.
   */
  const attachFold = useCallback(
    (el: HTMLDivElement | null): void => {
      foldElRef.current = el;
      if (!el) {
        armedRef.current = false;
        return;
      }
      if (armedRef.current) return;
      const state = foldRef.current;
      if (!state) return;
      armedRef.current = true;
      moveFold(el, sweepOf(el, state.dir).enter, 0);
    },
    [moveFold, sweepOf],
  );

  /** Wait for the band to exist and be placed, or give up after a few frames. */
  const armedFold = useCallback(async (gen: number): Promise<HTMLDivElement | null> => {
    for (let i = 0; i < 5; i += 1) {
      await nextFrame();
      if (turnRef.current !== gen) return null;
      if (foldElRef.current && armedRef.current) return foldElRef.current;
    }
    return null;
  }, []);

  /** The one-shot mount `ensurePage` de-duplicates. Never call it directly. */
  const mountPage = useCallback(
    async (targetPage: number): Promise<MountedPage | null> => {
      const layer = layerRef.current;
      if (!layer) return null;
      let markup: string;
      try {
        markup = await loadPageSvg(resolver.edition, targetPage);
      } catch {
        return null; // unvendored / fetch failed — caller degrades gracefully
      }
      const host = document.createElement("div");
      host.className = styles.host ?? "";
      // Which of this leaf's edges is free. Per *mounted page*, not per visible
      // page: several pages are mounted at once for the DOM budget, and a hop
      // target on the other half of the spread has a different free edge than
      // the page you are on. `null` for a page outside the print — those never
      // get the attribute, and the rounded/fore-edge rules never match.
      const side = leafSideOf(targetPage, totalRef.current);
      if (side) host.dataset.leaf = side;
      host.style.display = "none";
      host.innerHTML = markup;
      const svgEl = host.querySelector("svg");
      if (!svgEl) return null;
      // A group, not an img: the page contains focusable ayah "buttons", and an
      // img must be a leaf (axe: "img must not have focusable descendants").
      svgEl.setAttribute("role", "group");
      svgEl.setAttribute("aria-labelledby", `page-label-${targetPage}`);
      svgEl.classList.add(styles.svg ?? "");
      layer.appendChild(host);

      const hl = new Highlighter(svgEl as unknown as SVGSVGElement, resolver, targetPage, {
        labelFor: (key) => labelForRef.current(key),
      });
      hl.onSelect((key) => onSelectRef.current(key));
      // A page mounted while the skin is on must arrive wearing it, or turning a
      // page would flash plain until the effect below caught up.
      hl.setSkin(skinRef.current, tajweedRef.current);
      const mp: MountedPage = { host, svg: svgEl as unknown as SVGSVGElement, hl };
      pagesRef.current.set(targetPage, mp);
      // And the same for the breadcrumb, for a sharper reason than a flash. The
      // effect below draws it over whichever page is *already* mounted; it is
      // keyed on the crumb, not on the mounted set, and `pagesRef` is a ref, so
      // a page that arrives after it ran does not re-run it. Lose that race once
      // — a `?via=` deep link, where the origin page mounts alongside the target
      // — and the crumb never appears at all, for the life of the visit. Drawing
      // it here is the only place that knows the page has landed.
      const crumb = breadcrumbRef.current;
      if (crumb && resolver.resolve(crumb)?.page === targetPage) {
        hl.highlight(crumb, "crumb", "breadcrumb");
      }
      return mp;
    },
    [resolver],
  );

  /** Fetch + mount a page's SVG, returning its Highlighter (or null if unvendored). */
  const ensurePage = useCallback(
    (targetPage: number): Promise<MountedPage | null> => {
      const existing = pagesRef.current.get(targetPage);
      if (existing) return Promise.resolve(existing);
      // The mount is async, so `pagesRef` is still empty while a fetch is in
      // flight: two callers racing for the same page (the initial mount and a
      // cold-link `navigateTo`) would each append their own <svg>, leaving two
      // regions labelled `page-label-N` — a duplicated landmark, and the reason
      // the range deep-link e2e had to reach for `.first()`. In-flight mounts are
      // memoized so the second caller awaits the first instead of starting a rival.
      const pending = pendingRef.current.get(targetPage);
      if (pending) return pending;
      const mount = mountPage(targetPage);
      pendingRef.current.set(targetPage, mount);
      void mount.finally(() => pendingRef.current.delete(targetPage));
      return mount;
    },
    [mountPage],
  );

  /**
   * Center the current page's content in the stage (the reset view).
   *
   * There is no arithmetic left here: at z=1 the page is smaller than the stage
   * on both axes, and `clampView` answers "centred" for an axis that fits — so
   * asking for the origin and letting the clamp have it is the whole reset. The
   * hand-rolled `(stageWidth - contentWidth) / 2` that used to live here read
   * the *stage* rect — padding included — and translated a host the stage had
   * already centred, so the page sat one padding to the right of centre with its
   * far edge flush against the screen.
   */
  const centerCurrent = useCallback(() => {
    if (!measureFit()) return;
    view.current = { x: 0, y: 0, z: 1 };
    applyTransform();
  }, [applyTransform, measureFit]);

  /**
   * Swap the two pages *under* the band, with the fade's midpoint at its centre.
   *
   * The timing is the point of the whole design. A bare cross-fade between two
   * mus'haf pages double-exposes two nearly identical grids of black script, and
   * the moment of maximum ambiguity — t = 0.5 — is the moment the reader is
   * looking hardest. The band covers exactly that moment, which is also why the
   * fade can be dropped to a hard cut on a device that cannot afford two painted
   * layers and the turn stays legible (§5.2). A bare cross-fade has no such
   * fallback: remove its fade and there is no transition left.
   *
   * Every other mounted host is put to `opacity: 0` with its transition
   * suppressed, so a held-down arrow costs one composited layer rather than one
   * per mounted page. `pagesRef` is capped at MOUNTED_PAGE_CAP now (backlog ③),
   * but a fade touching every host would still make the whole held set a
   * per-frame cost, and the cap is a number the perf verdict may raise
   * (§3.4 rule 3).
   */
  const crossFade = useCallback(
    (from: number, to: number, ms: number): void => {
      const incoming = pagesRef.current.get(to);
      if (!incoming) return;
      const outgoing = pagesRef.current.get(from);
      for (const [p, mp] of pagesRef.current) {
        if (p === from || p === to) continue;
        mp.host.style.transition = "none";
        mp.host.style.opacity = "0";
      }
      incoming.host.style.transition = "none";
      incoming.host.style.opacity = "0";
      incoming.host.style.display = "block";
      // The incoming leaf has to arrive already wearing its transform, or it
      // paints for one frame at the layer's origin — unclamped, top-left — and
      // the fade shows a page sliding into place under the band.
      currentPageRef.current = to;
      view.current = { x: 0, y: 0, z: 1 };
      measureFit();
      applyTransform();
      // Flush, so the transition has a start value to run from instead of
      // coalescing both writes into one.
      void incoming.host.offsetWidth;
      incoming.host.style.transition = `opacity ${ms}ms linear`;
      incoming.host.style.opacity = "1";
      if (outgoing && outgoing !== incoming) {
        outgoing.host.style.transition = `opacity ${ms}ms linear`;
        outgoing.host.style.opacity = "0";
      }
    },
    [applyTransform, measureFit],
  );

  /** End a turn on the destination page: display swapped, inline fades cleared. */
  const land = useCallback(
    (next: number): void => {
      navigatedRef.current = true;
      cancelTween();
      setCurrentPage(next);
      for (const mp of pagesRef.current.values()) {
        mp.host.style.transition = "";
        mp.host.style.opacity = "";
      }
      centerCurrent();
      setErrorPage(null);
      setStatus("ready");
    },
    [cancelTween, centerCurrent, setCurrentPage],
  );

  /**
   * Abandon any turn in flight and take the band off the stage.
   *
   * Called by the two verbs that are *not* turns. A hop that lands mid-turn must
   * not leave a band crossing the page it jumped to: that band asserts an
   * adjacency, and a mutashabihat jump is precisely the proof against one.
   */
  const abortTurn = useCallback((): void => {
    turnRef.current += 1;
    armedRef.current = false;
    // A hop that lands mid-*drag* is rarer than one that lands mid-turn, but it
    // is the same sentence: whatever the finger was holding open is no longer
    // about the page on screen. Dropping the ref here is what stops the next
    // drag frame from moving a band this call just removed.
    dragTurnRef.current = null;
    foldRef.current = null;
    setFold(null);
    setTurnPhase(null);
    for (const mp of pagesRef.current.values()) {
      mp.host.style.transition = "";
      mp.host.style.opacity = "";
    }
  }, [setTurnPhase]);

  /**
   * The turn itself — insert the band, sweep it, swap under it, land.
   *
   * Written as one linear async function rather than as a reducer because that
   * is what it is: a sequence with four waits in it, each of which may find that
   * a newer turn has taken over. `turnRef` is the generation, and every await is
   * followed by the same three words — if the generation moved, this turn is no
   * longer the one holding the band, and it must return without touching a
   * single style. That is the whole of §3.4's "one fold, ever": there is no
   * bookkeeping to get wrong because there is only ever one element.
   */
  const runTurn = useCallback(
    async (next: number): Promise<boolean> => {
      const from = currentPageRef.current;
      const kind = foldBetween(from, next, totalRef.current);
      const sweepMs = durationMs("--dur-med", 240);
      const fadeMs = durationMs("--dur-fast", 120);
      const gen = (turnRef.current += 1);
      const mine = (): boolean => turnRef.current === gen;

      /*
       * When nothing is drawn at all, and the three reasons are different:
       *
       *  - `"none"` — not a turn. The caller got the pair wrong; land plainly.
       *  - a zero duration — `prefers-reduced-motion`. §5.1: not inserted-and-
       *    instant, *not inserted*. The information a fold carries is also
       *    carried at rest, by the leaf's rounded free corner, by the fore-edge
       *    stack, by the announcer and by the page bar — so this degrades to
       *    nothing without lying, which is the test this design had to pass.
       *  - a crease on a spread — §3.5. Both leaves of the opening are already
       *    on screen and neither changed; the only thing that moves is which
       *    leaf is live. Animating a leaf that did not turn is the failure, and
       *    the crease between them is already drawn, permanently, by the gutter.
       */
      const drawn =
        kind !== "none" && sweepMs > 0 && !(kind === "crease" && foldTargetRef.current?.current);
      if (!drawn) {
        const mp = await ensurePage(next);
        if (!mine()) return false;
        if (!mp) {
          setErrorPage(next);
          setStatus("error");
          return false;
        }
        land(next);
        return true;
      }

      const dir: TurnDir = next > from ? "forward" : "back";
      // Start the fetch now, not at the swap: the sweep is 240 ms of cover for
      // it, and a destination that arrives during the crossing never stalls.
      const mount = ensurePage(next);
      void mount.catch(() => null);

      foldRef.current = { kind: kind as FoldKind, dir };
      setFold(foldRef.current);
      const el = await armedFold(gen);
      if (!el || !mine()) return false;

      const { enter, exit, middle } = sweepOf(el, dir);
      setTurnPhase("crossing");
      moveFold(el, exit, sweepMs);

      // The swap is centred on the band's centre, so with a 240 ms sweep and a
      // 120 ms fade it runs from 60 ms to 180 ms.
      await sleep(Math.max(0, sweepMs / 2 - fadeMs / 2));
      if (!mine()) return false;

      if (!pagesRef.current.has(next)) {
        /*
         * §5.3 — the destination has not arrived. The band holds at the leaf's
         * centre rather than landing on nothing: a fold that stops mid-crossing
         * is honest, it says *the leaf is still coming*, which is what is
         * happening. `.layer` already carries `aria-busy`; this is its picture.
         */
        setTurnPhase("stalled");
        moveFold(el, middle, fadeMs);
        const mp = await mount;
        if (!mine()) return false;
        if (!mp) {
          // It will never arrive — offline, unvendored, a 404. Retreat the way
          // it came and leave the reader where they were. Landing would paint
          // sunk paper where scripture should be.
          setTurnPhase("retreating");
          moveFold(el, enter, fadeMs);
          await sleep(fadeMs);
          if (mine()) {
            setErrorPage(next);
            setStatus("error");
            abortTurn();
          }
          return false;
        }
        setTurnPhase("crossing");
        moveFold(el, exit, sweepMs / 2);
      }

      crossFade(from, next, fadeMs);
      await sleep(fadeMs);
      if (!mine()) return false;
      land(next);

      await sleep(Math.max(0, sweepMs / 2 - fadeMs / 2));
      // A newer turn owning the band is not a failure of this one: the page it
      // was asked for did land, under the band, before the hand-over.
      if (!mine()) return true;
      armedRef.current = false;
      foldRef.current = null;
      setFold(null);
      setTurnPhase(null);
      return true;
    },
    [
      abortTurn,
      armedFold,
      crossFade,
      durationMs,
      ensurePage,
      land,
      moveFold,
      setTurnPhase,
      sweepOf,
    ],
  );

  /**
   * Which page a turn in `step`'s direction would land on, or null for none.
   *
   * The prop when App supplied one; otherwise the neighbour in the print. See
   * `turnTargetOf`'s docblock for why the fallback is a fallback.
   */
  const turnTarget = useCallback((step: 1 | -1): number | null => {
    const ask = turnTargetOfRef.current;
    if (ask) return ask(step);
    const next = currentPageRef.current + step;
    return next >= 1 && next <= totalRef.current ? next : null;
  }, []);

  /**
   * Begin a tracked turn: put the band at its entry edge and hand it the finger.
   *
   * The one asymmetry with `runTurn` is who owns the clock. A wheel turn is a
   * decision already made, so the band sweeps on a transition and the code waits
   * out the milliseconds. A dragged turn has not been decided yet — the reader
   * is *asking*, and may still say no — so nothing here animates: every later
   * frame writes a transform with no transition on it, and the band's position
   * is a pure function of how far the hand has travelled. That is the whole of
   * §4.3's "linearly, 1:1, no easing", and it is why an eased tracking phase
   * would be wrong rather than merely fancy: an ease means the paper is
   * disagreeing with the finger about where the finger is.
   */
  const beginTrackedTurn = useCallback(
    (step: 1 | -1): void => {
      const from = currentPageRef.current;
      const next = turnTarget(step);
      const dir: TurnDir = step > 0 ? "forward" : "back";
      const gen = (turnRef.current += 1);
      // Same three reasons `runTurn` draws nothing, asked in the same order —
      // plus a fourth this one has and it does not: there may be no page that
      // way at all. The stroke still latches, and release still asks App, which
      // is what makes dragging at the end of the inventory say "last page"
      // rather than silently doing nothing.
      const sweepMs = durationMs("--dur-med", 240);
      const kind = next === null ? "none" : foldBetween(from, next, totalRef.current);
      const drawn =
        kind !== "none" && sweepMs > 0 && !(kind === "crease" && foldTargetRef.current?.current);
      dragTurnRef.current = { gen, step, dir, drawn };
      if (!drawn) return;

      setTurnPhase("tracking");
      foldRef.current = { kind: kind as FoldKind, dir };
      setFold(foldRef.current);
      // Pre-mount the destination now rather than at release. The reader is
      // holding a picture of a page; by the time they commit, 200-odd ms of
      // thinking time has been spent on the fetch that would otherwise stall.
      if (next !== null) void ensurePage(next).catch(() => null);
    },
    [durationMs, ensurePage, setTurnPhase, turnTarget],
  );

  /**
   * Move the band to where the hand has put it — 1:1, clamped to its own sweep.
   *
   * Clamped because past `exit` the band has already left the leaf: further drag
   * would push a page-sized element off into the layout, and the reader would be
   * dragging a thing they can no longer see while the commit rule quietly counts
   * up behind them.
   */
  const trackFold = useCallback(
    (dx: number): void => {
      const turn = dragTurnRef.current;
      const el = foldElRef.current;
      if (!turn?.drawn || !el || !armedRef.current || turnRef.current !== turn.gen) return;
      const { enter, exit } = sweepOf(el, turn.dir);
      const at = enter + dx;
      moveFold(el, exit > enter ? Math.min(exit, Math.max(enter, at)) : Math.max(exit, Math.min(enter, at)), 0);
    },
    [moveFold, sweepOf],
  );

  /** Slide the band back the way it came and take it off the stage. */
  const retreatFold = useCallback(
    async (gen: number, dir: TurnDir): Promise<void> => {
      const el = foldElRef.current;
      const mine = (): boolean => turnRef.current === gen;
      if (el && mine()) {
        const ms = durationMs("--dur-fast", 120);
        setTurnPhase("retreating");
        moveFold(el, sweepOf(el, dir).enter, ms);
        await sleep(ms);
      }
      if (!mine()) return;
      armedRef.current = false;
      foldRef.current = null;
      setFold(null);
      setTurnPhase(null);
    },
    [durationMs, moveFold, setTurnPhase, sweepOf],
  );

  /**
   * The finger came up. Ask the commit rule, then either hand the band over or
   * take it back.
   *
   * Handing over is not a second animation: `onTurn` walks through App and back
   * in through `turnTo`, and `runTurn` finds a band that is already armed and
   * mid-leaf, so it re-targets it exactly the way an interrupted wheel turn does.
   * The generation bump inside `runTurn` is synchronous, which is what makes the
   * check below a plain comparison rather than a watchdog: if it did not move,
   * nothing took the band and the honest thing is to give it back.
   */
  const releaseTrackedTurn = useCallback(
    (dx: number, velocityX: number): void => {
      const turn = dragTurnRef.current;
      dragTurnRef.current = null;
      if (!turn || turnRef.current !== turn.gen) return;
      const stageWidth = fitRef.current?.stageWidth ?? stageRef.current?.clientWidth ?? 0;
      const verdict = turnCommit({ dx, velocityX, stageWidth });
      // The commit rule may only confirm or refuse the direction the ladder
      // already latched. A stroke that ended up travelling the other way is a
      // reader who changed their mind, and `turnCommit` returning the opposite
      // sign is that, not a request for the opposite page.
      if (verdict !== turn.step) {
        if (turn.drawn) void retreatFold(turn.gen, turn.dir);
        return;
      }
      onTurnRef.current?.(turn.step);
      if (turn.drawn && turnRef.current === turn.gen) void retreatFold(turn.gen, turn.dir);
    },
    [retreatFold],
  );

  // Report the selected ayah's on-screen rect so the rail can sit beside it.
  const emitSelectionRect = useCallback(() => {
    const emit = onSelectionRectRef.current;
    if (!emit) return;
    const stage = stageRef.current;
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!stage || !cur || !selectedKey) {
      emit(null);
      return;
    }
    const resolved = cur.hl.resolve(selectedKey);
    const firstId = resolved?.elementIds[0];
    if (!resolved || !firstId) {
      emit(null);
      return;
    }
    const el = cur.svg.querySelector<SVGGraphicsElement>(`#${cssEscapeId(firstId)}`);
    const stageBox = stage.getBoundingClientRect();
    if (el && typeof el.getBoundingClientRect === "function") {
      const b = el.getBoundingClientRect();
      emit({ x: b.left - stageBox.left, y: b.top - stageBox.top, width: b.width, height: b.height });
    }
  }, [selectedKey]);

  useImperativeHandle(
    ref,
    (): PageStageHandle => ({
      async navigateTo(key, opts) {
        const loc = resolver.resolve(key);
        if (!loc) return; // unvendored target — App gates the chip, this is a no-op
        // A hop is not a turn (§4.5), so any band still crossing belongs to a
        // page relationship the reader has just left behind.
        abortTurn();
        const mp = await ensurePage(loc.page);
        // A page that will not mount has to be *said*, not swallowed. Staying
        // silent leaves the previous page on the stage while the chrome and the
        // live region have already committed to the new number — the reader is
        // then told they are on 19 while looking at 7, which for a hifz
        // instrument is worse than showing nothing at all. See the ④ eviction
        // probe: offline with an evicted cache is exactly how a *vendored* page
        // fails to fetch, so App's resolver gate never catches it.
        if (!mp) {
          setStatus("error");
          return; // no ghost page
        }
        setStatus("ready");
        // Claimed only once the target really mounted: a navigateTo that fails
        // above must leave the initial page in charge rather than blank the stage.
        navigatedRef.current = true;
        if (loc.page !== currentPageRef.current) setCurrentPage(loc.page);
        const bbox = mp.hl.bboxOf(loc.elementIds);
        const fit = measureFit();
        if (bbox && fit) {
          const target = frameBboxToView(
            bbox,
            { ...fit, viewBoxWidth: viewBoxWidthOf(mp.svg) },
            clampZoom(opts?.zoom ?? DEFAULT_HOP_ZOOM, MIN_ZOOM, MAX_ZOOM),
          );
          await tweenTo(target);
        }
        if (opts?.pulse !== false) {
          mp.hl.highlight(key, "sel", "selection");
          pulse(mp.svg);
        }
        emitSelectionRect();
      },
      async showPage(next) {
        abortTurn(); // a deep link is a relocation, not a turn
        const mp = await ensurePage(next);
        if (!mp) {
          setStatus("error"); // same contract as navigateTo above
          return;
        }
        setStatus("ready");
        navigatedRef.current = true;
        if (next !== currentPageRef.current) setCurrentPage(next);
        cancelTween();
        centerCurrent();
      },
      turnTo(next) {
        return runTurn(next);
      },
    }),
    [
      resolver,
      abortTurn,
      ensurePage,
      runTurn,
      setCurrentPage,
      tweenTo,
      emitSelectionRect,
      cancelTween,
      centerCurrent,
      measureFit,
    ],
  );

  // Mount the initial page and center it.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    ensurePage(page)
      .then((mp) => {
        if (cancelled) return;
        if (!mp) {
          setStatus("error");
          return;
        }
        // A deep link may have navigated while this fetch was in flight. Showing
        // `page` now would hide the page the reader actually asked for, and
        // re-centering would throw away the hop's framing.
        if (!navigatedRef.current) {
          setCurrentPage(page);
          centerCurrent();
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Initial mount only; page changes flow through navigateTo / mountedPages.
  }, []);

  // Tear down every mounted page + its highlighter on unmount.
  useEffect(() => {
    const pages = pagesRef.current;
    const pendingMounts = pendingRef.current;
    const lru = lruRef.current;
    return () => {
      cancelTween();
      // Any turn still awaiting a timer resolves into a component that is gone.
      // Bumping the generation is what makes those wake-ups no-ops rather than
      // writes to detached hosts.
      turnRef.current += 1;
      for (const mp of pages.values()) mp.hl.destroy();
      pages.clear();
      lru.length = 0;
      // Drop in-flight mounts too: their hosts are appended to a layer that is
      // going away, and a stale entry would hand a dead page to a remount.
      pendingMounts.clear();
    };
  }, [cancelTween]);

  // The DOM budget (spec §3.4, `docs/backlog.md` ③). `retainPages` decides it:
  // the page being read, then the requested hop targets in rail order, then —
  // in whatever slots are left — pages already mounted, newest first, so that
  // turning back or returning from a hop costs nothing. Everything past
  // MOUNTED_PAGE_CAP is destroyed and re-fetched if it is asked for again.
  useEffect(() => {
    if (status !== "ready") return;
    // The current page leads the request: it is the one page that must never be
    // evicted, and mountedPages is a hop fan-out that need not contain it.
    const request = [currentPageRef.current, ...mountedPages];
    // Recency is read back off the DOM, not trusted from the last run: a page
    // whose fetch never landed must not hold a slot forever, and navigateTo
    // mounts its target directly, so pagesRef can hold a page the order has
    // never seen. Those go to the tail — newest known first, then the rest.
    const order = lruRef.current.filter((p) => pagesRef.current.has(p));
    const untracked = [...pagesRef.current.keys()].filter((p) => !order.includes(p));
    const keep = retainPages(request, [...order, ...untracked], pageBudget);
    lruRef.current = keep;
    const held = new Set(keep);
    for (const [p, mp] of pagesRef.current) {
      if (!held.has(p)) {
        mp.hl.destroy();
        mp.host.remove();
        pagesRef.current.delete(p);
      }
    }
    // Warm what survived the cap, so a hop's tween has both endpoints ready.
    for (const p of keep) if (!pagesRef.current.has(p)) void ensurePage(p);
  }, [mountedPages, pageBudget, status, ensurePage]);

  /**
   * Let go of the word grain: the band comes off, the ayah stays lit.
   *
   * Every mounted page, not just the current one, because the run is cleared
   * from several places that do not all agree about which page is showing — a
   * new selection, a marquee, an Escape. One group, one owner, and no page keeps
   * a band whose ayah is no longer selected.
   */
  const clearWords = useCallback(() => {
    wordRunRef.current = null;
    for (const mp of pagesRef.current.values()) mp.hl.clear("word");
  }, []);

  // Reflect the controlled selection into the current page's 'selection' group.
  useEffect(() => {
    if (status !== "ready") return;
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!cur) return;
    // Whatever the selection just became, it is not the ayah the word run was
    // refining — a run only ever exists *inside* a selection, so the ayah
    // changing (or going away) ends it. Cheaper than comparing keys, and it
    // covers the case a comparison would miss: the same ayah selected again by
    // a tap, which is a reader asking for the coarse grain back.
    clearWords();
    if (selectedKey) {
      cur.hl.highlight(selectedKey, "sel", "selection");
      // A tap replaces a highlight (App keeps the two mutually exclusive), so
      // the range ink goes with it — otherwise the page would show two answers.
      cur.hl.clear("phrase");
    } else {
      cur.hl.clear("selection");
    }
    emitSelectionRect();
  }, [selectedKey, status, emitSelectionRect, clearWords]);

  // Draw the breadcrumb on whichever mounted page carries the origin ayah — and
  // clear it off the others, which is the half `mountPage` cannot do. Between
  // them the two halves cover both orders: the crumb changing under a mounted
  // page (here) and a page mounting under a standing crumb (there).
  useEffect(() => {
    if (status !== "ready") return;
    for (const mp of pagesRef.current.values()) mp.hl.clear("breadcrumb");
    if (!breadcrumbKey) return;
    const loc = resolver.resolve(breadcrumbKey);
    const mp = loc ? pagesRef.current.get(loc.page) : undefined;
    if (mp) mp.hl.highlight(breadcrumbKey, "crumb", "breadcrumb");
  }, [breadcrumbKey, status, resolver]);

  /**
   * A marquee released: turn the rectangle into an ayah range, ink it, and tell
   * L3. A drag that crossed no ayah (the margins) clears the ink and says
   * nothing — an empty range is not a selection, it is a miss.
   */
  const commitMarquee = useCallback(
    (fromPoint: { x: number; y: number }, clientX: number, clientY: number) => {
      const cur = pagesRef.current.get(currentPageRef.current);
      if (!cur) return;
      cur.hl.clear("preview");
      const toPoint = cur.hl.svgPointFromClient(clientX, clientY);
      const range = toPoint ? cur.hl.rangeFromRect(marqueeRect(fromPoint, toPoint)) : null;
      if (!range) {
        cur.hl.clear("phrase");
        return;
      }
      cur.hl.highlightRange(range.keys, "hlt", "phrase");
      onSelectRangeRef.current?.(range.fromKey, range.toKey, range.keys);
      // A range and a word run answer different questions about the same page,
      // so only one of them may be on it (`clearWords` says why once).
      clearWords();
    },
    [clearWords],
  );

  /**
   * The word shard for a page, fetched at most once.
   *
   * Keyed by edition *and* page: the shards are per-edition directories, and a
   * reader who switches edition is looking at different paper — page 7's boxes
   * are not transferable. `null` is cached as firmly as a shard is, so a page
   * whose shard is missing costs one failed request rather than one per press.
   */
  const ensureWords = useCallback(
    (edition: string, page: number): Promise<WordIndex | null> => {
      const id = `${edition}/${page}`;
      const have = wordShardsRef.current.get(id);
      if (have !== undefined) return Promise.resolve(have);
      const inflight = wordPendingRef.current.get(id);
      if (inflight) return inflight;
      const fetching = loadWordShard(edition, page).then((shard) => {
        const idx = shard && isWordShard(shard) ? new WordIndex(shard) : null;
        wordShardsRef.current.set(id, idx);
        wordPendingRef.current.delete(id);
        return idx;
      });
      wordPendingRef.current.set(id, fetching);
      return fetching;
    },
    [],
  );

  /**
   * Put the run's cursor on one named word, ink from the anchor to it, and — on
   * commit — say which words those were.
   *
   * The half the finger and the keyboard share. They disagree only about how the
   * word is *named*: a drag arrives with a coordinate and has to ask which word
   * that is, a key arrives already knowing. Everything after the answer — the
   * anchor, the band, the `#w` key that goes out — is the same sentence, so it
   * is written once here.
   *
   * The anchor is set once and never re-read, so a drag that runs backwards
   * selects backwards from where the hold landed rather than dragging the anchor
   * along with the finger. A plain arrow key moves the anchor itself (the caller
   * does that before calling); Shift is what leaves it standing.
   */
  const landWords = useCallback((idx: WordIndex, run: WordRun, at: number, commit: boolean) => {
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!cur) return;
    if (run.anchor === null) run.anchor = at;
    run.cursor = at;
    const from = Math.min(run.anchor, at);
    const to = Math.max(run.anchor, at);
    cur.hl.highlightRects(idx.bandsFor(run.key, from, to), "sel", "word");
    if (!commit) return;
    const parsed = parseAyahKey(run.key);
    if (!parsed) return;
    onSelectWordsRef.current?.(
      formatWordKey(parsed.edition, parsed.surah, parsed.ayah, from, to),
      run.key,
    );
  }, []);

  /**
   * The finger's way in: the word nearest where it is now.
   *
   * `wordAt` is nearest-not-containing (words.ts says why), which is what lets
   * the finger travel through the gaps between words without the band flickering
   * off.
   */
  const applyWords = useCallback(
    (idx: WordIndex, run: WordRun, commit: boolean) => {
      const at = idx.wordAt(run.key, run.point.x, run.point.y);
      // Null only if this ayah has no words on this page at all — a shard that
      // disagrees with the manifest. Leave the ayah highlight alone and say
      // nothing rather than inventing a word.
      if (at === null) return;
      landWords(idx, run, at, commit);
    },
    [landWords],
  );

  /**
   * One frame of a word stroke: where the finger is, and whether it just left.
   *
   * The shard is fetched on the first frame and is usually not back yet, so the
   * point is *stored* and the paint happens whenever the numbers arrive —
   * including after the finger has already lifted, which is the common case for
   * a quick press-and-release on a cold page. Dropping that would make the
   * gesture work or not work depending on the network, which is exactly the kind
   * of thing a reader reads as the app being broken.
   */
  const trackWords = useCallback(
    (point: { x: number; y: number }, commit: boolean, fresh: boolean) => {
      const key = selectedKeyRef.current;
      const parsed = key ? parseAyahKey(key) : null;
      if (!key || !parsed) return;
      const page = currentPageRef.current;
      let run = wordRunRef.current;
      // `fresh` is the first frame of *this* hold. Without it a second press on
      // the same ayah would inherit the previous run's anchor and extend a
      // selection the reader thinks they just started over.
      if (fresh || !run || run.key !== key || run.page !== page) {
        run = { key, edition: parsed.edition, page, point, anchor: null, cursor: null, done: commit };
        wordRunRef.current = run;
      } else {
        run.point = point;
        run.done = commit;
      }
      const settled = wordShardsRef.current.get(`${run.edition}/${page}`);
      if (settled !== undefined) {
        if (settled) applyWords(settled, run, commit);
        return;
      }
      const pending = run;
      void ensureWords(run.edition, page).then((idx) => {
        // Only if this is still the stroke that asked. A shard landing after the
        // reader has moved on must not paint over whatever they are doing now.
        if (idx && wordRunRef.current === pending) applyWords(idx, pending, pending.done);
      });
    },
    [applyWords, ensureWords],
  );

  /*
   * Escape climbs one level rather than releasing everything (the ladder the
   * design settled on: tap selects the ayah, a hold inside it drops to words).
   *
   * It runs *before* App's own Escape — this component's effect is registered
   * first because children mount first — and marks the event handled, so the
   * first Escape leaves the word run and the second releases the ayah's focus.
   * Without a run in hand it does nothing at all, so the ordinary Escape is
   * untouched. A sheet up owns the keyboard outright, same rule as the wheel.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (!wordRunRef.current) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      clearWords();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearWords]);

  /*
   * The keyboard's way down into the word grain, and its way along it.
   *
   * The pointer's rule is "a second gesture inside the ayah you already picked
   * means words" — a hold, because the tap is taken. The keyboard has no hold, so
   * its second action is a second Enter: Tab reaches the ayah, Enter selects it,
   * Enter again drops onto its first word, ←/→ move that word, Shift extends the
   * run, and the Escape above climbs back out. One sentence to teach, not two.
   *
   * ← is *forward*: the same mapping the ayah stepper already uses, because the
   * line runs right to left. A third Enter is not handled here and so reaches the
   * highlighter, which reads it as re-selecting the ayah — i.e. the toggle that
   * clears it, and with it the run. Enter, Enter, Enter is all the way out.
   *
   * Capture phase on `window`, which is what lets this exist without touching L1:
   * `Highlighter`'s own keydown sits on the SVG and would read this Enter as
   * "select the focused ayah". Running first and stopping the event is the whole
   * mechanism — the highlighter stays a pure function of the page and never has
   * to learn which ayah is currently selected.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      // A sheet up owns the keyboard outright — the same rule as the wheel.
      if (document.querySelector('[role="dialog"]')) return;
      const run = wordRunRef.current;

      if (!run) {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        const key = selectedKeyRef.current;
        const parsed = key ? parseAyahKey(key) : null;
        if (!key || !parsed) return;
        // Only the polygon of the ayah that is *already* selected descends. The
        // focused element is the polygon itself, so its own id is the question,
        // and a key that is not an ayah's answers it with null — which is how
        // Enter on a button in the chrome stays the chrome's.
        const id = (e.target as Element | null)?.getAttribute?.("id");
        if (!id || resolver.keyForElement(id) !== key) return;
        // On a spread both leaves hear this keystroke and both hold the same
        // `selectedKey`, so the polygon's identity is not enough: only the leaf
        // the ayah is actually printed on may descend. Without this the claim
        // would come down to which stage mounted first.
        const page = currentPageRef.current;
        if (resolver.resolve(key)?.page !== page) return;
        e.preventDefault();
        e.stopPropagation();
        const fresh: WordRun = {
          key,
          edition: parsed.edition,
          page,
          point: { x: 0, y: 0 },
          anchor: null,
          cursor: null,
          done: true,
        };
        wordRunRef.current = fresh;
        void ensureWords(parsed.edition, page).then((idx) => {
          // Only if this is still the descent that asked (same rule as a stroke's).
          if (wordRunRef.current !== fresh) return;
          // No shard, or an ayah this page's shard does not carry: let the run go
          // rather than leave the reader in a word mode with no words in it.
          if (!idx) {
            wordRunRef.current = null;
            return;
          }
          const span = idx.span(key);
          // The first *word*, not the first index. An ayah can open with a pause
          // mark, and a mark may sit inside a selection but never be an end of one.
          const at = span
            ? idx.isMark(key, span.from)
              ? idx.step(key, span.from, 1)
              : span.from
            : null;
          if (at === null) {
            wordRunRef.current = null;
            return;
          }
          landWords(idx, fresh, at, true);
        });
        return;
      }

      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      // Claimed before the shard is consulted: an arrow that fell through while
      // the numbers were still in flight would turn the page out from under a
      // reader who is standing in the middle of an ayah.
      e.preventDefault();
      e.stopPropagation();
      const idx = wordShardsRef.current.get(`${run.edition}/${run.page}`);
      if (!idx || run.cursor === null) return;
      const at = idx.step(run.key, run.cursor, e.key === "ArrowLeft" ? 1 : -1);
      // Null at either end of the ayah *on this page*: stand still. Wrapping
      // would say the ayah is a ring, and stepping into the next one would say
      // the selection had moved, which is the ayah stepper's job, not this.
      if (at === null) return;
      if (!e.shiftKey) run.anchor = at;
      landWords(idx, run, at, true);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [resolver, ensureWords, landWords]);

  // Pan (drag) + zoom (pinch) + marquee (drag-to-highlight) on one surface. Any
  // gesture frame first cancels an in-flight hop tween so the finger cleanly
  // takes over (single write path).
  //
  // The three-way split is core's `nextIntent` (see gestures.ts for the
  // thresholds and why): move-first pans, hold-first paints, two fingers zoom,
  // and whichever wins owns the whole stroke. The stage only *acts* on the
  // verdict — it must not re-decide per frame, or a stroke would change meaning
  // mid-way. `touch-action: none` on the stage (PageStage.module.css) is what
  // makes any of this reachable: without it the browser fires pointercancel and
  // native-scrolls out from under the gesture (research §4).
  useGesture(
    {
      onDrag: ({
        movement: [mx, my],
        xy: [cx, cy],
        initial: [ix, iy],
        velocity: [vx],
        direction: [dirX],
        elapsedTime,
        pinching,
        cancel,
        memo,
        first,
        last,
      }) => {
        if (pinching) {
          cancel();
          return memo;
        }
        if (first) {
          cancelTween();
          // Once per stroke, before the first frame moves anything: the page's
          // roaming range is fixed for the whole drag, and re-measuring it per
          // frame would be a layout read between the transform writes.
          measureFit();
          intentRef.current = "none";
          marqueeStartRef.current = null;
        }
        // Capture the pan origin on the first frame whatever the intent turns
        // out to be, so a pan that latches 8px in doesn't jump by 8px.
        const base = (memo as { x: number; y: number } | undefined) ?? {
          x: view.current.x,
          y: view.current.y,
        };

        // Classify on the *raw* displacement (xy − initial), not on `movement`:
        // @use-gesture subtracts its own tap threshold from `movement`, which is
        // exactly what the pan transform wants (no jump when the drag latches)
        // and exactly what the intent split must not see (it would shrink the
        // slop radius by 3px behind our backs).
        const dx = cx - ix;
        const wasTurn = intentRef.current === "turn";
        const wasWord = intentRef.current === "word";
        const intent = nextIntent(intentRef.current, {
          pointers: 1,
          elapsedMs: elapsedTime,
          dx,
          dy: cy - iy,
          // The two facts the turn rule needs that the hand alone cannot supply.
          // Both are read from values already in hand — `fitRef` was measured on
          // the first frame of this stroke, and the press point is the gesture's
          // own — so classifying costs no layout, which matters because this runs
          // on every pointermove.
          // `dragToTurn: false` opts out by simply not answering: core's ladder
          // treats a missing/false `fitsAcross` as "the horizontal slot is
          // taken", so the stroke falls through to the three-gesture ladder it
          // had before. One flag, no second code path.
          fitsAcross:
            dragToTurnRef.current && fitRef.current
              ? viewFitsAcross(view.current, fitRef.current)
              : false,
          // Distance from the *viewport* edge, not the stage's: the hazard is
          // Safari's own back-swipe band, and Safari measures it against the
          // screen (`page-turning.md` §4.4).
          edgeDistancePx: Math.min(ix, window.innerWidth - ix),
          // …and the one fact the word rule needs: did this stroke start inside
          // the ayah already selected? Read off the press the highlighter
          // already hit tested (`Highlighter.pressedKey`) rather than measured
          // here, so it costs nothing on a gesture that runs every pointermove.
          // A stroke that began anywhere else is the marquee it always was.
          insideSelection:
            selectedKeyRef.current !== null &&
            pagesRef.current.get(currentPageRef.current)?.hl.pressedKey === selectedKeyRef.current,
        });
        intentRef.current = intent;

        // A stroke that has latched into a gesture is no longer a tap, however
        // little the finger travelled. The highlighter's own tap detector
        // decides by travel and cannot see that — `Highlighter.consumePress`
        // carries the case it gets wrong, which is a hold that ends where it
        // began. Said every frame rather than only on the latching one: it is
        // one boolean write, and a guard here would be a second place that has
        // to agree with `nextIntent` about which verdicts are terminal.
        if (intent !== "tap" && intent !== "none") {
          pagesRef.current.get(currentPageRef.current)?.hl.consumePress();
        }

        if (intent === "turn") {
          // Latched this frame: fix the direction and put the band on the stage.
          // Every frame after is the band following the hand and nothing else —
          // in particular the page does not move, because `isViewportIntent` is
          // false for a turn and §1.5's axiom is that no glyph moves during one.
          if (!wasTurn) beginTrackedTurn(dx > 0 ? 1 : -1);
          if (last) releaseTrackedTurn(dx, vx * (dirX || Math.sign(dx)));
          else trackFold(dx);
          return base;
        }

        if (intent === "word") {
          // The finer grain: the page does not move (`isViewportIntent` is false
          // for a word, same as for a marquee), so the CTM is stable and every
          // frame is one client→SVG conversion and one nearest-box search.
          const cur = pagesRef.current.get(currentPageRef.current);
          const point = cur?.hl.svgPointFromClient(cx, cy);
          if (point) trackWords(point, last === true, !wasWord);
          return base;
        }

        if (intent === "marquee") {
          const cur = pagesRef.current.get(currentPageRef.current);
          if (!cur) return base;
          // The page does not move during a marquee, so the CTM is stable and
          // the start point can be resolved lazily from the press coordinates.
          marqueeStartRef.current ??= cur.hl.svgPointFromClient(ix, iy);
          const start = marqueeStartRef.current;
          if (!start) return base;
          if (last) {
            commitMarquee(start, cx, cy);
            marqueeStartRef.current = null;
            return base;
          }
          const now = cur.hl.svgPointFromClient(cx, cy);
          if (now) cur.hl.drawMarquee(marqueeRect(start, now));
          return base;
        }

        // Below both thresholds this is still a tap: hold the page perfectly
        // still so a select never nudges the page under the finger.
        if (isViewportIntent(intent)) {
          view.current.x = base.x + mx;
          view.current.y = base.y + my;
          applyTransform();
        }
        return base;
      },
      onDragEnd: () => {
        // An interrupted marquee (a second finger landed, the drag was
        // cancelled) leaves its rect on the page — drop it, emit nothing.
        if (marqueeStartRef.current) {
          pagesRef.current.get(currentPageRef.current)?.hl.clear("preview");
        }
        // Same for an interrupted turn. `releaseTrackedTurn` clears this ref, so
        // anything still here is a stroke that never got its last frame — a
        // second finger, a `pointercancel`, the tab going away. A band left
        // mid-leaf with no finger on it asserts a turn nobody asked for, so it
        // goes back the way it came rather than staying where it was dropped.
        const stranded = dragTurnRef.current;
        dragTurnRef.current = null;
        if (stranded?.drawn) void retreatFold(stranded.gen, stranded.dir);
        intentRef.current = "none";
        marqueeStartRef.current = null;
        emitSelectionRect();
      },
      // Two fingers on glass. `ctrl`+wheel used to arrive here too, through
      // @use-gesture's `pinchOnWheel`; it now has its own listener below, for
      // the sensitivity reason given there. Both zoom through `zoomAbout`, which
      // is where the anchor arithmetic and §7 ⑨'s fix live.
      onPinch: ({ origin: [ox, oy], movement: [ms], memo, first }) => {
        if (!layerRef.current) return memo;
        if (first) {
          cancelTween();
          measureFit();
        }
        const base =
          (memo as { z: number; x: number; y: number } | undefined) ?? {
            z: view.current.z,
            x: view.current.x,
            y: view.current.y,
          };
        zoomAbout(clampZoom(base.z * ms, MIN_ZOOM, MAX_ZOOM), ox, oy, base);
        return base;
      },
      onPinchEnd: emitSelectionRect,
    },
    {
      target: stageRef,
      drag: { filterTaps: true },
      pinch: {
        scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
        rubberband: true,
        // Hand the wheel back. @use-gesture's wheel-to-pinch bridge divides the
        // delta by a hard-coded 100 and multiplies by the current zoom, so one
        // notch is +40% and three saturate MAX_ZOOM; the constant is not
        // configurable (§7 ③). The listener below does it with a curve, and it
        // is also what makes a *plain* wheel free to turn pages.
        pinchOnWheel: false,
      },
      eventOptions: { passive: false },
    },
  );

  /*
   * The wheel — the desktop's fourth gesture on the same surface, and the one a
   * reader reaches for without being told (`page-turning.md` §7 ③).
   *
   * It is a raw listener rather than a `useGesture` binding because the two
   * things it does are things @use-gesture will not do: turn a *page*, which is
   * not a gesture it models at all, and zoom on a curve of our choosing rather
   * than its own (see `WHEEL_ZOOM_PER_100PX`).
   *
   * The split is one line — `ctrl`/`meta` zooms, anything else turns — and it is
   * not our convention. A trackpad pinch on macOS *is* a `ctrl`+wheel: the OS
   * synthesises the modifier, so honouring it is what makes a two-finger pinch
   * on a laptop zoom the page instead of turning four of them. `metaKey` rides
   * along for the Cmd+scroll some pointing devices send.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      /*
       * The same rule keydown obeys — `keymap.ts` rule 3. With a sheet open the
       * stage is not the thing being operated, and a page turn under it would
       * move the ground the reader is standing on. Nothing is prevented here
       * either: a scrollable sheet (the root lens' list, the jumper's results)
       * must keep its own scroll, and that is the whole reason this returns
       * *before* `preventDefault` rather than after.
       */
      if (document.querySelector('[role="dialog"]')) return;

      // Past this point the wheel is ours, and saying so is not optional: the
      // browser's own ctrl+wheel is a full-page zoom, which would scale the
      // chrome along with the scripture and leave `view.z` lying about it.
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // A wheel has no `first`, so quiet stands in for one — the same
        // threshold the turn rule uses to tell one gesture from the next.
        if (e.timeStamp - wheelZoomAtRef.current >= WHEEL_GAP_MS) {
          cancelTween();
          measureFit();
        }
        wheelZoomAtRef.current = e.timeStamp;
        const base = { z: view.current.z, x: view.current.x, y: view.current.y };
        const factor = Math.pow(WHEEL_ZOOM_PER_100PX, -normalizeWheelDelta(e) / 100);
        zoomAbout(clampZoom(base.z * factor, MIN_ZOOM, MAX_ZOOM), e.clientX, e.clientY, base);
        // …and no `last` either. The rail sits beside the selected ayah, so it
        // has to be told where that ayah ended up, but re-resolving it on every
        // frame of a pinch is work `onPinchEnd` deliberately avoids. A trailing
        // timer is that end: one emit per gesture, after the wheel goes quiet.
        if (wheelSettleRef.current !== null) window.clearTimeout(wheelSettleRef.current);
        wheelSettleRef.current = window.setTimeout(() => {
          wheelSettleRef.current = null;
          emitSelectionRect();
        }, WHEEL_GAP_MS);
        return;
      }

      const { state, step } = nextWheelTurn(wheelTurnRef.current, {
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        timeStamp: e.timeStamp,
      });
      wheelTurnRef.current = state;
      // The stage decided *whether* that was a turn; App decides what turning
      // means, because "the next page" is a fact about the inventory.
      if (step !== 0) onTurnRef.current?.(step);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      if (wheelSettleRef.current !== null) window.clearTimeout(wheelSettleRef.current);
    };
  }, [cancelTween, measureFit, zoomAbout, emitSelectionRect]);

  /*
   * The band. One div, no children, `aria-hidden` — everything it says is also
   * said by the announcer on landing, by the leaf's own edges at rest and by the
   * page bar's inventory, so there is nothing here for a screen reader to stop
   * on. Rendered into the spread when there is one, so that a turn which leaves
   * an opening sweeps the whole book rather than one of its two panels.
   */
  const band = fold ? (
    <div ref={attachFold} className={styles.fold} data-fold={fold.kind} aria-hidden="true" />
  ) : null;
  const target = foldTarget?.current ?? null;

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      // The stage drops its padding on the leaf's bound side so the page runs
      // into the spine. This is the *visible* page's side — the stage has one
      // padding, whatever else is mounted behind — which is why it is read from
      // the prop rather than from `totalRef`/`currentPageRef` like mountPage's.
      // A page mounted behind it whose parity disagrees compensates for the
      // difference itself; see the pair of rules under `.stage[data-leaf]` in
      // the stylesheet, and why an odd→even turn made that necessary.
      data-leaf={leafSideOf(page, total) ?? undefined}
      // A long press IS a gesture here (it arms the marquee), so the platform's
      // own long-press menu would fight it on every highlight.
      onContextMenu={(e) => e.preventDefault()}
    >
      <span id={`page-label-${page}`} className="sr-only">
        {label}
      </span>
      <div ref={layerRef} className={styles.layer} aria-busy={status === "loading"} />
      {band && (target ? createPortal(band, target) : band)}
      {status === "loading" && <div className={styles.hint}>{t.stageLoading}</div>}
      {status === "error" && (
        /* Names the page it failed on, always — the two ways of getting here
           disagree about where the chrome is. A hop or a deep link has already
           moved the header to the page that failed; a turn deliberately has not
           (§5.3), so `errorPage` carries the destination the prop no longer
           holds. Either way, "a page failed" while the header says one number
           and another page is on screen leaves the reader guessing which. */
        <div className={styles.hint} role="alert">
          {t.stageFailed(errorPage ?? page)}
        </div>
      )}
    </div>
  );
});

/**
 * Restart the pulse animation on the freshly-drawn selection.
 *
 * Every element of the group, not the first: a selection is now one marker
 * swipe per line the ayah occupies (@hifth/core ink.ts), so `querySelector`
 * would fade in line one and snap the rest into place beside it — a hop landing
 * half-animated, which reads as a dropped frame rather than as a bug.
 */
function pulse(svg: SVGSVGElement): void {
  for (const sel of svg.querySelectorAll<SVGElement>('[data-hl-group="selection"]')) {
    sel.classList.remove("pulse");
    // Force reflow so re-adding the class restarts the keyframes.
    void (sel as unknown as SVGGraphicsElement).getBBox?.();
    sel.classList.add("pulse");
  }
}

/**
 * Wait, in wall-clock milliseconds.
 *
 * The turn machine is written as a straight line of `await`s rather than as a
 * chain of `transitionend` handlers on purpose: the band's sweep and the two
 * hosts' cross-fade are three separate transitions on three separate elements,
 * and the moment the design cares about — the midpoint of the sweep — is not
 * the end of any of them. A clock that agrees with the CSS duration read from
 * the same token is simpler than reconciling three event streams, and the one
 * thing it can get wrong (a frame of drift) is invisible at 240 ms.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Wait for the next paint.
 *
 * Used only to find the band after React has inserted it: `setFold` schedules a
 * render, and the element does not exist until the browser has committed it.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** Read a page's viewBox width (defaults to the Madani 345). */
function viewBoxWidthOf(svg: SVGSVGElement): number {
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/\s+/).map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2])) return parts[2]!;
  }
  return 345;
}

function cssEscapeId(id: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(id);
  return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

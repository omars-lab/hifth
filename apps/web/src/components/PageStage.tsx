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
  frameBboxToView,
  isViewportIntent,
  leafSideOf,
  lerpView,
  marqueeRect,
  nextIntent,
  Highlighter,
  DEFAULT_HOP_ZOOM,
  type Fold,
  type PointerIntent,
  type Resolver,
  type SkinId,
  type StageFit,
  type TajweedLookup,
  type View,
} from "@hifth/core";
import { loadPageSvg } from "../assets";
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
  /** Pages to keep mounted (current + hop targets), for the DOM budget. */
  mountedPages: readonly number[];
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
  /** Human label for an ayah key (surah name), for per-polygon aria-label. */
  labelFor: (key: string) => string;
  /** Fired with the selected ayah's on-screen bbox so the rail can position. */
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
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

interface MountedPage {
  host: HTMLDivElement;
  svg: SVGSVGElement;
  hl: Highlighter;
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
    label,
    selectedKey,
    breadcrumbKey,
    onSelect,
    onSelectRange,
    labelFor,
    onSelectionRect,
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
  const labelForRef = useRef(labelFor);
  labelForRef.current = labelFor;
  const onSelectionRectRef = useRef(onSelectionRect);
  onSelectionRectRef.current = onSelectionRect;
  // Read by mountPage, which runs async and must not close over a stale skin.
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const tajweedRef = useRef(tajweedLookup);
  tajweedRef.current = tajweedLookup;
  // Same reason: mountPage decides a leaf's free edge after an await.
  const totalRef = useRef(total);
  totalRef.current = total;

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
  }, []);

  const cancelTween = useCallback(() => {
    if (tweenRef.current !== null) {
      cancelAnimationFrame(tweenRef.current);
      tweenRef.current = null;
      startTimeRef.current = null;
    }
  }, []);

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
   * per mounted page — `pagesRef` is unbounded today (backlog ③), and a fade
   * that touched every host would make that unbounded set a per-frame cost
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
    return () => {
      cancelTween();
      // Any turn still awaiting a timer resolves into a component that is gone.
      // Bumping the generation is what makes those wake-ups no-ops rather than
      // writes to detached hosts.
      turnRef.current += 1;
      for (const mp of pages.values()) mp.hl.destroy();
      pages.clear();
      // Drop in-flight mounts too: their hosts are appended to a layer that is
      // going away, and a stale entry would hand a dead page to a remount.
      pendingMounts.clear();
    };
  }, [cancelTween]);

  // Evict pages outside the budget (keep current + requested), spec DOM budget.
  useEffect(() => {
    if (status !== "ready") return;
    const keep = new Set(mountedPages);
    keep.add(currentPageRef.current);
    for (const [p, mp] of pagesRef.current) {
      if (!keep.has(p)) {
        mp.hl.destroy();
        mp.host.remove();
        pagesRef.current.delete(p);
      }
    }
    // Warm the target pages so a hop's tween has both endpoints ready.
    for (const p of mountedPages) if (!pagesRef.current.has(p)) void ensurePage(p);
  }, [mountedPages, status, ensurePage]);

  // Reflect the controlled selection into the current page's 'selection' group.
  useEffect(() => {
    if (status !== "ready") return;
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!cur) return;
    if (selectedKey) {
      cur.hl.highlight(selectedKey, "sel", "selection");
      // A tap replaces a highlight (App keeps the two mutually exclusive), so
      // the range ink goes with it — otherwise the page would show two answers.
      cur.hl.clear("phrase");
    } else {
      cur.hl.clear("selection");
    }
    emitSelectionRect();
  }, [selectedKey, status, emitSelectionRect]);

  // Draw the breadcrumb on whichever mounted page carries the origin ayah.
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
    },
    [],
  );

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
      onDrag: ({ movement: [mx, my], xy: [cx, cy], initial: [ix, iy], elapsedTime, pinching, cancel, memo, first, last }) => {
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
        const intent = nextIntent(intentRef.current, {
          pointers: 1,
          elapsedMs: elapsedTime,
          dx: cx - ix,
          dy: cy - iy,
        });
        intentRef.current = intent;

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
        intentRef.current = "none";
        marqueeStartRef.current = null;
        emitSelectionRect();
      },
      onPinch: ({ origin: [ox, oy], movement: [ms], memo, first }) => {
        const stage = stageRef.current;
        if (!stage) return memo;
        if (first) {
          cancelTween();
          measureFit();
        }
        const rect = stage.getBoundingClientRect();
        const base =
          (memo as { z: number; x: number; y: number } | undefined) ?? {
            z: view.current.z,
            x: view.current.x,
            y: view.current.y,
          };
        const nz = clampZoom(base.z * ms, MIN_ZOOM, MAX_ZOOM);
        const px = ox - rect.left;
        const py = oy - rect.top;
        const k = nz / base.z;
        view.current.z = nz;
        view.current.x = px - (px - base.x) * k;
        view.current.y = py - (py - base.y) * k;
        applyTransform();
        return base;
      },
      onPinchEnd: emitSelectionRect,
    },
    {
      target: stageRef,
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM }, rubberband: true },
      eventOptions: { passive: false },
    },
  );

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

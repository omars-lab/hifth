import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useGesture } from "@use-gesture/react";
import {
  clampZoom,
  easeInOutCubic,
  frameBboxToView,
  isViewportIntent,
  lerpView,
  marqueeRect,
  nextIntent,
  Highlighter,
  DEFAULT_HOP_ZOOM,
  type PointerIntent,
  type Resolver,
  type View,
} from "@hifth/core";
import { loadPageSvg } from "../assets";
import styles from "./PageStage.module.css";

interface PageStageProps {
  resolver: Resolver;
  /** The page currently shown. */
  page: number;
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
}

/** What App can drive imperatively on the stage. */
export interface PageStageHandle {
  /** Pan/zoom to an ayah, mounting its page if needed. Resolves when landed. */
  navigateTo: (key: string, opts?: { pulse?: boolean; zoom?: number }) => Promise<void>;
}

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
    mountedPages,
    label,
    selectedKey,
    breadcrumbKey,
    onSelect,
    onSelectRange,
    labelFor,
    onSelectionRect,
  },
  ref,
): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef(new Map<number, MountedPage>());
  /** Mounts still in flight, so concurrent callers share one fetch (see ensurePage). */
  const pendingRef = useRef(new Map<number, Promise<MountedPage | null>>());
  const currentPageRef = useRef<number>(page);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Latest callbacks without retriggering effects.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectRangeRef = useRef(onSelectRange);
  onSelectRangeRef.current = onSelectRange;
  const labelForRef = useRef(labelFor);
  labelForRef.current = labelFor;
  const onSelectionRectRef = useRef(onSelectionRect);
  onSelectionRectRef.current = onSelectionRect;

  // The one imperative transform. Gestures and the hop tween both write here.
  const view = useRef<View>({ x: 0, y: 0, z: 1 });
  // What the current stroke turned out to mean, latched by `nextIntent` (core
  // gestures.ts), plus where a marquee started in SVG user units. Refs, not
  // state: a gesture must never cost a render.
  const intentRef = useRef<PointerIntent>("none");
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const tweenRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const applyTransform = useCallback(() => {
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!cur) return;
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

  /** Read the hop duration from the token (0 under reduced-motion). */
  const hopDurationMs = useCallback((): number => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--dur-hop")
      .trim();
    const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
    return Number.isFinite(ms) ? ms : 460;
  }, []);

  /** RAF-tween `view` from its current value to `target`. Interruptible. */
  const tweenTo = useCallback(
    (target: View): Promise<void> => {
      cancelTween();
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
    [applyTransform, cancelTween, hopDurationMs],
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

  /** Center the current page's content in the stage (the reset view). */
  const centerCurrent = useCallback(() => {
    const stage = stageRef.current;
    const cur = pagesRef.current.get(currentPageRef.current);
    if (!stage || !cur) return;
    const rect = stage.getBoundingClientRect();
    const cw = cur.host.clientWidth || rect.width;
    view.current = { x: (rect.width - cw) / 2, y: 0, z: 1 };
    applyTransform();
  }, [applyTransform]);

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
        const mp = await ensurePage(loc.page);
        if (!mp) return; // page couldn't mount — no-op, no ghost page
        if (loc.page !== currentPageRef.current) setCurrentPage(loc.page);
        const bbox = mp.hl.bboxOf(loc.elementIds);
        const stage = stageRef.current;
        if (bbox && stage) {
          const target = frameBboxToView(
            bbox,
            {
              contentWidth: mp.host.clientWidth,
              stageWidth: stage.getBoundingClientRect().width,
              stageHeight: stage.getBoundingClientRect().height,
              viewBoxWidth: viewBoxWidthOf(mp.svg),
            },
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
    }),
    [resolver, ensurePage, setCurrentPage, tweenTo, emitSelectionRect],
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
        setCurrentPage(page);
        centerCurrent();
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
      // the range wash goes with it — otherwise the page would show two answers.
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
   * A marquee released: turn the rectangle into an ayah range, wash it, and tell
   * L3. A drag that crossed no ayah (the margins) clears the wash and says
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
        if (first) cancelTween();
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

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      // A long press IS a gesture here (it arms the marquee), so the platform's
      // own long-press menu would fight it on every highlight.
      onContextMenu={(e) => e.preventDefault()}
    >
      <span id={`page-label-${page}`} className="sr-only">
        {label}
      </span>
      <div ref={layerRef} className={styles.layer} aria-busy={status === "loading"} />
      {status === "loading" && <div className={styles.hint}>…جاري التحميل</div>}
      {status === "error" && (
        <div className={styles.hint} role="alert">
          تعذّر تحميل الصفحة. أعد المحاولة.
        </div>
      )}
    </div>
  );
});

/** Restart the pulse animation on the freshly-drawn selection clone. */
function pulse(svg: SVGSVGElement): void {
  const sel = svg.querySelector<SVGElement>('[data-hl-group="selection"]');
  if (!sel) return;
  sel.classList.remove("pulse");
  // Force reflow so re-adding the class restarts the keyframes.
  void (sel as unknown as SVGGraphicsElement).getBBox?.();
  sel.classList.add("pulse");
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

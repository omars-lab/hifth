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
  lerpView,
  Highlighter,
  DEFAULT_HOP_ZOOM,
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
    onSelectionRect,
  },
  ref,
): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef(new Map<number, MountedPage>());
  const currentPageRef = useRef<number>(page);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Latest callbacks without retriggering effects.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectionRectRef = useRef(onSelectionRect);
  onSelectionRectRef.current = onSelectionRect;

  // The one imperative transform. Gestures and the hop tween both write here.
  const view = useRef<View>({ x: 0, y: 0, z: 1 });
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

  /** Fetch + mount a page's SVG, returning its Highlighter (or null if unvendored). */
  const ensurePage = useCallback(
    async (targetPage: number): Promise<MountedPage | null> => {
      const existing = pagesRef.current.get(targetPage);
      if (existing) return existing;
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
      svgEl.setAttribute("role", "img");
      svgEl.setAttribute("aria-labelledby", `page-label-${targetPage}`);
      svgEl.classList.add(styles.svg ?? "");
      layer.appendChild(host);

      const hl = new Highlighter(svgEl as unknown as SVGSVGElement, resolver, targetPage);
      hl.onSelect((key) => onSelectRef.current(key));
      const mp: MountedPage = { host, svg: svgEl as unknown as SVGSVGElement, hl };
      pagesRef.current.set(targetPage, mp);
      return mp;
    },
    [resolver],
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
    return () => {
      cancelTween();
      for (const mp of pages.values()) mp.hl.destroy();
      pages.clear();
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
    if (selectedKey) cur.hl.highlight(selectedKey, "sel", "selection");
    else cur.hl.clear("selection");
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

  // Pan (drag) + zoom (pinch) on one surface. Any gesture frame first cancels an
  // in-flight hop tween so the finger cleanly takes over (single write path).
  useGesture(
    {
      onDrag: ({ movement: [mx, my], pinching, cancel, memo, first }) => {
        if (pinching) {
          cancel();
          return memo;
        }
        if (first) cancelTween();
        const base = (memo as { x: number; y: number } | undefined) ?? {
          x: view.current.x,
          y: view.current.y,
        };
        view.current.x = base.x + mx;
        view.current.y = base.y + my;
        applyTransform();
        return base;
      },
      onDragEnd: emitSelectionRect,
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
    <div ref={stageRef} className={styles.stage}>
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

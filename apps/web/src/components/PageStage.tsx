import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Highlighter, type Resolver } from "@hifth/core";
import { loadPageSvg } from "../assets";
import styles from "./PageStage.module.css";

interface PageStageProps {
  resolver: Resolver;
  page: number;
  /** Human label for the a11y region, e.g. "Page 7". */
  label: string;
  /** The currently selected ayah key (controlled by L3), or null. */
  selectedKey: string | null;
  /** Fired when the user taps an ayah polygon. */
  onSelect: (key: string) => void;
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 5;

/**
 * PageStage — the SVG mount point and the imperative pan/zoom surface (spec L2).
 *
 * The layer contract in practice: React owns the chrome and the *lifecycle*
 * (mount the page, create the Highlighter), but never re-renders on pan/zoom —
 * the transform is written straight to the host element's style in the gesture
 * handlers, so children never reconcile (research §6: one combined transform,
 * children never re-render). The Highlighter is the only owner of SVG geometry;
 * taps flow out through its `onSelect`, selection highlights flow in via the
 * controlled `selectedKey` prop.
 */
export function PageStage({
  resolver,
  page,
  label,
  selectedKey,
  onSelect,
}: PageStageProps): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<Highlighter | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Latest onSelect without retriggering the mount effect.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Imperative view transform. Kept in a ref (not state) so panning never
  // triggers a React render — we write the CSS transform directly.
  const view = useRef({ x: 0, y: 0, z: 1 });
  const applyTransform = () => {
    const host = hostRef.current;
    if (!host) return;
    const { x, y, z } = view.current;
    host.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
  };

  // Mount the page SVG and build the Highlighter over it.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    view.current = { x: 0, y: 0, z: 1 };
    hlRef.current?.destroy();
    hlRef.current = null;

    loadPageSvg(resolver.edition, page)
      .then((svg) => {
        if (cancelled || !hostRef.current) return;
        const host = hostRef.current;
        host.innerHTML = svg;
        const svgEl = host.querySelector("svg");
        if (!svgEl) {
          setStatus("error");
          return;
        }
        // A11y: the page is a labelled image (research §6).
        svgEl.setAttribute("role", "img");
        svgEl.setAttribute("aria-labelledby", `page-label-${page}`);
        svgEl.classList.add(styles.svg ?? "");
        applyTransform();

        const hl = new Highlighter(svgEl as unknown as SVGSVGElement, resolver, page);
        hl.onSelect((key) => onSelectRef.current(key));
        hlRef.current = hl;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      hlRef.current?.destroy();
      hlRef.current = null;
    };
  }, [resolver, page]);

  // Reflect the controlled selection into the highlighter's 'selection' group.
  useEffect(() => {
    const hl = hlRef.current;
    if (!hl || status !== "ready") return;
    if (selectedKey) hl.highlight(selectedKey, "sel", "selection");
    else hl.clear("selection");
  }, [selectedKey, status]);

  // Pan (drag) + zoom (pinch/wheel) on one surface. touch-action:none on the
  // stage (CSS) is what lets the browser hand us continuous pointer streams
  // instead of native-scrolling; @use-gesture's pinch/drag disambiguation keeps
  // a two-finger gesture from also panning.
  useGesture(
    {
      onDrag: ({ movement: [mx, my], pinching, cancel, memo }) => {
        if (pinching) {
          cancel();
          return memo;
        }
        const base = (memo as { x: number; y: number } | undefined) ?? {
          x: view.current.x,
          y: view.current.y,
        };
        view.current.x = base.x + mx;
        view.current.y = base.y + my;
        applyTransform();
        return base;
      },
      onPinch: ({ origin: [ox, oy], movement: [ms], memo }) => {
        const stage = stageRef.current;
        if (!stage) return memo;
        const rect = stage.getBoundingClientRect();
        const base =
          (memo as { z: number; x: number; y: number } | undefined) ?? {
            z: view.current.z,
            x: view.current.x,
            y: view.current.y,
          };
        const nz = clamp(base.z * ms, MIN_ZOOM, MAX_ZOOM);
        // Zoom toward the pinch origin so the point under the fingers stays put.
        const px = ox - rect.left;
        const py = oy - rect.top;
        const k = nz / base.z;
        view.current.z = nz;
        view.current.x = px - (px - base.x) * k;
        view.current.y = py - (py - base.y) * k;
        applyTransform();
        return base;
      },
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
      <div
        ref={hostRef}
        className={styles.host}
        data-status={status}
        aria-busy={status === "loading"}
      />
      {status === "loading" && <div className={styles.hint}>…جاري التحميل</div>}
      {status === "error" && (
        <div className={styles.hint} role="alert">
          تعذّر تحميل الصفحة. أعد المحاولة.
        </div>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

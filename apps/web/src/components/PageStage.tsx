import { useEffect, useRef, useState } from "react";
import { loadPageSvg } from "../assets";
import styles from "./PageStage.module.css";

interface PageStageProps {
  edition: string;
  page: number;
  /** Human label for the a11y region, e.g. "Page 7". */
  label: string;
}

/**
 * PageStage — the SVG mount point (spec L2 boundary).
 *
 * Loop 0 scope: mount one page's SVG statically, exposed accessibly. Pan/zoom
 * (@use-gesture), tap-to-select, and the highlighter hand-off arrive in Loop 1.
 * This component is the ONLY place that hands a raw DOM node to the SVG; per the
 * layer contract, React never restyles mushaf geometry (assets are immutable —
 * PLAN §8). The injected overlay group (#hifth-overlay) is where Loop 1+ draws
 * highlights, so the source SVG is never mutated.
 */
export function PageStage({ edition, page, label }: PageStageProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadPageSvg(edition, page)
      .then((svg) => {
        if (cancelled || !hostRef.current) return;
        const host = hostRef.current;
        host.innerHTML = svg;
        const svgEl = host.querySelector("svg");
        if (svgEl) {
          // A11y exposure (research §6): the SVG is an image with a label.
          svgEl.setAttribute("role", "img");
          svgEl.setAttribute("aria-labelledby", `page-label-${page}`);
          svgEl.classList.add(styles.svg ?? "");
          // Overlay group for highlights — additive, never touches source geometry.
          if (!svgEl.querySelector("#hifth-overlay")) {
            const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
            overlay.setAttribute("id", "hifth-overlay");
            svgEl.appendChild(overlay);
          }
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [edition, page]);

  return (
    <div className={styles.stage}>
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

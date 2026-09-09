import { useEffect, useMemo, useRef } from "react";
import {
  buildStorePageSvg,
  calibrateFontSize,
  fontReady,
  lineGeometry,
  type DrawOptions,
  type Fixture,
  type PageGeometry,
  type ViewBox,
  type WordBoxes,
} from "./storePage";

/*
 * The React face of `storePage.ts`, for the workbench. One effect: build the
 * SVG and put it in the box. The app's overlay never comes through here — it
 * calls the builder directly, inside the page stage's own host — so the two
 * rooms share the drawing and not the framework.
 */
export function StorePageSvg({
  fixture,
  boxes,
  viewBox,
  page,
  fill,
  bands = true,
  style,
  onGeometry,
}: {
  fixture: Fixture;
  boxes: WordBoxes | null;
  viewBox: ViewBox;
  page: number;
  fill?: string;
  bands?: boolean;
  style?: React.CSSProperties | undefined;
  onGeometry?: (g: PageGeometry) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const geom = useMemo(() => lineGeometry(fixture, boxes, viewBox), [fixture, boxes, viewBox]);

  useEffect(() => {
    onGeometry?.(geom);
  }, [geom, onGeometry]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let live = true;
    const opts: DrawOptions = { page, bands };
    if (fill) opts.fill = fill;
    const svg = buildStorePageSvg(fixture, geom, opts);
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
    el.replaceChildren(svg);
    // The words' size is measured from the words, so the face must be loaded
    // and the drawing in the document first; until then it is drawn at the guess.
    void fontReady(page).then(() => {
      if (live) calibrateFontSize(svg, geom);
    });
    return () => {
      live = false;
      el.replaceChildren();
    };
  }, [fixture, geom, page, fill, bands]);

  return <div ref={host} style={style} />;
}

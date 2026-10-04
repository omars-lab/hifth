import { rectsOf } from "@hifth/core";

/**
 * A surah's name, made into the button that opens the surah's introduction
 * (pitch build; owner, 2026-10-04): a soft wash over the name says it can be
 * pressed. It began as an ⓘ beside the name, and the owner asked for the name
 * itself to be the thing pressed. The print draws the whole page
 * as one shape, so the name cannot be picked out by itself: its line is worked
 * out from where verse 1 starts, and where its ink ends is found by asking,
 * point by point along that line, whether the page's shapes are inked there.
 * The asking goes through a canvas, not the page's own elements: a page is
 * drawn while it is still hidden, and a hidden element answers "no" everywhere.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** The distance from one line of the print to the next, in the page's own units. */
export const LINE_PITCH = 35.75;

/**
 * The line holding the surah's name: two lines above verse 1, over the basmala,
 * or one for At-Tawbah (no basmala) and Al-Fatihah (whose basmala is verse 1).
 */
export function titleBand(firstTop: number, surah: number, pitch = LINE_PITCH): { top: number; bottom: number } {
  const bottom = surah === 1 || surah === 9 ? firstTop : firstTop - pitch;
  return { top: Math.max(0, bottom - pitch), bottom };
}

/**
 * Where the name's ink ends on the left, walking out from the middle of the
 * line; null when nothing is inked near the middle. A gap wider than a word's
 * ends the name, so an ornament further along the line is not taken for it.
 */
export function titleLeftEdge(
  inked: (x: number, y: number) => boolean,
  band: { top: number; bottom: number },
  centreX: number,
  { gap = 14, reach = 40 }: { gap?: number; reach?: number } = {},
): number | null {
  const h = band.bottom - band.top;
  const rows = [0.3, 0.4, 0.5, 0.6, 0.7].map((f) => band.top + h * f);
  let last: number | null = null;
  for (let x = Math.round(centreX + reach); x >= 0; x--) {
    if (rows.some((y) => inked(x, y))) last = x;
    else if (last !== null && last - x > gap) break;
    else if (last === null && x < centreX - reach) break;
  }
  return last;
}

/** What is drawn to press: a wash over the name, or an ⓘ beside the basmala. */
export type IntroSpot =
  | { kind: "name"; x: number; y: number; width: number; height: number }
  | { kind: "beside"; cx: number; cy: number };

/**
 * Where the button goes. Over the name: it is centred on the page, so where
 * its ink ends on the right mirrors where it ends on the left, and the wash
 * runs a little past both, inside its line. The first two pages draw no name
 * line, so there an ⓘ goes just left of the line below, the basmala, a little
 * above its middle. Null when neither line has ink near the middle.
 */
export function introSpot(
  inked: (x: number, y: number) => boolean,
  firstTop: number,
  surah: number,
  pitch: number,
  centreX: number,
): IntroSpot | null {
  const name = titleBand(firstTop, surah, pitch);
  const h = name.bottom - name.top;
  if (h > pitch / 2) {
    const edge = titleLeftEdge(inked, name, centreX);
    if (edge !== null) {
      const x = edge - 6;
      return { kind: "name", x, y: name.top + h * 0.12, width: 2 * (centreX - x), height: h * 0.76 };
    }
  }
  const below = { top: name.bottom, bottom: name.bottom + pitch };
  const edge = titleLeftEdge(inked, below, centreX);
  if (edge === null) return null;
  return { kind: "beside", cx: Math.max(8, edge - 10), cy: below.top + pitch * 0.44 };
}

/** From the page's own units to a shape's, through every transform in between. */
function toLocal(el: SVGGraphicsElement, root: SVGSVGElement): DOMMatrix {
  let m = new DOMMatrix();
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const t = (n as SVGGraphicsElement).transform?.baseVal.consolidate();
    if (t) m = DOMMatrix.fromMatrix(t.matrix).multiply(m);
  }
  return m.inverse();
}

/** Make the name of each surah that opens on this page, and has an introduction, a button. */
export function drawIntroBadges(
  svg: SVGSVGElement,
  surahs: ReadonlySet<number>,
  labelOf: (surah: number) => string,
): void {
  svg.querySelector("g[data-intro-badges]")?.remove();
  // Only a page where a surah opens is measured at all.
  const opening = [...svg.querySelectorAll<SVGPathElement>('path.ayahPolygon[ayah="1"]')]
    .map((outline) => ({ surah: Number(outline.getAttribute("surah")), first: rectsOf(outline.getAttribute("d") ?? "")?.[0] }))
    .filter((o) => surahs.has(o.surah) && o.first);
  const ctx = opening.length > 0 ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return;
  const shapes = [...svg.querySelectorAll<SVGPathElement>("path:not(.ayahPolygon)")].map((p) => ({
    path: new Path2D(p.getAttribute("d") ?? ""),
    local: toLocal(p, svg),
    rule: (p.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero") as CanvasFillRule,
  }));
  const inked = (x: number, y: number) =>
    shapes.some((s) => {
      const q = new DOMPoint(x, y).matrixTransform(s.local);
      return ctx.isPointInPath(s.path, q.x, q.y, s.rule);
    });
  const [, , vw = 345, vh = 550] = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("data-intro-badges", "");
  for (const { surah, first } of opening) {
    if (!first) continue;
    const pitch = vh === 550 ? LINE_PITCH : first.height;
    const spot = introSpot(inked, first.y, surah, pitch, vw / 2);
    if (!spot) continue;
    const badge = document.createElementNS(SVG_NS, "g");
    badge.setAttribute("data-intro-badge", "");
    badge.setAttribute("data-surah", String(surah));
    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");
    badge.setAttribute("aria-label", labelOf(surah));
    if (spot.kind === "name") {
      const wash = document.createElementNS(SVG_NS, "rect");
      wash.setAttribute("data-wash", "");
      for (const [k, v] of [["x", spot.x], ["y", spot.y], ["width", spot.width], ["height", spot.height]] as const)
        wash.setAttribute(k, String(Math.round(v * 10) / 10));
      wash.setAttribute("rx", String(Math.round(spot.height * 5) / 10));
      badge.append(wash);
      g.append(badge);
      continue;
    }
    badge.setAttribute("transform", `translate(${spot.cx} ${spot.cy})`);
    // The finger's target, larger than the mark it finds.
    const hit = document.createElementNS(SVG_NS, "circle");
    hit.setAttribute("data-hit", "");
    hit.setAttribute("r", "12");
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("data-ring", "");
    ring.setAttribute("r", "5.5");
    const i = document.createElementNS(SVG_NS, "text");
    i.setAttribute("text-anchor", "middle");
    i.setAttribute("dominant-baseline", "central");
    i.textContent = "i";
    badge.append(hit, ring, i);
    g.append(badge);
  }
  if (g.childNodes.length > 0) svg.append(g);
}

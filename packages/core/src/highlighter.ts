/**
 * Highlighter (spec §3) — the ONE place that touches SVG geometry.
 *
 * Framework-free. React hands it a mounted `<svg>` node (the layer contract: L3
 * never restyles mushaf geometry). It renders highlights into an additive
 * `#hifth-overlay` group so the source paths are never mutated, and it groups
 * state by `GroupId` so independent concerns — selection, phrase, breadcrumb —
 * never clobber one another (spec §3).
 *
 * Geometry comes from the live SVG via `getBBox()`, not from the manifest: the
 * resolver says *which* elements carry a key, this reads *where* they are.
 *
 * Loop 1 scope: `highlight`/`clear`/`resolve` (bbox), `onSelect` on tap, and the
 * skin swap. `navigateTo` pan/zoom and range-select live with the PageStage
 * transform in L3-adjacent code for now; the pure geometry helpers they need
 * (`bboxOf`, `svgPointFromClient`) are exported here so there is still one owner
 * of SVG math.
 */

import type { Resolver } from "./resolver.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "hifth-overlay";

export type GroupId = "selection" | "phrase" | "breadcrumb" | "preview";
export type StyleToken = "sel" | "crumb" | "hlt" | "preview";

/** L3 supplies the human-readable label for a key (surah names live in L3). */
export type LabelFor = (key: string) => string;

/** Selector for the interactive ayah polygons on a page. */
const POLYGON_SELECTOR = ".ayahPolygon, [id^='verse-']";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Resolved {
  key: string;
  page: number;
  elementIds: readonly string[];
  bbox: Rect;
}

type SelectCb = (key: string, granularity: "ayah" | "word") => void;

/** Union of a list of rects into one bounding rect. */
function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export class Highlighter {
  private readonly svg: SVGSVGElement;
  private readonly resolver: Resolver;
  private readonly page: number;
  private overlay: SVGGElement;
  private readonly selectCbs: SelectCb[] = [];
  /** group → the clones/rects currently drawn for it, so clear() is exact. */
  private readonly drawn = new Map<GroupId, SVGElement[]>();
  private readonly labelFor: LabelFor | undefined;
  private readonly onPolygonPointerUp: (e: PointerEvent) => void;
  private readonly onPolygonKeyDown: (e: KeyboardEvent) => void;

  constructor(svg: SVGSVGElement, resolver: Resolver, page: number, opts?: { labelFor?: LabelFor }) {
    this.svg = svg;
    this.resolver = resolver;
    this.page = page;
    this.labelFor = opts?.labelFor;
    this.overlay = ensureOverlay(svg);

    // Glyph paths must not eat pointer events; polygons take all hits (asset
    // README + spec §3). Tapping a polygon fires onSelect with its ayah key.
    this.onPolygonPointerUp = (e: PointerEvent) => {
      const key = this.keyForEventTarget(e.target);
      if (!key) return;
      for (const cb of this.selectCbs) cb(key, "ayah");
    };
    svg.addEventListener("pointerup", this.onPolygonPointerUp);

    // Keyboard hop path (spec §7 a11y, Loop 3): Enter/Space selects the focused
    // ayah; Arrow/Home/End move focus along the page's ayahs in document order.
    // The RTL reading order is handled by the caller supplying next/prev intent;
    // here "next" = next polygon in document order (which is reading order).
    this.onPolygonKeyDown = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const poly = target?.closest<SVGElement>(POLYGON_SELECTOR);
      if (!poly) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const key = this.keyForElement(poly);
        if (key) for (const cb of this.selectCbs) cb(key, "ayah");
        return;
      }
      const step = arrowStep(e.key);
      if (step === 0) return;
      e.preventDefault();
      this.moveFocus(poly, step);
    };
    svg.addEventListener("keydown", this.onPolygonKeyDown);

    this.enhancePolygons();
  }

  /** The ayah key for a polygon element, via its id and the resolver. */
  private keyForElement(poly: Element): string | null {
    const id = poly.getAttribute("id");
    return id ? this.resolver.keyForElement(id) : null;
  }

  /** The ayah key for an event target that is (or is inside) a polygon. */
  private keyForEventTarget(target: EventTarget | null): string | null {
    const el = (target as Element | null)?.closest<SVGElement>(POLYGON_SELECTOR);
    return el ? this.keyForElement(el) : null;
  }

  /** Every interactive ayah polygon on the page, in document order. */
  private polygons(): SVGElement[] {
    return Array.from(this.svg.querySelectorAll<SVGElement>(POLYGON_SELECTOR));
  }

  /**
   * Make polygons a keyboard-operable list (spec §7 a11y). Each carries
   * `role="button"`, `tabindex="0"` (Home for the first, so the page has one
   * tab stop that then walks with arrows — a roving-tabindex would be nicer but
   * every-polygon-tabbable is fine for a page's worth), and an `aria-label`
   * naming the ayah ("الآية ٢:٤٨" style, from the L3 `labelFor`). Idempotent.
   */
  private enhancePolygons(): void {
    const polys = this.polygons();
    polys.forEach((poly, i) => {
      poly.setAttribute("role", "button");
      // First polygon is the page's initial tab stop; the rest join the tab
      // order too (arrows are the fast path, Tab still works for AT users).
      poly.setAttribute("tabindex", i === 0 ? "0" : "0");
      const key = this.keyForElement(poly);
      if (key) {
        const label = this.labelFor?.(key) ?? key;
        poly.setAttribute("aria-label", label);
      }
    });
  }

  /** Move keyboard focus `step` polygons from `from` (clamped to the page). */
  private moveFocus(from: SVGElement, step: number): void {
    const polys = this.polygons();
    const i = polys.indexOf(from);
    if (i === -1) return;
    let j: number;
    if (step === Number.NEGATIVE_INFINITY) j = 0;
    else if (step === Number.POSITIVE_INFINITY) j = polys.length - 1;
    else j = Math.max(0, Math.min(polys.length - 1, i + step));
    const next = polys[j];
    if (next && typeof (next as unknown as { focus?: () => void }).focus === "function") {
      (next as unknown as { focus: () => void }).focus();
    }
  }

  /** Resolve a key to page + element ids + live bbox (null if not on this page). */
  resolve(key: string): Resolved | null {
    const loc = this.resolver.resolve(key);
    if (!loc || loc.page !== this.page) return null;
    const bbox = this.bboxOf(loc.elementIds);
    if (!bbox) return null;
    return { key, page: loc.page, elementIds: loc.elementIds, bbox };
  }

  /** The union bbox (SVG user units) of the given element ids on this page. */
  bboxOf(elementIds: readonly string[]): Rect | null {
    const rects: Rect[] = [];
    for (const id of elementIds) {
      const el = this.svg.querySelector<SVGGraphicsElement>(`#${cssEscape(id)}`);
      if (el && typeof el.getBBox === "function") {
        const b = el.getBBox();
        rects.push({ x: b.x, y: b.y, width: b.width, height: b.height });
      }
    }
    return unionRects(rects);
  }

  /**
   * Draw a highlight for `key` in `group` with `style`. Additive: clones the
   * source polygon(s) into the overlay and tags them; the source is untouched.
   * Re-highlighting the same group first clears it, so a group holds one target.
   */
  highlight(key: string, style: StyleToken, group: GroupId): void {
    this.clear(group);
    const loc = this.resolver.resolve(key);
    if (!loc || loc.page !== this.page) return;
    const drawn: SVGElement[] = [];
    for (const id of loc.elementIds) {
      const src = this.svg.querySelector<SVGElement>(`#${cssEscape(id)}`);
      if (!src) continue;
      const clone = src.cloneNode(true) as SVGElement;
      clone.removeAttribute("id");
      clone.setAttribute("class", `hl hl-${style}`);
      clone.setAttribute("data-hl-group", group);
      clone.style.pointerEvents = "none";
      this.overlay.appendChild(clone);
      drawn.push(clone);
    }
    this.drawn.set(group, drawn);
  }

  /** Remove every highlight drawn for a group. */
  clear(group: GroupId): void {
    const els = this.drawn.get(group);
    if (els) for (const el of els) el.remove();
    this.drawn.set(group, []);
  }

  /** Subscribe to tap-selects. Returns an unsubscribe fn. */
  onSelect(cb: SelectCb): () => void {
    this.selectCbs.push(cb);
    return () => {
      const i = this.selectCbs.indexOf(cb);
      if (i >= 0) this.selectCbs.splice(i, 1);
    };
  }

  /** Skin swap = a class on the svg; geometry untouched (spec §3, §8). */
  setSkin(skin: "plain" | "tajweed"): void {
    this.svg.classList.toggle("skin-tajweed", skin === "tajweed");
    this.svg.classList.toggle("skin-plain", skin === "plain");
  }

  /** Convert a client (screen) point to SVG user coordinates. */
  svgPointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    return {
      x: inv.a * clientX + inv.c * clientY + inv.e,
      y: inv.b * clientX + inv.d * clientY + inv.f,
    };
  }

  /** Detach listeners and remove all overlay content. */
  destroy(): void {
    this.svg.removeEventListener("pointerup", this.onPolygonPointerUp);
    this.svg.removeEventListener("keydown", this.onPolygonKeyDown);
    for (const group of this.drawn.keys()) this.clear(group as GroupId);
    this.selectCbs.length = 0;
  }
}

/**
 * Map an arrow/Home/End key to a focus step. RTL note: on a mushaf page reading
 * runs right-to-left, and the polygons are in document (= reading) order, so
 * "move to the next ayah" is +1 regardless of physical arrow direction. We keep
 * it intuitive: Down/Left → next ayah (+1), Up/Right → previous (−1), Home/End
 * → first/last. 0 means "not a navigation key".
 */
function arrowStep(key: string): number {
  switch (key) {
    case "ArrowDown":
    case "ArrowLeft":
      return 1;
    case "ArrowUp":
    case "ArrowRight":
      return -1;
    case "Home":
      return Number.NEGATIVE_INFINITY;
    case "End":
      return Number.POSITIVE_INFINITY;
    default:
      return 0;
  }
}

/** Ensure the additive overlay group exists and return it. */
function ensureOverlay(svg: SVGSVGElement): SVGGElement {
  let overlay = svg.querySelector<SVGGElement>(`#${OVERLAY_ID}`);
  if (!overlay) {
    overlay = document.createElementNS(SVG_NS, "g");
    overlay.setAttribute("id", OVERLAY_ID);
    svg.appendChild(overlay);
  }
  return overlay;
}

/** CSS.escape when available (browser), else a minimal fallback for ids. */
function cssEscape(id: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(id);
  return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

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
 * skin swap. `navigateTo` pan/zoom lives with the PageStage transform in
 * L3-adjacent code for now; the pure geometry helpers it needs (`bboxOf`,
 * `svgPointFromClient`) are exported here so there is still one owner of SVG math.
 *
 * Loop 5 adds the range side of spec §3's `onRangeSelect`: `rangeFromRect` turns
 * a marquee rectangle into the ayahs it crossed, and `highlightRange` /
 * `drawMarquee` paint the amber wash and the live rect — both additive, both in
 * their own groups, both leaving source geometry untouched like everything else.
 */

import { TAP_SLOP_PX } from "./gestures.js";
import type { Resolver } from "./resolver.js";
import {
  TAJWEED_CLASS_PREFIX,
  leadingRule,
  tajweedClass,
  tajweedMarkClass,
  type SkinId,
  type TajweedLookup,
} from "./skins.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "hifth-overlay";

export type GroupId = "selection" | "phrase" | "breadcrumb" | "preview";
export type StyleToken = "sel" | "crumb" | "hlt" | "preview" | "marquee";

/**
 * A marquee that resolved to ayahs. `keys` is the contiguous run in page reading
 * order; `fromKey`/`toKey` are its endpoints — the range form spec §7 links use.
 */
export interface ResolvedRange {
  readonly fromKey: string;
  readonly toKey: string;
  readonly keys: readonly string[];
}

/**
 * A press with no drag is a zero-area rect, and a zero-area rect intersects
 * nothing. Inflate a degenerate marquee to this size (SVG user units — the
 * Madani page is 345 wide, so this is well under a glyph) so "hold and release
 * on one ayah" resolves to that ayah instead of to silence.
 */
export const MARQUEE_MIN_SIZE = 0.5;

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

/**
 * Do two rects overlap with positive area? Strict on every edge: a marquee that
 * merely grazes the boundary of the next ayah's polygon has not touched it, and
 * on a mushaf page the polygons of neighbouring lines share edges — an inclusive
 * test would drag in a whole extra line for a one-pixel overshoot.
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Grow a degenerate marquee to {@link MARQUEE_MIN_SIZE} so it can hit something. */
function inflateDegenerate(rect: Rect): Rect {
  const width = Math.max(rect.width, MARQUEE_MIN_SIZE);
  const height = Math.max(rect.height, MARQUEE_MIN_SIZE);
  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
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
  private readonly onPolygonPointerDown: (e: PointerEvent) => void;
  private readonly onPolygonPointerUp: (e: PointerEvent) => void;
  private readonly onPolygonKeyDown: (e: KeyboardEvent) => void;
  /** Where the current press started, so a release can tell a tap from a drag. */
  private pressAt: { x: number; y: number } | null = null;
  /** The applied skin, and L3's rule lookup for it (spec §8; see `setSkin`). */
  private currentSkin: SkinId = "plain";
  private skinLookup: TajweedLookup | null = null;

  constructor(svg: SVGSVGElement, resolver: Resolver, page: number, opts?: { labelFor?: LabelFor }) {
    this.svg = svg;
    this.resolver = resolver;
    this.page = page;
    this.labelFor = opts?.labelFor;
    this.overlay = ensureOverlay(svg);

    // Glyph paths must not eat pointer events; polygons take all hits (asset
    // README + spec §3). Tapping a polygon fires onSelect with its ayah key.
    //
    // A *tap* — not any release. The stage's pan and marquee gestures both end
    // with a pointerup over some polygon, and this listener sits below them in
    // the bubble path (polygon → svg → … → the document listeners @use-gesture
    // binds), so it cannot be told after the fact to stay quiet. It measures the
    // travel itself instead: past the gestures' own slop radius, the release
    // belongs to a drag and selects nothing.
    this.onPolygonPointerDown = (e: PointerEvent) => {
      this.pressAt =
        typeof e.clientX === "number" && typeof e.clientY === "number"
          ? { x: e.clientX, y: e.clientY }
          : null;
    };
    svg.addEventListener("pointerdown", this.onPolygonPointerDown);

    this.onPolygonPointerUp = (e: PointerEvent) => {
      const press = this.pressAt;
      this.pressAt = null;
      if (press && typeof e.clientX === "number" && typeof e.clientY === "number") {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP_PX) return;
      }
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

  /**
   * Paint several keys at once in one group — the marquee's amber wash over a
   * whole passage (spec §9). Same additive contract as `highlight`: clones into
   * the overlay, source geometry untouched, the group replaced not stacked.
   * Keys not on this page are skipped (a range can't straddle a page turn).
   */
  highlightRange(keys: readonly string[], style: StyleToken, group: GroupId): void {
    this.clear(group);
    const drawn: SVGElement[] = [];
    for (const key of keys) {
      const loc = this.resolver.resolve(key);
      if (!loc || loc.page !== this.page) continue;
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
    }
    this.drawn.set(group, drawn);
  }

  /**
   * Draw the live marquee rectangle (SVG user units) in the `preview` group —
   * the outline the finger is dragging, replaced every frame. It is a plain
   * `<rect>` in the overlay, so it scales with the page transform for free.
   */
  drawMarquee(rect: Rect): void {
    this.clear("preview");
    const el = document.createElementNS(SVG_NS, "rect");
    el.setAttribute("x", String(rect.x));
    el.setAttribute("y", String(rect.y));
    el.setAttribute("width", String(Math.max(0, rect.width)));
    el.setAttribute("height", String(Math.max(0, rect.height)));
    el.setAttribute("class", "hl hl-marquee");
    el.setAttribute("data-hl-group", "preview");
    el.style.pointerEvents = "none";
    this.overlay.appendChild(el);
    this.drawn.set("preview", [el]);
  }

  /**
   * Every ayah key whose polygon geometry the rect crosses, in page reading
   * order. Bbox-against-bbox is the honest resolution the ayah-polygon corpus
   * affords: polygons are line-slabs, so a sweep along a line catches that
   * line's ayahs. Word granularity waits on Loop 4b's ligature corpus (spec §3
   * note); until then the highlighter reports ayahs.
   */
  keysInRect(rect: Rect): string[] {
    const marquee = inflateDegenerate(rect);
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const poly of this.polygons()) {
      const el = poly as unknown as SVGGraphicsElement;
      if (typeof el.getBBox !== "function") continue;
      const b = el.getBBox();
      if (!rectsIntersect(marquee, { x: b.x, y: b.y, width: b.width, height: b.height })) {
        continue;
      }
      const key = this.keyForElement(poly);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys;
  }

  /**
   * Resolve a marquee to the ayah range it selected, or null if it crossed no
   * ayah at all (a drag over the margins). The returned `keys` are the
   * *contiguous* run between the endpoints in page reading order, not the raw
   * intersection: a passage a hand swept across is a passage, and the range link
   * form (spec §7) can only express `from..to` anyway — so a skipped ayah in the
   * middle would be a range whose highlight and whose URL disagree.
   */
  rangeFromRect(rect: Rect): ResolvedRange | null {
    const hit = this.keysInRect(rect);
    const fromKey = hit[0];
    const toKey = hit[hit.length - 1];
    if (!fromKey || !toKey) return null;
    const order = this.keysOnPage();
    const first = order.indexOf(fromKey);
    const last = order.indexOf(toKey);
    const keys = first >= 0 && last >= first ? order.slice(first, last + 1) : hit;
    return { fromKey, toKey, keys };
  }

  /** The ayah keys on this page in document (= reading) order, deduped. */
  private keysOnPage(): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const poly of this.polygons()) {
      const key = this.keyForElement(poly);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys;
  }

  /** Subscribe to tap-selects. Returns an unsubscribe fn. */
  onSelect(cb: SelectCb): () => void {
    this.selectCbs.push(cb);
    return () => {
      const i = this.selectCbs.indexOf(cb);
      if (i >= 0) this.selectCbs.splice(i, 1);
    };
  }

  /** The skin currently applied to this page. */
  get skin(): SkinId {
    return this.currentSkin;
  }

  /**
   * Skin swap (spec §3, §8) — **classes only, never geometry**.
   *
   * Two things change: a scope class on the `<svg>` (so the stylesheet can key
   * off the whole page at once), and, on each ayah polygon, the `tj-*` classes
   * naming the rules on that ayah plus one `tj-mark-<rule>` for its leading
   * rule. Nothing is added, removed or moved in the document; no attribute
   * outside `class`/`data-tj` is written. `geometrySignature()` (skins.ts) is
   * byte-identical across a swap, and the unit tests assert exactly that.
   *
   * `lookup` is L3's index over the loaded shards — the same arrangement as
   * `labelFor`, so L2 never learns the shard format. Omit it to re-apply with
   * whatever lookup was last supplied (which is what "a shard just landed, paint
   * again" looks like from the app's side). Without a lookup the tajweed skin
   * still sets its scope class but marks nothing: honest emptiness beats
   * inventing rules.
   *
   * Overlay clones are unaffected on purpose — `highlight()` *replaces* a
   * clone's class attribute, so a selection never inherits a rule colour and the
   * amber "you are here" keeps winning under any skin.
   */
  setSkin(skin: SkinId, lookup?: TajweedLookup | null): void {
    this.currentSkin = skin;
    if (lookup !== undefined) this.skinLookup = lookup;
    this.svg.classList.toggle("skin-tajweed", skin === "tajweed");
    this.svg.classList.toggle("skin-plain", skin === "plain");

    const paint = skin === "tajweed" && this.skinLookup !== null;
    for (const poly of this.polygons()) {
      for (const cls of (poly.getAttribute("class") ?? "").split(/\s+/)) {
        if (cls.startsWith(TAJWEED_CLASS_PREFIX)) poly.classList.remove(cls);
      }
      poly.removeAttribute("data-tj");
      if (!paint) continue;
      const key = this.keyForElement(poly);
      const marks = key ? this.skinLookup!(key) : [];
      const lead = leadingRule(marks);
      if (!lead) continue;
      poly.classList.add(tajweedMarkClass(lead.id));
      for (const mark of marks) poly.classList.add(tajweedClass(mark.rule.id));
      // The machine-readable rule list, for the app's legend/inspector and for
      // the e2e assertion that the swap actually reached the page.
      poly.setAttribute("data-tj", marks.map((m) => m.rule.id).join(" "));
    }
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
    this.svg.removeEventListener("pointerdown", this.onPolygonPointerDown);
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

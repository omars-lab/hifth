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
 * `drawMarquee` paint the range and the live rect — both additive, both in
 * their own groups, both leaving source geometry untouched like everything else.
 *
 * The marks are hand-drawn bands, one per line an ayah crosses: `paint` finds
 * the lines via ink.ts, rough.ts draws each band's outline from a seed so the
 * same verse always gets the same hand, and one page-wide filter streaks the
 * ink along the line. Each meaning has its own ink — the verse, a passage, a
 * word run — and they blend where they cross. Any geometry ink.ts does not
 * recognise falls back to a filled clone.
 */

import { fingersOnGlass } from "./fingers.js";
import { LONG_PRESS_MS, TAP_SLOP_PX } from "./gestures.js";
import {
  fitSwipesToText,
  joinSwipesByLine,
  pageLineHeight,
  swipesFromPath,
  swipesFromRects,
  textSpanOf,
  type Matrix2D,
  type Swipe,
  type TextSpan,
} from "./ink.js";
import { bandSeed, roughBandPath } from "./rough.js";
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

export type GroupId = "selection" | "phrase" | "breadcrumb" | "preview" | "word" | "heard";
/**
 * What a mark means, which is what decides its colour (highlight.css): `sel`
 * the verse you are on, `hlt` a passage you swept, `run` a run of words you
 * held, `crumb` where you came from, `heard` the verse a "Play to" run is
 * reciting while the verse it started from stays lit. Three inks since the
 * highlight-texture decision (2026-09-30): a passage and a word run each take
 * their own colour, blended with the amber verse where they cross.
 */
export type StyleToken = "sel" | "crumb" | "hlt" | "run" | "preview" | "marquee" | "heard";

/**
 * The styles that are ink, and so get marker swipes instead of a filled clone
 * (see `paint`). `crumb` is deliberately absent: an outline is the grammar for
 * "you came from here", and drawing it as ink would make provenance and
 * selection look like the same kind of thing.
 */
const INKED: ReadonlySet<StyleToken> = new Set<StyleToken>(["sel", "hlt", "run"]);

/**
 * The streaks along the line (highlight-texture, option E): a fixed noise
 * pattern, stretched along the line, thins the ink in long streaks. One filter
 * per page's overlay, the same on every page.
 *
 * The noise is in page units (the filter's default for its primitives), so a
 * streak belongs to the page, not to the mark: a verse is streaked the same
 * way on every visit. The last step floors the ink at 70% of a pass — the
 * table is max(0.7, a) — so a streak thins the mark and never breaks it.
 *
 * It is referenced by an attribute on each band, never from the stylesheet: a
 * `url(#…)` in a built CSS file resolves against the CSS file's own address,
 * and finds nothing there.
 */
export const FIBRE_ID = "hifth-fibre";
/** The one shape this print draws a page's words as; see `textSpan`. */
const TEXT_ID = "content";
export const FIBRE_FLOOR = 0.7;
const FIBRE_TABLE = Array.from({ length: 11 }, (_, i) => Math.max(FIBRE_FLOOR, i / 10).toFixed(1)).join(" ");

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

/**
 * How a verse was chosen: a press let go at once (`tap`), a press kept still
 * past {@link LONG_PRESS_MS} and let go without moving (`hold`), or the
 * keyboard's Enter or Space (`key`). The app decides what each one opens
 * (docs/design/verse-tap-and-hold.md); the page only says which it was.
 */
export type PressKind = "tap" | "hold" | "key";

type SelectCb = (key: string, granularity: "ayah" | "word", how: PressKind) => void;

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
  /** Which ayah the current press landed on — see {@link pressedKey}. */
  private pressKey: string | null = null;
  /** When the current press went down, so a release can tell a tap from a hold. */
  private pressT = 0;
  /** Whether the current press has been spent — see {@link consumePress}. */
  private pressSpent = false;
  /**
   * Whether a second finger came down during this stroke. Two fingers are a
   * pinch, and no release in it is a tap, whichever finger lifts last. Reset by
   * the next first finger down, which the browser marks as the primary one.
   */
  private manyFingers = false;
  /** Stops this page counting the fingers on the whole glass (`fingers.ts`). */
  private unwatchGlass: (() => void) | null = null;
  /** The applied skin, and L3's rule lookup for it (spec §8; see `setSkin`). */
  private currentSkin: SkinId = "plain";
  private skinLookup: TajweedLookup | null = null;
  /**
   * The page's line height in SVG units, computed once from its polygons and
   * cached — the pen needs it to split a merged multi-line rectangle back into
   * lines (see ink.ts). `undefined` means "not computed yet"; the computation
   * itself may land on `null` (nothing parsed), which is a valid, cached answer.
   */
  private lineHeightCache: number | null | undefined;
  /**
   * Where the page's words start and end across the line, measured once the
   * page is laid out — the pen stops every band just past them (see
   * `fitSwipesToText`). `null` means this page has no shape to measure.
   */
  private textSpanCache: TextSpan | null | undefined;
  /**
   * Bands drawn before their page was laid out, with the ends they were drawn
   * at: a link straight to a page draws its verse while the page is still off
   * screen, where its words cannot be measured. Once the page takes up room,
   * `fitWaitingBands` pulls these in, so how soon the page appeared never
   * decides how long a band is.
   */
  private readonly unfitted = new Map<SVGElement, Swipe>();
  private layoutWatch: ResizeObserver | null = null;

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
    // travel itself — past the gestures' own slop radius, the release belongs to
    // a drag and selects nothing — and, for the strokes travel cannot see, it
    // can be told *in advance* ({@link consumePress}).
    this.onPolygonPointerDown = (e: PointerEvent) => {
      // A second finger joining the first: the stroke is a pinch from here on,
      // and the first finger's press stays the one `pressedKey` answers for.
      if (e.isPrimary === false) {
        this.manyFingers = true;
        return;
      }
      this.manyFingers = false;
      this.pressAt =
        typeof e.clientX === "number" && typeof e.clientY === "number"
          ? { x: e.clientX, y: e.clientY }
          : null;
      this.pressSpent = false;
      this.pressT = e.timeStamp;
      // Which ayah was under the finger, decided by the browser's own hit test
      // against the polygon's fill — see `pressedKey` for why it is recorded
      // here and not measured later.
      this.pressKey = this.keyForEventTarget(e.target);
    };
    svg.addEventListener("pointerdown", this.onPolygonPointerDown);
    const glass = svg.ownerDocument?.defaultView;
    this.unwatchGlass = glass ? fingersOnGlass.watch(glass) : null;

    this.onPolygonPointerUp = (e: PointerEvent) => {
      const press = this.pressAt;
      const spent = this.pressSpent;
      this.pressAt = null;
      this.pressSpent = false;
      // The other finger of a pinch can be on the facing page of the open book,
      // where this page never hears it; the count of the whole glass does.
      if (spent || this.manyFingers || fingersOnGlass.crowded) return;
      if (press && typeof e.clientX === "number" && typeof e.clientY === "number") {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP_PX) return;
      }
      const key = this.keyForEventTarget(e.target);
      if (!key) return;
      const how: PressKind = this.pressT && e.timeStamp - this.pressT >= LONG_PRESS_MS ? "hold" : "tap";
      this.pressT = 0;
      for (const cb of this.selectCbs) cb(key, "ayah", how);
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
        if (key) for (const cb of this.selectCbs) cb(key, "ayah", "key");
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
   * The page's line height, computed from its polygons the first time the pen
   * needs it and cached for the life of the page (a page's geometry does not
   * change under it). Read through the pen's split; see {@link pageLineHeight}.
   */
  private inkLineHeight(): number | undefined {
    if (this.lineHeightCache === undefined) {
      const ds = this.polygons()
        .map((p) => p.getAttribute("d"))
        .filter((d): d is string => d !== null);
      this.lineHeightCache = pageLineHeight(ds);
    }
    return this.lineHeightCache ?? undefined;
  }

  /**
   * Where the page's words start and end, in the page's units: the box of the
   * one shape the print draws them all as, `#content`. Kept once measured. A
   * page that is not laid out yet (a leaf not on screen) has an empty box, and
   * gets asked again next time rather than remembered as having no words; a
   * print without that shape, or a browser that cannot measure it, gets bands
   * as long as its verse boxes, as before.
   */
  private textSpan(): TextSpan | undefined {
    if (this.textSpanCache !== undefined) return this.textSpanCache ?? undefined;
    const words = this.svg.querySelector<SVGGraphicsElement>(`#${TEXT_ID}`);
    if (!words || typeof words.getBBox !== "function" || typeof words.getScreenCTM !== "function") {
      this.textSpanCache = null;
      return undefined;
    }
    try {
      // The screen matrices, not each element's own: the two browsers agree on
      // those. Asked for the page's own, Firefox leaves out its sizing to its
      // box, and every band stopped a ninth of the way short of its first word.
      const wordsCtm = words.getScreenCTM() as Matrix2D | null;
      const pageCtm = this.svg.getScreenCTM() as Matrix2D | null;
      if (!wordsCtm || !pageCtm) return undefined;
      const span = textSpanOf(words.getBBox(), wordsCtm, pageCtm);
      if (span) this.textSpanCache = span;
      return span;
    } catch {
      return undefined;
    }
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
      drawn.push(...this.paint(id, style, group));
    }
    // Which verse a mark is on, so a reader of the page (and a test) can ask
    // without measuring it against the verses beneath.
    for (const el of drawn) el.setAttribute("data-hl-key", key);
    this.drawn.set(group, drawn);
  }

  /**
   * Render one source element into the overlay and return what it drew.
   *
   * Two renderings, chosen by what the mark *means*. The inked styles — the
   * selection and the range wash — are drawn as marker swipes (see ink.ts):
   * a band along the middle of each line, round-capped, thinner than the line
   * box. Everything else is cloned exactly as before, because a breadcrumb is
   * not ink: its dashed outline says "you came from here", and an outline is
   * the right grammar for provenance in a way it is not for a highlight.
   *
   * The swipe path falls back to the clone whenever `swipesFromPath` declines
   * the geometry, so an unrecognised page renders the old boxy highlight rather
   * than nothing at all.
   */
  private paint(id: string, style: StyleToken, group: GroupId): SVGElement[] {
    const src = this.svg.querySelector<SVGElement>(`#${cssEscape(id)}`);
    if (!src) return [];

    const swipes = this.swipesOf(src, style);
    if (swipes) return this.drawSwipes(swipes, style, group);

    const clone = src.cloneNode(true) as SVGElement;
    clone.removeAttribute("id");
    return [this.tag(clone, style, group, false)];
  }

  /** The marker swipes for a source element, or null when it is not ink (or not recognised). */
  private swipesOf(src: SVGElement, style: StyleToken): Swipe[] | null {
    return INKED.has(style)
      ? swipesFromPath(src.getAttribute("d") ?? "", this.inkLineHeight())
      : null;
  }

  /**
   * Put a drawn element into the overlay and label it.
   *
   * `hl-ink` is what the stylesheet keys the marker rules off, and it is on the
   * swipes only. Styling by `hl-sel` alone would reach the fallback clone too
   * and turn it into a hairline outline of the polygon — a *worse* result than
   * the box it is meant to be, and one that would only ever appear on the pages
   * we have not seen.
   */
  private tag(el: SVGElement, style: StyleToken, group: GroupId, ink: boolean): SVGElement {
    el.setAttribute("class", `hl hl-${style}${ink ? " hl-ink" : ""}`);
    el.setAttribute("data-hl-group", group);
    el.style.pointerEvents = "none";
    this.overlay.appendChild(el);
    return el;
  }

  /**
   * Lay down one rough band per marker swipe, whatever produced the swipes.
   *
   * Each band is a group holding one filled shape. The group carries what the
   * mark means (its class, so the stylesheet can colour it), the multiply blend
   * and the wipe; the shape inside carries the outline and the streaks. Blend
   * and wipe sit on the outer element and the filter on the inner one because
   * that is the arrangement both browser engines draw right: a blend nested
   * inside a clipped or filtered element blends with nothing and paints solid
   * over the letters (found drawing the options page for this decision).
   *
   * The band's geometry is kept on the group as data — right end, left end,
   * centreline, thickness — so what the pen was asked to draw can be read back
   * without parsing a curve.
   */
  private drawSwipes(swipes: readonly Swipe[], style: StyleToken, group: GroupId): SVGElement[] {
    // One element per swipe rather than one shape for the whole ayah: line
    // heights differ between lines, and each band is as thick as its own line.
    // One node per line the ayah occupies — usually a handful, more for the
    // long ayahs the print fuses into one tall box and the pen splits back.
    const span = this.textSpan();
    const waiting = !span && this.textSpanCache === undefined;
    if (waiting) this.watchForLayout();
    return swipes.map((raw, i) => {
      const g = document.createElementNS(SVG_NS, "g");
      // Which line of the ayah this is, so line 2 starts after line 1 — a
      // marker crosses one line before the next, it does not paint a paragraph
      // at once. A custom property, not a duration: the stylesheet owns timing
      // and reduced-motion can zero it.
      g.style.setProperty("--hl-i", String(i));
      const band = document.createElementNS(SVG_NS, "path");
      band.setAttribute("class", "hl-band");
      band.setAttribute("filter", `url(#${FIBRE_ID})`);
      g.appendChild(band);
      this.shapeBand(g, fitSwipesToText([raw], span)[0]!);
      if (waiting) this.unfitted.set(g, raw);
      return this.tag(g, style, group, true);
    });
  }

  /** Give a drawn band its ends and its outline. */
  private shapeBand(g: SVGElement, s: Swipe): void {
    g.setAttribute("data-x1", String(Math.max(s.x1, s.x2)));
    g.setAttribute("data-x2", String(Math.min(s.x1, s.x2)));
    g.setAttribute("data-y", String(s.y));
    g.setAttribute("data-width", String(s.width));
    g.querySelector(".hl-band")?.setAttribute("d", roughBandPath(s, bandSeed(this.page, s)));
  }

  /**
   * Wait for this page to take up room, then fit the bands drawn while it could
   * not be measured. A browser with no way to watch keeps them as drawn.
   */
  private watchForLayout(): void {
    if (this.layoutWatch || typeof ResizeObserver === "undefined") return;
    this.layoutWatch = new ResizeObserver(() => this.fitWaitingBands());
    this.layoutWatch.observe(this.svg);
  }

  private fitWaitingBands(): void {
    const span = this.textSpan();
    if (!span) return;
    for (const [g, raw] of this.unfitted) if (g.isConnected) this.shapeBand(g, fitSwipesToText([raw], span)[0]!);
    this.unfitted.clear();
    this.layoutWatch?.disconnect();
    this.layoutWatch = null;
  }

  /**
   * Ink a set of rectangles directly — the word selection's path onto the page.
   *
   * The one method here that takes geometry as an argument rather than reading
   * it off the mounted SVG, and the header's rule about that is deliberately not
   * being broken: a word has no element to measure. Its rectangle comes from a
   * shard (`words.ts`), pre-collapsed by `WordIndex.bandsFor` into one rect per
   * line — the same shape `swipesFromPath` parses a polygon into — so the two
   * kinds of selection reach the pen as the same thing and cannot drift apart.
   *
   * No fallback branch, because there is nothing to fall back *to*: a rectangle
   * cannot fail to be recognised, and there is no source element to clone.
   */
  highlightRects(rects: readonly Rect[], style: StyleToken, group: GroupId): void {
    this.clear(group);
    if (rects.length === 0) return;
    this.drawn.set(
      group,
      this.drawSwipes(swipesFromRects(rects, this.inkLineHeight()), style, group),
    );
  }

  /** Remove every highlight drawn for a group. */
  clear(group: GroupId): void {
    const els = this.drawn.get(group);
    if (els)
      for (const el of els) {
        el.remove();
        this.unfitted.delete(el);
      }
    this.drawn.set(group, []);
  }

  /**
   * Paint several keys at once in one group — the marquee's amber over a whole
   * passage (spec §9). Same additive contract as `highlight`: draws into
   * the overlay, source geometry untouched, the group replaced not stacked.
   * Keys not on this page are skipped (a range can't straddle a page turn).
   */
  highlightRange(keys: readonly string[], style: StyleToken, group: GroupId): void {
    this.clear(group);
    const drawn: SVGElement[] = [];
    // The inked verses are gathered first and joined line by line before the
    // pen goes down, so a passage is one band per line: painted verse by verse,
    // the two bands on a line two verses share would each stop half a stroke
    // short and leave a notch of paper around the verse number (see
    // `joinSwipesByLine`). Anything the pen does not recognise is still cloned,
    // as `highlight` would.
    const swipes: Swipe[] = [];
    for (const key of keys) {
      const loc = this.resolver.resolve(key);
      if (!loc || loc.page !== this.page) continue;
      for (const id of loc.elementIds) {
        const src = this.svg.querySelector<SVGElement>(`#${cssEscape(id)}`);
        if (!src) continue;
        const s = this.swipesOf(src, style);
        if (s) swipes.push(...s);
        else drawn.push(...this.paint(id, style, group));
      }
    }
    if (swipes.length) drawn.push(...this.drawSwipes(joinSwipesByLine(swipes), style, group));
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

  /**
   * The ayah the current press landed on, or null if it landed off the text.
   *
   * Set on `pointerdown` and left standing until the next one, which is what
   * makes it readable from the middle of a drag — the question "did this stroke
   * begin inside the ayah I have selected?" (`gestures.ts`
   * {@link PointerSample.insideSelection}) is asked several frames after the
   * press, once the hold has run long enough to mean something.
   *
   * Recorded rather than measured because the press event has already been hit
   * tested by the browser, against the polygon's actual fill. Re-deriving it
   * later would mean either a bounding box — which on a two-line ayah covers
   * words belonging to its neighbours — or `isPointInFill` per polygon, which is
   * a geometry query on the compositor's critical path for an answer the
   * pointerdown handed us for free.
   */
  get pressedKey(): string | null {
    return this.pressKey;
  }

  /**
   * Spend the current press: the release that ends it selects nothing.
   *
   * The tap detector on `pointerup` decides by travel — a release more than
   * {@link TAP_SLOP_PX} from its press belongs to a drag — and that is right for
   * every gesture whose defining feature is movement. It is wrong for the two
   * whose defining feature is *stillness*. A hold that drops into words
   * (`gestures.ts` `heldIntent`) can travel three pixels and mean something
   * quite specific, and the release that ends it used to read as a second tap on
   * the ayah already selected — which the app takes as "dismiss", so a reader
   * who long-pressed inside their own selection and lifted lost the selection
   * they were refining. A small marquee ended the same way.
   *
   * So the ladder tells the detector, rather than the detector guessing: the
   * stage calls this on the frame a stroke latches into any intent that is not a
   * tap. Cleared by the next `pointerdown`, so it can never mute a later press.
   *
   * {@link pressedKey} is deliberately *not* cleared here — it answers a
   * question about where this stroke began, which stays true after the stroke
   * has been spoken for.
   */
  consumePress(): void {
    this.pressAt = null;
    this.pressSpent = true;
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
    this.unwatchGlass?.();
    this.unwatchGlass = null;
    for (const group of this.drawn.keys()) this.clear(group as GroupId);
    this.layoutWatch?.disconnect();
    this.layoutWatch = null;
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
  if (!overlay.querySelector(`#${FIBRE_ID}`)) overlay.appendChild(fibreFilter());
  return overlay;
}

/**
 * The streak filter ({@link FIBRE_ID}), in a `<defs>` of its own. Noise
 * stretched along the line (a low frequency across it, a high one down it),
 * turned into how much ink stays, floored, and cut to the band's own shape.
 * The region is the band's box and a little more, so a failure to filter can
 * only ever draw the band itself.
 */
function fibreFilter(): SVGDefsElement {
  const el = (tag: string, attrs: Record<string, string>) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const defs = el("defs", {}) as SVGDefsElement;
  const filter = el("filter", {
    id: FIBRE_ID,
    x: "-5%",
    y: "-20%",
    width: "110%",
    height: "140%",
    "color-interpolation-filters": "sRGB",
  });
  filter.append(
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.018 0.42", numOctaves: "2", seed: "17", result: "noise" }),
    el("feColorMatrix", {
      in: "noise",
      type: "matrix",
      values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 0 0 0 0.2",
      result: "streaks",
    }),
  );
  const floor = el("feComponentTransfer", { in: "streaks", result: "kept" });
  floor.append(el("feFuncA", { type: "table", tableValues: FIBRE_TABLE }));
  filter.append(floor, el("feComposite", { in: "SourceGraphic", in2: "kept", operator: "in" }));
  defs.append(filter);
  return defs;
}

/** CSS.escape when available (browser), else a minimal fallback for ids. */
function cssEscape(id: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(id);
  return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

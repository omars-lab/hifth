// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TAP_SLOP_PX } from "./gestures.js";
import { Highlighter, MARQUEE_MIN_SIZE, rectsIntersect } from "./highlighter.js";
import { Resolver } from "./resolver.js";
import type { AssetManifest } from "./types.js";

const manifest: AssetManifest = {
  edition: "hafs-kfqc",
  editionLabel: "Hafs (test)",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-45", number: 2038, surah: 2, ayah: 38, key: "quran/hafs-kfqc/2:38" },
        { elementId: "verse-46", number: 2039, surah: 2, ayah: 39, key: "quran/hafs-kfqc/2:39" },
      ],
    },
  ],
};

/**
 * A fixture whose ayah hit areas are `<polygon>` elements with no `d` — so
 * every test built on it exercises the *fallback* rendering, the cloned shape.
 * That is deliberate and it is only half the story: the shipped assets are
 * `<path>` rect runs and take the marker-swipe branch instead. The
 * "marker swipes" block at the end of this file uses real corpus geometry to
 * cover that side, and `makeInkSvg` below builds it.
 */
function makeSvg(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 345 550");
  for (const id of ["verse-45", "verse-46"]) {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("id", id);
    poly.setAttribute("class", "ayahPolygon");
    // jsdom has no SVG layout; stub getBBox so bbox-dependent paths are testable.
    (poly as unknown as { getBBox: () => DOMRect }).getBBox = () =>
      ({ x: 10, y: 20, width: 30, height: 40 }) as DOMRect;
    svg.appendChild(poly);
  }
  const glyph = document.createElementNS(NS, "path");
  glyph.setAttribute("class", "glyph");
  svg.appendChild(glyph);
  document.body.appendChild(svg);
  return svg;
}

describe("Highlighter", () => {
  let svg: SVGSVGElement;
  let hl: Highlighter;
  const resolver = new Resolver(manifest);

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeSvg();
    hl = new Highlighter(svg, resolver, 7);
  });

  it("creates the additive overlay group and never mutates source polygons", () => {
    const overlay = svg.querySelector("#hifth-overlay");
    expect(overlay).not.toBeNull();
    const before = svg.querySelector("#verse-45")!.outerHTML;
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    // Source element is byte-identical after highlighting.
    expect(svg.querySelector("#verse-45")!.outerHTML).toBe(before);
    // The clone lives in the overlay, tagged, with no id.
    const clones = overlay!.querySelectorAll(".hl-sel");
    expect(clones).toHaveLength(1);
    expect(clones[0]!.getAttribute("id")).toBeNull();
    expect(clones[0]!.getAttribute("data-hl-group")).toBe("selection");
  });

  it("isolates groups: breadcrumb never clobbers selection", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    hl.highlight("quran/hafs-kfqc/2:39", "crumb", "breadcrumb");
    const overlay = svg.querySelector("#hifth-overlay")!;
    expect(overlay.querySelectorAll("[data-hl-group='selection']")).toHaveLength(1);
    expect(overlay.querySelectorAll("[data-hl-group='breadcrumb']")).toHaveLength(1);
    // Clearing one leaves the other.
    hl.clear("breadcrumb");
    expect(overlay.querySelectorAll("[data-hl-group='selection']")).toHaveLength(1);
    expect(overlay.querySelectorAll("[data-hl-group='breadcrumb']")).toHaveLength(0);
  });

  it("re-highlighting a group replaces, not stacks", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    hl.highlight("quran/hafs-kfqc/2:39", "sel", "selection");
    const overlay = svg.querySelector("#hifth-overlay")!;
    expect(overlay.querySelectorAll("[data-hl-group='selection']")).toHaveLength(1);
  });

  it("ignores highlight requests for a key not on this page", () => {
    hl.highlight("quran/hafs-kfqc/2:255", "sel", "selection");
    expect(svg.querySelector("#hifth-overlay")!.children).toHaveLength(0);
  });

  it("fires onSelect with the tapped polygon's ayah key", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-46")!;
    poly.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:39", "ayah");
  });

  it("does not fire onSelect when a non-polygon (glyph) is tapped", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    svg.querySelector(".glyph")!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("resolve() returns the union bbox from live geometry", () => {
    const r = hl.resolve("quran/hafs-kfqc/2:38");
    expect(r).not.toBeNull();
    expect(r?.bbox).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(r?.page).toBe(7);
    expect(hl.resolve("quran/hafs-kfqc/2:255")).toBeNull();
  });

  it("setSkin toggles a class without touching geometry", () => {
    hl.setSkin("tajweed");
    expect(svg.classList.contains("skin-tajweed")).toBe(true);
    expect(svg.querySelectorAll("polygon")).toHaveLength(2); // geometry intact
    hl.setSkin("plain");
    expect(svg.classList.contains("skin-tajweed")).toBe(false);
    expect(svg.classList.contains("skin-plain")).toBe(true);
  });

  it("destroy() detaches the select listener", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    hl.destroy();
    svg.querySelector("#verse-45")!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("Highlighter · keyboard a11y (Loop 3)", () => {
  let svg: SVGSVGElement;
  let hl: Highlighter;
  const resolver = new Resolver(manifest);
  const labelFor = (key: string) => `الآية ${key.slice(key.lastIndexOf("/") + 1)}`;

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeSvg();
    hl = new Highlighter(svg, resolver, 7, { labelFor });
  });

  it("makes each ayah polygon a labeled, focusable button", () => {
    for (const id of ["verse-45", "verse-46"]) {
      const poly = svg.querySelector(`#${id}`)!;
      expect(poly.getAttribute("role")).toBe("button");
      expect(poly.getAttribute("tabindex")).toBe("0");
    }
    expect(svg.querySelector("#verse-45")!.getAttribute("aria-label")).toBe("الآية 2:38");
    expect(svg.querySelector("#verse-46")!.getAttribute("aria-label")).toBe("الآية 2:39");
  });

  it("falls back to the key when no labelFor is supplied", () => {
    document.body.innerHTML = "";
    const bare = makeSvg();
    new Highlighter(bare, resolver, 7);
    expect(bare.querySelector("#verse-45")!.getAttribute("aria-label")).toBe("quran/hafs-kfqc/2:38");
  });

  it("Enter and Space on a focused polygon select its ayah", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-46")!;
    poly.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:39", "ayah");
    cb.mockClear();
    poly.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:39", "ayah");
  });

  it("Arrow keys move focus to the next / previous ayah (document order)", () => {
    const first = svg.querySelector<SVGElement>("#verse-45")!;
    const second = svg.querySelector<SVGElement>("#verse-46")!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(second);
    // Back up; and Up past the start clamps at the first.
    second.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe(first);
  });

  it("Home / End jump to the first / last ayah", () => {
    const first = svg.querySelector<SVGElement>("#verse-45")!;
    const second = svg.querySelector<SVGElement>("#verse-46")!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement).toBe(second);
    second.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.activeElement).toBe(first);
  });

  it("destroy() detaches the keyboard listener", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    hl.destroy();
    svg
      .querySelector("#verse-45")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });
});

/*
 * Loop 5 — the marquee range. The fixture here is a stack of line-slab polygons
 * with distinct bboxes (the shape a real mushaf page has: one wide, short
 * polygon per ayah run), so intersection actually has something to decide.
 */

const rangeManifest: AssetManifest = {
  edition: "hafs-kfqc",
  editionLabel: "Hafs (test)",
  pages: [
    {
      edition: "hafs-kfqc",
      page: 7,
      viewBox: "0 0 345 550",
      polygons: [
        { elementId: "verse-1", number: 2041, surah: 2, ayah: 41, key: "quran/hafs-kfqc/2:41" },
        { elementId: "verse-2", number: 2042, surah: 2, ayah: 42, key: "quran/hafs-kfqc/2:42" },
        { elementId: "verse-3", number: 2043, surah: 2, ayah: 43, key: "quran/hafs-kfqc/2:43" },
        { elementId: "verse-4", number: 2044, surah: 2, ayah: 44, key: "quran/hafs-kfqc/2:44" },
      ],
    },
  ],
};

/** Four stacked line slabs: y = 0..20, 20..40, 40..60, 60..80, all 300 wide. */
function makeRangeSvg(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 345 550");
  ["verse-1", "verse-2", "verse-3", "verse-4"].forEach((id, i) => {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("id", id);
    poly.setAttribute("class", "ayahPolygon");
    const box = { x: 20, y: i * 20, width: 300, height: 20 } as DOMRect;
    (poly as unknown as { getBBox: () => DOMRect }).getBBox = () => box;
    svg.appendChild(poly);
  });
  document.body.appendChild(svg);
  return svg;
}

describe("rectsIntersect", () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };

  it("overlapping rects intersect", () => {
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it("a contained rect intersects (either way round)", () => {
    const inner = { x: 2, y: 2, width: 3, height: 3 };
    expect(rectsIntersect(a, inner)).toBe(true);
    expect(rectsIntersect(inner, a)).toBe(true);
  });

  it("edge-sharing rects do NOT intersect — line slabs must not bleed", () => {
    expect(rectsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsIntersect(a, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
  });

  it("separated rects do not intersect", () => {
    expect(rectsIntersect(a, { x: 11, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe("Highlighter · marquee range (Loop 5)", () => {
  let svg: SVGSVGElement;
  let hl: Highlighter;
  const resolver = new Resolver(rangeManifest);

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeRangeSvg();
    hl = new Highlighter(svg, resolver, 7);
  });

  it("resolves a sweep across two line slabs to those two ayahs", () => {
    const range = hl.rangeFromRect({ x: 30, y: 15, width: 200, height: 15 });
    expect(range).not.toBeNull();
    expect(range!.fromKey).toBe("quran/hafs-kfqc/2:41");
    expect(range!.toKey).toBe("quran/hafs-kfqc/2:42");
    expect(range!.keys).toEqual(["quran/hafs-kfqc/2:41", "quran/hafs-kfqc/2:42"]);
  });

  it("fills the contiguous run between the endpoints", () => {
    // A tall thin marquee down the right margin crosses all four slabs.
    const range = hl.rangeFromRect({ x: 300, y: 5, width: 5, height: 70 });
    expect(range!.keys).toHaveLength(4);
    expect(range!.fromKey).toBe("quran/hafs-kfqc/2:41");
    expect(range!.toKey).toBe("quran/hafs-kfqc/2:44");
  });

  it("a hold-and-release with no drag resolves to the single ayah under it", () => {
    const range = hl.rangeFromRect({ x: 100, y: 50, width: 0, height: 0 });
    expect(range).toEqual({
      fromKey: "quran/hafs-kfqc/2:43",
      toKey: "quran/hafs-kfqc/2:43",
      keys: ["quran/hafs-kfqc/2:43"],
    });
    expect(MARQUEE_MIN_SIZE).toBeGreaterThan(0);
  });

  it("a marquee entirely in the margin resolves to nothing", () => {
    expect(hl.rangeFromRect({ x: 0, y: 200, width: 10, height: 10 })).toBeNull();
  });

  it("a marquee grazing a slab's edge does not pick it up", () => {
    // y = 20 is exactly where slab 1 ends and slab 2 begins.
    const range = hl.rangeFromRect({ x: 30, y: 20, width: 100, height: 10 });
    expect(range!.keys).toEqual(["quran/hafs-kfqc/2:42"]);
  });

  it("paints the range wash in the phrase group without touching selection", () => {
    hl.highlight("quran/hafs-kfqc/2:41", "sel", "selection");
    const range = hl.rangeFromRect({ x: 30, y: 5, width: 200, height: 50 })!;
    hl.highlightRange(range.keys, "hlt", "phrase");
    const overlay = svg.querySelector("#hifth-overlay")!;
    expect(overlay.querySelectorAll("[data-hl-group='phrase']")).toHaveLength(3);
    expect(overlay.querySelectorAll(".hl-hlt")).toHaveLength(3);
    // The selection group is untouched by the wash.
    expect(overlay.querySelectorAll("[data-hl-group='selection']")).toHaveLength(1);
    // …and the source polygons are still pristine.
    expect(svg.querySelectorAll("polygon[id]")).toHaveLength(4);
  });

  it("re-painting the range replaces it, and clear() removes it", () => {
    hl.highlightRange(["quran/hafs-kfqc/2:41", "quran/hafs-kfqc/2:42"], "hlt", "phrase");
    hl.highlightRange(["quran/hafs-kfqc/2:43"], "hlt", "phrase");
    const overlay = svg.querySelector("#hifth-overlay")!;
    expect(overlay.querySelectorAll("[data-hl-group='phrase']")).toHaveLength(1);
    hl.clear("phrase");
    expect(overlay.querySelectorAll("[data-hl-group='phrase']")).toHaveLength(0);
  });

  it("skips keys that are not on this page", () => {
    hl.highlightRange(["quran/hafs-kfqc/2:41", "quran/hafs-kfqc/9:1"], "hlt", "phrase");
    expect(
      svg.querySelector("#hifth-overlay")!.querySelectorAll("[data-hl-group='phrase']"),
    ).toHaveLength(1);
  });

  it("draws the live marquee rect into the preview group and replaces it per frame", () => {
    hl.drawMarquee({ x: 10, y: 10, width: 100, height: 40 });
    const overlay = svg.querySelector("#hifth-overlay")!;
    const rect = overlay.querySelector("rect.hl-marquee")!;
    expect(rect.getAttribute("x")).toBe("10");
    expect(rect.getAttribute("width")).toBe("100");
    hl.drawMarquee({ x: 12, y: 10, width: 120, height: 40 });
    expect(overlay.querySelectorAll("rect.hl-marquee")).toHaveLength(1);
    expect(overlay.querySelector("rect.hl-marquee")!.getAttribute("width")).toBe("120");
    hl.clear("preview");
    expect(overlay.querySelectorAll("rect.hl-marquee")).toHaveLength(0);
  });

  it("the marquee rect never gets a negative size attribute", () => {
    hl.drawMarquee({ x: 10, y: 10, width: -5, height: -5 });
    const rect = svg.querySelector("rect.hl-marquee")!;
    expect(rect.getAttribute("width")).toBe("0");
    expect(rect.getAttribute("height")).toBe("0");
  });
});

describe("Highlighter · a drag release is not a tap (Loop 5)", () => {
  let svg: SVGSVGElement;
  let hl: Highlighter;
  const resolver = new Resolver(rangeManifest);

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeRangeSvg();
    hl = new Highlighter(svg, resolver, 7);
  });

  /** MouseEvent carries clientX/clientY; the listener only cares about the name. */
  function press(el: Element, type: string, x: number, y: number): void {
    el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  }

  it("selects when the finger barely moved (within the gesture slop)", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    press(poly, "pointerup", 100 + TAP_SLOP_PX, 100);
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:42", "ayah");
  });

  it("does not select when the release ends a pan or a marquee", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    press(poly, "pointerup", 100 + TAP_SLOP_PX + 1, 100);
    expect(cb).not.toHaveBeenCalled();
  });

  it("forgets the press point after a release, so the next tap is judged fresh", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    press(poly, "pointerup", 400, 400); // a pan — no select
    press(poly, "pointerup", 100, 100); // a stray release with no press
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:42", "ayah");
  });

  /*
   * `consumePress` — the strokes travel cannot see (word-C).
   *
   * Everything above measures the finger. A long-press that drops into words is
   * the case where that measurement is exactly backwards: the gesture's defining
   * feature is that the finger *stayed*, so it releases well inside the slop and
   * reads as a second tap on the ayah already selected — which the app takes as
   * "dismiss". The reader would lose the selection they were refining, and the
   * word run with it, on every hold that ended where it began.
   */
  it("does not select when the ladder has already spoken for the press", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    hl.consumePress(); // the stage: "this one latched into a word run"
    press(poly, "pointerup", 100 + 2, 100); // a hold, released where it began
    expect(cb).not.toHaveBeenCalled();
  });

  it("spends only the press it was called for", () => {
    const cb = vi.fn();
    hl.onSelect(cb);
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    hl.consumePress();
    press(poly, "pointerup", 100, 100);

    // The next press is a fresh one. Without the reset on `pointerdown`, one
    // word run would mute every tap that followed it.
    press(poly, "pointerdown", 100, 100);
    press(poly, "pointerup", 100, 100);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("quran/hafs-kfqc/2:42", "ayah");
  });

  it("leaves pressedKey standing, because it answers a different question", () => {
    const poly = svg.querySelector("#verse-2")!;
    press(poly, "pointerdown", 100, 100);
    hl.consumePress();
    // Where the stroke began stays true after the stroke is spoken for — this
    // is read every frame of the drag that follows (`PointerSample.insideSelection`).
    expect(hl.pressedKey).toBe("quran/hafs-kfqc/2:42");
  });
});

/**
 * The rendering that actually ships. Everything above builds on `<polygon>`
 * fixtures and therefore only ever sees the fallback clone; these use the real
 * geometry from apps/web/public/assets/pages/hafs-kfqc/7.svg, where an ayah is
 * a run of one axis-aligned rectangle per line it occupies.
 */
describe("Highlighter marker swipes", () => {
  /** verse-45 as it is vendored: two lines. verse-46: one. */
  const TWO_LINE = "M0 8.5h345v38H0Zm79.5 38H345v38.2H79.5Z";
  const ONE_LINE = "M0 84.7h345v38H0Z";

  const resolver = new Resolver(manifest);
  let svg: SVGSVGElement;
  let hl: Highlighter;

  function makeInkSvg(d45: string): SVGSVGElement {
    const NS = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(NS, "svg");
    el.setAttribute("viewBox", "0 0 345 550");
    for (const [id, d] of [
      ["verse-45", d45],
      ["verse-46", ONE_LINE],
    ]) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("id", id);
      path.setAttribute("class", "ayahPolygon");
      path.setAttribute("d", d);
      (path as unknown as { getBBox: () => DOMRect }).getBBox = () =>
        ({ x: 0, y: 8.5, width: 345, height: 76.2 }) as DOMRect;
      el.appendChild(path);
    }
    document.body.appendChild(el);
    return el;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    svg = makeInkSvg(TWO_LINE);
    hl = new Highlighter(svg, resolver, 7);
  });

  it("draws one line per line of the ayah, not one shape for the ayah", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-sel")];
    expect(marks).toHaveLength(2);
    expect(marks.every((m) => m.tagName === "line")).toBe(true);
    // Horizontal: a swipe is a band along a line, so both ends share a y.
    for (const m of marks) expect(m.getAttribute("y1")).toBe(m.getAttribute("y2"));
  });

  it("splits a long ayah's fused middle box into one line per line (#4, #12)", () => {
    // 2:249 as vendored (`verse-256`, page 41): a one-line head, six full-width
    // middle lines the print fused into one 218-unit box, and a one-line tail.
    // Before the fix the box was drawn as a single fat band — the "blob" a
    // reader saw instead of six lines. The line height is not in the ayah (the
    // box is taller than any line it contains); the highlighter reads it off the
    // page's other polygons, which are one line each.
    document.body.innerHTML = "";
    svg = makeInkSvg("M0 6.3h345v36H0Zm0 36h345v218.4H0Zm233.4 218.4H345v36H233.4Z");
    hl = new Highlighter(svg, resolver, 7);
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");

    const marks = [...svg.querySelectorAll<SVGElement>("#hifth-overlay .hl-sel")];
    expect(marks).toHaveLength(8);
    // No band is a blob: every stroke is about one line thick, never the whole
    // box. The old bug drew one stroke 218 × 0.72 ≈ 157 units wide.
    for (const m of marks) {
      expect(Number(m.getAttribute("stroke-width"))).toBeLessThan(36 * 1.5);
    }
    // The stagger runs unbroken across all eight lines, so the wipe still reads
    // as one pen crossing the ayah top to bottom.
    expect(marks.map((m) => m.style.getPropertyValue("--hl-i"))).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7",
    ]);
  });

  it("tags swipes `hl-ink`, which is what the stylesheet keys the pen off", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-sel")];
    expect(marks.every((m) => m.classList.contains("hl-ink"))).toBe(true);
    // Stroke width is per element precisely because line heights differ; a
    // single shape for the whole ayah would have to pick one and be wrong.
    expect(marks.map((m) => m.getAttribute("stroke-width"))).toEqual([
      String(38 * 0.72),
      String(38.2 * 0.72),
    ]);
  });

  // The wipe (highlight.css) draws a stroke by sliding a dash in from the path's
  // START point, so the only thing deciding which way the ink travels is which
  // end the highlighter wrote first. A `<line>` renders identically either way,
  // which means nothing on screen and no other test can catch this being
  // backwards — a left-to-right wipe across Arabic would just look subtly wrong
  // to a reader and correct to everyone else.
  it("starts each swipe at its RIGHT end, because that is where a pen meets Arabic", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-sel")];
    for (const m of marks) {
      expect(Number(m.getAttribute("x1"))).toBeGreaterThan(Number(m.getAttribute("x2")));
    }
  });

  it("hands the wipe the two numbers CSS cannot work out for itself", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    const marks = [...svg.querySelectorAll<SVGElement>("#hifth-overlay .hl-sel")];

    // How long each stroke runs. `stroke-dasharray: 100%` on a <line> resolves
    // against the viewport, not the line, so the length has to be measured here
    // or the dash is the wrong size on every ayah.
    for (const m of marks) {
      const len = Number(m.style.getPropertyValue("--hl-len"));
      expect(len).toBeCloseTo(
        Math.abs(Number(m.getAttribute("x2")) - Number(m.getAttribute("x1"))),
        6,
      );
      expect(len).toBeGreaterThan(0);
    }

    // Which line of the ayah this is, in reading order — the stagger that makes
    // a two-line ayah read as one pen crossing two lines rather than two pens.
    expect(marks.map((m) => m.style.getPropertyValue("--hl-i"))).toEqual(["0", "1"]);
  });

  it("clones the source and withholds `hl-ink` when the geometry is not a rect run", () => {
    document.body.innerHTML = "";
    svg = makeInkSvg("M0 0L120 30L240 0Z"); // a genuine polygon — ink.ts declines
    hl = new Highlighter(svg, resolver, 7);
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");

    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-sel")];
    expect(marks).toHaveLength(1);
    expect(marks[0].tagName).toBe("path");
    // Without this the stylesheet's `fill: none` reaches the clone and the
    // fallback renders as a hairline tracing instead of the old box.
    expect(marks[0].classList.contains("hl-ink")).toBe(false);
    expect(marks[0].getAttribute("id")).toBeNull();
  });

  it("leaves the breadcrumb a clone — provenance is an outline, not ink", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "crumb", "trail");
    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-crumb")];
    expect(marks).toHaveLength(1);
    expect(marks[0].tagName).toBe("path");
    expect(marks[0].classList.contains("hl-ink")).toBe(false);
  });

  it("never touches the source polygon", () => {
    const before = svg.querySelector("#verse-45")!.outerHTML;
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    expect(svg.querySelector("#verse-45")!.outerHTML).toBe(before);
  });

  it("clears every swipe of a group, not just the first", () => {
    hl.highlight("quran/hafs-kfqc/2:38", "sel", "selection");
    expect(svg.querySelectorAll("#hifth-overlay .hl-sel").length).toBe(2);
    hl.clear("selection");
    expect(svg.querySelectorAll("#hifth-overlay .hl-sel")).toHaveLength(0);
  });
});

/**
 * `highlightRects` — the same pen, handed its rectangles instead of finding them.
 *
 * A word selection has no element on the page to measure: the print's words are
 * glyph paths with no structure, so the geometry arrives from a shard. These
 * assert that taking that route changes *nothing* about the ink — same `<line>`
 * per band, same `hl-ink` tag, same right-to-left wipe, same two custom
 * properties — because the moment word ink and ayah ink diverge they read as two
 * different pens on the same page.
 */
describe("Highlighter.highlightRects", () => {
  const resolver = new Resolver(manifest);
  let svg: SVGSVGElement;
  let hl: Highlighter;

  /** Two lines of a word run, the shape `WordIndex.bandsFor` emits. */
  const BANDS = [
    { x: 10, y: 100, width: 200, height: 30 },
    { x: 40, y: 140, width: 120, height: 30 },
  ];

  beforeEach(() => {
    document.body.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 345 550");
    document.body.appendChild(svg);
    hl = new Highlighter(svg, resolver, 7);
  });

  it("lays one swipe per band, inked, in the group it was given", () => {
    hl.highlightRects(BANDS, "sel", "word");
    const marks = [...svg.querySelectorAll("#hifth-overlay .hl-sel")];
    expect(marks).toHaveLength(2);
    expect(marks.every((m) => m.tagName === "line")).toBe(true);
    expect(marks.every((m) => m.classList.contains("hl-ink"))).toBe(true);
    expect(marks.map((m) => m.getAttribute("data-hl-group"))).toEqual(["word", "word"]);
    // Band height is the pen's, not the box's — the same 0.72 an ayah gets.
    expect(marks.map((m) => m.getAttribute("stroke-width"))).toEqual([
      String(30 * 0.72),
      String(30 * 0.72),
    ]);
  });

  it("wipes right-to-left, exactly as the parsed path does", () => {
    hl.highlightRects(BANDS, "sel", "word");
    const marks = [...svg.querySelectorAll<SVGElement>("#hifth-overlay .hl-sel")];
    for (const m of marks) {
      expect(Number(m.getAttribute("x1"))).toBeGreaterThan(Number(m.getAttribute("x2")));
      expect(m.getAttribute("y1")).toBe(m.getAttribute("y2"));
      const len = Number(m.style.getPropertyValue("--hl-len"));
      expect(len).toBeCloseTo(
        Math.abs(Number(m.getAttribute("x2")) - Number(m.getAttribute("x1"))),
        6,
      );
    }
    // The stagger, so two lines of one word run read as one pen crossing both.
    expect(marks.map((m) => m.style.getPropertyValue("--hl-i"))).toEqual(["0", "1"]);
  });

  it("insets the caps so a band stops inside its own box", () => {
    hl.highlightRects([BANDS[0]!], "sel", "word");
    const m = svg.querySelector<SVGElement>("#hifth-overlay .hl-sel")!;
    const half = (30 * 0.72) / 2;
    // Written right-to-left, so x1 is the band's right end.
    expect(Number(m.getAttribute("x1"))).toBeCloseTo(10 + 200 - half, 6);
    expect(Number(m.getAttribute("x2"))).toBeCloseTo(10 + half, 6);
    expect(Number(m.getAttribute("y1"))).toBeCloseTo(115, 6);
  });

  it("draws a single word as a dot when it is narrower than the pen", () => {
    // One short word on its own: 5 units wide against a 21.6-unit band. A real
    // pen tapped once leaves a round mark, and that is what this must be — not
    // a zero-length line the renderer drops.
    hl.highlightRects([{ x: 0, y: 0, width: 5, height: 30 }], "sel", "word");
    const m = svg.querySelector<SVGElement>("#hifth-overlay .hl-sel")!;
    expect(Number(m.getAttribute("x1"))).toBeCloseTo(2.5, 6);
    expect(Number(m.getAttribute("x2"))).toBeCloseTo(2.5, 6);
    expect(m.getAttribute("stroke-width")).toBe(String(30 * 0.72));
  });

  it("replaces its group rather than stacking on it", () => {
    hl.highlightRects(BANDS, "sel", "word");
    hl.highlightRects([BANDS[0]!], "sel", "word");
    expect(svg.querySelectorAll("#hifth-overlay .hl-sel")).toHaveLength(1);
  });

  it("takes an empty run as a clear — which is what Escape hands it", () => {
    hl.highlightRects(BANDS, "sel", "word");
    hl.highlightRects([], "sel", "word");
    expect(svg.querySelectorAll("#hifth-overlay .hl-sel")).toHaveLength(0);
    // And clearing the group afterwards is not a double-remove.
    expect(() => hl.clear("word")).not.toThrow();
  });

  it("leaves every other group where it was", () => {
    // The ayah stays lit underneath: dropping to words is a *descent* into the
    // selection, not a replacement of it, and multiply is what makes the band
    // read as darker ink over the wash rather than as a second colour.
    hl.highlightRects(BANDS, "sel", "word");
    hl.highlightRects([BANDS[0]!], "sel", "selection");
    expect(svg.querySelectorAll('[data-hl-group="word"]')).toHaveLength(2);
    hl.clear("word");
    expect(svg.querySelectorAll('[data-hl-group="selection"]')).toHaveLength(1);
  });
});

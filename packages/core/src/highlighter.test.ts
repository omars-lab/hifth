// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Highlighter } from "./highlighter.js";
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

/** Build a minimal fixture SVG matching the asset shape (polygons + a glyph path). */
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

import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { Edge, WordShard } from "@hifth/core";
import { DiffView } from "./DiffView";
import styles from "./DiffView.module.css";

/**
 * Geometry chosen so an assertion reads as arithmetic: word *n* sits at x = 10n,
 * eight wide, all on one line — so a run of words collapses to a single band and
 * the band's x-span says which words it covers without a lookup. Real pages are
 * right-to-left and their boxes are tight around glyphs; neither fact changes
 * what is being tested here, which is *which indices get washed*.
 */
const boxes = (count: number) =>
  Array.from({ length: count }, (_, i) => [10 * (i + 1), 20, 8, 10] as const);

const SHARDS: Record<number, WordShard> = {
  // 2:48 is printed on page 7 in 23 words, 2:123 on page 19 in 22.
  7: { page: 7, words: { "2:48": { from: 1, boxes: boxes(23) } } },
  19: { page: 19, words: { "2:123": { from: 1, boxes: boxes(22) } } },
};

const PAGE_SVG = '<svg viewBox="0 0 235 235" width="235" height="235"><path d="M0 0" /></svg>';

vi.mock("../assets", () => ({
  loadPageSvg: vi.fn(async () => PAGE_SVG),
  loadWordShard: vi.fn(async (_edition: string, page: number) => SHARDS[page] ?? null),
}));

/** The 2:48 ↔ 2:123 edge as it ships: both sides match on their first 13 words. */
const EDGE: Edge = {
  type: "mutashabih",
  to: "quran/hafs-kfqc/2:123",
  page: 19,
  dir: { dSurah: 0, dPage: 12, sameJuz: true },
  span: { from: [1, 13] },
  toSpan: { from: [1, 13] },
};

const FROM = "quran/hafs-kfqc/2:48";

/** Every wash rectangle on the page, in the order the component appended them. */
function washes(root: HTMLElement, cls: string): SVGRectElement[] {
  return Array.from(root.querySelectorAll<SVGRectElement>(`rect.${cls}`));
}

/** A wash's covered x-span, undoing the half-unit of bleed it is drawn with. */
function xSpan(rect: SVGRectElement): [number, number] {
  const x = Number(rect.getAttribute("x")) + 0.5;
  return [x, x + Number(rect.getAttribute("width")) - 1];
}

describe("DiffView (spec §3 — why these two are confusable)", () => {
  it("washes the words each side does not share, on both sides", async () => {
    const { container } = render(<DiffView edge={EDGE} fromKey={FROM} />);
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(2));

    // 2:48 shares 1–13 of its 23 words, so 14–23 is what differs: x 140 → 238.
    const a = washes(container, styles.dA as string);
    expect(a).toHaveLength(1);
    expect(xSpan(a[0] as SVGRectElement)).toEqual([140, 238]);

    // 2:123 shares the same opening but is 22 words, so 14–22: x 140 → 228.
    const b = washes(container, styles.dB as string);
    expect(b).toHaveLength(1);
    expect(xSpan(b[0] as SVGRectElement)).toEqual([140, 228]);
  });

  it("crops each page to the ayah rather than showing the whole leaf", async () => {
    const { container } = render(<DiffView edge={EDGE} fromKey={FROM} />);
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(2));
    const [from] = Array.from(container.querySelectorAll("svg"));
    // 23 words spanning x 10–238, y 20–30, with two units of air around them.
    expect(from?.getAttribute("viewBox")).toBe("8 18 232 14");
    // A crop has no intrinsic size — it fills the row it is drawn into.
    expect(from?.hasAttribute("width")).toBe(false);
  });

  it("names both ayahs, and says which one the reader is standing on", async () => {
    const { container } = render(<DiffView edge={EDGE} fromKey={FROM} />);
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(2));
    const labels = Array.from(
      container.querySelectorAll(`.${styles.who as string}`),
      (el) => el.textContent,
    );
    expect(labels[0]).toMatch(/٢:٤٨ · هنا/);
    expect(labels[1]).toMatch(/٢:١٢٣/);
    expect(labels[1]).not.toMatch(/هنا/);
  });

  it("hides the artwork from screen readers — the label above it is the name", async () => {
    const { container } = render(<DiffView edge={EDGE} fromKey={FROM} />);
    await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(2));
    for (const svg of Array.from(container.querySelectorAll("svg"))) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("renders nothing when the edge matches in more than one place and names none", () => {
    // 452 of 2,996 look-alike edges are this shape. The row keeps its plain note.
    const { span: _span, ...noSpan } = EDGE;
    const { container } = render(<DiffView edge={noSpan} fromKey={FROM} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a side's page has no geometry to hand", async () => {
    const { container } = render(
      <DiffView edge={{ ...EDGE, page: 400, dir: { dSurah: 0, dPage: 12 } }} fromKey={FROM} />,
    );
    // Give the load a turn to settle, then confirm it stayed empty.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

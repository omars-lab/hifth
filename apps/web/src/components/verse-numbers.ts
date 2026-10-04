import { formatAyahKey, rectsOf, type EditionId, type Rect, type WordIndex } from "@hifth/core";

/**
 * The verse numbers on the page, made into buttons (pitch build; owner,
 * 2026-10-04): a tap on a verse's number opens a short menu of what there is to
 * read about it. The print draws the number as part of the page, so the button
 * is a ring laid over it, found the same way the note dots find it: the number
 * fills the gap between the verse's last word and where its outline stops.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The disc the number fills: the middle of that gap, as tall as its line. Null
 * when the gap is too narrow to hold a number (the verse runs on to the next
 * page, and its number is there).
 */
export function verseNumberDisc(
  lines: readonly Rect[],
  words: readonly Rect[],
): { cx: number; cy: number; r: number } | null {
  if (lines.length === 0 || words.length === 0) return null;
  const last = lines.reduce((a, b) => (b.y > a.y ? b : a));
  const onLast = words.filter((w) => w.y < last.y + last.height && w.y + w.height > last.y);
  if (onLast.length === 0) return null;
  const gap = Math.min(...onLast.map((w) => w.x)) - last.x;
  if (gap < last.height * 0.4) return null;
  return { cx: last.x + gap / 2, cy: last.y + last.height / 2, r: Math.min(gap, last.height) / 2 };
}

/** Lay a button over every verse number on the page; the selected verse's is washed. */
export function drawVerseNumbers(
  svg: SVGSVGElement,
  edition: EditionId,
  words: WordIndex | null,
  selectedKey: string | null,
  labelOf: (key: string) => string,
): void {
  svg.querySelector("g[data-verse-numbers]")?.remove();
  if (!words) return;
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("data-verse-numbers", "");
  for (const outline of svg.querySelectorAll<SVGPathElement>("path.ayahPolygon")) {
    const surah = Number(outline.getAttribute("surah"));
    const ayah = Number(outline.getAttribute("ayah"));
    if (!(surah >= 1 && surah <= 114 && ayah >= 1)) continue;
    const key = formatAyahKey(edition, surah, ayah);
    const lines = rectsOf(outline.getAttribute("d") ?? "");
    const span = words.span(key);
    if (!lines || !span) continue;
    const disc = verseNumberDisc(lines, words.boxesFor(key, span.from, span.to));
    if (!disc) continue;
    const mark = document.createElementNS(SVG_NS, "g");
    mark.setAttribute("data-verse-number", "");
    mark.setAttribute("data-verse-key", key);
    if (key === selectedKey) mark.setAttribute("data-selected", "");
    mark.setAttribute("role", "button");
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("aria-haspopup", "menu");
    mark.setAttribute("aria-label", labelOf(key));
    mark.setAttribute("transform", `translate(${disc.cx} ${disc.cy})`);
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("r", String(disc.r + 1));
    mark.append(ring);
    g.append(mark);
  }
  svg.append(g);
}

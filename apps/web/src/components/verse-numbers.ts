import {
  formatAyahKey,
  printedVerseNumbers,
  rectsOf,
  verseNumberGap,
  type EditionId,
  type NumberPoint,
  type Rect,
  type WordIndex,
} from "@hifth/core";

/**
 * The verse numbers on the page, made into buttons (pitch build; owner,
 * 2026-10-04): a tap on a verse's number opens a short menu of what there is to
 * read about it. The print draws the number as part of the page, so the button
 * is a ring laid over it, found the same way the note dots find it: on the
 * number's centre, which the page drawing marks.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The page's printed verse numbers, by verse (`"2:41"`). The drawing marks each
 * number's centre on its group as `ayah:x` / `ayah:y`, in the page's units.
 */
export function printedNumbersOf(svg: SVGSVGElement): Map<string, NumberPoint> {
  const verses = [...svg.querySelectorAll("path.ayahPolygon")].map(
    (el) => `${el.getAttribute("surah")}:${el.getAttribute("ayah")}`,
  );
  const points: NumberPoint[] = [];
  for (const g of svg.querySelectorAll("g")) {
    const x = g.getAttribute("ayah:x");
    const y = g.getAttribute("ayah:y");
    if (x !== null && y !== null) points.push({ x: Number(x), y: Number(y) });
  }
  return printedVerseNumbers(verses, points);
}

/**
 * The disc the number fills: on its printed centre, as wide as the room up to
 * the verse's last word and no taller than its line. Null when the number is
 * not on this page (the verse runs on to the next, and its number is there).
 */
export function verseNumberDisc(
  lines: readonly Rect[],
  words: readonly Rect[],
  printed?: NumberPoint | null,
): { cx: number; cy: number; r: number } | null {
  const at = verseNumberGap(lines, words, printed);
  if (!at) return null;
  const { line, gap } = at;
  return { cx: line.x + gap / 2, cy: line.y + line.height / 2, r: Math.min(gap, line.height) / 2 };
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
  const printed = printedNumbersOf(svg);
  for (const outline of svg.querySelectorAll<SVGPathElement>("path.ayahPolygon")) {
    const surah = Number(outline.getAttribute("surah"));
    const ayah = Number(outline.getAttribute("ayah"));
    if (!(surah >= 1 && surah <= 114 && ayah >= 1)) continue;
    const key = formatAyahKey(edition, surah, ayah);
    const lines = rectsOf(outline.getAttribute("d") ?? "");
    const span = words.span(key);
    if (!lines || !span) continue;
    const disc = verseNumberDisc(lines, words.boxesFor(key, span.from, span.to), printed.get(`${surah}:${ayah}`));
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

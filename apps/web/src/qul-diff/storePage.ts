/*
 * The store's page, drawn once, for two rooms.
 *
 * This is the one drawing of a page from the held store — which words sit on
 * which of the fifteen lines, set in the print's own per-page word font — and
 * both the side-by-side workbench (`QulDiff.tsx`) and the in-app dev overlay
 * (`overlay.ts`) mount it. Neither draws a line of its own; a slip that showed
 * in one room and not the other would otherwise be a difference between two
 * drawings, not between the store and the print.
 *
 * It is plain DOM, not React, on purpose: the app's page stage mounts the print
 * as an inline SVG it builds by hand, and the overlay has to sit inside that
 * host at the print's exact geometry. A React wrapper for the workbench is one
 * effect away (`StorePage.tsx`).
 *
 * GEOMETRY. The print has no per-line data of its own, but the app ships each
 * page's *word boxes* (assets/words/<edition>/<page>.json) in the print's
 * viewBox coordinates. Those boxes fall into rows; the rows are the print's
 * lines; and pairing them top-to-bottom with the store's ayah lines gives every
 * store line a measured y and the page its column. Surah-name and basmala lines
 * have no boxes and take their y from a straight-line fit of line number → y
 * over the lines that do. So the overlay is drawn at the print's geometry from
 * the print's own measurements — which is the only way a word on the wrong line
 * can be a finding about the store rather than about our guess of where the
 * lines are.
 *
 * NO ARABIC HERE. The word text is a font-private, one-code-point-per-word
 * encoding that arrives at run time from a gitignored fixture, in dev, and
 * nowhere else; this file carries the shapes' addresses, never the shapes.
 */

export type Word = {
  word_id: number;
  surah: number;
  ayah: number;
  position: number;
  text: string;
};

export type Line = {
  line_number: number;
  line_type: string;
  is_centered: boolean;
  surah_number: number | null;
  first_word_id: number | null;
  last_word_id: number | null;
  words: Word[];
};

export type Fixture = { page: number; lines: Line[] };

/** The app's own word-box shard for a page: `"surah:ayah"` → boxes, in viewBox units. */
export type WordBoxes = {
  page: number;
  words: Record<string, { from: number; boxes: [number, number, number, number][] }>;
};

export type ViewBox = { x: number; y: number; w: number; h: number };

/** Where one store line lands on the print, in viewBox units. */
export type LineSlot = {
  line: Line;
  /** vertical centre of the line's ink */
  y: number;
  /**
   * the measure the line is set to (right-to-left: x1 is the start edge). For a
   * line paired to a print row this is that row's own extent — so the short,
   * centred lines of the opening pages are set to their own width and not the
   * page's — and for a line placed by fit it is the page's column.
   */
  x0: number;
  x1: number;
  /** true when this y came from the print's own boxes, false when interpolated */
  measured: boolean;
};

export type PageGeometry = {
  viewBox: ViewBox;
  /** distance between line centres, in viewBox units */
  pitch: number;
  lines: LineSlot[];
  /** rows of print boxes found vs store ayah lines expected — unequal means the pairing is a guess */
  rows: number;
  ayahLines: number;
};

export const EDITION = "hafs-kfqc";

/*
 * The print's own word-shape font, dev-served from the ETL's gitignored cache (see
 * `qulFixturesDev` in vite.config.ts). It is ONE FILE PER PAGE: page N's words are the
 * code points FC41, FC42, … and only `pN.ttf` maps them to N's words — the same code point
 * is a different word in every other page's file, and a general Arabic font shows it as
 * an unrelated ligature. So the face is declared per page, under a family name that carries
 * the page number. The family name is ours; the file is the library's (QUL resource 240).
 */
export const fontFamily = (page: number) => `Hifth QUL Dev V4 p${page}`;
export const fontCss = (page: number) =>
  `@font-face{font-family:"${fontFamily(page)}";src:url("/dev-fixtures/fonts/p${page}.ttf") format("truetype");font-display:block;}`;

/** Declare page N's face in the document once; a second call is a no-op. */
export function ensureFontFace(page: number, doc: Document = document): void {
  const id = `qul-dev-font-p${page}`;
  if (doc.getElementById(id)) return;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = fontCss(page);
  doc.head.appendChild(style);
}

export function parseViewBox(attr: string | null | undefined): ViewBox | null {
  if (!attr) return null;
  const n = attr.trim().split(/[\s,]+/).map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [x, y, w, h] = n as [number, number, number, number];
  return { x, y, w, h };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const lo = s[mid - 1] ?? s[mid] ?? 0;
  const hi = s[mid] ?? 0;
  return s.length % 2 ? hi : (lo + hi) / 2;
}

type Row = { y: number; x0: number; x1: number; h: number };

type Box = { cy: number; x0: number; x1: number; h: number };

function rowFrom(cur: Box[]): Row {
  return {
    y: median(cur.map((b) => b.cy)),
    x0: Math.min(...cur.map((b) => b.x0)),
    x1: Math.max(...cur.map((b) => b.x1)),
    h: median(cur.map((b) => b.h)),
  };
}

/** Split centre-sorted boxes wherever two neighbours are further apart than `gap`. */
function splitByGap(all: Box[], gap: number): Box[][] {
  const groups: Box[][] = [];
  let cur: Box[] = [];
  let prev = all[0]?.cy ?? 0;
  for (const b of all) {
    if (cur.length > 0 && b.cy - prev > gap) {
      groups.push(cur);
      cur = [];
    }
    cur.push(b);
    prev = b.cy;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Split centre-sorted boxes at their `k - 1` widest gaps, into exactly `k` groups. */
function splitIntoK(all: Box[], k: number): Box[][] {
  if (k <= 1 || all.length < k) return [all];
  const gaps = all.slice(1).map((b, i) => ({ i: i + 1, d: b.cy - (all[i]?.cy ?? b.cy) }));
  const cuts = gaps
    .sort((a, b) => b.d - a.d)
    .slice(0, k - 1)
    .map((g) => g.i)
    .sort((a, b) => a - b);
  const groups: Box[][] = [];
  let from = 0;
  for (const c of cuts) {
    groups.push(all.slice(from, c));
    from = c;
  }
  groups.push(all.slice(from));
  return groups;
}

/**
 * Group the print's word boxes into rows by vertical centre.
 *
 * Two boxes are on one line when their centres are closer than most of a word's
 * height — a word box is ink-tall, marks included, so half of that is more than
 * the jitter along a line and less than a pitch. A few boxes on every page are
 * not one word tall, and those sit between lines: a sign in the gutter between
 * two lines is a third of a word's height (page 300 has seven of them, each
 * squarely between two rows), and a box the tracer stretched to a neighbour's
 * mark is half again taller. By the chaining rule either one bridges two rows
 * into one. So boxes shorter than half or taller than 1.4× the page's usual
 * height are set aside before clustering and only their extents are kept; and
 * when the caller knows how many lines the page has and the chain still
 * disagrees, the boxes are cut at their `n - 1` widest gaps instead — accepted
 * only if every group is then tighter than half a pitch, so a page whose rows
 * really did split or merge is still reported as such rather than forced.
 */
function rowsOf(boxes: WordBoxes, expect?: number): Row[] {
  const all: Box[] = [];
  for (const entry of Object.values(boxes.words)) {
    for (const [x, y, w, h] of entry.boxes) all.push({ cy: y + h / 2, x0: x, x1: x + w, h });
  }
  if (all.length === 0) return [];
  all.sort((a, b) => a.cy - b.cy);
  const usual = median(all.map((b) => b.h));
  const lineTall = all.filter((b) => b.h >= usual * 0.5 && b.h <= usual * 1.4);
  const core = lineTall.length >= 2 ? lineTall : all;

  let groups = splitByGap(core, usual * 0.6);
  if (expect && groups.length !== expect && core.length >= expect) {
    const cut = splitIntoK(core, expect);
    const centres = cut.map((g) => median(g.map((b) => b.cy)));
    const pitch = median(centres.slice(1).map((c, i) => c - (centres[i] ?? c)));
    const tight = cut.every((g) => (g[g.length - 1]?.cy ?? 0) - (g[0]?.cy ?? 0) < pitch * 0.5);
    if (tight) groups = cut;
  }
  const rows = groups.map(rowFrom);
  // A tall box still belongs to a line — the one its centre is nearest — and
  // widens that row's extent; it just does not get a vote on where the row is.
  for (const b of all) {
    if (core.includes(b)) continue;
    let best: Row | undefined;
    for (const r of rows) if (!best || Math.abs(r.y - b.cy) < Math.abs(best.y - b.cy)) best = r;
    if (best) {
      best.x0 = Math.min(best.x0, b.x0);
      best.x1 = Math.max(best.x1, b.x1);
    }
  }
  return rows;
}

/** Least-squares line through (n, y) pairs; falls back to a sane grid when there is nothing to fit. */
function fitLine(pairs: { n: number; y: number }[], vb: ViewBox, total: number) {
  if (pairs.length >= 2) {
    const N = pairs.length;
    const sn = pairs.reduce((a, p) => a + p.n, 0);
    const sy = pairs.reduce((a, p) => a + p.y, 0);
    const snn = pairs.reduce((a, p) => a + p.n * p.n, 0);
    const sny = pairs.reduce((a, p) => a + p.n * p.y, 0);
    const den = N * snn - sn * sn;
    if (den !== 0) {
      const slope = (N * sny - sn * sy) / den;
      const icept = (sy - slope * sn) / N;
      return { at: (n: number) => icept + slope * n, pitch: slope };
    }
  }
  // Nothing measured: an even grid over the page, a print's usual 15 lines.
  const pitch = vb.h / (total + 1);
  const first = pairs[0];
  const icept = first ? first.y - pitch * first.n : vb.y + pitch * 0.5;
  return { at: (n: number) => icept + pitch * n, pitch };
}

/**
 * Where each store line lands on the print. See the file comment for the method;
 * `rows !== ayahLines` in the result means the print's box rows and the store's
 * ayah lines did not pair one to one, and every y is then from the fit, not a row.
 */
export function lineGeometry(fixture: Fixture, boxes: WordBoxes | null, viewBox: ViewBox): PageGeometry {
  const lines = [...fixture.lines].sort((a, b) => a.line_number - b.line_number);
  const ayah = lines.filter((l) => l.line_type === "ayah");
  const rows = boxes ? rowsOf(boxes, ayah.length) : [];
  const paired = rows.length === ayah.length && rows.length > 0;

  const pairs: { n: number; y: number }[] = [];
  if (paired) ayah.forEach((l, i) => pairs.push({ n: l.line_number, y: rows[i]?.y ?? 0 }));
  else if (rows.length >= 2 && ayah.length >= 2) {
    // Anchor the first and last ayah lines to the first and last rows: the
    // ends of a page are the rows least likely to have split or merged.
    const first = ayah[0];
    const last = ayah[ayah.length - 1];
    const r0 = rows[0];
    const r1 = rows[rows.length - 1];
    if (first && last && r0 && r1 && first !== last) {
      pairs.push({ n: first.line_number, y: r0.y }, { n: last.line_number, y: r1.y });
    }
  }
  const total = Math.max(lines.length, 15);
  const fit = fitLine(pairs, viewBox, total);

  // The column: the widest extent any row reaches. A line placed by fit is set
  // to it; a line paired to a row is set to that row's own extent, which on a
  // full page is the column give or take a word's tail, and on the two opening
  // pages — whose lines the store calls full but the print sets short and
  // centred — is the width the print actually gave that line.
  const x0 = rows.length ? Math.min(...rows.map((r) => r.x0)) : viewBox.x + viewBox.w * 0.08;
  const x1 = rows.length ? Math.max(...rows.map((r) => r.x1)) : viewBox.x + viewBox.w * 0.92;

  const slots: LineSlot[] = lines.map((line) => {
    const idx = paired ? ayah.indexOf(line) : -1;
    const row = idx >= 0 ? rows[idx] : undefined;
    return {
      line,
      y: row ? row.y : fit.at(line.line_number),
      x0: row ? row.x0 : x0,
      x1: row ? row.x1 : x1,
      measured: Boolean(row),
    };
  });

  return { viewBox, pitch: Math.abs(fit.pitch), lines: slots, rows: rows.length, ayahLines: ayah.length };
}

export type DrawOptions = {
  page: number;
  /** ink colour for the store's words */
  fill?: string;
  /**
   * glyph size as a fraction of the line pitch — the *starting* size; once the
   * drawing is in the document `calibrateFontSize` measures the real one, and
   * this only decides how far the first paint is from it (0.55 is what the
   * measurement comes to on pages 1 and 300)
   */
  fontScale?: number;
  /** baseline sits this fraction of the font size below the line's centre; 0.24 by eye against page 300 */
  baselineShift?: number;
  /** draw the non-ayah lines (surah names, basmala) as labelled bands */
  bands?: boolean;
  className?: string;
};

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Build the store's page as an SVG in the print's viewBox. Each ayah line is one
 * `<text>`: the words joined by a space, set right-to-left from the column's
 * start edge, justified to the column with `lengthAdjust="spacing"` — the print's
 * own device, which stretches the gaps and never the letters — or centred when
 * the store says the line is. Every text carries `data-line` so a later pass can
 * measure word boxes against the app's tappable ayah shapes.
 */
export function buildStorePageSvg(fixture: Fixture, geom: PageGeometry, opts: DrawOptions): SVGSVGElement {
  const { page } = opts;
  const fill = opts.fill ?? "#1b1815";
  const fontSize = geom.pitch * (opts.fontScale ?? 0.55);
  const baseline = fontSize * (opts.baselineShift ?? 0.24);
  const vb = geom.viewBox;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-qul-store-page", String(page));
  if (opts.className) svg.setAttribute("class", opts.className);

  for (const slot of geom.lines) {
    const { line } = slot;
    if (line.line_type !== "ayah") {
      if (!opts.bands) continue;
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("data-line", String(line.line_number));
      g.setAttribute("data-line-type", line.line_type);
      const band = document.createElementNS(SVG_NS, "rect");
      band.setAttribute("x", String(slot.x0));
      band.setAttribute("y", String(slot.y - geom.pitch * 0.32));
      band.setAttribute("width", String(slot.x1 - slot.x0));
      band.setAttribute("height", String(geom.pitch * 0.64));
      band.setAttribute("fill", "none");
      band.setAttribute("stroke", fill);
      band.setAttribute("stroke-width", String(geom.pitch * 0.03));
      band.setAttribute("stroke-dasharray", `${geom.pitch * 0.12} ${geom.pitch * 0.08}`);
      band.setAttribute("opacity", "0.6");
      g.appendChild(band);
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", String((slot.x0 + slot.x1) / 2));
      label.setAttribute("y", String(slot.y + geom.pitch * 0.12));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-family", "ui-sans-serif, system-ui, sans-serif");
      label.setAttribute("font-size", String(geom.pitch * 0.34));
      label.setAttribute("fill", fill);
      label.setAttribute("opacity", "0.75");
      label.textContent =
        line.line_type === "surah_name" && line.surah_number != null
          ? `surah ${line.surah_number}`
          : line.line_type.replace(/_/g, " ");
      g.appendChild(label);
      svg.appendChild(g);
      continue;
    }

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("data-line", String(line.line_number));
    text.setAttribute("data-line-type", line.line_type);
    text.setAttribute("data-measured", slot.measured ? "true" : "false");
    text.setAttribute("direction", "rtl");
    text.setAttribute("font-family", `"${fontFamily(page)}", serif`);
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("fill", fill);
    text.setAttribute("y", String(slot.y + baseline));
    if (line.is_centered) {
      text.setAttribute("x", String((slot.x0 + slot.x1) / 2));
      text.setAttribute("text-anchor", "middle");
    } else {
      // RTL: the line *starts* at its right edge, and the justification
      // stretches it leftward to the column's far edge.
      text.setAttribute("x", String(slot.x1));
      text.setAttribute("text-anchor", "start");
      text.setAttribute("textLength", String(slot.x1 - slot.x0));
      text.setAttribute("lengthAdjust", "spacing");
    }
    // One <tspan> per word, so a word can be found and measured by its address.
    line.words.forEach((w, i) => {
      if (i > 0) text.appendChild(document.createTextNode(" "));
      const span = document.createElementNS(SVG_NS, "tspan");
      span.setAttribute("data-word", `${w.surah}:${w.ayah}:${w.position}`);
      span.textContent = w.text;
      text.appendChild(span);
    });
    svg.appendChild(text);
  }
  return svg;
}

/**
 * Size the words to the column, from the words themselves.
 *
 * The per-page font is cut so that every full line of a page fills the same
 * measure at one size — that is what a page-by-page font is *for* — so the
 * natural width of a full line, divided by the font size it was measured at,
 * is a constant of the page. Measure it (the SVG must be in the document and
 * the face loaded), take the median over the justified lines, and set the one
 * font size at which that width is the print's column. The `lengthAdjust`
 * justification is then a hair's correction, as the print's own is, and never
 * the negative spacing that piles words on each other when a guess runs wide.
 *
 * Returns the font size chosen, in viewBox units, or null when nothing could be
 * measured (no justified lines, or the face not yet loaded).
 */
export function calibrateFontSize(svg: SVGSVGElement, geom: PageGeometry, baselineShift = 0.24): number | null {
  const texts = [...svg.querySelectorAll<SVGTextElement>('text[data-line-type="ayah"]')];
  // Each justified line proposes the size at which its natural width is the
  // measure it was given; the median is the page's. On a full page every line
  // proposes about the same number; on an opening page, where the print sets
  // each line to its own width, they still agree, because the measure was
  // taken from that line's own row.
  const proposals: number[] = [];
  for (const t of texts) {
    const want = t.getAttribute("textLength");
    const fs0 = Number(t.getAttribute("font-size"));
    if (want == null || !fs0) continue;
    t.removeAttribute("textLength");
    const w = t.getComputedTextLength();
    t.setAttribute("textLength", want);
    const measure = Number(want);
    if (w > 0 && measure > 0) proposals.push((measure / w) * fs0);
  }
  if (proposals.length === 0) return null;
  const fs = median(proposals);
  if (!(fs > 0)) return null;
  for (const t of texts) {
    const slot = geom.lines.find((s) => String(s.line.line_number) === t.getAttribute("data-line"));
    t.setAttribute("font-size", String(fs));
    if (slot) t.setAttribute("y", String(slot.y + fs * baselineShift));
  }
  svg.dataset.fontSize = fs.toFixed(3);
  return fs;
}

/** Resolve once page N's face is usable for measuring; false if the browser cannot load it. */
export async function fontReady(page: number, doc: Document = document): Promise<boolean> {
  ensureFontFace(page, doc);
  try {
    const faces = await doc.fonts.load(`12px "${fontFamily(page)}"`);
    return faces.length > 0;
  } catch {
    return false;
  }
}

/** The dev fixture for a page, or null when none has been pulled from the store. */
export async function loadFixture(page: number): Promise<Fixture | null> {
  const r = await fetch(`/dev-fixtures/qul-page-${page}.json`, { cache: "no-store" });
  const body = (await r.json()) as Fixture | { error?: string };
  if ("error" in body && body.error === "fixture-absent") return null;
  if (!r.ok) throw new Error(`fixture HTTP ${r.status}`);
  return body as Fixture;
}

/** The app's word boxes for a page, from the same asset the reader's word selection uses. */
export async function loadWordBoxes(page: number, base = "/"): Promise<WordBoxes | null> {
  const r = await fetch(`${base}assets/words/${EDITION}/${page}.json`);
  if (!r.ok) return null;
  return (await r.json()) as WordBoxes;
}

/** One store word, measured where it lands on the print. Box is in viewBox units. */
export type StoreWordBox = {
  /** the word's own address, `"surah:ayah:position"` */
  word: string;
  /** the ayah it belongs to, `"surah:ayah"` — the store's word→ayah opinion */
  ayah: string;
  /** the glyph's ink box, in the print's viewBox coordinates */
  box: { x: number; y: number; w: number; h: number };
};

/**
 * Measure every store word's box on the drawn, justified page.
 *
 * Each word is one <tspan> of one code point, so the browser has already laid it
 * out — spacing justification and right-to-left order included — and reports the
 * glyph's ink box in viewBox units through `getExtentOfChar`. Spaces sit between
 * words, so the character index of word i on its line is 2i. The SVG must be in
 * the document and the face loaded (`fontReady`), and `calibrateFontSize` should
 * have run first so the size is the print's; this is the "later pass" that
 * `buildStorePageSvg`'s data-line/data-word attributes exist for.
 *
 * Returns one entry per ayah word actually drawn (surah-name and basmala lines
 * carry no words and no tappable ayah, so they contribute none).
 */
export function measureStoreWordBoxes(svg: SVGSVGElement): StoreWordBox[] {
  const out: StoreWordBox[] = [];
  for (const text of svg.querySelectorAll<SVGTextElement>('text[data-line-type="ayah"]')) {
    const spans = [...text.querySelectorAll<SVGTSpanElement>("tspan[data-word]")];
    spans.forEach((span, i) => {
      const addr = span.getAttribute("data-word");
      if (!addr) return;
      // words joined by a single space → word i is character 2i on the line
      const idx = i * 2;
      let r: DOMRect | { x: number; y: number; width: number; height: number };
      try {
        r = text.getExtentOfChar(idx);
      } catch {
        return;
      }
      if (!(r.width > 0) || !(r.height > 0)) return;
      const parts = addr.split(":");
      out.push({
        word: addr,
        ayah: `${parts[0]}:${parts[1]}`,
        box: { x: r.x, y: r.y, w: r.width, h: r.height },
      });
    });
  }
  return out;
}

/*
 * WHERE A TAP LANDS. The app makes each ayah tappable by a shape in the page
 * asset — one <path class="ayahPolygon"> per ayah, in the same viewBox units as
 * the word boxes above. Most are a stack of full-line rectangles, but some (the
 * closing ayahs of al-Fatiha, a centred last line) are irregular polygons with
 * slanted edges. So this reads the shape as what it is — a set of straight-sided
 * rings — and asks the browser's own hit-test question of a store word's box
 * centre: does the word the store places for ayah X land where the app lets a
 * reader tap X — on a neighbour, or on nothing? The rings are straight-line only
 * (measured across all 6,236 shapes: no curves), so this point-in-polygon test
 * is exact and agrees with the app's isPointInFill, while staying pure DOM-free
 * JavaScript that also runs in a whole-book sweep by tool.
 */
type Point = { x: number; y: number };
type Ring = Point[];
export type TapShape = { ayah: string; rings: Ring[] };

/** Parse a straight-line path (M/L/H/V and relatives, Z) into its closed rings. */
export function polygonsFromPath(d: string): Ring[] {
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  if (!tokens) return [];
  const rings: Ring[] = [];
  let ring: Ring = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0;
  let cmd = "";
  let i = 0;
  const num = () => parseFloat(tokens[i++] as string);
  const isCmd = (s: string) => /^[MmLlHhVvZz]$/.test(s);
  const flush = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
  };
  while (i < tokens.length) {
    const tk = tokens[i] as string;
    if (isCmd(tk)) cmd = tokens[i++] as string;
    switch (cmd) {
      case "M":
        flush();
        cx = num();
        cy = num();
        sx = cx;
        sy = cy;
        ring.push({ x: cx, y: cy });
        cmd = "L";
        break;
      case "m":
        flush();
        cx += num();
        cy += num();
        sx = cx;
        sy = cy;
        ring.push({ x: cx, y: cy });
        cmd = "l";
        break;
      case "L":
        cx = num();
        cy = num();
        ring.push({ x: cx, y: cy });
        break;
      case "l":
        cx += num();
        cy += num();
        ring.push({ x: cx, y: cy });
        break;
      case "H":
        cx = num();
        ring.push({ x: cx, y: cy });
        break;
      case "h":
        cx += num();
        ring.push({ x: cx, y: cy });
        break;
      case "V":
        cy = num();
        ring.push({ x: cx, y: cy });
        break;
      case "v":
        cy += num();
        ring.push({ x: cx, y: cy });
        break;
      case "Z":
      case "z":
        cx = sx;
        cy = sy;
        flush();
        cmd = "";
        break;
      default:
        i++;
    }
  }
  flush();
  return rings;
}

/** Read the ayah tap shapes out of a page asset's SVG source. */
export function tapShapesFromSvgText(svgText: string): TapShape[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const out: TapShape[] = [];
  for (const path of doc.querySelectorAll("path.ayahPolygon")) {
    const surah = path.getAttribute("surah");
    const ayah = path.getAttribute("ayah");
    const d = path.getAttribute("d");
    if (!surah || !ayah || !d) continue;
    const rings = polygonsFromPath(d);
    if (!rings.length) continue;
    out.push({ ayah: `${surah}:${ayah}`, rings });
  }
  return out;
}

/** The app's tap shapes for a page, from the very asset that draws them. */
export async function loadTapShapes(page: number, base = "/"): Promise<TapShape[]> {
  const r = await fetch(`${base}assets/pages/${EDITION}/${page}.svg`);
  if (!r.ok) throw new Error(`page svg HTTP ${r.status}`);
  return tapShapesFromSvgText(await r.text());
}

/** One store word that did not land in its own ayah's tap shape. */
export type Mislanded = StoreWordBox & {
  /** the ayah whose tap shape it fell in, or null when it fell on none */
  landedIn: string | null;
};

/** The per-page verdict: how many store words tap their own ayah, and which do not. */
export type PlacementReport = {
  /** store words measured (surah-name and basmala lines carry none) */
  total: number;
  /** words whose box centre falls in their own ayah's tap shape */
  ok: number;
  /** words whose centre falls in a *different* ayah's shape — a crossed tap */
  inNeighbour: Mislanded[];
  /** words whose centre falls in no ayah shape at all */
  outside: Mislanded[];
};

function centreOf(b: { x: number; y: number; w: number; h: number }): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Even-odd ray cast, the same rule a browser fill hit-test uses on a ring. */
function inRing(p: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as Point;
    const b = ring[j] as Point;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** In the shape if in any of its rings — the union the app makes tappable. */
function inShape(p: Point, s: TapShape): boolean {
  return s.rings.some((ring) => inRing(p, ring));
}

/**
 * Classify each measured store word by where its box centre lands among the
 * app's tap shapes: in its own ayah (counted), in another ayah (a crossed tap,
 * recorded with which), or in none (recorded).
 *
 * Pure and framework-free, so the same check runs in the workbench, in the app
 * overlay, and in a whole-book sweep by tool. It says nothing about whether the
 * store's line pairing was trustworthy — a page placed by fit (print rows !=
 * store lines) will report placement guesses, not store findings, so the caller
 * must weigh `geom.rows === geom.ayahLines` before trusting a non-zero count.
 */
export function classifyPlacement(boxes: StoreWordBox[], shapes: TapShape[]): PlacementReport {
  const byAyah = new Map<string, TapShape>();
  for (const s of shapes) byAyah.set(s.ayah, s);
  const inNeighbour: Mislanded[] = [];
  const outside: Mislanded[] = [];
  let ok = 0;
  for (const b of boxes) {
    const c = centreOf(b.box);
    const own = byAyah.get(b.ayah);
    if (own && inShape(c, own)) {
      ok++;
      continue;
    }
    let landed: string | null = null;
    for (const s of shapes) {
      if (s.ayah === b.ayah) continue;
      if (inShape(c, s)) {
        landed = s.ayah;
        break;
      }
    }
    if (landed) inNeighbour.push({ ...b, landedIn: landed });
    else outside.push({ ...b, landedIn: null });
  }
  return { total: boxes.length, ok, inNeighbour, outside };
}

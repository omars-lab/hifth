#!/usr/bin/env node
/**
 * Draw every ayah box the sweep flags, on its own page, at reading size.
 *
 *   node scripts/build-box-sweep.mjs        → docs/design/ayah-box-sweep.html
 *
 * The sweep (lib/box-sweep.mjs, held by gate:boxes) says *how many* boxes the
 * pen cannot draw as lines. This page shows *which*, and what the reader sees:
 * for each flagged box a strip of the real page around it — the glyphs, the
 * page's line grid, the box's raw outline, and the swipes the app's own pen
 * lays down for it, in the app's own selection colour, or the wash-and-ring
 * fallback when the pen refuses. Rebuild it whenever the gate's count moves.
 *
 * Everything is inlined and built from committed bytes. The glyphs are the
 * print's outlined paths, so the page carries no Arabic codepoints; the build
 * checks that before writing, because the repo ships no Qur'an text and a
 * page under docs/ is shipped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sweep, readPolygons, REPO, PAGES_DIR } from "./lib/box-sweep.mjs";

const OUT = join(REPO, "docs", "design", "ayah-box-sweep.html");
const TOKENS = join(REPO, "apps", "web", "src", "styles", "tokens.css");
const INK = join(REPO, "packages", "core", "dist", "ink.js");

/** The app's own colours, read from its tokens so the page cannot drift. */
function token(css, name, fallback) {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : fallback;
}
const css = readFileSync(TOKENS, "utf8");
const COLOUR = {
  paper: token(css, "paper", "#f6efe1"),
  ink: token(css, "ink", "#26201a"),
  sel: token(css, "highlight", "#e8a91c"),
  wash: token(css, "highlight-wash", "rgba(232,169,28,.28)"),
  ring: token(css, "highlight-ring", "#c98d0f"),
};

/**
 * A rough bounding box for a glyph path — every coordinate the path mentions,
 * control points included, so a glyph is never cropped away by being judged on
 * its anchors alone. Unknown commands keep the path: over-inclusion is the safe
 * error for a crop.
 */
function roughBox(d) {
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const see = (x, y) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const tok of d.match(
    /[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g,
  ) ?? []) {
    const c = tok[0];
    const C = c.toUpperCase();
    const rel = c !== C;
    const n = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const pair = (i) => [
      rel ? cx + n[i] : n[i],
      rel ? cy + n[i + 1] : n[i + 1],
    ];
    if (C === "M" || C === "L" || C === "T") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        [cx, cy] = pair(i);
        see(cx, cy);
        if (C === "M" && i === 0) [sx, sy] = [cx, cy];
      }
    } else if (C === "H") {
      for (const v of n) see((cx = rel ? cx + v : v), cy);
    } else if (C === "V") {
      for (const v of n) see(cx, (cy = rel ? cy + v : v));
    } else if (C === "C") {
      for (let i = 0; i + 5 < n.length; i += 6) {
        for (let k = 0; k < 6; k += 2) see(...pair(i + k));
        [cx, cy] = pair(i + 4);
      }
    } else if (C === "S" || C === "Q") {
      for (let i = 0; i + 3 < n.length; i += 4) {
        see(...pair(i));
        [cx, cy] = pair(i + 2);
        see(cx, cy);
      }
    } else if (C === "A") {
      for (let i = 0; i + 6 < n.length; i += 7) {
        [cx, cy] = pair(i + 5);
        see(cx, cy);
      }
    } else if (C === "Z") {
      cx = sx;
      cy = sy;
    } else {
      return null;
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** The page's glyph paths whose (transformed) box touches a viewBox window. */
function glyphsWithin(svg, win) {
  const mx = svg.match(
    /<g transform="matrix\(([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+)\)">/,
  );
  if (!mx) throw new Error("page has no matrix group");
  const [a, d, e, f] = mx.slice(1).map(Number);
  const kept = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    if (tag.includes('class="ayahPolygon"')) continue;
    const path = tag.match(/\bd="([^"]+)"/)?.[1];
    if (!path) continue;
    const b = roughBox(path);
    if (b) {
      const ys = [d * b.y0 + f, d * b.y1 + f];
      const xs = [a * b.x0 + e, a * b.x1 + e];
      const yy0 = Math.min(...ys),
        yy1 = Math.max(...ys),
        xx0 = Math.min(...xs),
        xx1 = Math.max(...xs);
      if (yy1 < win.y0 || yy0 > win.y1 || xx1 < win.x0 || xx0 > win.x1)
        continue;
    }
    kept.push(tag.endsWith("/>") ? tag : `${tag}</path>`);
  }
  return { matrix: `matrix(${a} 0 0 ${d} ${e} ${f})`, paths: kept.join("") };
}

/** Bounding box of a polygon's `d` in viewBox space, via the same rough walk. */
function polygonBox(d) {
  const b = roughBox(d);
  if (!b) throw new Error(`cannot box polygon ${d}`);
  return b;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const { rectsFromPath, swipesFromPath } = await import(INK);
const { census, flagged } = await sweep();

const SCALE = 2; // CSS px per viewBox unit — a desktop leaf is ~1.6–2.2×, a phone ~1×
const PAGE_W = 345;

const strips = flagged.map((f) => {
  const svg = readFileSync(join(PAGES_DIR, `${f.page}.svg`), "utf8");
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const pageW = vb ? Number(vb[1]) : PAGE_W;
  const H = f.lineHeight ?? 36;
  const pb = polygonBox(f.d);
  const y0 = Math.max(0, pb.y0 - H * 0.6);
  const y1 = pb.y1 + H * 0.6;
  const win = { x0: 0, y0, x1: pageW, y1 };
  const { matrix, paths } = glyphsWithin(svg, win);

  // The page's line grid, from the neighbouring boxes' rows: every distinct
  // rectangle top on the page, so the reader can see the grid a box misses.
  const rows = new Set();
  for (const p of readPolygons(svg)) {
    const rs = rectsFromPath(p.d);
    if (rs) for (const r of rs) rows.add(Math.round(r.y * 10) / 10);
  }
  const grid = [...rows]
    .filter((y) => y >= y0 && y <= y1)
    .map((y) => `<line x1="0" x2="${pageW}" y1="${y}" y2="${y}" class="grid"/>`)
    .join("");

  const swipes = swipesFromPath(f.d, H);
  const ink = swipes
    ? swipes
        .map(
          (s) =>
            `<line x1="${s.x1}" y1="${s.y}" x2="${s.x2}" y2="${s.y}" stroke-width="${s.width}" class="swipe"/>`,
        )
        .join("")
    : `<path d="${esc(f.d)}" class="wash"/>`;
  const outline = `<path d="${esc(f.d)}" class="outline"/>`;

  const what =
    f.rule === "fallback"
      ? `The pen cannot read this box as a run of rectangles (${
          f.kind === "polygon" ? "it is a true polygon" : f.kind
        }), so the app fills the raw shape and rings it — the older look, kept on purpose for a shape the pen does not know.`
      : `Rectangle ${f.rect + 1} of this box is ${f.height.toFixed(1)} units tall on a page whose lines are ${
          f.lineHeight
        } — ${f.lines} of a line. The pen draws a band ${(
          (f.height / f.lineHeight) *
          100
        ).toFixed(
          0,
        )}% as thick as its neighbours, and centred above the line's middle.`;

  return `
<section class="strip">
  <h3>Page ${f.page} · verse ${f.key} · ${f.rule === "fallback" ? "drawn as a box" : "off the line grid"}</h3>
  <p>${what}</p>
  <div class="frame" style="max-width:${pageW * SCALE}px">
    <svg viewBox="0 ${y0} ${pageW} ${y1 - y0}" width="${pageW * SCALE}" height="${(y1 - y0) * SCALE}" role="img" aria-label="page ${f.page}, verse ${f.key}">
      <rect x="0" y="${y0}" width="${pageW}" height="${y1 - y0}" fill="${COLOUR.paper}"/>
      ${grid}
      <g transform="${matrix}">${paths}</g>
      <g style="mix-blend-mode:multiply">${ink}</g>
      ${outline}
    </svg>
  </div>
</section>`;
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ayah Box Sweep</title>
<style>
  :root { color-scheme: light; --paper: ${COLOUR.paper}; --ink: ${COLOUR.ink}; }
  body { margin: 0; padding: 2rem 1.25rem 4rem; background: #fbf8f1; color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 62rem; margin-inline: auto; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
  h3 { font-size: 1rem; margin: 1.5rem 0 .25rem; }
  p { margin: .25rem 0 .75rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; margin: .5rem 0 1rem; }
  dt { font-weight: 600; }
  dd { margin: 0; }
  table { border-collapse: collapse; margin: .5rem 0 1rem; }
  td, th { text-align: left; padding: .2rem .8rem .2rem 0; border-bottom: 1px solid #e6dfd0; }
  th { font-weight: 600; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  .frame { overflow-x: auto; border: 1px solid #e0d8c6; border-radius: 6px; background: var(--paper); }
  .frame svg { display: block; max-width: 100%; height: auto; }
  .grid { stroke: #b9ad94; stroke-width: .3; stroke-dasharray: 1.5 1.5; }
  .swipe { stroke: ${COLOUR.sel}; stroke-linecap: round; fill: none; }
  .wash { fill: ${COLOUR.wash}; stroke: ${COLOUR.ring}; stroke-width: 1.2; stroke-linejoin: round; }
  .outline { fill: none; stroke: #7a2e2e; stroke-width: .5; stroke-dasharray: 2 1.5; }
  .legend { display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: .9rem; margin: .5rem 0 1rem; }
  .legend span::before { content: ""; display: inline-block; width: 1.4rem; height: .6rem; margin-right: .4rem; vertical-align: middle; border-radius: .3rem; }
  .legend .s::before { background: ${COLOUR.sel}; }
  .legend .o::before { border: 1px dashed #7a2e2e; height: .5rem; }
  .legend .g::before { border-top: 1px dashed #b9ad94; height: 0; }
  .note { font-size: .9rem; color: #5c5347; }
</style>
</head>
<body>
<h1>Which ayah boxes can the pen not draw as lines?</h1>
<p class="note">Built from the committed pages by <code>scripts/build-box-sweep.mjs</code>; the counts are held by <code>gate:boxes</code>. Rebuild when either moves.</p>

<h2>What is this page for?</h2>
<p>When you tap a verse, the app lays an amber marker swipe along each line of it. It does that by reading the verse's hit box — a run of rectangles, one per line — and drawing one band per line. Three defects in that drawing were each found by a reader on one page; each was a whole class, visible across the book long before anyone met an instance. This page runs the app's own pen over every one of the ${census.polygons.toLocaleString()} verse boxes and shows the ones it cannot draw as lines, on their real page, at about the size a desktop reader sees them.</p>

<dl>
  <dt>verse</dt><dd>an ayah — the unit a reader selects.</dd>
  <dt>hit box</dt><dd>the invisible shape under a verse that decides which verse a tap lands on. The print supplies one per verse, as a run of rectangles.</dd>
  <dt>line grid</dt><dd>the fifteen lines the print sets to a page; every rectangle is expected to be a whole number of them tall.</dd>
</dl>

<h2>What did the sweep count?</h2>
<table>
  <tr><th>Class</th><th>Count</th><th>What the reader sees</th></tr>
  <tr><td>Boxes the pen cannot read as lines</td><td class="n">${census.fallback}</td><td>The older look: the raw shape filled and ringed. All on pages 1 and 2, whose decorated frame gives verses true polygon shapes.</td></tr>
  <tr><td>Rectangles off the line grid</td><td class="n">${census.offGrid}</td><td>A band thinner than its neighbours, sitting a little high. Drawn below.</td></tr>
  <tr><td>Rectangles spanning several lines (the pen splits them)</td><td class="n">${census.fused}</td><td>Nothing wrong any more — up to ${census.fusedMaxLines} lines fused by the print, each now drawn as its own swipe. This was the 2:249 defect.</td></tr>
  <tr><td>Rectangles too short for a band (drawn as a dot)</td><td class="n">${census.dot}</td><td>A one-word tail, inked as a single round dot — what a pen does when tapped.</td></tr>
  <tr><td>Rectangles in all</td><td class="n">${census.rects.toLocaleString()}</td><td></td></tr>
</table>

<h2>What does each flagged box look like?</h2>
<div class="legend"><span class="s">the app's swipe, or its fallback wash</span><span class="o">the box's own outline</span><span class="g">the page's line grid</span></div>
${strips.join("\n")}

<h2>What is this not settling?</h2>
<p>Whether the two off-grid boxes should be repaired in the print's polygon layer (a declared repair, a re-vendor and a re-pin) or tolerated as they are — a reader would have to be looking for them. The plan carries that question as follow-up 17. The sweep also says nothing about a box that covers the wrong glyphs; that is what the page and word gates measure.</p>
</body>
</html>
`;

const arabic = html.match(
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
);
if (arabic) {
  console.error(
    `refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`,
  );
  process.exit(1);
}
if (/<text\b/.test(html)) {
  console.error("refusing to write: the page carries an SVG <text> element");
  process.exit(1);
}
writeFileSync(OUT, html);
console.log(
  `box-sweep — ${flagged.length} boxes drawn on ${new Set(flagged.map((f) => f.page)).size} pages → ${OUT} (${(html.length / 1024).toFixed(0)} KB)`,
);

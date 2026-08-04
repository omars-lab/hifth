#!/usr/bin/env node
/**
 * CI gate: the committed page SVGs are the pinned corpus, unedited.
 *
 * PLAN §8 has said since Loop 0 that vendored bytes are never hand-edited.
 * Nothing checked it. That was tolerable while the corpus was three files a
 * reviewer could read in a diff; at 604 files and 91 MB it is not — a one-glyph
 * "fix" to a page, or a stray page from an aborted `vendor:pages` run, would
 * land in a pull request as a wall of minified path data that no human reviews
 * and no test notices.
 *
 * So `packages/etl/data/pages/quran-svg.pin.json` carries a SHA-256 per page of
 * exactly the bytes `vendor-pages.mjs` writes, and this gate checks them. It is
 * the offline half of the vendoring story: `vendor:pages` verifies the
 * *upstream* hashes when it runs (proving the fetch got what was pinned), and
 * this gate verifies the *vendored* hashes on every CI run (proving what is
 * committed is what that recipe produced), without needing the 348 MB corpus or
 * a network.
 *
 * It deliberately does not weigh anything — `gate:assets` owns the per-page and
 * whole-mus'haf byte ceilings, and two gates arguing about the same number is
 * how a ceiling gets raised by accident.
 *
 * Also checked: the count. A missing page is not a rendering bug, it is an ayah
 * that cannot be reached, and the manifest alone would not catch it — the
 * manifest is derived from whatever pages happen to be present.
 *
 * And, since PLAN follow-up 14: whether every glyph of scripture falls inside a
 * tappable ayah polygon. That check is the second half of this file and carries
 * its own explanation.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PIN_FILE = join(REPO, "packages", "etl", "data", "pages", "quran-svg.pin.json");
const PAGES_DIR = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const failures = [];
const fail = (msg) => failures.push(msg);

const pin = JSON.parse(readFileSync(PIN_FILE, "utf8"));
const expected = pin.pages.length;

if (expected === 0) {
  console.error(
    "FAIL gate:pages — the pin lists no pages. Run `pnpm --filter @hifth/etl vendor:pages --repin`.",
  );
  process.exit(1);
}

const onDisk = readdirSync(PAGES_DIR).sort();
const svgs = onDisk.filter((f) => /^\d+\.svg$/.test(f));

const stray = onDisk.filter((f) => !svgs.includes(f));
if (stray.length) {
  fail(`${stray.length} file(s) in the page directory are not page SVGs: ${stray.join(", ")}`);
}

let verified = 0;
const missing = [];
const altered = [];

for (const entry of pin.pages) {
  const file = join(PAGES_DIR, `${entry.page}.svg`);
  if (!existsSync(file)) {
    missing.push(entry.page);
    continue;
  }
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (digest !== entry.vendored) altered.push(entry.page);
  else verified++;
}

const extraOnDisk = svgs
  .map((f) => Number(f.replace(".svg", "")))
  .filter((p) => !pin.pages.some((e) => e.page === p));

if (missing.length) {
  fail(
    `${missing.length} pinned page(s) are not committed (first: ${missing[0]}) — ` +
      `an ayah on a missing page cannot be reached. Run \`vendor:pages\`.`,
  );
}
if (altered.length) {
  fail(
    `${altered.length} page SVG(s) do not match the pin (first: page ${altered[0]}). ` +
      `Vendored bytes are never hand-edited (PLAN §8): re-run ` +
      `\`pnpm --filter @hifth/etl vendor:pages\` to restore them, or if the change is ` +
      `deliberate, bump the pin with \`--repin\` and say why in the commit.`,
  );
}
if (extraOnDisk.length) {
  fail(
    `${extraOnDisk.length} page SVG(s) are committed but not in the pin ` +
      `(first: page ${extraOnDisk[0]}) — a leftover from an aborted vendoring run?`,
  );
}

/* --------------------------- does every glyph fall inside a tappable ayah? */

/**
 * Every check above is about *identity* — are these the bytes we pinned. None
 * of them would notice a page whose bytes are exactly right and whose polygons
 * leave a line of scripture untappable, which in this app means unreachable:
 * there is no way to select an ayah except by touching its polygon.
 *
 * So this reads the ink and the polygons out of the same committed file and
 * asks the only question that matters: does every glyph fall inside some
 * tappable box? The ink lives under the page's `matrix(a 0 0 d e f)`, the
 * polygons live outside it in plain viewBox space; applying the matrix puts
 * both in one space.
 *
 * The one thing that is legitimately ink with no polygon is furniture — a
 * surah header and its basmala belong to no ayah and so carry no box. Furniture
 * is not guessed at, and it is not a list of page numbers: it is the band the
 * polygons leave empty immediately above a surah's *first* ayah. That gives two
 * tests, neither carrying a number invented for the occasion:
 *
 *   ORPHAN   a glyph outside every polygon and outside every furniture band —
 *            a hole in the page no finger can reach.
 *   BAND     a furniture band more than two lines tall — a header and a basmala
 *            are two lines, so a taller band has swallowed scripture that
 *            should have had a polygon of its own.
 *
 * Both demand zero, which is only honest because TOL below was measured rather
 * than chosen: across the corpus the worst *benign* glyph sits 8.8 units
 * outside its box (a fatha riding above the line it belongs to), while a real
 * defect leaves glyphs a median 36 units out. Twelve separates them with room
 * on both sides, so this can insist on zero instead of carrying a baseline
 * count — and a baseline count is exactly what would quietly absorb the next
 * defect.
 *
 * This is what closed PLAN follow-up 14. The two signatures that preceded it
 * found eleven pages by pattern-matching the shapes already known; measuring
 * ink against polygon across the whole corpus found seven more, including four
 * whose first polygon is an `X:1` — which the old rule explicitly excused.
 * `vendor-pages.mjs`'s POLYGON_REPAIRS repairs all eighteen. There is
 * deliberately no allow-list here: this gate knows nothing of that table, so a
 * repair that regresses and an upstream that breaks a new page fail alike.
 */
const LINES = 15; // the print sets fifteen lines to a page
const TOL = 12; // units a glyph may ride outside its box — measured, see above
const BAND_MAX = 2.3; // line-heights of furniture: a header and a basmala, never more

/**
 * Every subpath of a *polygon* `d`, as a point list. All 12 358 polygon
 * subpaths in the corpus are straight-line; a curve would mean the shape is no
 * longer a point list and every bounding box below would be a guess, so it
 * fails instead. (A parser that assumed the axis-aligned `M…h…v…H…Z` rect form
 * is what first reported pages 1 and 2 as malformed. 118 polygons in the corpus
 * are general polygons, spread over 74 pages, 11 of them on those two, and all
 * are well formed.)
 *
 * Both figures were re-measured 2026-08-04 and both moved, for different
 * reasons. The subpath total drifts with every polygon repair — it read 12 346
 * when this comment was written, and PLAN 14's p577 work added twelve. The 118
 * replaces a "189" that was never right: re-measured against the assets of the
 * commit that first wrote it, it was 118 there too, so it was not drift. It was
 * float equality — see `isAxisRect` — and 71 of the 189 are ordinary rectangles
 * that close 3e-14 away from where they opened. That is the more useful half of
 * this note: the miscount was not carelessness, it was a measurement anyone
 * re-deriving these by eye would repeat.
 *
 * So one number rotted and the other was born wrong, and nothing in the repo
 * could tell — which is why `census` below now counts both on every run and
 * prints them. A figure in a comment that no run re-derives is a figure nobody
 * can check; these are output, and this paragraph is only their history.
 */
function subpaths(d, where) {
  const out = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0,
    pts = null;
  for (const tok of d.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const c = tok[0];
    const n = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const rel = c === c.toLowerCase();
    if (c === "M" || c === "m") {
      if (pts && pts.length > 1) out.push(pts);
      cx = rel ? sx + n[0] : n[0];
      cy = rel ? sy + n[1] : n[1];
      sx = cx;
      sy = cy;
      pts = [[cx, cy]];
      for (let i = 2; i < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "H" || c === "h") {
      for (const v of n) pts.push([(cx = rel ? cx + v : v), cy]);
    } else if (c === "V" || c === "v") {
      for (const v of n) pts.push([cx, (cy = rel ? cy + v : v)]);
    } else if (c === "L" || c === "l") {
      for (let i = 0; i < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        pts.push([cx, cy]);
      }
    } else if (c === "Z" || c === "z") {
      if (pts && pts.length > 1) out.push(pts);
      pts = null;
      cx = sx;
      cy = sy;
    } else {
      fail(`${where}: polygon path uses "${c}" — only straight-line commands are understood`);
      return [];
    }
  }
  if (pts && pts.length > 1) out.push(pts);
  return out;
}

/**
 * Whether a subpath is the axis-aligned rectangle nearly every ayah polygon is:
 * four distinct corners with every edge horizontal or vertical. Anything else is
 * a *general* polygon — an L where an ayah wraps mid-line, and the decorated
 * frames of the opening spread.
 *
 * `SAME` is not fussiness. The corpus writes rectangles with *relative*
 * commands — `M80.6 153h184v36h-184Z` — and 80.6 + 184 − 184 is
 * 80.59999999999997, so the closing edge of a perfectly good rectangle is
 * neither horizontal nor vertical under `===`. That is exactly the mistake the
 * "189" recorded below was: 71 of those 189 are plain rectangles that missed by
 * 3e-14. Page coordinates carry one decimal (svgo floatPrecision 1), so 1e-6 is
 * four orders of magnitude below anything the print can express and cannot
 * absorb a real corner.
 */
const SAME = 1e-6;
function isAxisRect(pts) {
  const p = pts.slice();
  if (p.length > 1) {
    const [ax, ay] = p[0];
    const [bx, by] = p[p.length - 1];
    if (Math.abs(ax - bx) < SAME && Math.abs(ay - by) < SAME) p.pop(); // explicit close
  }
  if (p.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % 4];
    const h = Math.abs(y1 - y2) < SAME;
    const v = Math.abs(x1 - x2) < SAME;
    if (h === v) return false; // exactly one edge direction, and a real edge
  }
  return true;
}

/**
 * The shape census. Not a test — every general polygon in this corpus is well
 * formed, and the parser above already fails on the thing that would be a
 * defect. This counts because the two figures in its docblock were carried in
 * prose for a loop and both were wrong: one had drifted with a repair, and one
 * was never right at all. A count that is printed on every run cannot do that.
 */
const shape = { polys: 0, subpaths: 0, general: 0, pages: new Set() };
function census(page, svg) {
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const d = m[0].match(/\bd="([^"]+)"/)?.[1];
    if (!d) continue;
    const subs = subpaths(d, `page ${page} census`);
    shape.polys++;
    shape.subpaths += subs.length;
    if (subs.some((s) => !isAxisRect(s))) {
      shape.general++;
      shape.pages.add(page);
    }
  }
}

/**
 * Every subpath of an *ink* `d`. Glyph outlines are cubics and quadratics, so
 * this understands the whole path grammar — but it flags control points as
 * off-curve and `inkBox` drops them, because a control point can sit well
 * outside the shape it steers and a box drawn around one would report a glyph
 * where there is no glyph.
 */
function inkSubpaths(d, where) {
  const out = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0,
    px = 0,
    py = 0,
    pts = null;
  const push = (x, y, on = true) => pts && pts.push([x, y, on]);
  for (const tok of d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) ?? []) {
    const c = tok[0];
    const C = c.toUpperCase();
    const n = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const rel = c === c.toLowerCase();
    if (C === "M") {
      if (pts && pts.length > 1) out.push(pts);
      cx = rel ? cx + n[0] : n[0];
      cy = rel ? cy + n[1] : n[1];
      sx = cx;
      sy = cy;
      pts = [[cx, cy, true]];
      for (let i = 2; i + 1 < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        push(cx, cy);
      }
    } else if (C === "H") {
      for (const v of n) push((cx = rel ? cx + v : v), cy);
    } else if (C === "V") {
      for (const v of n) push(cx, (cy = rel ? cy + v : v));
    } else if (C === "L") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        cx = rel ? cx + n[i] : n[i];
        cy = rel ? cy + n[i + 1] : n[i + 1];
        push(cx, cy);
      }
    } else if (C === "C") {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const p = [];
        for (let k = 0; k < 6; k += 2) {
          p.push([rel ? cx + n[i + k] : n[i + k], rel ? cy + n[i + k + 1] : n[i + k + 1]]);
        }
        p.forEach(([x, y], k) => push(x, y, k === 2));
        [px, py] = p[1];
        [cx, cy] = p[2];
      }
    } else if (C === "S" || C === "Q") {
      // Both take four numbers: a control point and an endpoint. S additionally
      // implies a first control reflected through the current point.
      for (let i = 0; i + 3 < n.length; i += 4) {
        const c2 = [rel ? cx + n[i] : n[i], rel ? cy + n[i + 1] : n[i + 1]];
        const end = [rel ? cx + n[i + 2] : n[i + 2], rel ? cy + n[i + 3] : n[i + 3]];
        if (C === "S") push(2 * cx - px, 2 * cy - py, false);
        push(c2[0], c2[1], false);
        push(end[0], end[1], true);
        [px, py] = c2;
        [cx, cy] = end;
      }
    } else if (C === "T") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        const q = [2 * cx - px, 2 * cy - py];
        const end = [rel ? cx + n[i] : n[i], rel ? cy + n[i + 1] : n[i + 1]];
        push(q[0], q[1], false);
        push(end[0], end[1], true);
        [px, py] = q;
        [cx, cy] = end;
      }
    } else if (C === "A") {
      for (let i = 0; i + 6 < n.length; i += 7) {
        cx = rel ? cx + n[i + 5] : n[i + 5];
        cy = rel ? cy + n[i + 6] : n[i + 6];
        push(cx, cy);
      }
    } else if (C === "Z") {
      if (pts && pts.length > 1) out.push(pts);
      pts = null;
      cx = sx;
      cy = sy;
    } else {
      fail(`${where}: ink path uses "${c}", which this gate does not understand`);
      return [];
    }
    if (C !== "C" && C !== "S" && C !== "Q" && C !== "T") {
      px = cx;
      py = cy;
    }
  }
  if (pts && pts.length > 1) out.push(pts);
  return out;
}

/** Bounding box of a point list, ignoring off-curve control points. */
function box(pts) {
  const on = pts.filter((p) => p[2] !== false);
  const use = on.length ? on : pts;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of use) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** The ayah polygons of one page, each as its subpath bounding boxes. */
function readPolygons(page, svg) {
  const polys = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const tag = m[0];
    const d = tag.match(/\bd="([^"]+)"/)?.[1];
    const surah = Number(tag.match(/\bsurah="(\d+)"/)?.[1]);
    const ayah = Number(tag.match(/\bayah="(\d+)"/)?.[1]);
    if (!d || !surah || !ayah) {
      fail(`page ${page}: an ayahPolygon is missing its d/surah/ayah`);
      continue;
    }
    polys.push({ surah, ayah, boxes: subpaths(d, `page ${page} ${surah}:${ayah}`).map(box) });
  }
  return polys;
}

/**
 * The two tests, for one page. Returns the furniture bands it inferred, the
 * bands that are too tall to be furniture, and the glyphs no polygon covers.
 */
function coverage(page, svg) {
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const mx = svg.match(/matrix\(([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
  if (!vb || !mx) {
    fail(`page ${page}: no viewBox or no page transform — the ink cannot be placed`);
    return null;
  }
  const [w, h] = vb.slice(1).map(Number);
  const [a, d, e, f] = mx.slice(1).map(Number);

  const polys = readPolygons(page, svg);
  const boxes = polys.flatMap((p) => p.boxes);
  if (!boxes.length) {
    fail(`page ${page}: no ayah polygons at all — nothing on this page can be tapped`);
    return null;
  }

  // Line pitch is the modal rect height. Not the mean or the median: a squashed
  // or stretched rect is itself the defect being looked for, and either of those
  // would let the defect lead the measurement of what normal looks like.
  const tally = new Map();
  for (const b of boxes) {
    const k = Math.round(b.y1 - b.y0);
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const H = [...tally.entries()].sort((x, y) => y[1] - x[1])[0][0];

  // What the polygons cover, as a union of y-intervals, and then the gaps in it.
  // The block runs fifteen lines up from the last covered edge, so a page whose
  // first polygon starts four lines down has a gap where those lines should be.
  const cov = [];
  for (const [y0, y1] of boxes.map((b) => [b.y0, b.y1]).sort((x, y) => x[0] - y[0])) {
    if (cov.length && y0 <= cov.at(-1)[1] + 0.5) cov.at(-1)[1] = Math.max(cov.at(-1)[1], y1);
    else cov.push([y0, y1]);
  }
  const gaps = [];
  const blockTop = cov.at(-1)[1] - LINES * H;
  if (cov[0][0] - blockTop > 0.5) gaps.push([blockTop, cov[0][0]]);
  for (let i = 1; i < cov.length; i++) gaps.push([cov[i - 1][1], cov[i][0]]);

  // A gap is furniture when a surah's first ayah picks up exactly below it.
  const bands = [];
  for (const [y0, y1] of gaps) {
    const opens = polys.some(
      (p) => p.ayah === 1 && p.boxes.some((b) => Math.abs(b.y0 - y1) < 0.5),
    );
    if (opens) bands.push({ y0, y1, lines: (y1 - y0) / H });
  }

  const start = svg.indexOf('<g id="content"');
  const stop = svg.indexOf('class="ayahPolygon"');
  const region = svg.slice(start < 0 ? 0 : start, stop < 0 ? svg.length : stop);
  const orphans = [];
  for (const m of region.matchAll(/\bd="([^"]+)"/g)) {
    for (const ring of inkSubpaths(m[1], `page ${page}`)) {
      const b = box(ring.map(([x, y, on]) => [a * x + e, d * y + f, on]));
      // Off the page: the corpus carries a little geometry outside the viewBox
      // (clip shapes, a stray rule) that no reader ever sees.
      if (b.cx < 0 || b.cx > w || b.cy < 0 || b.cy > h) continue;
      const covered = polys.some((p) =>
        p.boxes.some(
          (r) => b.cx >= r.x0 - TOL && b.cx <= r.x1 + TOL && b.cy >= r.y0 - TOL && b.cy <= r.y1 + TOL,
        ),
      );
      if (covered) continue;
      if (bands.some((n) => b.cy > n.y0 && b.cy < n.y1)) continue;
      orphans.push(b);
    }
  }
  return { H, bands, tall: bands.filter((n) => n.lines > BAND_MAX), orphans };
}

let checked = 0;
for (const entry of pin.pages) {
  const file = join(PAGES_DIR, `${entry.page}.svg`);
  if (!existsSync(file)) continue;
  const svg = readFileSync(file, "utf8");
  census(entry.page, svg); // every page, including the two the tests skip
  // The opening spread is set as two decorated frames, not a fifteen-line
  // block: pages 1 and 2 have their own viewBox and eleven general polygons
  // between them, and every line-pitch statement below is false of them.
  if (entry.page <= 2) continue;
  const r = coverage(entry.page, svg);
  if (!r) continue;
  checked++;
  if (r.tall.length) {
    const worst = r.tall.sort((x, y) => y.lines - x.lines)[0];
    fail(
      `page ${entry.page}: a band of ${worst.lines.toFixed(2)} line-heights at y ` +
        `${worst.y0.toFixed(1)}–${worst.y1.toFixed(1)} carries no ayah polygon. A surah header ` +
        `and its basmala are two lines; this one has swallowed scripture that should be tappable.`,
    );
  }
  if (r.orphans.length) {
    const first = r.orphans.sort((x, y) => x.cy - y.cy || x.cx - y.cx)[0];
    fail(
      `page ${entry.page}: ${r.orphans.length} glyph(s) fall outside every ayah polygon ` +
        `(first at ${first.cx.toFixed(1)},${first.cy.toFixed(1)}) — that scripture is printed on ` +
        `the page and cannot be selected. Repair it in vendor-pages.mjs POLYGON_REPAIRS and ` +
        `re-vendor; the SVG itself is never hand-edited (PLAN §8).`,
    );
  }
}

if (failures.length) {
  console.error("FAIL gate:pages");
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}

console.log(
  `gate:pages — ${verified}/${expected} page SVGs match ` +
    `${pin.repo}@${pin.commit.slice(0, 8)} via svgo ${pin.svgo.version}; ` +
    `every glyph on ${checked} of them falls inside a tappable ayah; ` +
    `${shape.polys} ayah polygons in ${shape.subpaths} straight-line subpaths, ` +
    `of which ${shape.general} are general polygons on ${shape.pages.size} pages`,
);

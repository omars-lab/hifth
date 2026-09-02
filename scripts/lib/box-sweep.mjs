/**
 * The whole-book ayah-box sweep: what the pen makes of every one of the 6,236
 * ayah boxes, and which ones it cannot make lines of.
 *
 * Three highlight defects were each found by a reader on one page — 2:249's
 * six-line middle inked as a slab, 10:44 dropped to a box because the print
 * rounds to a tenth, and the 110 other boxes silently on that same fallback that
 * the 10:44 fix uncovered. Each was a *class*, and each class was visible in the
 * corpus long before a reader met an instance. This runs the app's own pen over
 * the committed pages and says, per class, how many boxes are in it — so the
 * next one is a number that moved, not a screenshot in a message.
 *
 * It imports the pen it is sweeping with (`packages/core/dist/ink.js`), on
 * purpose and against the house habit of gates carrying their own parser. A
 * gate that re-measures the *corpus* must not trust the code under test; this
 * one measures the *code's behaviour on the corpus*, and a copy of the parser
 * would answer for the copy. CI builds core before any gate runs, and the
 * Makefile's `ci` target depends on `core` for the same reason.
 *
 * Every box is classified once:
 *
 *   FALLBACK  the pen returns null — the box is not a run of rectangles it
 *             recognises, and the app clones the raw shape instead. Correct,
 *             boxy, and where the 110 lived until the tolerance was measured.
 *             Sub-kinds: `polygon` (an L, or more sides than a rectangle),
 *             `slanted` (rect grammar whose closing edge misses by more than
 *             the rounding tolerance), `other`.
 *   OFF-GRID  a rectangle the pen accepts whose height is not a whole number
 *             of the page's lines (within ±OFF_GRID_TOL of an integer). The pen
 *             draws a band thinner or thicker than its neighbours, centred off
 *             the line — a print quirk in the polygon layer, one reader might
 *             notice as "that one looks thin".
 *   FUSED     a rectangle taller than a line (the 2:249 class), which the pen
 *             now splits back into lines. Counted, not flagged: it is handled,
 *             and the count is what says how common the case is.
 *   DOT       a rectangle narrower than the band it carries, which the pen
 *             renders as a single round dot — a one-word tail. Counted.
 *
 * The line height per page is the pen's own `pageLineHeight` (modal rectangle
 * height), so a page's rects are judged against the grid the pen will draw on.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..", "..");
export const PAGES_DIR = join(
  REPO,
  "apps",
  "web",
  "public",
  "assets",
  "pages",
  "hafs-kfqc",
);
const INK = join(REPO, "packages", "core", "dist", "ink.js");

/**
 * How far a rectangle's height may sit from a whole number of lines before it
 * is off the grid. The print's rects are 36 on a 36 line, 38 or 38.2 for the
 * first line under a header; the two known off-grid rects are 27.9 and 28.3
 * (0.77 and 0.79 of a line). 0.2 keeps 38.2 on the grid and catches those.
 */
export const OFF_GRID_TOL = 0.2;

/** The pen's band fraction — mirrored from ink.ts, which does not export it. */
const BAND = 0.72;

async function loadPen() {
  if (!existsSync(INK)) {
    throw new Error(
      `the pen is not built — ${INK} is missing. Run \`pnpm --filter @hifth/core build\` first.`,
    );
  }
  return import(INK);
}

/** Every ayah polygon on a page, in document order. */
export function readPolygons(svg) {
  const out = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const tag = m[0];
    const d = tag.match(/\bd="([^"]+)"/)?.[1];
    const surah = Number(tag.match(/\bsurah="(\d+)"/)?.[1]);
    const ayah = Number(tag.match(/\bayah="(\d+)"/)?.[1]);
    if (d && surah && ayah)
      out.push({ surah, ayah, key: `${surah}:${ayah}`, d });
  }
  return out;
}

/** Why the pen refused a path — the sub-kind of a FALLBACK. */
function fallbackKind(d) {
  const subs = d
    .trim()
    .split(/(?=[Mm])/)
    .filter(Boolean);
  const rectShaped = subs.every((s) =>
    /^[Mm][^A-Za-z]+[Hh][^A-Za-z]+[Vv][^A-Za-z]+[Hh][^A-Za-z]+[Zz]$/.test(
      s.trim(),
    ),
  );
  if (rectShaped) return "slanted";
  // An L, or more sides than a rectangle has (page 2 writes its stepped
  // shapes in h/v alone): a true polygon either way.
  const polygon =
    /[Ll]/.test(d) || subs.some((s) => (s.match(/[A-Za-z]/g) ?? []).length > 5);
  return polygon ? "polygon" : "other";
}

/**
 * Sweep every page. Returns the census and the flagged boxes, each flagged row
 * carrying enough to draw it: page, key, rule, the polygon `d`, the page's line
 * height, and (for a rect) which rect and its height in lines.
 */
export async function sweep(pagesDir = PAGES_DIR) {
  const { rectsFromPath, pageLineHeight } = await loadPen();
  const files = readdirSync(pagesDir)
    .filter((f) => /^\d+\.svg$/.test(f))
    .sort((a, b) => Number(a.slice(0, -4)) - Number(b.slice(0, -4)));

  const census = {
    pages: files.length,
    polygons: 0,
    rects: 0,
    fallback: 0,
    fallbackByKind: { polygon: 0, slanted: 0, other: 0 },
    offGrid: 0,
    fused: 0,
    fusedMaxLines: 0,
    dot: 0,
  };
  const flagged = [];

  for (const f of files) {
    const page = Number(f.slice(0, -4));
    const svg = readFileSync(join(pagesDir, f), "utf8");
    const polys = readPolygons(svg);
    const lineHeight = pageLineHeight(polys.map((p) => p.d));
    for (const p of polys) {
      census.polygons++;
      const rects = rectsFromPath(p.d);
      if (!rects) {
        const kind = fallbackKind(p.d);
        census.fallback++;
        census.fallbackByKind[kind]++;
        flagged.push({
          page,
          key: p.key,
          rule: "fallback",
          kind,
          d: p.d,
          lineHeight,
        });
        continue;
      }
      rects.forEach((r, i) => {
        census.rects++;
        const lines = lineHeight ? r.height / lineHeight : 1;
        const n = Math.max(1, Math.round(lines));
        if (lineHeight && Math.abs(lines - n) > OFF_GRID_TOL) {
          census.offGrid++;
          flagged.push({
            page,
            key: p.key,
            rule: "off-grid",
            d: p.d,
            lineHeight,
            rect: i,
            height: r.height,
            lines: Number(lines.toFixed(2)),
          });
        }
        if (n > 1) {
          census.fused++;
          census.fusedMaxLines = Math.max(census.fusedMaxLines, n);
        }
        if (r.width < (r.height / n) * BAND) census.dot++;
      });
    }
  }
  return { census, flagged };
}

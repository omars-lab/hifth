/**
 * Where does one letter end and the next begin, in the print's own ink?
 *
 * The one implementation of the cut that docs/decisions/letter-parts.md chose
 * (A): `probe-letter-cuts.mjs` draws it for the eye, `build-letters.mjs` ships
 * the dividing lines it finds. Both call `cutPage`, so what was looked at is
 * what ships.
 *
 * ## How a word is cut
 *
 * 1. The word's box is rasterised from the page, and split into its separate
 *    pieces of ink. A piece that sits almost wholly inside a vowel-sign's
 *    rectangle (the mark shard) is a sign, not a letter, and is set aside; a
 *    piece another word's box holds more of is that word's.
 * 2. The corpus spells the word as a string of letters (QAC, via the committed
 *    word alignment). Arabic letters only join forward from some letters — alif,
 *    dal, dhal, ra, zay, waw never reach the next one — so the spelling splits
 *    into runs, and each run should be one body of ink, taken right to left.
 * 3. Inside a run of k letters, k−1 cuts are chosen where the ink is thinnest,
 *    pulled toward widths each letter usually takes, then each cut is let bend
 *    around the ink as a seam from top to bottom. The seams only cut across the
 *    writing line; ink above or below it goes with the letter it is joined to.
 * 4. Dots go to the letter whose slice they sit over.
 *
 * Words the corpus holds as one word but the print draws as two (or the other
 * way round) are skipped, as are words whose body count does not match the
 * spelling's run count: a word left uncut shows no letters, which is better
 * than letters that are wrong.
 *
 * The spelling is used here, at build time, and never leaves: what ships is
 * geometry only (see `dividers`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPageInk, rasterise } from "./ink.mjs";
import { openAlignment, EDITION, WORDS_DIR } from "./segmentation.mjs";
import { wordsByAyah } from "../morphology.mjs";

// ------------------------------------------------------------ the letters --

/** Letters that never join the one after them. Hamza joins neither side. */
const NO_NEXT = new Set([..."Adrz*w'"]);

/**
 * How wide each letter usually runs in this print, relative to a medial ba.
 * Rough on purpose: the cut follows the ink, these only break ties.
 */
const WIDTH = {
  A: 0.7, b: 1, t: 1, v: 1, n: 1, y: 1, j: 1.8, H: 1.8, x: 1.8, d: 1.3, "*": 1.3, r: 1.8, z: 1.8,
  s: 2.6, $: 2.6, S: 3, D: 3, T: 2.2, Z: 2.2, E: 1.5, g: 1.5, f: 1.4, q: 1.4, k: 2, l: 1, m: 1.3,
  h: 1.3, w: 2.2, "'": 1,
};
/** Letters that grow a tail when they end a run. */
const TAILED = new Set([..."bvtnyjHxsS$DEgfqklmh"]);

export function runsOf(letters) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < letters.length; i += 1) {
    cur.push(letters[i]);
    const next = letters[i + 1];
    if (next === undefined || NO_NEXT.has(letters[i]) || next === "'") {
      runs.push(cur);
      cur = [];
    }
  }
  return runs;
}

// ------------------------------------------------------------ the pieces --

export function piecesOf(mask, cols, rows) {
  const lab = new Int32Array(cols * rows);
  const stack = new Int32Array(cols * rows);
  const out = [];
  for (let s = 0; s < mask.length; s += 1) {
    if (!mask[s] || lab[s]) continue;
    const id = out.length + 1;
    const px = [];
    let sp = 0;
    lab[s] = id;
    stack[sp++] = s;
    while (sp) {
      const q = stack[--sp];
      px.push(q);
      const qi = q % cols;
      const qj = (q - qi) / cols;
      const nb = [qi > 0 ? q - 1 : -1, qi < cols - 1 ? q + 1 : -1, qj > 0 ? q - cols : -1, qj < rows - 1 ? q + cols : -1];
      for (const r of nb) if (r >= 0 && mask[r] && !lab[r]) { lab[r] = id; stack[sp++] = r; }
    }
    let i0 = cols, i1 = 0, j0 = rows, j1 = 0, sx = 0;
    for (const q of px) {
      const i = q % cols, j = (q - i) / cols;
      if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
      sx += i;
    }
    out.push({ id, px, i0, i1, j0, j1, cx: sx / px.length, cy: 0 });
  }
  for (const p of out) p.cy = p.px.reduce((a, q) => a + Math.floor(q / cols), 0) / p.px.length;
  return { lab, pieces: out };
}

// -------------------------------------------------------------- the cuts --

/**
 * k−1 cut columns across one body, right to left, by dynamic programming over
 * columns: thin ink is cheap to cut, a slice far from its letter's usual width
 * is dear.
 */
function cutColumns(prof, tall, onLine, i0, i1, letters, RES, debug) {
  const k = letters.length;
  if (k === 1) return [];
  const W = i1 - i0 + 1;
  const w = letters.map((l, n) => (WIDTH[l] ?? 1.2) * (n === k - 1 && TAILED.has(l) ? 1.8 : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  const want = w.map((x) => (x / sum) * W);
  const stroke = Math.max(1, [...prof.slice(i0, i1 + 1)].filter((c) => c > 0).sort((a, b) => a - b)[Math.floor(W * 0.2)] ?? 1);
  // A tall stroke starts its letter at its right: a cut just left of one hands
  // the stroke to the letter before it, so that is dear — unless that letter is
  // a lam, which is little more than its stroke, so the cut just left of the
  // stroke is its own (the lam of خٰلِدُونَ went with the dal without this).
  const reach = Math.round(1.2 * RES);
  // thin(x, n): the cost of cut n at column x; letter n lies to its right.
  const thin = (x, n) => {
    // One stroke along the line is as cheap as any other: only extra ink costs.
    let t = Math.max(0, prof[x] / stroke - 1.3);
    if (letters[n] !== "l") for (let d = 1; d <= reach && x + d <= i1; d += 1) if (tall[x + d]) { t += 3; break; }
    // Letters join on the writing line; a thin tail below it is not a join.
    if (!onLine[x]) t += 4;
    // The ends of a body taper, and a cut there leaves a letter of nothing.
    if (x - i0 < RES || i1 - x < RES) t += 4;
    return t;
  };
  // cost[n][x]: best cost with the n-th cut at column x (letters 0..n to its right).
  const INF = 1e18;
  // No letter is narrower than a unit.
  const MIN = RES;
  const cost = Array.from({ length: k - 1 }, () => new Float64Array(W).fill(INF));
  const back = Array.from({ length: k - 1 }, () => new Int32Array(W).fill(-1));
  const dev = (n, width) => 1 * ((width - want[n]) / Math.max(want[n], 4)) ** 2;
  for (let x = 0; x < W; x += 1) cost[0][x] = W - 1 - x < MIN ? INF : thin(i0 + x, 0) * 2 + dev(0, W - 1 - x);
  for (let n = 1; n < k - 1; n += 1) {
    for (let x = 0; x < W; x += 1) {
      let best = INF, arg = -1;
      for (let y = x + MIN; y < W; y += 1) {
        const c = cost[n - 1][y] + dev(n, y - x);
        if (c < best) { best = c; arg = y; }
      }
      cost[n][x] = best + thin(i0 + x, n) * 2;
      back[n][x] = arg;
    }
  }
  if (debug) for (let x = 0; x < W; x += 1) console.log(i0 + x, prof[i0 + x], tall[i0 + x], onLine[i0 + x], thin(i0 + x, 0).toFixed(2));
  let best = Infinity, at = -1;
  for (let x = MIN; x < W - MIN; x += 1) {
    const c = cost[k - 2][x] + dev(k - 1, x);
    if (c < best) { best = c; at = x; }
  }
  const cuts = [];
  for (let n = k - 2; n >= 0; n -= 1) { cuts.push(i0 + at); at = back[n][at]; }
  return cuts.sort((a, b) => b - a);
}

/** Let a straight cut bend around the ink: a top-to-bottom path through the fewest inked pixels, within a band. */
function seam(body, cols, rows, x, band) {
  const lo = Math.max(0, x - band), hi = Math.min(cols - 1, x + band);
  const Wb = hi - lo + 1;
  let prev = new Float64Array(Wb);
  const from = [];
  for (let j = 0; j < rows; j += 1) {
    const cur = new Float64Array(Wb).fill(Infinity);
    const bk = new Int8Array(Wb);
    for (let d = 0; d < Wb; d += 1) {
      const c = (body[j * cols + lo + d] ? 10 : 0) + Math.abs(lo + d - x) * 0.05;
      for (const s of [-1, 0, 1]) {
        const e = d + s;
        if (e < 0 || e >= Wb) continue;
        const v = (j === 0 ? 0 : prev[e]) + c + (s ? 0.3 : 0);
        if (v < cur[d]) { cur[d] = v; bk[d] = s; }
      }
    }
    from.push(bk);
    prev = cur;
  }
  let d = 0;
  for (let e = 1; e < Wb; e += 1) if (prev[e] < prev[d]) d = e;
  const path = new Int32Array(rows);
  for (let j = rows - 1; j >= 0; j -= 1) { path[j] = lo + d; d += from[j][d]; }
  return path;
}

// ------------------------------------------------------------- the page --

/** Page units of margin round each word's grid, and of paper the word tool keeps round each copy. */
const GRID_MARGIN = 4;
export const PAD = 2.5;

/** The least ink a letter may keep, in square units; less and the word stays uncut. */
const THIN = 0.8;

/**
 * The writing line through one body: its busiest row, where its letters join.
 * A body that sits off the word's line — a kaf's meem dropping below it — joins
 * on its own line, not the word's. A body with no run along a row (a lone
 * upright) keeps the word's.
 */
function lineOf(body, cols, rows, wordLine, RES) {
  const perRow = new Int32Array(rows);
  for (const q of body.px) perRow[Math.floor(q / cols)] += 1;
  let line = wordLine;
  for (let j = 0; j < rows; j += 1) if (perRow[j] > perRow[line]) line = j;
  return perRow[line] >= 2.5 * RES ? line : wordLine;
}

let shared = null;
/** The alignment and the spellings, read once per process. */
function corpus() {
  shared ??= { align: openAlignment(), qac: wordsByAyah() };
  return shared;
}

/**
 * Cut every word on one page.
 *
 * Returns the page's ink (`vb`, `shapes`) and one result per print word:
 * `{ tag, key, print, status, x0, y0, cols, rows, pieces }`, where `x0, y0` is
 * the word grid's corner in pixels at `res` per unit. A word with `status:
 * "cut"` also carries `n` (its letter count), `letterOf` (each grid pixel's
 * letter, right to left from 0, or −1 for none) and `seams` (for drawing:
 * `{ paths, line, band }` per body). Other statuses are "mismatch" (bodies and
 * runs disagree in number) and "skip" with a `why`.
 */
export function cutPage(page, { res = 12, word = null, perBody = true } = {}) {
  const RES = res;
  const { align, qac } = corpus();
  const ASSETS = join(WORDS_DIR, "..");
  const svg = readFileSync(join(ASSETS, "pages", EDITION, `${page}.svg`), "utf8");
  const words = JSON.parse(readFileSync(join(WORDS_DIR, EDITION, `${page}.json`), "utf8")).words;
  const marks = JSON.parse(readFileSync(join(ASSETS, "marks", EDITION, `${page}.json`), "utf8")).marks;
  const { vb, shapes } = readPageInk(svg, 1 / (4 * RES));
  const ALL_BOXES = Object.values(words).flatMap((e) => e.boxes);
  // Any sign on the page: a neighbour's wasla can sit inside this word's box.
  const ALL_SIGNS = Object.values(marks).flat().map((m) => m.r);
  const results = [];
  const unshared = [];

  for (const [key, entry] of Object.entries(words)) {
    const map = align.mapOf(key);
    const spelled = qac.get(key);
    if (!map || !spelled) {
      for (let i = 0; i < entry.boxes.length; i += 1) results.push({ tag: `${key}#${entry.from + i}`, key, print: entry.from + i, status: "skip", why: "no alignment" });
      continue;
    }
    // The ink of one print word: its separate pieces, sorted into bodies, dots and signs.
    const analyse = (print) => {
      const [bx, by, bw, bh] = entry.boxes[print - entry.from];
      // A margin past the box, so a neighbour's letter the box clips is seen whole
      // and can be told apart by how much of it sits outside.
      const M = GRID_MARGIN;
      const x0 = Math.floor((bx - M) * RES), y0 = Math.floor((by - M) * RES);
      const cols = Math.ceil((bw + 2 * M) * RES), rows = Math.ceil((bh + 2 * M) * RES);
      const mask = rasterise(shapes, x0 / RES, y0 / RES, cols, rows, RES);
      const { pieces } = piecesOf(mask, cols, rows);
      const at = (q) => [(x0 + (q % cols) + 0.5) / RES, (y0 + Math.floor(q / cols) + 0.5) / RES];
      const inSign = (p) => {
        let hit = 0;
        for (const q of p.px) {
          const [x, y] = at(q);
          if (ALL_SIGNS.some(([rx, ry, rw, rh]) => x >= rx - 0.3 && x <= rx + rw + 0.3 && y >= ry - 0.3 && y <= ry + rh + 0.3)) hit += 1;
        }
        return hit / p.px.length >= 0.8;
      };
      const here = entry.boxes[print - entry.from];
      const kept = pieces.filter((p) => {
        if (inSign(p)) { p.kind = "sign"; return false; }
        // Ink poking in from a neighbouring word: some other word's box holds
        // more of it than this one does.
        const share = (b) => p.px.filter((q) => {
          const [x, y] = at(q);
          return x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
        }).length;
        const inside = share(here);
        if (ALL_BOXES.some((b) => b !== here && share(b) > inside)) { p.kind = "other"; return false; }
        if (inside / p.px.length < 0.6) { p.kind = "other"; return false; }
        return true;
      });
      // Dots, alone or run together in twos and threes, stay under five units a
      // side; every letter body in this print is taller than that.
      const isDot = (p) => p.j1 - p.j0 + 1 <= 5 * RES && p.i1 - p.i0 + 1 <= 5.5 * RES && p.px.length <= 10 * RES * RES;
      const bodies = kept.filter((p) => !isDot(p)).sort((a, b) => b.i1 - a.i1);
      const dots = kept.filter((p) => !bodies.includes(p));
      for (const p of bodies) p.kind = "body";
      for (const p of dots) p.kind = "dot";
      return { x0, y0, cols, rows, pieces, kept, bodies, dots };
    };
    // Where the corpus holds one word and the print draws several, share the
    // spelling out: the first split, shortest prefix first, whose runs match
    // every piece's bodies.
    const lettersOf = new Map();
    const seen = new Set();
    for (const row of map) {
      if (seen.has(row.qac) || row.qacSpan !== 1) continue;
      seen.add(row.qac);
      const group = map.filter((r) => r.qac === row.qac).map((r) => r.print);
      const all = [...spelled[row.qac - 1]];
      if (group.length === 1) { lettersOf.set(group[0], all); continue; }
      const want = group.map((g) => analyse(g).bodies.length);
      const split = (from, g) => {
        if (g === group.length - 1) return runsOf(all.slice(from)).length === want[g] && from < all.length ? [all.slice(from)] : null;
        for (let e = from + 1; e < all.length; e += 1) {
          if (runsOf(all.slice(from, e)).length !== want[g]) continue;
          const rest = split(e, g + 1);
          if (rest) return [all.slice(from, e), ...rest];
        }
        return null;
      };
      const parts = split(0, 0);
      if (parts) group.forEach((g, n) => lettersOf.set(g, parts[n]));
      else unshared.push({ key, group, want });
    }
    for (const row of map) {
      const tag = `${key}#${row.print}`;
      const base = { tag, key, print: row.print };
      if (row.qacSpan !== 1) { results.push({ ...base, status: "skip", why: "one print word holds two corpus words" }); continue; }
      const letters = lettersOf.get(row.print);
      if (!letters) { results.push({ ...base, status: "skip", why: "no way to share a word's letters between its pieces" }); continue; }
      const { x0, y0, cols, rows, pieces, kept, bodies, dots } = analyse(row.print);
      const runs = runsOf(letters);
      const grid = { x0, y0, cols, rows, pieces };
      if (bodies.length !== runs.length) {
        results.push({
          ...base, ...grid, status: "mismatch", bodies: bodies.length, runs: runs.length, letters: letters.length,
          sizes: kept.map((p) => [+(p.px.length / RES / RES).toFixed(1), +((p.i1 - p.i0 + 1) / RES).toFixed(1), +((p.j1 - p.j0 + 1) / RES).toFixed(1), p.kind]),
        });
        continue;
      }
      // The writing line: the busiest row across the word's bodies.
      const perRow = new Int32Array(rows);
      for (const b of bodies) for (const q of b.px) perRow[Math.floor(q / cols)] += 1;
      let wordLine = 0;
      for (let j = 1; j < rows; j += 1) if (perRow[j] > perRow[wordLine]) wordLine = j;
      const letterOf = new Int32Array(cols * rows).fill(-1);
      const slices = [];
      const seams = [];
      let n = 0;
      bodies.forEach((body, r) => {
        const run = runs[r];
        const line = perBody ? lineOf(body, cols, rows, wordLine, RES) : wordLine;
        const bmask = new Uint8Array(cols * rows);
        for (const q of body.px) bmask[q] = 1;
        const prof = new Int32Array(cols);
        const top = new Int32Array(cols).fill(rows), bot = new Int32Array(cols).fill(-1);
        for (const q of body.px) {
          const i = q % cols, j = Math.floor(q / cols);
          prof[i] += 1;
          if (j < top[i]) top[i] = j;
          if (j > bot[i]) bot[i] = j;
        }
        const tall = new Uint8Array(cols);
        for (let i = 0; i < cols; i += 1) tall[i] = bot[i] - top[i] > 6 * RES && prof[i] > 4 * RES ? 1 : 0;
        const onLine = new Uint8Array(cols);
        for (const q of body.px) {
          const j = Math.floor(q / cols);
          if (Math.abs(j - line) <= 0.8 * RES) onLine[q % cols] = 1;
        }
        const debug = tag === word;
        const cuts = cutColumns(prof, tall, onLine, body.i0, body.i1, run, RES, debug);
        if (debug) console.log("cuts", cuts, run.join(""));
        const paths = cuts.map((c) => seam(bmask, cols, rows, c, Math.round(1.2 * RES)));
        // Letter of a body pixel by the seams alone: how many lie to its right.
        const seamAt = (i, j) => paths.filter((p) => i < p[j]).length;
        // The seams cut only across the writing line. Ink above or below it —
        // a kaf's long top stroke leaning back over the letter before — goes
        // with the letter it stays joined to. Where a letter stays joined to two
        // (a loop that closes above the line), the plain seams decide.
        const band = Math.round(1.5 * RES);
        const lamAlif = new Set(run.flatMap((l, i) => (l === "l" && run[i + 1] === "A" ? [i] : [])));
        const wall = new Uint8Array(cols * rows);
        for (const p of paths) for (let j = Math.max(0, line - band); j <= Math.min(rows - 1, line + band); j += 1) { wall[j * cols + p[j]] = 1; if (p[j] + 1 < cols) wall[j * cols + p[j] + 1] = 1; }
        const cut = new Uint8Array(cols * rows);
        for (const q of body.px) if (!wall[q]) cut[q] = 1;
        for (const part of piecesOf(cut, cols, rows).pieces) {
          const votes = new Map();
          for (const q of part.px) {
            const j = Math.floor(q / cols);
            if (Math.abs(j - line) > band) continue;
            const l = seamAt(q % cols, j);
            votes.set(l, (votes.get(l) ?? 0) + 1);
          }
          const only = votes.size === 1 ? [...votes.keys()][0] : -1;
          // Lam-alif is drawn as two crossed strokes meeting at the foot: its
          // strokes are split by the seam, not by what they are joined to.
          const crossed = only >= 0 && (lamAlif.has(only) || lamAlif.has(only - 1));
          for (const q of part.px) letterOf[q] = n + (only >= 0 && !crossed ? only : seamAt(q % cols, Math.floor(q / cols)));
        }
        // The wall's own pixels.
        for (const q of body.px) if (letterOf[q] < 0) letterOf[q] = n + seamAt(q % cols, Math.floor(q / cols));
        slices.push({ n, i0: body.i0, i1: body.i1, paths });
        seams.push({ paths, line, band });
        n += run.length;
      });
      // Dots go to the slice they sit over.
      for (const d of dots) {
        const i = Math.round(d.cx), j = Math.round(d.cy);
        let best = slices[0], gap = Infinity;
        for (const s of slices) {
          const g = i > s.i1 ? i - s.i1 : i < s.i0 ? s.i0 - i : 0;
          if (g < gap) { gap = g; best = s; }
        }
        const at = best.paths.filter((p) => i < p[Math.min(rows - 1, Math.max(0, j))]).length;
        for (const q of d.px) letterOf[q] = best.n + at;
      }
      // A letter left with next to no ink means the cut went wrong: leave the
      // word uncut rather than ship a letter of nothing.
      const ink = new Int32Array(n);
      for (const l of letterOf) if (l >= 0) ink[l] += 1;
      if (ink.some((c) => c < THIN * RES * RES)) { results.push({ ...base, ...grid, status: "thin", ink: [...ink].map((c) => +(c / RES / RES).toFixed(1)) }); continue; }
      results.push({ ...base, ...grid, status: "cut", n, letterOf, seams });
    }
  }
  return { vb, shapes, results, unshared };
}

// ----------------------------------------------------------- the dividers --

/** Douglas–Peucker over a polyline of [x, y] points. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, fd = tol;
    for (let k = a + 1; k < b; k += 1) {
      const d = Math.abs(dy * (pts[k][0] - ax) - dx * (pts[k][1] - ay)) / len;
      if (d > fd) { fd = d; far = k; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/**
 * What ships for a cut word: n−1 dividing lines, each running from the top of
 * the word's grid to the bottom, with letters 0..j to its right and j+1.. to
 * its left. Letter i is the region between line i−1 and line i (the word's own
 * edges beyond the first and last). Nothing here spells anything: a reader of
 * the shard learns only where the ink may be divided.
 *
 * Each line is swept row by row out from the writing line, kept clear of both
 * sides' ink by a small margin where there is room; where the two sides' ink
 * overlaps on one row (a dot over the letter before) it runs between them and
 * the row is counted in `overlap`, so a word whose line had to cross ink can be
 * found.
 *
 * Returns `{ lines, overlap }`, each line in tenths of a page unit: a single
 * number x for a line that runs straight down, else a flat [x, y, x, y, …]
 * from top to bottom.
 */
export function dividers(r, res, { tol = 0.3, margin = 0.3 } = {}) {
  const { cols, rows, x0, y0, letterOf, n } = r;
  const line = r.seams[0]?.line ?? Math.floor(rows / 2);
  const m = margin * res;
  const lines = [];
  let overlap = 0;
  for (let j = 0; j < n - 1; j += 1) {
    // Per row: the leftmost ink of the letters to the right, the rightmost of those to the left.
    const hi = new Float64Array(rows).fill(Infinity);
    const lo = new Float64Array(rows).fill(-Infinity);
    let rMin = Infinity, lMax = -Infinity;
    for (let q = 0; q < letterOf.length; q += 1) {
      const l = letterOf[q];
      if (l < 0) continue;
      const i = q % cols, y = (q - i) / cols;
      if (l <= j) { if (i < hi[y]) hi[y] = i; if (i < rMin) rMin = i; }
      else { if (i + 1 > lo[y]) lo[y] = i + 1; if (i + 1 > lMax) lMax = i + 1; }
    }
    const xs = new Float64Array(rows);
    const place = (y, prev) => {
      const a = lo[y], b = hi[y];
      if (a > b) { overlap += 1; return (a + b) / 2; }
      const room = b - a > 2 * m;
      const lo2 = a === -Infinity ? a : a + (room ? m : (b - a) / 2);
      const hi2 = b === Infinity ? b : b - (room ? m : (b - a) / 2);
      return Math.min(Math.max(prev, lo2), hi2);
    };
    const start = (rMin + lMax) / 2;
    xs[line] = place(line, start);
    for (let y = line - 1; y >= 0; y -= 1) xs[y] = place(y, xs[y + 1]);
    for (let y = line + 1; y < rows; y += 1) xs[y] = place(y, xs[y - 1]);
    // Only as far past the box as the word tool's copies reach.
    const pts = [];
    const reach = Math.round((GRID_MARGIN - PAD) * res);
    for (let y = reach; y <= rows - reach; y += 1) pts.push([(x0 + xs[Math.min(y, rows - 1)]) / res, (y0 + y) / res]);
    const kept = simplify(pts, tol).map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]);
    // A line that runs straight down is one number: its x.
    const xs2 = kept.map(([x]) => x);
    const upright = Math.max(...xs2) - Math.min(...xs2) <= 3;
    lines.push(upright ? Math.round(xs2.reduce((a, b) => a + b, 0) / xs2.length) : kept.flat());
  }
  return { lines, overlap };
}

/**
 * One word's lines as the shard stores them, measured from the word's own box
 * so the numbers stay small: x from the box's left edge and y from the top of
 * the word tool's copy (PAD above the box), both in tenths of a page unit.
 * An upright line is its x alone. Any other is [x, dy, dx, dy, dx, …]: its top
 * point, then each next point as a step down and across. Its last point runs
 * on straight to the bottom of the copy.
 */
export function encodeLines(lines, [bx, by]) {
  const ox = Math.round(bx * 10);
  const oy = Math.round((by - PAD) * 10);
  return lines.map((l) => {
    if (typeof l === "number") return l - ox;
    const out = [l[0] - ox];
    let px = l[0], py = oy;
    for (let k = 2; k < l.length; k += 2) {
      out.push(l[k + 1] - py, l[k] - px);
      px = l[k]; py = l[k + 1];
    }
    // A last step straight down says nothing the reader does not assume.
    while (out.length > 1 && out[out.length - 1] === 0) out.length -= 2;
    return out.length === 1 ? out[0] : out;
  });
}

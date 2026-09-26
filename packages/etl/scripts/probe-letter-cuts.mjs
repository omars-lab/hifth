#!/usr/bin/env node
/**
 * Where does one letter end and the next begin, in the print's own ink?
 *
 * docs/decisions/letter-parts.md chose to cut the print at the joins (A), and
 * to check a sample by eye before any of it ships. This is the first cut, run
 * on one page and drawn so the eye can check it. Nothing here ships.
 *
 * ## How a word is cut
 *
 * 1. The word's box is rasterised from the page, and split into its separate
 *    pieces of ink. A piece that sits almost wholly inside a vowel-sign's
 *    rectangle (the mark shard) is a sign, not a letter, and is set aside.
 * 2. The corpus spells the word as a string of letters (QAC, via the committed
 *    word alignment). Arabic letters only join forward from some letters — alif,
 *    dal, dhal, ra, zay, waw never reach the next one — so the spelling splits
 *    into runs, and each run should be one body of ink, taken right to left.
 * 3. Inside a run of k letters, k−1 cuts are chosen where the ink is thinnest,
 *    pulled toward widths each letter usually takes, then each cut is let bend
 *    around the ink as a seam from top to bottom.
 * 4. Dots go to the letter whose slice they sit over.
 *
 * Words the corpus holds as one word but the print draws as two (or the other
 * way round) are skipped and counted, as are words whose body count does not
 * match the spelling's run count: those are exactly the ones worth looking at.
 *
 *   node packages/etl/scripts/probe-letter-cuts.mjs --page 7 --out <dir>
 *
 * Writes <dir>/letter-cuts-<page>.png (every body coloured by letter, seams in
 * red, signs pale, unmatched words boxed) and <dir>/letter-cuts-<page>.json.
 * Both carry the print's ink, so they belong in a scratch folder, never docs/.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { readPageInk, rasterise } from "./lib/ink.mjs";
import { openAlignment, EDITION, WORDS_DIR } from "./lib/segmentation.mjs";
import { wordsByAyah } from "./morphology.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const PAGE = Number(arg("--page", "7"));
const OUT = arg("--out", ".");
const RES = Number(arg("--res", "12"));
const WORD = arg("--word", null);
let DEBUG = false;

const ASSETS = join(WORDS_DIR, "..");
const svg = readFileSync(join(ASSETS, "pages", EDITION, `${PAGE}.svg`), "utf8");
const words = JSON.parse(readFileSync(join(WORDS_DIR, EDITION, `${PAGE}.json`), "utf8")).words;
const marks = JSON.parse(readFileSync(join(ASSETS, "marks", EDITION, `${PAGE}.json`), "utf8")).marks;
const { vb, shapes } = readPageInk(svg, 1 / (4 * RES));
const align = openAlignment();
const qac = wordsByAyah();

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

function runsOf(letters) {
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

function piecesOf(mask, cols, rows) {
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
function cutColumns(prof, tall, onLine, i0, i1, letters) {
  const k = letters.length;
  if (k === 1) return [];
  const W = i1 - i0 + 1;
  const w = letters.map((l, n) => (WIDTH[l] ?? 1.2) * (n === k - 1 && TAILED.has(l) ? 1.8 : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  const want = w.map((x) => (x / sum) * W);
  const stroke = Math.max(1, [...prof.slice(i0, i1 + 1)].filter((c) => c > 0).sort((a, b) => a - b)[Math.floor(W * 0.2)] ?? 1);
  // A tall stroke starts its letter at its right: a cut just left of one hands
  // the stroke to the letter before it, so that is dear.
  const reach = Math.round(1.2 * RES);
  const thin = (x) => {
    // One stroke along the line is as cheap as any other: only extra ink costs.
    let t = Math.max(0, prof[x] / stroke - 1.3);
    for (let d = 1; d <= reach && x + d <= i1; d += 1) if (tall[x + d]) { t += 3; break; }
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
  for (let x = 0; x < W; x += 1) cost[0][x] = W - 1 - x < MIN ? INF : thin(i0 + x) * 2 + dev(0, W - 1 - x);
  for (let n = 1; n < k - 1; n += 1) {
    for (let x = 0; x < W; x += 1) {
      let best = INF, arg = -1;
      for (let y = x + MIN; y < W; y += 1) {
        const c = cost[n - 1][y] + dev(n, y - x);
        if (c < best) { best = c; arg = y; }
      }
      cost[n][x] = best + thin(i0 + x) * 2;
      back[n][x] = arg;
    }
  }
  if (DEBUG) for (let x = 0; x < W; x += 1) console.log(i0 + x, prof[i0 + x], tall[i0 + x], onLine[i0 + x], thin(i0 + x).toFixed(2));
  let best = Infinity, at = -1;
  for (let x = MIN; x < W - MIN; x += 1) {
    const c = cost[k - 2][x] + dev(k - 1, x);
    if (c < best) { best = c; at = x; }
  }
  const cuts = [];
  for (let n = k - 2; n >= 0; n -= 1) { cuts.push(i0 + at); at = back[n][at]; }
  return cuts.reverse().reverse().sort((a, b) => b - a);
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

const CW = Math.ceil(vb[2] * RES), CH = Math.ceil(vb[3] * RES);
const ALL_BOXES = Object.values(words).flatMap((e) => e.boxes);
const ALL_SIGNS = Object.values(marks).flat().map((m) => m.r);
const img = new Uint8Array(CW * CH * 3).fill(255);
const put = (i, j, [r, g, b]) => {
  if (i < 0 || j < 0 || i >= CW || j >= CH) return;
  const o = (j * CW + i) * 3;
  img[o] = r; img[o + 1] = g; img[o + 2] = b;
};
const PALETTE = [[31, 111, 102], [196, 98, 16], [70, 90, 190], [160, 40, 120], [90, 140, 20], [20, 140, 200]];
const SIGN = [200, 200, 200];
const OTHER = [120, 120, 120];
const RED = [230, 20, 20];

// Paint the whole page's ink first, grey, so anything no word claims shows.
{
  const all = rasterise(shapes, vb[0], vb[1], CW, CH, RES);
  for (let q = 0; q < all.length; q += 1) if (all[q]) put(q % CW, Math.floor(q / CW), OTHER);
}

const report = { page: PAGE, res: RES, words: 0, cut: 0, skipped: {}, mismatched: [], cuts: {} };
const skip = (why) => { report.skipped[why] = (report.skipped[why] ?? 0) + 1; };
const frame = (x0, y0, w, h, colour) => {
  for (let i = x0; i <= x0 + w; i += 1) { put(i, y0, colour); put(i, y0 + h, colour); put(i, y0 + 1, colour); }
  for (let j = y0; j <= y0 + h; j += 1) { put(x0, j, colour); put(x0 + w, j, colour); put(x0 + 1, j, colour); }
};

for (const [key, entry] of Object.entries(words)) {
  const map = align.mapOf(key);
  const spelled = qac.get(key);
  if (!map || !spelled) { skip("no alignment"); continue; }
  const signs = marks[key] ?? [];
  // The ink of one print word: its separate pieces, sorted into bodies, dots and signs.
  const analyse = (print) => {
    const [bx, by, bw, bh] = entry.boxes[print - entry.from];
    // A margin past the box, so a neighbour's letter the box clips is seen whole
    // and can be told apart by how much of it sits outside.
    const M = 4;
    const x0 = Math.floor((bx - M) * RES), y0 = Math.floor((by - M) * RES);
    const cols = Math.ceil((bw + 2 * M) * RES), rows = Math.ceil((bh + 2 * M) * RES);
    const mask = rasterise(shapes, x0 / RES, y0 / RES, cols, rows, RES);
    const { lab, pieces } = piecesOf(mask, cols, rows);
    // Any sign on the page: a neighbour's wasla can sit inside this word's box.
    const mine = ALL_SIGNS;
    const inSign = (p) => {
      let hit = 0;
      for (const q of p.px) {
        const x = (x0 + (q % cols) + 0.5) / RES, y = (y0 + Math.floor(q / cols) + 0.5) / RES;
        if (mine.some(([rx, ry, rw, rh]) => x >= rx - 0.3 && x <= rx + rw + 0.3 && y >= ry - 0.3 && y <= ry + rh + 0.3)) hit += 1;
      }
      return hit / p.px.length >= 0.8;
    };
    const kept = pieces.filter((p) => {
      if (inSign(p)) { p.kind = "sign"; return false; }
      // Ink poking in from a neighbouring word: some other word's box holds
      // more of it than this one does.
      const share = (b) => p.px.filter((q) => {
        const x = (x0 + (q % cols) + 0.5) / RES, y = (y0 + Math.floor(q / cols) + 0.5) / RES;
        return x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
      }).length;
      const here = entry.boxes[print - entry.from];
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
    else report.unshared = [...(report.unshared ?? []), { key, group, want, spelled: all.join("") }];
  }
  for (const row of map) {
    report.words += 1;
    if (row.qacSpan !== 1) { skip("one print word holds two corpus words"); continue; }
    const letters = lettersOf.get(row.print);
    if (!letters) { skip("no way to share a word's letters between its pieces"); continue; }
    const { x0, y0, cols, rows, pieces, kept, bodies, dots } = analyse(row.print);
    const runs = runsOf(letters);
    const paint = (p, colour) => { for (const q of p.px) put(x0 + (q % cols), y0 + Math.floor(q / cols), colour); };
    for (const p of pieces) if (p.kind === "sign") paint(p, SIGN);
    const tag = `${key}#${row.print}`;
    if (bodies.length !== runs.length) {
      report.mismatched.push({ word: tag, bodies: bodies.length, runs: runs.length, letters: letters.length, sizes: kept.map((p) => [+(p.px.length / RES / RES).toFixed(1), +((p.i1 - p.i0 + 1) / RES).toFixed(1), +((p.j1 - p.j0 + 1) / RES).toFixed(1), p.kind]) });
      for (const p of kept) paint(p, [0, 0, 0]);
      frame(x0, y0, cols, rows, [230, 150, 0]);
      continue;
    }
    // The writing line: the busiest row across the word's bodies.
    const perRow = new Int32Array(rows);
    for (const b of bodies) for (const q of b.px) perRow[Math.floor(q / cols)] += 1;
    let line = 0;
    for (let j = 1; j < rows; j += 1) if (perRow[j] > perRow[line]) line = j;
    // Cut each body into its run's letters.
    const slices = []; // [{colour, i0, i1 (inclusive, cols), path?}]
    let n = 0;
    const out = [];
    bodies.forEach((body, r) => {
      const run = runs[r];
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
      DEBUG = tag === WORD;
      const cuts = cutColumns(prof, tall, onLine, body.i0, body.i1, run);
      if (DEBUG) console.log("cuts", cuts, run.join(""));
      const paths = cuts.map((c) => seam(bmask, cols, rows, c, Math.round(1.2 * RES)));
      // Letter index of a body pixel: how many seams lie to its right.
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
      const parts = piecesOf(cut, cols, rows).pieces;
      const letterOf = new Int32Array(cols * rows).fill(-1);
      for (const part of parts) {
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
        if (only >= 0 && !crossed) for (const q of part.px) letterOf[q] = only;
        else for (const q of part.px) letterOf[q] = seamAt(q % cols, Math.floor(q / cols));
      }
      const letterAt = (i, j) => (letterOf[j * cols + i] >= 0 ? letterOf[j * cols + i] : seamAt(i, j));
      for (const q of body.px) {
        const i = q % cols, j = Math.floor(q / cols);
        put(x0 + i, y0 + j, PALETTE[(n + letterAt(i, j)) % PALETTE.length]);
      }
      for (const p of paths) for (let j = Math.max(0, line - band); j <= Math.min(rows - 1, line + band); j += 1) { put(x0 + p[j], y0 + j, RED); put(x0 + p[j] + 1, y0 + j, RED); }
      slices.push({ n, i0: body.i0, i1: body.i1, paths, k: run.length });
      out.push(paths.map((p) => [...p].filter((_, j) => j % 3 === 0).map((i, jj) => [+(((x0 + i) / RES).toFixed(2)), +(((y0 + jj * 3) / RES).toFixed(2))])));
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
      paint(d, PALETTE[(best.n + at) % PALETTE.length]);
    }
    report.cut += 1;
    report.cuts[tag] = out;
  }
}

// --------------------------------------------------------------- output --

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let j = 0; j < h; j += 1) {
    raw[j * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, j * w * 3, w * 3).copy(raw, j * (w * 3 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, `letter-cuts-${PAGE}.png`), png(CW, CH, img));
writeFileSync(join(OUT, `letter-cuts-${PAGE}.json`), JSON.stringify(report, null, 1));
console.log(`page ${PAGE}: ${report.words} words, ${report.cut} cut, ${report.mismatched.length} body/run mismatches, skipped ${JSON.stringify(report.skipped)}`);

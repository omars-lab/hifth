#!/usr/bin/env node
/**
 * Where does one letter end and the next begin, in the print's own ink?
 *
 * docs/decisions/letter-parts.md chose to cut the print at the joins (A), and
 * to check a sample by eye before any of it ships. This draws one page of the
 * cut for the eye. The cutting itself is lib/letter-cuts.mjs, shared with
 * build-letters.mjs, and the colours here come from the dividing lines that
 * build ships — not from the cutter's own pixel labels — so what the eye passes
 * is what a reader gets.
 *
 *   node packages/etl/scripts/probe-letter-cuts.mjs --page 7 --out <dir> [--word 2:38#1]
 *
 * Writes <dir>/letter-cuts-<page>.png (each word's letters coloured by the
 * region its dividing lines give them, the lines in red, signs pale, words left
 * uncut boxed in orange with their ink black) and <dir>/letter-cuts-<page>.json.
 * Both carry the print's ink, so they belong in a scratch folder, never docs/.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { rasterise } from "./lib/ink.mjs";
import { cutPage, dividers } from "./lib/letter-cuts.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const PAGE = Number(arg("--page", "7"));
const OUT = arg("--out", ".");
const RES = Number(arg("--res", "12"));
const WORD = arg("--word", null);

// --word-line: every body cuts on the word's one writing line (the old way), for comparison.
const { vb, shapes, results, unshared } = cutPage(PAGE, { res: RES, word: WORD, perBody: !process.argv.includes("--word-line") });

const CW = Math.ceil(vb[2] * RES), CH = Math.ceil(vb[3] * RES);
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

const report = { page: PAGE, res: RES, words: results.length, cut: 0, skipped: {}, mismatched: [], thin: {}, overlap: {}, unshared, lines: {} };
const frame = (x0, y0, w, h, colour) => {
  for (let i = x0; i <= x0 + w; i += 1) { put(i, y0, colour); put(i, y0 + h, colour); put(i, y0 + 1, colour); }
  for (let j = y0; j <= y0 + h; j += 1) { put(x0, j, colour); put(x0 + w, j, colour); put(x0 + 1, j, colour); }
};
let first = 0;
for (const r of results) {
  if (r.status === "skip") { report.skipped[r.why] = (report.skipped[r.why] ?? 0) + 1; continue; }
  const { x0, y0, cols, rows, pieces } = r;
  const paint = (p, colour) => { for (const q of p.px) put(x0 + (q % cols), y0 + Math.floor(q / cols), colour); };
  for (const p of pieces) if (p.kind === "sign") paint(p, SIGN);
  if (r.status === "mismatch" || r.status === "thin") {
    const { tag, bodies, runs, letters, sizes } = r;
    if (r.status === "thin") report.thin[tag] = r.ink;
    else report.mismatched.push({ word: tag, bodies, runs, letters, sizes });
    for (const p of pieces) if (p.kind === "body" || p.kind === "dot") paint(p, [0, 0, 0]);
    frame(x0, y0, cols, rows, [230, 150, 0]);
    continue;
  }
  report.cut += 1;
  const { lines, overlap } = dividers(r, RES);
  report.lines[r.tag] = lines;
  if (overlap) report.overlap[r.tag] = overlap;
  // The region a pixel falls in: how many lines lie to its right on its row.
  const xAt = (stored, y) => {
    if (typeof stored === "number") return stored / 10;
    const line = stored.map((v) => v / 10);
    if (y <= line[1]) return line[0];
    for (let k = 2; k < line.length; k += 2) {
      if (line[k + 1] >= y) {
        const [ax, ay, bx, by] = line.slice(k - 2, k + 2);
        return by === ay ? bx : ax + ((y - ay) / (by - ay)) * (bx - ax);
      }
    }
    return line[line.length - 2];
  };
  for (const p of pieces) {
    if (p.kind !== "body" && p.kind !== "dot") continue;
    for (const q of p.px) {
      const i = q % cols, j = Math.floor(q / cols);
      const x = (x0 + i + 0.5) / RES, y = (y0 + j + 0.5) / RES;
      const region = lines.filter((l) => x < xAt(l, y)).length;
      put(x0 + i, y0 + j, PALETTE[(first + region) % PALETTE.length]);
    }
  }
  for (const l of lines) for (let j = 0; j < rows; j += 1) put(Math.round(xAt(l, (y0 + j + 0.5) / RES) * RES), y0 + j, RED);
  first += r.n;
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
console.log(`page ${PAGE}: ${report.words} words, ${report.cut} cut, ${report.mismatched.length} body/run mismatches, ${Object.keys(report.thin).length} with a letter of nothing, ${Object.keys(report.overlap).length} with a line crossing ink, skipped ${JSON.stringify(report.skipped)}`);

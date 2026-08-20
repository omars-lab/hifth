#!/usr/bin/env node
/**
 * Reach for the ink, rather than resize toward it: the candidate this rule
 * would draw for a mark the search refuses, rebuilt as a script that stays.
 *
 * ㉘–㉚ in `docs/design/mark-registration.md` scored this rule twice — once as a
 * sample, once as an escalation over the whole refused population — and both
 * runs came from a script that was never committed. Everything those three
 * items say is a fact about a run this repo can no longer reproduce. This is
 * that script, written fresh from the rule's own description rather than
 * recovered, because nothing of the original survives to diff against:
 *
 *   of the pieces of ink in a mark's search window, take every piece whose
 *   middle falls inside the rectangle we already ship, and union their
 *   bounding boxes into a candidate.
 *
 * A mark with no such piece keeps its shipped rectangle rather than guess —
 * the same shape of refusal ㉜ describes for the size guard, and the one this
 * script already implements because the rule cannot draw a candidate from
 * nothing. What ㉜ still asks for — refusing a union that grew implausibly
 * large — is deliberately **not** decided here. This script reports the area
 * ratio every candidate would have; #210 is what tests a cutoff against it.
 *
 * ## The window
 *
 * The same window the ink search itself used: the shipped rectangle padded by
 * however far that particular mark was allowed to look (`searchedAt`, which is
 * wider for marks the ordinary radius gave up on — see `mark-ink.mjs`'s
 * `ranOutOfRoom`). A piece union scored against a *different* window than the
 * one the refusal was measured against would be answering a question nobody
 * asked; the pieces have to be exactly the ones the search already had in view.
 *
 * ## Which marks
 *
 * `--set refused` (default) is the population ㉙ and ㉚ scored against: every
 * mark the shipped rule currently refuses, matching `build-mark-report.mjs`'s
 * own test so the two never name different populations for the same words. It
 * will not print 329 — the corpus has moved since ㉙ counted it, once already
 * because of the boundary-check fix ㉛ describes — and that is expected, not a
 * bug: report the number this run actually finds, the same way the artifact
 * for ㉜ reported 40 doubled marks against the doc's stated 45 rather than
 * force a match it could not independently verify.
 *
 * Usage:
 *   node packages/etl/scripts/probe-piece-union.mjs --rows <rows.json> \
 *     [--set refused|weak|edge|all] [--radius 3] [--iou 0.55] [--res 16] \
 *     [--out packages/etl/out/piece-union.json]
 *
 * The rows file is the same one `build-mark-report.mjs` reads: one row per
 * mark, dumped by `probe-mark-ink.mjs --rows-out`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inkPieces, readPageInk } from "./lib/ink.mjs";
import { ranOutOfRoom, refusedItsOwnInk } from "./lib/mark-ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PAGES = join(ROOT, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const rowsPath = arg("--rows", null);
const set = arg("--set", "refused");
const radius = Number(arg("--radius", 3));
const iouFloor = Number(arg("--iou", 0.55));
const res = Number(arg("--res", 16));
const outPath = arg("--out", join(HERE, "..", "out", "piece-union.json"));

/**
 * `--ids page:k,page:k,...` scores exactly those marks instead of a `--set`.
 *
 * For checking the rule against a sitting's own ground truth — #210's job —
 * `--set` is the wrong tool: a mark a reader was asked about may since have
 * stopped being `refused` as the corpus moved, and dropping it from the check
 * would be silently excluding the very disagreement the sitting recorded. An
 * explicit id list scores what was actually asked, not what the current
 * population happens to contain.
 */
const idsArg = arg("--ids", null);

if (!rowsPath) {
  console.error("--rows <file> is required: the per-mark ink-search rows to draw candidates from.");
  console.error("  build them with: probe-mark-ink.mjs --pages-n 604 --grain line-tilt --rows-out <file>");
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(rowsPath, "utf8"));
const all = Array.isArray(parsed) ? parsed : parsed.rows;

// The same three tests `build-mark-report.mjs` names its own populations with,
// kept in lockstep on purpose — see that file's header on why a second reading
// of "refused" is a second definition waiting to drift from the first.
const atEdge = (r) => ranOutOfRoom(r, radius);
const placed = (r) => !refusedItsOwnInk(r, radius, iouFloor);
const SETS = {
  refused: (r) => !placed(r),
  weak: (r) => r.iouBest < iouFloor,
  edge: (r) => atEdge(r),
  all: () => true,
};
if (!SETS[set]) {
  console.error(`--set must be one of ${Object.keys(SETS).join(", ")}`);
  process.exit(2);
}

let pool;
if (idsArg) {
  const want = new Set(idsArg.split(",").map((s) => s.trim()).filter(Boolean));
  const byId = new Map(all.map((r) => [`${r.page}:${r.k}`, r]));
  pool = [...want].map((id) => {
    const r = byId.get(id);
    if (!r) console.error(`  no row for ${id} in ${rowsPath} — skipping`);
    return r;
  }).filter(Boolean);
} else {
  pool = all.filter(SETS[set]);
}
if (!pool.length) {
  console.error(idsArg ? "none of --ids matched a row" : `nothing in set ${set} — check --radius/--iou against the rows file.`);
  process.exit(2);
}

/**
 * Every piece of ink in a window, as a bounding box, keyed by nothing but its
 * own connectivity. Mirrors the box half of `build-mark-report.mjs`'s
 * `crop()` exactly — same ring loop, same thin-ring exclusion — because that
 * function and this one have to agree pixel for pixel about what a piece is,
 * or a reader could affirm a candidate this rule never actually drew.
 */
function pieceBoxesIn(shapes, vx, vy, vw, vh) {
  const cut = inkPieces(shapes, vx, vy, vw, vh, res);
  const seen = new Map();
  const boxes = [];
  for (const sh of shapes) {
    for (const ring of sh.rings) {
      let lo = Infinity;
      let hi = -Infinity;
      let loy = Infinity;
      let hiy = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < lo) lo = ring[i];
        if (ring[i] > hi) hi = ring[i];
        if (ring[i + 1] < loy) loy = ring[i + 1];
        if (ring[i + 1] > hiy) hiy = ring[i + 1];
      }
      if (hi < vx || lo > vx + vw || hiy < vy || loy > vy + vh) continue;
      // A ring too thin to have rasterised anything belongs to no piece — see
      // crop()'s own comment on why that is the honest outcome, not a bug.
      const l = cut.of(ring);
      if (!l) continue;
      let p = seen.get(l);
      if (p === undefined) {
        p = boxes.length;
        seen.set(l, p);
        boxes.push([lo, loy, hi, hiy]);
      } else {
        const b = boxes[p];
        if (lo < b[0]) b[0] = lo;
        if (loy < b[1]) b[1] = loy;
        if (hi > b[2]) b[2] = hi;
        if (hiy > b[3]) b[3] = hiy;
      }
    }
  }
  return boxes;
}

/**
 * One mark's window: the shipped rectangle, padded by however far this mark
 * was actually allowed to search. Same construction as `probe-mark-ink.mjs`'s
 * `windowOf`, because a candidate has to be drawn from exactly the ink that
 * mark's own search had in view — not a wider or narrower guess about it.
 */
function windowOf(box, effRadius) {
  const pad = effRadius + 1;
  const padX = pad + box[2];
  return { vx: box[0] - padX, vy: box[1] - pad, vw: box[2] + 2 * padX, vh: box[3] + 2 * pad };
}

const inks = new Map();
const inkFor = (p) => {
  if (!inks.has(p)) inks.set(p, readPageInk(readFileSync(join(PAGES, `${p}.svg`), "utf8"), 1 / res));
  return inks.get(p);
};

const n3 = (v) => Math.round(v * 1000) / 1000;

const out = [];
for (const r of pool) {
  const [bx, by, bw, bh] = r.box;
  const effRadius = r.searchedAt ?? radius;
  const { vx, vy, vw, vh } = windowOf(r.box, effRadius);
  const { shapes } = inkFor(r.page);
  const boxes = pieceBoxesIn(shapes, vx, vy, vw, vh);

  // "Whose middle falls inside the rectangle we already ship" — ㉘'s own
  // wording, tested against the shipped box, never the ink-corrected one: the
  // whole point of this rule is to find a candidate independent of what the
  // displacement search already guessed.
  const inside = boxes.filter((b) => {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    return cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh;
  });

  let candidate = null;
  if (inside.length) {
    let lo = Infinity;
    let loy = Infinity;
    let hi = -Infinity;
    let hiy = -Infinity;
    for (const b of inside) {
      if (b[0] < lo) lo = b[0];
      if (b[1] < loy) loy = b[1];
      if (b[2] > hi) hi = b[2];
      if (b[3] > hiy) hiy = b[3];
    }
    candidate = [n3(lo), n3(loy), n3(hi - lo), n3(hiy - loy)];
  }

  const shippedArea = bw * bh;
  const candidateArea = candidate ? candidate[2] * candidate[3] : null;
  out.push({
    page: r.page,
    k: r.k,
    name: r.name,
    box: r.box,
    searchedAt: effRadius,
    piecesInWindow: boxes.length,
    piecesUnioned: inside.length,
    candidate,
    ratio: candidate ? n3(candidateArea / shippedArea) : null,
    grow: candidate ? [n3(candidate[2] - bw), n3(candidate[3] - bh)] : null,
  });
}

writeFileSync(outPath, JSON.stringify(out));

// --------------------------------------------------------------- summary --
const q = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const zero = out.filter((r) => !r.candidate);
const ratios = out.filter((r) => r.candidate).map((r) => r.ratio);
const worst = out
  .filter((r) => r.candidate)
  .slice()
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 10);

console.error(`set ${set}: ${out.length} marks scored, ${zero.length} with no piece to point to (kept shipped)`);
console.error(
  `area ratio over the ${ratios.length} with a candidate: ` +
    `p50 ${q(ratios, 0.5)}, p90 ${q(ratios, 0.9)}, p95 ${q(ratios, 0.95)}, max ${q(ratios, 1)}`,
);
console.error("worst 10 by area ratio:");
for (const r of worst) {
  console.error(`  ${r.page}:${r.k} ${r.name} — shipped ${r.box[2]}×${r.box[3]}, ratio ${r.ratio}, grew ${r.grow}`);
}
console.error(`wrote ${out.length} rows to ${outPath}`);

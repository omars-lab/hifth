#!/usr/bin/env node
/**
 * Does the ink under a mark's rectangle match what the rectangle claims?
 *
 * 326,515 rectangles say "this box, on this page, holds a kasra". Every check
 * this repo has run on them so far compares one description of the text with
 * another description of the text: `probe-diacritics.mjs` ② proves each mark
 * sits inside its own word's box, ④ that the ligatures partition the letters,
 * ⑤ that the drawn name and the codepoint agree on 62,931 held-out runs. All of
 * it is arithmetic over the corpus the boxes came from, and
 * `sub-word-marks.md` §⑦ says exactly what that leaves untested:
 *
 * > A print that named its paths correctly and *placed* one of them a letter to
 * > the left would satisfy ①–⑤ exactly as a correct one does, because nothing
 * > here ever asks where the outline sits relative to the letter that wrote it.
 *
 * This asks. It is the first thing in the repo to open the picture a hafiz
 * actually sees — the shipped print, whose text is one anonymous outline per
 * page — and compare it against the corpus the boxes were measured from.
 *
 * ## Two verdicts, never one
 *
 * **Registration** — is the box in the right *place*? Slide the mark's own
 * outline over the shipped page and see where it fits best. A box that is right
 * scores highest where it claims to be; a box that is on the neighbouring letter
 * scores highest a letter away, and says so in units.
 *
 * **Identity** — is the ink under it the mark we *named*? Put all twenty-six
 * marks the print knows how to draw on the same spot, and see which one the ink
 * looks most like. If the answer is not the one on the label, the label is
 * wrong — and if the answer *cannot* be the one on the label because two marks
 * are the same shape drawn in different places, that is a finding about the
 * method and it is reported as one.
 *
 * They fail for different reasons and cost different amounts, so they are never
 * added together.
 *
 * ## Why every number here comes with a control
 *
 * A pass rate on its own measures nothing, because a metric that says "yes" to
 * everything also says "yes" to the right answer. So each mark is scored three
 * more times, at placements known to be wrong: one mark-width to the left, one
 * to the right, and at a different mark's rectangle elsewhere on the same page.
 * The gap between the true placement and the best of those is the only evidence
 * that the score is about the mark rather than about the page being covered in
 * ink. If the gap is small, nothing else in the output is worth reading, and the
 * report says so first.
 *
 * ## What it does not need
 *
 * No model, no download, no network, no native binary, no font. The whole
 * measurement is `lib/ink.mjs` — a scanline filler in arithmetic — over bytes
 * already committed to this repo and a cache already pinned by hash. Which is
 * the point: `packages/etl` re-derives its output from committed bytes offline,
 * and a check on that output that could not itself be re-derived offline would
 * be worth less than the thing it checks.
 *
 * Named `probe-` and not `gate-` for the reason `probe-encodings.mjs` is: the
 * ligature corpus is a gitignored cache, so there is nothing for a gate to read
 * on a clean checkout. It exits non-zero on a breached threshold so that it
 * *could* become one, and is deliberately not wired into anything yet.
 *
 * ## The one rule this script exists under
 *
 * **Nothing this script writes is Quran text, and nothing it writes is
 * committed** — the rule as `morphology.mjs` now states it, and as
 * `gate:scripture` enforces it. Marks are
 * reported by page, word index and drawn name. The word's own letters are read
 * from the cache at runtime and never written to a file outside
 * `packages/etl/out/`, which is gitignored — the same arrangement
 * `probe-encodings.mjs` runs under and for the same reason.
 *
 * Usage:
 *   node packages/etl/scripts/probe-mark-ink.mjs                     # a seeded sample
 *   node packages/etl/scripts/probe-mark-ink.mjs --pages 2,3,50      # whole pages
 *   node packages/etl/scripts/probe-mark-ink.mjs --pages 100-120     # a range
 *   node packages/etl/scripts/probe-mark-ink.mjs --sample 2000 --seed 7
 *   node packages/etl/scripts/probe-mark-ink.mjs --json              # machine output
 *   node packages/etl/scripts/probe-mark-ink.mjs --out /tmp/look.html
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMarkOutlines } from "./lib/diacritics.mjs";
import { readPageInk, integral, rasterise } from "./lib/ink.mjs";
import { cachedMarkPages, markPageFile as pageFile, marksOf } from "./lib/marks.mjs";
import {
  bestPlacement,
  outlineRings,
  refusedItsOwnInk,
  rng,
  sampleSizeFor,
  scoreAt,
  stamp,
  wilson,
  withSecondLook,
} from "./lib/mark-ink.mjs";
import { classifier, loadExemplars, shapeGroups, similarityMatrix } from "./lib/mark-shape.mjs";
import {
  FLOOR,
  GRAINS,
  SPLIT_FLOOR,
  correctionFor,
  fitLine,
  half,
  pageKey,
  shiftsBy,
} from "./lib/registration-grain.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PAGES = join(ROOT, "apps", "web", "public", "assets", "pages", "hafs-kfqc");
const PIN = JSON.parse(readFileSync(join(HERE, "..", "data", "pages", "word-boxes.pin.json"), "utf8"));
const OUT = join(HERE, "..", "out", "mark-ink.html");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = (name) => process.argv.includes(name);

/**
 * Samples per page unit.
 *
 * Sixteen puts about a hundred by fifty samples on a mark of median size, so the
 * smallest displacement the search can resolve is a fortieth of a mark's height
 * — comfortably finer than the tenth-of-a-unit the boxes are rounded to, which
 * is the precision the answer is allowed to claim. Raising it costs time
 * quadratically and buys nothing the rounding does not throw away.
 */
const RES = Number(arg("--res", 16));

/**
 * How far the search may move a mark, in page units.
 *
 * Three units is about half a mark's width and comfortably more than the gap to
 * the neighbouring letter, so "it fits better one letter over" is inside the
 * search rather than clipped by it. A radius that could not reach the wrong
 * answer would report every wrong box as merely unmatched.
 */
const RADIUS = Number(arg("--radius", 3));

/**
 * How far the search may move a mark on its *second* look, and why there is one.
 *
 * The radius above was sized against the neighbouring letter, so that "it fits
 * better one letter over" would land inside the search rather than be clipped by
 * it. That reasoning is right and it has a consequence nobody drew at the time:
 * a mark whose true ink is further away than the radius comes back not as
 * *misplaced* but as *unmatched*, which is the one thing the docblock above says
 * a radius must never do.
 *
 * It was happening to all of them. On 272 marks a reader placed by hand, the
 * displacement they actually needed was a median of 4.292 units and 230 of the
 * 272 exceeded 3 — the search was looking in a window smaller than the thing it
 * was looking for, and where it hit the wall it was already heading the right
 * way, agreeing with the reader on 92 of 100 marks across and 99 of 100 down.
 *
 * So the refused ones get a second, wider look. **Only the refused ones**, and
 * that is not a performance choice. Searching everything this wide moves 4.11%
 * of the marks that already matched by more than two units — a wider window
 * finds a better-scoring match that is the adjacent mark's ink, and it does it
 * confidently. Those cannot be adjudicated, because nothing knows which answer
 * is right; escalating only where the narrow search gave up means they never
 * arise, and every accepted mark keeps its answer bit for bit.
 *
 * Set to 0 to turn the second look off and get the old single-pass behaviour.
 */
const ESCALATE = Number(arg("--escalate", 8));

/**
 * When the first look counts as having given up.
 *
 * The same two tests `build-mark-report.mjs` uses to split placed from fallback,
 * because the population this rescues has to be the same population that names
 * it. They are different failures: hitting the radius means the answer is out of
 * reach, while matching under the floor means the search could see it and did
 * not like it. Only the first is a thing a wider look can fix, but both are
 * offered it — a mark that matched badly at 3 units sometimes matched badly
 * because the real ink was outside and it settled for whatever was inside.
 */
const ESC_FLOOR = Number(arg("--escalate-floor", 0.55));

const wantJson = has("--json");
const outPath = arg("--out", OUT);
const crops = Number(arg("--crops", 240));

// ------------------------------------------------------- the working set --

const parsePages = (s) =>
  s
    .split(",")
    .flatMap((part) => {
      const m = part.match(/^(\d+)-(\d+)$/);
      if (!m) return [Number(part)];
      const out = [];
      for (let p = Number(m[1]); p <= Number(m[2]); p += 1) out.push(p);
      return out;
    })
    .filter((p) => p >= 1 && p <= 604);

const pageArg = arg("--pages", null);
const sampleN = Number(arg("--sample", 1200));
const seed = Number(arg("--seed", 7));

const cached = cachedMarkPages();
if (!cached.length) {
  console.error(
    "No ligature pages in packages/etl/data/pages/.cache/words/.\n" +
      "This probe reads the cache the word boxes were built from; fill it with\n" +
      "`node packages/etl/scripts/probe-encodings.mjs --fetch` first.",
  );
  process.exit(2);
}

// ----------------------------------------------------------- the scoring --

/**
 * A mark's window: the claimed rectangle with room round it for the search to
 * move in, plus one unit so that a template pushed to the edge still has its own
 * rectangle inside the raster.
 *
 * Sideways it is wider still, by the mark's own width, because one of the
 * controls below puts the outline a whole mark-width to the left and to the
 * right and then asks how it scores there. A control that fell off the edge of
 * what was drawn would be scored on the part of it that remained, and the part
 * of a wrong answer that stayed in view is not the wrong answer.
 */
function windowOf(box, radius = RADIUS) {
  const pad = radius + 1;
  const padX = pad + box[2];
  const x0 = box[0] - padX;
  const y0 = box[1] - pad;
  return {
    x0,
    y0,
    cols: Math.ceil((box[2] + 2 * padX) * RES),
    rows: Math.ceil((box[3] + 2 * pad) * RES),
  };
}

/**
 * @param corr  a page-wide displacement to apply to the claimed placement before
 *              scoring, in page units. Null on the first pass, which is what
 *              measures it; set on the second, which is what tests it. The
 *              second pass does not search — the best placement is a fact about
 *              the page and does not move when the claim does, so it is carried
 *              over and only the *distance from the claim* changes.
 */
function scoreMark(mark, ink, lib, other, corr, radius = RADIUS) {
  const { box, fit } = mark;
  const win = windowOf(box, radius);
  const obs = rasterise(ink.shapes, win.x0, win.y0, win.cols, win.rows, RES);
  const sat = integral(obs, win.cols, win.rows);
  const cx0 = corr ? corr.dx : 0;
  const cy0 = corr ? corr.dy : 0;

  const own = stamp(
    outlineRings(mark.d, fit.sx, fit.sy, fit.tx - win.x0 + cx0, fit.ty - win.y0 + cy0),
    0,
    0,
    win.cols,
    win.rows,
    RES,
  );
  if (!own.area) return null;

  const at = scoreAt(own, obs, sat, win.cols, win.rows, 0, 0);
  const best = corr
    ? { ...corr.best, di: corr.best.di - Math.round(cx0 * RES), dj: corr.best.dj - Math.round(cy0 * RES) }
    : bestPlacement(own, obs, sat, win.cols, win.rows, RES, radius);

  // The ink fraction of the claimed rectangle, kept because it is the statistic
  // the first look at this used and the two must be comparable.
  const inkFrac = at.n ? at.ink / at.n : 0;

  // --- the controls ------------------------------------------------------
  // One mark-width either side is "the neighbouring letter"; a different mark's
  // rectangle elsewhere on the page is "somewhere a mark really is, but not
  // this one". Whichever scores best is the number to beat, which is the
  // generous reading and the only honest one.
  const wpx = Math.max(1, Math.round(box[2] * RES));
  const nulls = [
    scoreAt(own, obs, sat, win.cols, win.rows, wpx, 0).phi,
    scoreAt(own, obs, sat, win.cols, win.rows, -wpx, 0).phi,
  ];
  if (other) {
    // The far control gets a raster of its own, centred on the rectangle it is
    // being moved to. Reusing this mark's window would only have shown whatever
    // sliver of the displaced outline happened to still be inside it, and a
    // sliver scores like a sliver rather than like a wrong answer.
    const w2 = windowOf(other.box, radius);
    const obs2 = rasterise(ink.shapes, w2.x0, w2.y0, w2.cols, w2.rows, RES);
    const sat2 = integral(obs2, w2.cols, w2.rows);
    const dx = other.box[0] + other.box[2] / 2 - (box[0] + box[2] / 2);
    const dy = other.box[1] + other.box[3] / 2 - (box[1] + box[3] / 2);
    const far = stamp(
      outlineRings(mark.d, fit.sx, fit.sy, fit.tx - w2.x0 + dx + cx0, fit.ty - w2.y0 + dy + cy0),
      0,
      0,
      w2.cols,
      w2.rows,
      RES,
    );
    nulls.push(far.area ? scoreAt(far, obs2, sat2, w2.cols, w2.rows, 0, 0).phi : -1);
  }

  // --- identity ----------------------------------------------------------
  // Every name the print can draw, centred on the claimed rectangle, scored the
  // same way. Also scored at the placement the registration search found, so
  // that a box which is merely low is not read as a box which is mislabelled.
  const cx = box[0] + box[2] / 2 + cx0;
  const cy = box[1] + box[3] / 2 + cy0;
  const votes = [];
  for (const [name, ex] of lib) {
    const [bx0, by0, bx1, by1] = ex.box;
    const ecx = fit.sx * ((bx0 + bx1) / 2) + fit.tx;
    const ecy = fit.sy * ((by0 + by1) / 2) + fit.ty;
    const rings = outlineRings(ex.d, fit.sx, fit.sy, fit.tx - win.x0 + (cx - ecx), fit.ty - win.y0 + (cy - ecy));
    const st = stamp(rings, 0, 0, win.cols, win.rows, RES);
    if (!st.area) continue;
    votes.push({
      name,
      phi: scoreAt(st, obs, sat, win.cols, win.rows, 0, 0).phi,
      phiAt: scoreAt(st, obs, sat, win.cols, win.rows, best.di, best.dj).phi,
    });
  }
  votes.sort((a, b) => b.phi - a.phi);
  const byShift = [...votes].sort((a, b) => b.phiAt - a.phiAt);
  const mine = votes.find((v) => v.name === mark.name);
  const runnerUp = votes.find((v) => v.name !== votes[0].name);

  return {
    page: mark.page,
    k: mark.k,
    name: mark.name,
    id: mark.id,
    surah: mark.surah,
    aya: mark.aya,
    idx: mark.idx,
    line: mark.line,
    box: [box[0] + cx0, box[1] + cy0, box[2], box[3]],
    best,
    ink: inkFrac,
    phi0: at.phi,
    iou0: at.iou,
    phiBest: best.phi,
    iouBest: best.iou,
    dx: best.di / RES,
    dy: best.dj / RES,
    off: Math.hypot(best.di, best.dj) / RES,
    nullPhi: Math.max(...nulls),
    saw: votes[0].name,
    sawPhi: votes[0].phi,
    minePhi: mine ? mine.phi : 0,
    margin: votes[0].phi - (runnerUp ? runnerUp.phi : 0),
    sawShift: byShift[0].name,
    // How far this particular answer was allowed to look. Equal to the ordinary
    // radius for almost every mark; wider for the ones the first look gave up
    // on. It travels with the row because `dx, dy` pinned at a boundary is not
    // the same kind of number as `dx, dy` found inside one, and nothing
    // downstream can tell which it is holding without knowing the boundary.
    searchedAt: radius,
  };
}

// --------------------------------------------------------------- summary --

const q = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
};

/**
 * There is deliberately no confusion matrix in this script.
 *
 * An earlier version had one, over every mark it scored, and it was the single
 * most misleading thing in the output. Its biggest cell was "labelled fatha, ink
 * looks like kasra" — which is not a confusion at all, because this print draws
 * the two as one shape. Its next cells were marks whose rectangle sat a unit low
 * and therefore over the letter rather than over the mark. Three unrelated
 * effects, stacked into one table, and read as one finding.
 *
 * What each of the three now is, and where it lives:
 *
 * - the rectangle is displaced — measured here, in the registration numbers;
 * - the drawing and its name are drawn as one shape — probe-mark-labels.mjs,
 *   which answers it without the shipped page in the arithmetic at all;
 * - the two printings genuinely differ at one spot — the last section here, on
 *   the marks where the first two have been ruled out, and only there.
 */

// ------------------------------------------------------------------ main --

const t0 = Date.now();

/**
 * The same template library the labelling probe uses, built by the same
 * function — so that when the two probes are read side by side, the comparison
 * is between two questions and not between two libraries.
 */
const lib = loadExemplars({
  cacheFile: join(HERE, "..", "out", `mark-exemplars.${PIN.pages.length}.json`),
  pages: cached,
  outlinesOf: (p) => readMarkOutlines(readFileSync(pageFile(p), "utf8")),
  rebuild: has("--rebuild-templates"),
});

/**
 * Which names this print draws as one shape, and the whole square it came from.
 *
 * Derived here only so that this probe can *exclude* marks whose label is
 * already in question. The labelling verdict itself belongs to
 * `probe-mark-labels.mjs`, which answers it without the shipped page in the
 * arithmetic at all; this script must never be the place a reader learns
 * whether a drawing matches its name, because everything in this script has a
 * displacement in it.
 */
const MATRIX = similarityMatrix(lib);
const TWIN = Number(arg("--twin", 0.85));
const SHAPES = shapeGroups(MATRIX, TWIN);
const labelOf = classifier(lib, SHAPES.groupOf);

let population = null;
let pagesDrawn = null;
let picks;
if (pageArg) {
  const ps = parsePages(pageArg).filter((p) => cached.includes(p));
  picks = ps.flatMap((p) => marksOf(p).map((m) => ({ ...m, page: p })));
} else {
  /**
   * A two-stage sample: some pages, then some marks on them.
   *
   * Not because it is cheaper — though it is, since opening a page is the
   * expensive part and a sample spread thinly over all 604 opens every one of
   * them for four marks. Because the measurement needs it. Half of what this
   * probe reports is a *per-page* quantity, and a page with four marks on it
   * cannot say anything about its own alignment; a page with eighty can.
   *
   * The price is that the marks are not independent — two marks on one page
   * share whatever that page's fit did wrong — so a plain binomial interval on a
   * rate is narrower than the truth. That is why the per-page table is printed
   * next to every rate: the spread between pages *is* the part the interval
   * leaves out, and a reader can see it rather than take a corrected number on
   * trust.
   */
  const r = rng(seed);
  const pool = [...cached];
  const chosen = [];
  const want = Math.min(Number(arg("--pages-n", 40)), pool.length);
  while (chosen.length < want) chosen.push(...pool.splice(Math.floor(r() * pool.length), 1));
  chosen.sort((a, b) => a - b);

  const counts = chosen.map((p) => readMarkOutlines(readFileSync(pageFile(p), "utf8")).length);
  population = counts.reduce((a, b) => a + b, 0);
  const n = Math.min(sampleN, population);
  const grabs = new Set();
  while (grabs.size < n) grabs.add(Math.floor(r() * population));

  const byPage = new Map();
  let base = 0;
  for (let i = 0; i < chosen.length; i += 1) {
    const lo = base;
    const hi = base + counts[i];
    for (const g of grabs) if (g >= lo && g < hi) {
      if (!byPage.has(chosen[i])) byPage.set(chosen[i], []);
      byPage.get(chosen[i]).push(g - lo);
    }
    base = hi;
  }
  picks = [];
  for (const p of [...byPage.keys()].sort((a, b) => a - b)) {
    const all = marksOf(p);
    for (const k of byPage.get(p).sort((a, b) => a - b)) picks.push(all[k]);
  }
  pagesDrawn = chosen.length;
}

if (!picks.length) {
  console.error("no marks selected");
  process.exit(2);
}

const skipped = [];

/**
 * Score every selected mark, optionally with a page-wide displacement applied
 * to the claim first.
 *
 * Run twice. The first pass asks what the boxes claim; the second asks what they
 * would claim if each page's whole-page displacement were taken out. Running it
 * twice rather than reasoning about the first pass's numbers is the difference
 * between predicting the correction would work and showing that it does.
 *
 * `onlyCorrected` drops any mark the correction has nothing to say about, rather
 * than scoring it uncorrected alongside the ones that moved. That is wrong for
 * the ordinary run — a handful of pages carry too few marks to be corrected at
 * all, and they are part of what ships — and it is the only honest thing to do
 * when the correction was deliberately kept away from half the marks, because
 * there the uncorrected ones are precisely the training set.
 */
function scoreAll(corrections, onlyCorrected = false, { radius = RADIUS, only = null } = {}) {
  const out = [];
  let lastPage = null;
  let ink = null;
  let pageMarks = null;
  const pick = rng(seed ^ 0x5bf03635);
  for (const m of picks) {
    if (m.page !== lastPage) {
      ink = readPageInk(readFileSync(join(PAGES, `${m.page}.svg`), "utf8"), 1 / (4 * RES));
      pageMarks = marksOf(m.page);
      lastPage = m.page;
    }
    // The swap control: a different mark's rectangle on the same page, of a
    // different name where one exists, chosen from the seeded stream so the
    // control is as reproducible as the sample.
    const pool = pageMarks.filter((o) => o.k !== m.k && o.name !== m.name);
    const other = pool.length ? pool[Math.floor(pick() * pool.length)] : null;
    const c = corrections?.get(`${m.page}:${m.k}`) ?? null;
    if (onlyCorrected && !c) continue;
    // Filtered here rather than at the top of the loop, so that the seeded draw
    // above has already happened. A second look at a subset then picks the same
    // swap control the first look picked, and its `nullPhi` stays comparable
    // with every row the first look produced.
    if (only && !only.has(`${m.page}:${m.k}`)) continue;
    const r = scoreMark(m, ink, lib, other, c, radius);
    if (r) out.push({ ...r, hafs: m.hafs, d: m.d, fit: m.fit });
    else if (!corrections) skipped.push(m);
  }
  return out;
}

/**
 * The first look, and then a second one for whatever it gave up on.
 *
 * The second look replaces a row only when it actually helps — it has to both
 * clear the floor and beat the overlap the first look managed. A wider search
 * cannot score worse at the same offset, so in practice this only refuses the
 * handful where a bigger window let the outline drift onto a neighbour and the
 * arithmetic still called it worse; keeping the test explicit means the pass can
 * never make a row worse than not running it at all.
 *
 * Rows the second look does not improve keep the first look's answer untouched,
 * pinned `dx, dy` and all. They are the marks that are genuinely hard, and their
 * refusal is the signal that says which ones are still worth a person's hour.
 */
const escalated = { looked: 0, took: 0 };

function lookAgain(rows) {
  if (!(ESCALATE > RADIUS)) return rows;
  const stuck = rows.filter((r) => refusedItsOwnInk(r, RADIUS, ESC_FLOOR));
  if (!stuck.length) return rows;
  escalated.looked = stuck.length;
  const only = new Set(stuck.map((r) => `${r.page}:${r.k}`));
  const wider = scoreAll(null, false, { radius: ESCALATE, only });
  const merged = withSecondLook(rows, wider, { radius: RADIUS, wide: ESCALATE, floor: ESC_FLOOR });
  escalated.took = merged.took;
  return merged.rows;
}

const raw = lookAgain(scoreAll(null));
if (escalated.looked) {
  console.error(
    `  second look at ±${ESCALATE}: ${escalated.looked} marks the first look gave up on, ` +
      `${escalated.took} placed from their own ink (${((100 * escalated.took) / escalated.looked).toFixed(0)}%)`,
  );
}

/**
 * Which grain the corrected pass is scored at, and the correction it applies.
 *
 * The page is the default because it is what ships, and because leaving it as
 * the default means the corrected numbers in every earlier run still mean the
 * same thing.
 *
 * The models themselves live in `lib/registration-grain.mjs` rather than here.
 * They are arithmetic on displacements the rasteriser has already measured, so a
 * search over grains can run in seconds outside this probe — and they are the
 * one part of this file whose answer can be checked against a corpus we built
 * ourselves, which is what `registration-grain.test.mjs` does. What cannot be
 * checked that way, and is why the winning grain still comes back through here,
 * is how much ink a rectangle covers once it has moved: overlap is not linear in
 * the displacement and cannot be predicted from it.
 */
const GRAIN = arg("--grain", "page");
if (!GRAINS.includes(GRAIN)) {
  console.error(`--grain must be ${GRAINS.join(", ")}; got ${GRAIN}`);
  process.exit(2);
}

/**
 * Whether the correction is allowed to see the marks it is then graded on.
 *
 * A correction is fitted to make the rectangles agree with the ink and is then
 * scored by how well the rectangles agree with the ink, so a model with more
 * parameters wins every time — including when what it is fitting is the noise in
 * this particular sample. There is exactly one way to tell those apart, and it
 * is to grade on marks the model never saw.
 *
 * Off by default, because the corrected block in every earlier run means "what
 * would these same marks look like if we corrected them", and quietly changing
 * what a printed number means is worse than making somebody ask for the other
 * one. On, it is the number to quote when comparing grains: a finer grain that
 * wins here has found something about the print, and a finer grain that wins
 * only with this off has found something about these marks.
 */
const SPLIT_HALF = process.argv.includes("--split-half");

const perPageShift = shiftsBy(raw, pageKey);
const corrections = new Map();
/** The fitted correction itself, kept so `--shift-out` can write it down. */
let fitted;
{
  const train = SPLIT_HALF ? raw.filter((r) => half(r) === 0) : raw;
  const graded = SPLIT_HALF ? raw.filter((r) => half(r) === 1) : raw;
  fitted = correctionFor(GRAIN, train, SPLIT_HALF ? SPLIT_FLOOR : FLOOR);
  for (const r of graded) {
    if (!perPageShift.has(r.page)) continue;
    const c = fitted.apply(r);
    corrections.set(`${r.page}:${r.k}`, { dx: c.dx, dy: c.dy, best: r.best });
  }
}

/**
 * What the fit between the two prints would have been if it had been fitted to
 * the ink instead of to the ornaments.
 *
 * The pinned transform is `ours = s · theirs + t`, four numbers a page, fitted
 * once against the marker shapes the two prints share. Every mark this probe
 * looked at is a second, independent observation of that same transform: the
 * rectangle says where the fit *thinks* the mark landed, and the search says
 * where it actually landed. Regressing the second on the first re-derives the
 * transform from a few hundred observations spread over the whole page rather
 * than from a handful of ornaments clustered on it.
 *
 * Reported, not applied. A whole-corpus read of it said the scale term is real
 * and worth about two per cent of the scatter it would have to remove, which is
 * how the search moved off the four-number family and onto the grain question
 * above — so this stays as evidence, and the correction that ships comes from
 * `correctionFor`.
 */
function refit(rs, fit) {
  // Back out the corpus-frame centre the pinned fit was applied to, then ask
  // what transform would have carried it to where the ink actually is.
  const theirsX = rs.map((r) => (r.box[0] + r.box[2] / 2 - fit.tx) / fit.sx);
  const theirsY = rs.map((r) => (r.box[1] + r.box[3] / 2 - fit.ty) / fit.sy);
  const oursX = rs.map((r, i) => fit.sx * theirsX[i] + fit.tx + r.dx);
  const oursY = rs.map((r, i) => fit.sy * theirsY[i] + fit.ty + r.dy);
  const fx = fitLine(theirsX, oursX);
  const fy = fitLine(theirsY, oursY);
  return {
    n: rs.length,
    sx: fx.a,
    tx: fx.b,
    sy: fy.a,
    ty: fy.b,
    dsx: fx.a - fit.sx,
    dtx: fx.b - fit.tx,
    dsy: fy.a - fit.sy,
    dty: fy.b - fit.ty,
    residX: fx.sd,
    residY: fy.sd,
  };
}

const fixed = corrections.size ? scoreAll(corrections, SPLIT_HALF) : raw;

// Everything below reports the boxes as they are. The corrected pass is
// reported alongside it, never instead of it: what ships today is the first
// number, and the second is what a change would buy.
const rows = raw;

/**
 * Every scored mark, one row, for a grain search to be run outside this script.
 *
 * Searching for the right grain does not need the rasteriser. A correction moves
 * the rectangle, and `dx, dy` already says where the ink is relative to where the
 * rectangle claims to be — so the residual under any candidate correction is
 * arithmetic on these rows, and a search over grains costs seconds instead of a
 * pass a rung. The winning grain still comes back through `scoreAll`, which is
 * the only thing that reports overlap, because overlap is not linear in the
 * displacement and cannot be predicted from it.
 *
 * Off by default and written only where asked. It carries no text: page, mark,
 * printed line, the mark's own name, the rectangle, and numbers.
 */
const rowsOut = arg("--rows-out", null);
if (rowsOut) {
  writeFileSync(
    rowsOut,
    JSON.stringify(
      rows.map((r) => ({
        page: r.page,
        k: r.k,
        line: r.line,
        name: r.name,
        box: r.box,
        ink: r.ink,
        dx: r.dx,
        dy: r.dy,
        iou0: r.iou0,
        iouBest: r.iouBest,
        phi0: r.phi0,
        nullPhi: r.nullPhi,
        searchedAt: r.searchedAt,
      })),
    ),
  );
}

// ------------------------------------------------------------ aggregation --

/**
 * The thresholds, and where each one comes from.
 *
 * `EMPTY` — a rectangle with under two percent of its area inked. Inherited from
 * the first look at this so the two numbers can be compared; it is a
 * "there is nothing here at all" test, not a quality bar.
 *
 * `OFF` — how far the best placement may sit from the claimed one. Built from an
 * error budget rather than chosen: the per-page fits recorded alongside the word
 * boxes have residuals up to 0.46 page units, both rectangles are rounded to a
 * tenth so each edge can move 0.05, and one raster sample is 1/16 of a unit.
 * That is 0.46 + 0.10 + 0.06 ≈ 0.62 units of movement that means nothing.
 * Rounded up to **0.75**, which is under a quarter of the median mark's width
 * and well under the distance to the next letter.
 *
 * `SEP` — how far the true placement must beat the best deliberately-wrong one
 * before the run is worth reading at all.
 */
const EMPTY = 0.02;
const OFF = Number(arg("--max-off", 0.75));
const SEP = Number(arg("--min-separation", 0.25));

const nAll = rows.length;
const empties = rows.filter((r) => r.ink < EMPTY);
const placed = rows.filter((r) => r.ink >= EMPTY);
const shifted = placed.filter((r) => r.off > OFF);

const sep = mean(rows.map((r) => r.phi0 - r.nullPhi));
const truePhi = rows.map((r) => r.phi0);
const nullPhi = rows.map((r) => r.nullPhi);

const pct = (k, n) => (n ? (100 * k) / n : 0);
const ci = (k, n) => wilson(k, n).map((v) => 100 * v);

/** Per drawn name: how many, how empty, how far off, and in which direction. */
const byName = new Map();
for (const r of rows) {
  if (!byName.has(r.name)) byName.set(r.name, []);
  byName.get(r.name).push(r);
}

// ------------------------------ do the two printings disagree anywhere? --

/**
 * Whether each sampled mark's *drawing* matches its *name*, decided without the
 * shipped page.
 *
 * This is not a result of this probe and is not reported as one; it is a filter.
 * A mark whose own corpus drawing does not match its own corpus name is already
 * a question for `probe-mark-labels.mjs`, and asking what the shipped ink looks
 * like at that spot would produce a second, dependent copy of the same doubt.
 */
const labelVerdict = new Map();
for (const m of picks) {
  const v = labelOf(m.d, m.name);
  if (v) labelVerdict.set(`${m.page}:${m.k}`, v);
}

/**
 * The marks on which the shipped ink is allowed to be asked what it looks like.
 *
 * Four conditions, and every one of them exists to stop a different thing being
 * counted as a disagreement between the two printings:
 *
 * - **there is ink there at all** — nothing to look at otherwise.
 * - **the rectangle is where the mark is** — an identity score on a rectangle a
 *   unit low is scoring partly the letter underneath, which is exactly what
 *   makes a fatha "look like" something else. This is the condition that made
 *   the earlier merged number meaningless.
 * - **the placement beat a deliberately wrong one** — if it did not, the score
 *   is not about this mark.
 * - **the drawing already matches its own name** — otherwise the doubt is about
 *   the label, and belongs to the other probe.
 *
 * How many were dropped for each is reported, because a filtered rate whose
 * filter is not published is a rate somebody chose.
 */
const excluded = { blank: 0, displaced: 0, notSeparated: 0, labelInQuestion: 0 };
const eligible = [];
for (const r of fixed) {
  const key = `${r.page}:${r.k}`;
  const lv = labelVerdict.get(key);
  if (r.ink < EMPTY) excluded.blank += 1;
  else if (r.off > OFF) excluded.displaced += 1;
  else if (r.phi0 - r.nullPhi < SEP) excluded.notSeparated += 1;
  else if (!lv || lv.verdict !== "agrees") excluded.labelInQuestion += 1;
  else eligible.push(r);
}

/**
 * Three counts on that set, never summed.
 *
 * The third is the only one that is news, and it is news of a particular kind:
 * the corpus drew a mark, named it, and the app ships a page whose ink at the
 * same place looks like a different mark of a different shape. That is the two
 * printings genuinely differing, and it is a more serious thing than either a
 * displacement or a look-alike, which is why it gets its own count, its own
 * list and its own section of the evidence page.
 */
const inkSame = eligible.filter((r) => r.saw === r.name);
const inkTwin = eligible.filter((r) => r.saw !== r.name && SHAPES.groupOf(r.saw) === SHAPES.groupOf(r.name));
const inkDiff = eligible.filter((r) => SHAPES.groupOf(r.saw) !== SHAPES.groupOf(r.name));
// A disagreement that does not survive being scored at the placement the search
// itself preferred is a disagreement about a sixteenth of a unit, not about a
// mark. Kept separately rather than filtered out, so the count is visible.
const inkDiffHeld = inkDiff.filter((r) => SHAPES.groupOf(r.sawShift) !== SHAPES.groupOf(r.name));

const report = {
  ran: new Date().toISOString().slice(0, 10),
  res: RES,
  radius: RADIUS,
  // Which grain the `corrected` block below was scored at. Without it, two runs
  // of this script produce the same field names for two different models.
  grain: GRAIN,
  splitHalf: SPLIT_HALF,
  seed: pageArg ? null : seed,
  pages: [...new Set(rows.map((r) => r.page))].length,
  pagesDrawn,
  population,
  scored: nAll,
  skipped: skipped.length,
  ms: Date.now() - t0,
  control: {
    truePhiMean: mean(truePhi),
    truePhiSd: sd(truePhi),
    nullPhiMean: mean(nullPhi),
    nullPhiSd: sd(nullPhi),
    separation: sep,
    beatsNull: rows.filter((r) => r.phi0 > r.nullPhi).length,
  },
  registration: {
    empty: empties.length,
    emptyPct: pct(empties.length, nAll),
    emptyCi: ci(empties.length, nAll),
    shifted: shifted.length,
    shiftedPct: pct(shifted.length, placed.length),
    shiftedCi: ci(shifted.length, placed.length),
    offP50: q(placed.map((r) => r.off), 0.5),
    offP95: q(placed.map((r) => r.off), 0.95),
    dxMean: mean(placed.map((r) => r.dx)),
    dyMean: mean(placed.map((r) => r.dy)),
    dxSd: sd(placed.map((r) => r.dx)),
    dySd: sd(placed.map((r) => r.dy)),
    iou0P50: q(rows.map((r) => r.iou0), 0.5),
    iouBestP50: q(rows.map((r) => r.iouBest), 0.5),
  },
  /**
   * Not "identity". This is one question and it is a narrow one: on the marks
   * where the rectangle is demonstrably in the right place and the drawing
   * demonstrably matches its own name, does the *other* printing's ink at that
   * spot look like the same mark?
   *
   * There is deliberately no rate here that mixes this with anything else. The
   * earlier version of this script reported a single "identity" percentage over
   * every mark, which stacked a displacement, a look-alike and a genuine
   * difference into one number — and produced a headline that moved eighteen
   * points depending on which of the three you decided to forgive.
   */
  betweenPrints: {
    eligible: eligible.length,
    excluded,
    same: inkSame.length,
    samePct: pct(inkSame.length, eligible.length),
    sameCi: ci(inkSame.length, eligible.length),
    twin: inkTwin.length,
    twinPct: pct(inkTwin.length, eligible.length),
    twinCi: ci(inkTwin.length, eligible.length),
    differ: inkDiff.length,
    differPct: pct(inkDiff.length, eligible.length),
    differCi: ci(inkDiff.length, eligible.length),
    differHeld: inkDiffHeld.length,
    groups: SHAPES.groups,
    groupThreshold: TWIN,
    // Survivors of re-placement first, then by margin. Sorting by margin alone
    // put the only mark that could actually be a difference between the two
    // printings at position 38 of 111, underneath a hundred near-misses.
    worst: inkDiff
      .slice()
      .sort(
        (a, b) =>
          (SHAPES.groupOf(a.sawShift) !== SHAPES.groupOf(a.name) ? 0 : 1) -
            (SHAPES.groupOf(b.sawShift) !== SHAPES.groupOf(b.name) ? 0 : 1) ||
          b.sawPhi - b.minePhi - (a.sawPhi - a.minePhi),
      )
      .slice(0, 40)
      .map((r) => ({
        page: r.page,
        k: r.k,
        name: r.name,
        saw: r.saw,
        sawPhi: r.sawPhi,
        minePhi: r.minePhi,
        sawShift: r.sawShift,
        held: SHAPES.groupOf(r.sawShift) !== SHAPES.groupOf(r.name),
        off: r.off,
        separation: r.phi0 - r.nullPhi,
      })),
  },
  perName: [...byName.entries()]
    .map(([name, rs]) => ({
      name,
      n: rs.length,
      empty: rs.filter((r) => r.ink < EMPTY).length,
      emptyPct: pct(rs.filter((r) => r.ink < EMPTY).length, rs.length),
      emptyCi: ci(rs.filter((r) => r.ink < EMPTY).length, rs.length),
      dxMean: mean(rs.map((r) => r.dx)),
      dyMean: mean(rs.map((r) => r.dy)),
      dySe: sd(rs.map((r) => r.dy)) / Math.sqrt(Math.max(1, rs.length)),
      dxSe: sd(rs.map((r) => r.dx)) / Math.sqrt(Math.max(1, rs.length)),
      offP95: q(rs.map((r) => r.off), 0.95),
      phi0: mean(rs.map((r) => r.phi0)),
    }))
    .sort((a, b) => b.n - a.n),
  /**
   * The same displacement, split by page rather than by name.
   *
   * Which is the split that tells the two error sources apart. A mark-level
   * fault is a mark drawn in the wrong place, and its displacement has no reason
   * to agree with the mark beside it. A page-level fault is the *fit* between
   * the two prints being wrong, and every mark on that page moves together. So a
   * per-page mean that is large and a per-page spread that is small is not 500
   * bad marks — it is one bad number, and it is correctable.
   */
  perPage: [...new Set(rows.map((r) => r.page))]
    .sort((a, b) => a - b)
    .map((p) => {
      const rs = rows.filter((r) => r.page === p && r.ink >= EMPTY);
      const all = rows.filter((r) => r.page === p);
      const fit = PIN.pages.find((r) => r.page === p);
      return {
        page: p,
        n: all.length,
        dxMean: mean(rs.map((r) => r.dx)),
        dyMean: mean(rs.map((r) => r.dy)),
        dxSd: sd(rs.map((r) => r.dx)),
        dySd: sd(rs.map((r) => r.dy)),
        iou0: q(all.map((r) => r.iou0), 0.5),
        iouBest: q(all.map((r) => r.iouBest), 0.5),
        // What the fit's own recorded residual said about this page, so the two
        // opinions of the same fit sit in one row.
        residual: fit.residual,
        refit: rs.length >= 20 ? refit(rs, fit) : null,
      };
    }),
  needed: {
    forOnePercent: sampleSizeFor(0.02, 0.005, 326515),
    forTenth: sampleSizeFor(0.02, 0.001, 326515),
  },
  /**
   * The same measurements again, after each page's whole-page displacement has
   * been taken out of the claim.
   *
   * This is the part that separates a fault in 326,515 rectangles from a fault
   * in 604 numbers. If the corrected numbers are good, then the rectangles were
   * never wrong about which mark is where — the fit that carried them onto the
   * page was wrong about where the page is, once per page, and it is one
   * subtraction to put right.
   */
  corrected: corrections.size
    ? {
        pagesShifted: perPageShift.size,
        shiftDx: mean([...perPageShift.values()].map((s) => s.dx)),
        shiftDy: mean([...perPageShift.values()].map((s) => s.dy)),
        truePhiMean: mean(fixed.map((r) => r.phi0)),
        nullPhiMean: mean(fixed.map((r) => r.nullPhi)),
        separation: mean(fixed.map((r) => r.phi0 - r.nullPhi)),
        beatsNull: fixed.filter((r) => r.phi0 > r.nullPhi).length,
        empty: fixed.filter((r) => r.ink < EMPTY).length,
        emptyPct: pct(fixed.filter((r) => r.ink < EMPTY).length, fixed.length),
        emptyCi: ci(fixed.filter((r) => r.ink < EMPTY).length, fixed.length),
        shifted: fixed.filter((r) => r.ink >= EMPTY && r.off > OFF).length,
        shiftedPct: pct(
          fixed.filter((r) => r.ink >= EMPTY && r.off > OFF).length,
          fixed.filter((r) => r.ink >= EMPTY).length,
        ),
        shiftedCi: ci(
          fixed.filter((r) => r.ink >= EMPTY && r.off > OFF).length,
          fixed.filter((r) => r.ink >= EMPTY).length,
        ),
        offP50: q(fixed.filter((r) => r.ink >= EMPTY).map((r) => r.off), 0.5),
        offP95: q(fixed.filter((r) => r.ink >= EMPTY).map((r) => r.off), 0.95),
        dxSd: sd(fixed.filter((r) => r.ink >= EMPTY).map((r) => r.dx)),
        dySd: sd(fixed.filter((r) => r.ink >= EMPTY).map((r) => r.dy)),
        iou0P50: q(fixed.map((r) => r.iou0), 0.5),
        inkMean: mean(fixed.map((r) => r.ink)),
        // No identity rate here. Whether the ink matches the label is asked
        // once, on the marks where the rectangle has been shown to be in the
        // right place, and it is reported in its own section rather than as a
        // percentage of everything scored.
        perName: [...new Set(fixed.map((r) => r.name))]
          .map((name) => {
            const rs = fixed.filter((r) => r.name === name);
            return {
              name,
              n: rs.length,
              emptyPct: pct(rs.filter((r) => r.ink < EMPTY).length, rs.length),
              dxMean: mean(rs.map((r) => r.dx)),
              dyMean: mean(rs.map((r) => r.dy)),
              dySe: sd(rs.map((r) => r.dy)) / Math.sqrt(Math.max(1, rs.length)),
              dxSe: sd(rs.map((r) => r.dx)) / Math.sqrt(Math.max(1, rs.length)),
              offP95: q(rs.map((r) => r.off), 0.95),
              phi0: mean(rs.map((r) => r.phi0)),
            };
          })
          .sort((a, b) => b.n - a.n),
      }
    : null,
};

// ---------------------------------------------------------- the surface --

/**
 * The evidence for one verdict, drawn at a size a person can judge.
 *
 * Not a picture of a picture: the rings are the shipped page's own outlines,
 * clipped to the neighbourhood and re-emitted as straight segments at the same
 * flatness the measurement used. So what a reader sees is the thing that was
 * measured, and if they disagree with the verdict they are disagreeing with the
 * measurement rather than with a rendering of it.
 */
function crop(r, shapes, viewport) {
  const [x, y, w, h] = r.box;
  const pad = Math.max(3, w * 0.6);
  const vx = x - pad;
  const vy = y - pad;
  const vw = w + 2 * pad;
  const vh = h + 2 * pad;
  const n2 = (v) => Math.round(v * 100) / 100;
  const parts = [];
  for (const s of shapes) {
    const ds = [];
    for (const ring of s.rings) {
      let inX = false;
      let inY = false;
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
      inX = hi >= vx && lo <= vx + vw;
      inY = hiy >= vy && loy <= vy + vh;
      if (!inX || !inY) continue;
      let d = `M${n2(ring[0])} ${n2(ring[1])}`;
      for (let i = 2; i < ring.length; i += 2) d += `L${n2(ring[i])} ${n2(ring[i + 1])}`;
      ds.push(`${d}Z`);
    }
    if (ds.length) parts.push(`<path d="${ds.join("")}" fill="#231f20" fill-rule="${s.fillRule}"/>`);
  }
  const tr = outlineRings(r.d, r.fit.sx, r.fit.sy, r.fit.tx, r.fit.ty);
  const td = tr
    .map((ring) => {
      let d = `M${n2(ring[0])} ${n2(ring[1])}`;
      for (let i = 2; i < ring.length; i += 2) d += `L${n2(ring[i])} ${n2(ring[i + 1])}`;
      return `${d}Z`;
    })
    .join("");
  return (
    `<svg viewBox="${n2(vx)} ${n2(vy)} ${n2(vw)} ${n2(vh)}" width="${viewport}" height="${Math.round((viewport * vh) / vw)}">` +
    `<rect x="${n2(vx)}" y="${n2(vy)}" width="${n2(vw)}" height="${n2(vh)}" fill="#fff"/>` +
    parts.join("") +
    `<path d="${td}" fill="none" stroke="#0a7" stroke-width="${n2(vw / 260)}"/>` +
    `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="none" stroke="#d33" stroke-width="${n2(vw / 300)}"/>` +
    (Math.abs(r.dx) + Math.abs(r.dy) > 0
      ? `<rect x="${n2(x + r.dx)}" y="${n2(y + r.dy)}" width="${n2(w)}" height="${n2(h)}" fill="none" stroke="#36c" stroke-width="${n2(vw / 400)}" stroke-dasharray="${n2(vw / 90)}"/>`
      : "") +
    "</svg>"
  );
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

/**
 * One card, and it answers exactly one question: is the rectangle on the mark?
 *
 * There used to be a line on here reading "ink looks like …", and it made the
 * page unusable for the question the page exists for. A reader working down a
 * list sorted by placement kept meeting a purple verdict about a name, decided
 * the two were the same kind of complaint, and stopped reading either carefully.
 * The name question has a page of its own now, drawn differently, and this one
 * has three verdicts, all of them about position.
 */
function card(r, i, inks, prefix) {
  const verdict = r.ink < EMPTY ? "empty" : r.off > OFF ? "shifted" : "ok";
  return `<article class="card ${verdict}" id="${prefix}${r.page}-${r.k}" data-name="${esc(r.name)}" data-page="${r.page}" data-verdict="${verdict}">
<header><b>#${i + 1}</b> <span class="v">${verdict}</span> <code>p${r.page} · ${r.surah}:${r.aya} word ${r.idx} · mark ${r.k}</code></header>
${crop(r, inks.get(r.page).shapes, 300)}
<dl><dt>labelled</dt><dd><b>${esc(r.name)}</b></dd>
<dt>agreement here</dt><dd>${r.phi0.toFixed(3)} &nbsp; <small>overlap ${r.iou0.toFixed(3)}, ink ${(100 * r.ink).toFixed(1)}%</small></dd>
<dt>best nearby</dt><dd>${r.phiBest.toFixed(3)} at ${r.dx >= 0 ? "+" : ""}${r.dx.toFixed(2)}, ${r.dy >= 0 ? "+" : ""}${r.dy.toFixed(2)} units <small>(${r.off.toFixed(2)} away)</small></dd>
<dt>a wrong place scores</dt><dd>${r.nullPhi.toFixed(3)} <small>(margin ${(r.phi0 - r.nullPhi).toFixed(3)})</small></dd></dl></article>`;
}

/**
 * The one place on this page where a name is mentioned, kept apart from
 * everything above it and reachable only after the position question has been
 * answered for that mark.
 */
function differCard(r, i, inks) {
  const held = SHAPES.groupOf(r.sawShift) !== SHAPES.groupOf(r.name);
  return `<article class="card differ" id="x${r.page}-${r.k}" data-name="${esc(r.name)}" data-page="${r.page}">
<header><b>#${i + 1}</b> <span class="v">the two prints differ</span> <code>p${r.page} · ${r.surah}:${r.aya} word ${r.idx} · mark ${r.k}</code></header>
${crop(r, inks.get(r.page).shapes, 300)}
<dl><dt>the corpus drew, and named</dt><dd><b>${esc(r.name)}</b> <small>(and the drawing matches that name)</small></dd>
<dt>the shipped ink looks like</dt><dd><b>${esc(r.saw)}</b> <small>${r.sawPhi.toFixed(3)} against ${r.minePhi.toFixed(3)} for the name it was given</small></dd>
<dt>and the rectangle is on it</dt><dd>${r.off.toFixed(2)} units from where it fits best, ${(r.phi0 - r.nullPhi).toFixed(3)} clear of a wrong place</dd>
<dt>still differs at the best fit</dt><dd>${held ? `<b>yes</b> — still ${esc(r.sawShift)} once moved` : `no — ${r.sawShift === r.name ? "it agrees" : `it becomes ${esc(r.sawShift)}, inside the name's own shape group`} once moved, so this is the last fraction of a unit of placement and not the two printings differing`}</dd></dl></article>`;
}

function surface() {
  const worstOf = (list, n) => [...list].sort((a, b) => a.phi0 - a.nullPhi - (b.phi0 - b.nullPhi)).slice(0, n);
  const before = worstOf(rows, Math.min(12, rows.length));
  const after = worstOf(fixed, crops);
  const inks = new Map();
  for (const p of new Set([...before, ...after, ...inkDiff].map((r) => r.page))) {
    inks.set(p, readPageInk(readFileSync(join(PAGES, `${p}.svg`), "utf8"), 1 / (4 * RES)));
  }
  const cards = after.map((r, i) => card(r, i, inks, "m")).join("\n");
  const shipped = before.map((r, i) => card(r, i, inks, "b")).join("\n");
  // The ones that survive re-placement first: they are the only rows on this
  // page that could be two printings genuinely differing, and burying them
  // among a hundred near-misses sorted by margin would hide the finding inside
  // its own evidence.
  const heldFirst = (r) => (SHAPES.groupOf(r.sawShift) !== SHAPES.groupOf(r.name) ? 0 : 1);
  const differs = inkDiff
    .slice()
    .sort((a, b) => heldFirst(a) - heldFirst(b) || b.sawPhi - b.minePhi - (a.sawPhi - a.minePhi))
    .map((r, i) => differCard(r, i, inks))
    .join("\n");
  const names = [...new Set(rows.map((r) => r.name))].sort();
  const c = report.corrected;
  return `<!doctype html><meta charset="utf-8"><title>Hifth — is the mark under the box? — ${report.ran}</title>
<style>
:root{color-scheme:light dark}
body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;max-width:1400px}
h1{font-size:20px;margin:0 0 4px}
h2{font-size:16px;margin:26px 0 8px}
.lede{border-left:3px solid #d33;padding-left:14px;margin:0 0 24px}
.lede p{max-width:60em}
.ask{border:1px solid #8886;border-radius:10px;padding:4px 18px 14px;margin:0 0 24px;max-width:62em;background:#8881}
.ask h2{margin:16px 0 6px}
.ask h2:first-of-type{margin-top:14px}
.ask p,.ask ul{margin:0}
.ask ul{padding-left:20px}
.ask li{margin:4px 0}
.strip{margin:12px 0}
.sub{color:#777;margin:0 0 18px}
.key{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 18px;padding:12px;border:1px solid #8884;border-radius:8px}
.key span{display:flex;align-items:center;gap:6px}
.sw{width:22px;height:12px;border-width:2px;border-style:solid}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.card{border:1px solid #8884;border-radius:8px;padding:10px;background:#fff2}
.card header{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
.card code{color:#777;font-size:12px}
.card svg{display:block;border:1px solid #8882;background:#fff;width:100%;height:auto}
.v{font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.06em}
.ok .v{color:#0a7}.shifted .v{color:#c80}.empty .v{color:#d33}.differ .v{color:#95c}
.differ{border-color:#95c8}
dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:8px 0 0;font-size:12.5px}
dt{color:#777}dd{margin:0}
small{color:#888}
.note{max-width:62em;color:#666;border-left:3px solid #8884;padding-left:12px}
.filters{margin:0 0 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
select,input{font:inherit;padding:3px 6px}
</style>
<h1>Is the mark under the box?</h1>
<p class="sub">${nAll} marks scored${population ? ` from a seeded sample of ${population.toLocaleString()}` : ""} · generated ${report.ran}</p>
<section class="ask">
<h2>What is being decided on this page?</h2>
<p>Whether the rectangle this app holds for each mark is in the right place — and if it is not,
whether to correct it and how. Nothing draws a mark today, so nothing is broken for a reader right
now. What it costs to leave is that the first feature to point at a mark points slightly off, which
is the failure a reader trusts rather than notices.</p>
<h2>What does the measurement say?</h2>
<p>The rectangles are not scattered — they are displaced together, on all but a handful of pages, by
very nearly the same amount. A rectangle agrees with the ink underneath it
<b>${report.control.truePhiMean.toFixed(3)}</b> where it claims to be, against
<b>${report.control.nullPhiMean.toFixed(3)}</b> at a deliberately wrong place on the same page: a separation of
<b>${report.control.separation.toFixed(3)}</b>, where this method needs at least ${SEP} before any other number on the
page means anything. Those two are agreement scores rather than percentages — only the gap between them
carries the meaning, and it is the gap that has to be positive.${
    report.control.separation < SEP
      ? " It does not clear its own control, which is the finding: a rectangle taken from elsewhere describes the ink about as well as the right one does."
      : ""
  } ${report.registration.shiftedPct.toFixed(2)}% of rectangles sit further than ${OFF} units from where their own ink is.</p>
<h2>What are the choices?</h2>
<ul>
<li><b>Leave the rectangles alone and never draw a mark.</b> Costs nothing today and makes the mark
layer permanently unusable for pointing at anything.</li>
<li><b>Record one displacement per page, measured from the ink</b> — recommended.${
    c
      ? ` Two numbers per page, derived offline and reproducibly, and the overlap between rectangle and ink
moves from <b>${report.registration.iou0P50.toFixed(3)}</b> to <b>${c.iou0P50.toFixed(3)}</b>, blank rectangles from
${report.registration.emptyPct.toFixed(2)}% to <b>${c.emptyPct.toFixed(2)}%</b>, and badly-placed ones from
${report.registration.shiftedPct.toFixed(1)}% to <b>${c.shiftedPct.toFixed(1)}%</b>.`
      : ""
  } The correction is read from a file thereafter, never re-fitted where it is used.</li>
<li><b>Re-derive the whole fit from the ink, scale and all.</b> It works, and it buys about two
hundredths of a unit over a shift alone — in exchange for discarding a fit that is already checked.
Rejected on the evidence rather than on principle.</li>
</ul>
<h2>What is left for a person to do?</h2>
<p>Look at a sample of the cards below and say whether the machine's verdicts are the ones you would
have given. Until somebody has, this measurement stays a report and does not become a check that can
fail a build — that ordering is deliberate.</p>
</section>
<div class="key">
<span><i class="sw" style="border-color:#d33"></i> the rectangle we claim</span>
<span><i class="sw" style="border-color:#0a7"></i> the outline the other print drew</span>
<span><i class="sw" style="border-color:#36c;border-style:dashed"></i> where it fits best</span>
<span>black is the ink this app actually ships</span>
</div>
${
  c
    ? `<section class="lede"><h2>Every rectangle on a page is wrong by the same amount</h2>
<p>The rectangles are not scattered. On all but the opening pages they sit together, about
<b>${Math.abs(c.shiftDx).toFixed(2)} units too far ${c.shiftDx < 0 ? "right" : "left"} and ${Math.abs(c.shiftDy).toFixed(2)} units too far ${c.shiftDy < 0 ? "down" : "up"}</b>
— which on a page ${Math.round(345)} units wide is about a fifth of a line's height. Below, the twelve worst as
they ship. Their outlines are the right shape and the right size; they are in the wrong place, and every
one of them is in the <em>same</em> wrong place.</p>
<div class="grid strip">${shipped}</div>
<p>Taking each page's own displacement out — one subtraction per page, ${c.pagesShifted} numbers in total —
moves the overlap between rectangle and ink from <b>${report.registration.iou0P50.toFixed(3)}</b> to
<b>${c.iou0P50.toFixed(3)}</b>, and the share of rectangles further than ${OFF} units from where they fit best from
<b>${report.registration.shiftedPct.toFixed(1)}%</b> to <b>${c.shiftedPct.toFixed(1)}%</b>. Everything below is what is
left <em>after</em> that correction: the marks a single number per page does not explain.</p></section>`
    : ""
}
<p class="note">This page answers one question: <b>is the rectangle on the mark?</b> Whether a mark's drawing
matches the name it was given is a different question with a different answer, and it has
<a href="mark-labels.html">a page of its own</a> —
it is asked without the shipped print, the fitted transform or any rectangle in the arithmetic, so that the
displacement measured here cannot reach it.</p>
<h2>What is left, worst first</h2>
<div class="filters">
<label>name <select id="fname"><option value="">all</option>${names.map((n) => `<option>${esc(n)}</option>`).join("")}</select></label>
<label>verdict <select id="fverdict"><option value="">all</option><option>ok</option><option>shifted</option><option>empty</option></select></label>
<label>page <input id="fpage" size="5" placeholder="any"></label>
<span id="count"></span>
</div>
<div class="grid" id="grid">
${cards}
</div>
<h2>And separately: where the two printings disagree</h2>
<p class="note">A different list, and deliberately not merged into the one above. Every mark here has already
passed the placement question — there is ink, the rectangle is on it, and it beats a deliberately wrong
placement — <em>and</em> its own drawing matches its own name. What is left is that the page this app ships
has, at that spot, ink resembling a mark of a different shape. ${inkDiff.length ? `There ${inkDiff.length === 1 ? "is one" : `are ${inkDiff.length}`} of them, out of ${eligible.length.toLocaleString()} marks that got this far — and ${inkDiffHeld.length === 0 ? "<strong>none of them survives</strong>" : `<strong>${inkDiffHeld.length}</strong> survive${inkDiffHeld.length === 1 ? "s" : ""}`} being scored again at the placement the search itself preferred. Read that as the size of the finding: the rest are a fraction of a unit of leftover placement, not two printings drawing different marks.` : `There are none, out of ${eligible.length.toLocaleString()} marks that got this far — which is the result, not an empty section.`}</p>
${inkDiff.length ? `<div class="grid">${differs}</div>` : ""}
<script>
const cards=[...document.querySelectorAll("#grid .card")];
const f=()=>{
  const n=fname.value,v=fverdict.value,p=fpage.value.trim();
  let k=0;
  for(const c of cards){
    const on=(!n||c.dataset.name===n)&&(!v||c.dataset.verdict===v)&&(!p||c.dataset.page===p);
    c.hidden=!on; if(on)k++;
  }
  count.textContent=k+" shown";
};
for(const el of [fname,fverdict,fpage]) el.addEventListener("input",f);
f();
if(location.hash) document.querySelector(location.hash)?.scrollIntoView();
</script>`;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, surface());

/**
 * The correction itself, written down on its own.
 *
 * It is buried in the report otherwise, and it is the one thing here another
 * tool needs: the adjudication page draws these very numbers for a person to
 * judge, and it must draw the *same* numbers this run measured rather than
 * numbers it derived a second time. Writing them out once is also what the
 * recommended option amounts to — this file is that option's shape, produced
 * here so it can be looked at before anybody agrees to ship it.
 *
 * It lands beside the evidence page, which is not checked in. Nothing reads it
 * at build time and nothing in the app knows it exists.
 *
 * `coverage` is the field to read before any of the numbers under it. This file
 * describes a SAMPLE of pages: `--sample` sets how many marks are drawn and
 * `minMarksPerPage` throws away any page that got too few to fit, so a row here
 * means "measured" and a page with no row means "never looked at". The default
 * run reaches forty of six hundred and four, and until this field existed
 * nothing downstream could tell — which mattered more than it sounds, because
 * a by-eye trial can only be built for a page that HAS a proposed move, so both
 * sessions asked their questions exclusively about the pages the correction was
 * already fitted to. A reader of this file should be able to see that without
 * being told.
 *
 * `shifts` is always the per-page median and always means the same thing, so a
 * run at any grain still writes the file the two by-eye scorers already read.
 * A run at a FINER grain adds `perLine` beside it, and that block is the whole
 * point of measuring a grain at all: the per-page family was measured to be
 * exhausted, so whatever ships is a table the four pinned numbers cannot hold,
 * and a table nobody wrote down is a finding rather than a correction. It is
 * additive on purpose — a page-grain run writes byte-identical output to the
 * one before this field existed, which is what keeps the committed rulings and
 * their fingerprints valid.
 *
 * The two grains store different things because they ARE different things. A
 * per-line grain stores one displacement a line, on top of its page's. A tilted
 * one stores a line through the marks of that line, so it needs two numbers an
 * axis — read them as `dx = ax·cx + bx`, where `cx` is the centre of the mark
 * across the page, which is the whole reason the model exists: a difference in
 * glyph advances accumulates ALONG a line rather than sitting constant on it.
 */
const MUSHAF_PAGES = 604;

/**
 * The finer-than-a-page half of the correction, or nothing at all.
 *
 * Spread into the object below, so a page-grain run adds no key and the file
 * stays what it was. `fitted.lines` is keyed `page:line` by the model, and it
 * is unpacked back into two fields here rather than shipped as a joined string,
 * because whatever reads this has a page and a line and should not have to
 * know how this file happened to spell them together.
 */
function finerGrain() {
  if (GRAIN === "page" || !fitted?.lines?.size) return {};
  const rows = [...fitted.lines.entries()]
    .map(([k, v]) => {
      const [page, line] = k.split(":").map(Number);
      return { page, line, v };
    })
    .sort((a, b) => a.page - b.page || a.line - b.line);
  return {
    grain: GRAIN,
    perLine: {
      how:
        GRAIN === "line"
          ? "one further displacement for every printed line, applied ON TOP of that page's row above"
          : "a straight line through the marks of one printed line, applied ON TOP of that page's row above: dx = ax·cx + bx, where cx is the centre of the mark across the page",
      floor: SPLIT_HALF ? SPLIT_FLOOR : FLOOR,
      note: "a line with no row here was not measured; leave it on its page's displacement rather than guessing one",
      lines:
        GRAIN === "line"
          ? rows.map(({ page, line, v }) => ({
              page,
              line,
              dx: Number(v.dx.toFixed(4)),
              dy: Number(v.dy.toFixed(4)),
              n: v.n,
            }))
          : rows.map(({ page, line, v }) => ({
              page,
              line,
              ax: Number(v.x.a.toFixed(6)),
              bx: Number(v.x.b.toFixed(4)),
              ay: Number(v.y.a.toFixed(6)),
              by: Number(v.y.b.toFixed(4)),
            })),
    },
  };
}

const SHIFT_OUT = arg("--shift-out", join(dirname(outPath), "mark-shift.json"));
writeFileSync(
  SHIFT_OUT,
  `${JSON.stringify(
    {
      ran: report.ran,
      from: "probe-mark-ink.mjs",
      how: "the median displacement of that page's marks, measured against the ink the app ships",
      units: "page units of the shipped page frame; add these to a claimed rectangle to correct it",
      seed,
      sampled: nAll,
      minMarksPerPage: 20,
      coverage: {
        measured: perPageShift.size,
        ofMushaf: MUSHAF_PAGES,
        pct: Number(((100 * perPageShift.size) / MUSHAF_PAGES).toFixed(1)),
        pagesOpened: pagesDrawn ?? report.pages,
        pagesInCache: cached.length,
        note: "a page with no row below has no measured correction; it was not looked at, not found to be right",
      },
      shifts: [...perPageShift.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([page, s]) => ({ page, dx: Number(s.dx.toFixed(4)), dy: Number(s.dy.toFixed(4)), n: s.n })),
      ...finerGrain(),
    },
    null,
    2,
  )}\n`,
);

// ---------------------------------------------------------------- output --

if (wantJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const f = (v, n = 2) => v.toFixed(n);
  const L = [];
  L.push(`probe:mark-ink — ${nAll} marks on ${report.pages} pages, ${RES} samples per page unit, ${report.ms} ms`);
  if (population) {
    L.push(
      `  seed ${seed}: ${pagesDrawn} pages drawn at random from the ${cached.length} in the cache, ` +
        `then ${nAll} marks drawn from the ${population.toLocaleString()} on them`,
    );
  }
  L.push("");
  L.push("① IS THE MEASURE MEASURING ANYTHING — the control");
  L.push(`  agreement where the box claims to be      ${f(report.control.truePhiMean, 3)} ± ${f(report.control.truePhiSd, 3)}`);
  L.push(`  agreement at a deliberately wrong place   ${f(report.control.nullPhiMean, 3)} ± ${f(report.control.nullPhiSd, 3)}`);
  L.push(`  separation                                ${f(report.control.separation, 3)}   ${report.control.separation < SEP ? "*** TOO SMALL — nothing below is worth reading ***" : "ok"}`);
  L.push(`  marks beating their own wrong place       ${report.control.beatsNull} of ${nAll} (${f(pct(report.control.beatsNull, nAll), 2)}%)`);
  L.push("");
  L.push("② REGISTRATION — is the box in the right place");
  L.push(`  rectangles essentially blank (<2% ink)    ${empties.length} (${f(report.registration.emptyPct)}%, 95% CI ${f(report.registration.emptyCi[0])}–${f(report.registration.emptyCi[1])}%)`);
  L.push(`  best fit further than ${OFF} units off      ${shifted.length} of ${placed.length} (${f(report.registration.shiftedPct)}%, 95% CI ${f(report.registration.shiftedCi[0])}–${f(report.registration.shiftedCi[1])}%)`);
  L.push(`  displacement, median / 95th percentile    ${f(report.registration.offP50)} / ${f(report.registration.offP95)} units`);
  L.push(`  mean displacement across / down the page  ${f(report.registration.dxMean, 3)} / ${f(report.registration.dyMean, 3)} units (sd ${f(report.registration.dxSd, 2)} / ${f(report.registration.dySd, 2)})`);
  L.push(`  overlap where claimed / where best        ${f(report.registration.iou0P50, 3)} / ${f(report.registration.iouBestP50, 3)} (median)`);
  L.push("");
  L.push("③ WHOSE MARKS ARE ELIGIBLE TO BE COMPARED BETWEEN THE TWO PRINTINGS");
  L.push("  A mark only qualifies if the rectangle is on ink, sits where it claims, beats a deliberately");
  L.push("  wrong placement, and — measured with no page in the question — is drawn like its own name.");
  const bp = report.betweenPrints;
  L.push(`  eligible                                  ${bp.eligible} of ${fixed.length}`);
  L.push(`  set aside, rectangle essentially blank    ${bp.excluded.blank}`);
  L.push(`  set aside, rectangle too far off the ink  ${bp.excluded.displaced}`);
  L.push(`  set aside, no better than a wrong place   ${bp.excluded.notSeparated}`);
  L.push(`  set aside, its own name is in question    ${bp.excluded.labelInQuestion}`);
  L.push("  (that last one is answered on its own, with no page and no fit: run the labelling probe)");
  L.push("");
  if (report.corrected) {
    const c = report.corrected;
    L.push("④ IF EACH PAGE'S OWN DISPLACEMENT WERE TAKEN OUT FIRST");
    L.push(`  the displacement removed, averaged over ${c.pagesShifted} pages: ${f(c.shiftDx, 2)} across, ${f(c.shiftDy, 2)} down`);
    L.push("                                            as shipped        corrected");
    L.push(`  agreement where the box claims to be     ${f(report.control.truePhiMean, 3).padStart(9)}  →  ${f(c.truePhiMean, 3).padStart(9)}`);
    L.push(`  separation from a wrong place            ${f(report.control.separation, 3).padStart(9)}  →  ${f(c.separation, 3).padStart(9)}`);
    L.push(`  marks beating their own wrong place      ${f(pct(report.control.beatsNull, nAll), 1).padStart(8)}%  →  ${f(pct(c.beatsNull, fixed.length), 1).padStart(8)}%`);
    L.push(`  mean ink inside the rectangle            ${f(100 * mean(rows.map((r) => r.ink)), 1).padStart(8)}%  →  ${f(100 * c.inkMean, 1).padStart(8)}%`);
    L.push(`  blank rectangles                         ${f(report.registration.emptyPct, 2).padStart(8)}%  →  ${f(c.emptyPct, 2).padStart(8)}%  (95% CI ${f(c.emptyCi[0], 2)}–${f(c.emptyCi[1], 2)}%)`);
    L.push(`  further than ${OFF} units off              ${f(report.registration.shiftedPct, 2).padStart(8)}%  →  ${f(c.shiftedPct, 2).padStart(8)}%  (95% CI ${f(c.shiftedCi[0], 2)}–${f(c.shiftedCi[1], 2)}%)`);
    L.push(`  displacement left over, median / p95     ${f(report.registration.offP50, 2).padStart(9)}  →  ${f(c.offP50, 2).padStart(9)} / ${f(c.offP95, 2)} units`);
    L.push(`  overlap with the ink, median             ${f(report.registration.iou0P50, 3).padStart(9)}  →  ${f(c.iou0P50, 3).padStart(9)}`);
    L.push("  (there is deliberately no 'ink matches the label' line here — see ⑧)");
    L.push("");
    L.push("⑤ PER NAME, after that correction");
    L.push("  name                    n   blank%   mean dx    mean dy    off p95  agree");
    for (const r of c.perName) {
      const bias = Math.abs(r.dyMean) > 2 * r.dySe && Math.abs(r.dyMean) > 0.05 ? " <" : "";
      L.push(
        `  ${r.name.padEnd(22)} ${String(r.n).padStart(4)} ${f(r.emptyPct).padStart(7)} ` +
          `${f(r.dxMean, 3).padStart(9)} ${f(r.dyMean, 3).padStart(10)}${bias.padEnd(2)} ` +
          `${f(r.offP95).padStart(7)} ${f(r.phi0, 3).padStart(6)}`,
      );
    }
    L.push("  ('<' marks a mean displacement more than two standard errors from zero — a bias, not noise)");
    L.push("");
  }
  L.push("⑥ PER NAME, as shipped");
  L.push("  name                    n   blank%   mean dx    mean dy    off p95  agree");
  for (const r of report.perName) {
    const bias = Math.abs(r.dyMean) > 2 * r.dySe && Math.abs(r.dyMean) > 0.05 ? " <" : "";
    L.push(
      `  ${r.name.padEnd(22)} ${String(r.n).padStart(4)} ${f(r.emptyPct).padStart(7)} ` +
        `${f(r.dxMean, 3).padStart(9)} ${f(r.dyMean, 3).padStart(10)}${bias.padEnd(2)} ` +
        `${f(r.offP95).padStart(7)} ${f(r.phi0, 3).padStart(6)}`,
    );
  }
  L.push("  ('<' marks a mean displacement more than two standard errors from zero — a bias, not noise)");
  L.push("");
  if (report.perPage.length > 1) {
    L.push("⑦ PER PAGE — does a page move as one piece?");
    L.push("  page     n   mean dx    mean dy    sd dx   sd dy   overlap now  overlap moved  fit residual");
    for (const r of report.perPage.slice(0, 24)) {
      L.push(
        `  ${String(r.page).padStart(4)} ${String(r.n).padStart(5)} ${f(r.dxMean, 3).padStart(9)} ${f(r.dyMean, 3).padStart(10)} ` +
          `${f(r.dxSd, 2).padStart(7)} ${f(r.dySd, 2).padStart(7)} ${f(r.iou0, 3).padStart(12)} ${f(r.iouBest, 3).padStart(14)} ${f(r.residual, 3).padStart(13)}`,
      );
    }
    if (report.perPage.length > 24) L.push(`  … ${report.perPage.length - 24} more pages, in the machine output`);
    L.push("");
    const rf = report.perPage.filter((r) => r.refit);
    if (rf.length) {
      L.push("  and what the fit between the two prints would have been, re-derived from the ink:");
      L.push("  page      scale across   moves by      scale down     moves by     scatter left over");
      for (const r of rf.slice(0, 24)) {
        L.push(
          `  ${String(r.page).padStart(4)} ${f(r.refit.sx, 5).padStart(14)} ${f(r.refit.dtx, 3).padStart(10)} ` +
            `${f(r.refit.sy, 5).padStart(15)} ${f(r.refit.dty, 3).padStart(12)} ${f(r.refit.residX, 2)} / ${f(r.refit.residY, 2)} units`,
        );
      }
      L.push(
        `  (the pinned scales are ${f(PIN.pages.find((x) => x.page === rf[0].page).sx, 5)} and ` +
          `${f(PIN.pages.find((x) => x.page === rf[0].page).sy, 5)} on page ${rf[0].page})`,
      );
      L.push("");
    }
  }
  L.push("⑧ AND SEPARATELY: DO THE TWO PRINTINGS DRAW THE SAME MARK IN THE SAME PLACE?");
  L.push("  Only the eligible marks from ③. Three counts, never added together — the middle one is a");
  L.push("  limit of a comparison that centres both drawings, not a disagreement between the printings.");
  L.push(`  the shipped ink is drawn as the same name   ${bp.same} (${f(bp.samePct)}%, 95% CI ${f(bp.sameCi[0])}–${f(bp.sameCi[1])}%)`);
  L.push(`  a name this print draws as the same shape   ${bp.twin} (${f(bp.twinPct)}%, 95% CI ${f(bp.twinCi[0])}–${f(bp.twinCi[1])}%)`);
  L.push(`  a genuinely different shape                 ${bp.differ} (${f(bp.differPct)}%, 95% CI ${f(bp.differCi[0])}–${f(bp.differCi[1])}%)`);
  L.push(`  …and of those, still different when scored at the placement the search itself preferred:`);
  L.push(
    `      ${bp.differHeld} of ${bp.differ}` +
      (bp.differ && bp.differHeld / bp.differ < 0.1
        ? "  — so all but a handful are a sixteenth of a unit of residual placement, not two printings disagreeing"
        : ""),
  );
  if (bp.groups.length) {
    L.push(`  the shapes this print does not separate, above ${bp.groupThreshold}:`);
    for (const g of bp.groups) L.push(`    ${g.join(" · ")}`);
  }
  if (bp.worst.length) {
    L.push("  worst, by how far the shipped ink beat the named mark ('*' = still differs after re-placing):");
    for (const w of bp.worst.slice(0, 12)) {
      L.push(
        `   ${w.held ? "*" : " "}p${String(w.page).padStart(3)} mark ${String(w.k).padStart(4)}  ${w.name.padEnd(22)} ` +
          `drawn like ${w.saw.padEnd(22)} ${f(w.sawPhi, 3)} vs ${f(w.minePhi, 3)}`,
      );
    }
  }
  L.push("");
  L.push(`⑨ HOW BIG A SAMPLE WOULD SETTLE IT`);
  L.push(`  to pin a ~2% rate to ±0.5 points          ${report.needed.forOnePercent.toLocaleString()} marks`);
  L.push(`  to pin it to ±0.1 points                  ${report.needed.forTenth.toLocaleString()} marks`);
  L.push("");
  L.push(`Look at the evidence: ${outPath}`);
  if (skipped.length) L.push(`(${skipped.length} marks had an outline that rasterised to nothing and were not scored)`);
  console.log(L.join("\n"));
}

// A breached threshold exits non-zero so this *could* be a gate. It is not one:
// nothing runs it in CI, on purpose — the thresholds below are proposed in
// `docs/design/mark-registration.md` and have not been agreed.
const breaches = [];
if (report.control.separation < SEP) breaches.push(`separation ${report.control.separation.toFixed(3)} < ${SEP}`);
if (report.registration.emptyPct > 3) breaches.push(`blank rectangles ${report.registration.emptyPct.toFixed(2)}% > 3%`);
if (report.registration.shiftedPct > 2) breaches.push(`displaced ${report.registration.shiftedPct.toFixed(2)}% > 2%`);
if (breaches.length) {
  console.error(`\nthreshold breached: ${breaches.join("; ")}`);
  process.exit(1);
}

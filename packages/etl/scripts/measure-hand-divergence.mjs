/**
 * How far does a hand placement sit from where the machine would have put the
 * mark on its own? — the question that decides whether the least-sure sitting
 * has anything to measure.
 *
 * The rebuilt sitting pits the shipped rectangle against the automatic one on the
 * marks the machine was least sure of. For the 892 hand marks the shipped
 * rectangle is a person's, and the rival is `automaticPlacement` with the person
 * left out. If those two nearly always coincide, every trial is a twin and the
 * sitting is a landslide of "can't tell" — so before any of the page is drawn,
 * this measures the gap on every hand mark and prints its distribution.
 *
 * The join needs no ruling resolver. `build-mark-placements` walks `marksOf(page)`
 * in order and buckets each mark into its ayah, so the i-th entry of a shard
 * ayah is the i-th `marksOf` mark of that ayah. A shard entry marked `s:"hand"`
 * therefore names its live mark exactly, and its automatic rival is that mark's
 * `automaticPlacement`.
 *
 * Reads the committed shards, the corpus cache, the page ink and the rebuilt
 * rows; writes nothing. Run after `probe-mark-ink.mjs --rows-out …` has rebuilt
 * the rows.
 *
 *   node packages/etl/scripts/measure-hand-divergence.mjs [--rows <file>] [--examples 8]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPageInk } from "./lib/ink.mjs";
import { automaticPlacement } from "./lib/mark-placement.mjs";
import { marksOf } from "./lib/marks.mjs";
import { correctionFor } from "./lib/registration-grain.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const REPO = join(ETL, "..", "..");
const SHARDS = join(REPO, "apps", "web", "public", "assets", "marks", "hafs-kfqc");
const PAGES = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const ROWS = arg("--rows", join(ETL, "out", "mark-rows.line-tilt.json"));
const nExamples = Number(arg("--examples", 8));

const rows = JSON.parse(readFileSync(ROWS, "utf8"));
const byPage = new Map();
for (const r of rows) {
  if (!byPage.has(r.page)) byPage.set(r.page, new Map());
  byPage.get(r.page).set(r.k, r);
}

/** Centre of a rectangle. */
const centre = ([x, y, w, h]) => [x + w / 2, y + h / 2];
/** Distance between two rectangles' centres, in page (viewBox) units. */
const shift = (a, b) => {
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  return Math.hypot(ax - bx, ay - by);
};
/** Intersection-over-union of two axis-aligned rectangles. */
const iou = (a, b) => {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const inter = ix * iy;
  const uni = aw * ah + bw * bh - inter;
  return uni > 0 ? inter / uni : 0;
};

const shifts = [];
const bySrc = { ink: 0, reach: 0, tilt: 0 }; // which tier the rival fell into
const examples = [];
let pagesWithHand = 0;

for (let page = 1; page <= 604; page += 1) {
  let shard;
  try {
    shard = JSON.parse(readFileSync(join(SHARDS, `${page}.json`), "utf8"));
  } catch {
    continue;
  }
  const handHere = Object.values(shard.marks).some((a) => a.some((m) => m.s === "hand"));
  if (!handHere) continue;
  pagesWithHand += 1;

  const ms = marksOf(page);
  const rmap = byPage.get(page);
  if (!rmap) continue;
  const corr = correctionFor("line-tilt", [...rmap.values()]);
  const ink = readPageInk(readFileSync(join(PAGES, `${page}.svg`), "utf8"), 1 / 16).shapes;

  // Rebuild the ayah buckets in marksOf order, so index i in a bucket lines up
  // with index i in the shard's ayah array.
  const seen = new Map();
  for (const m of ms) {
    const key = `${m.surah}:${m.aya}`;
    const i = seen.get(key) ?? 0;
    seen.set(key, i + 1);
    const entry = shard.marks[key]?.[i];
    if (!entry || entry.s !== "hand") continue;
    const row = rmap.get(m.k);
    if (!row) continue;
    const auto = automaticPlacement({ mark: m, row, ink, corr });
    bySrc[auto.src] += 1;
    const d = shift(entry.r, auto.rect);
    const overlap = iou(entry.r, auto.rect);
    shifts.push(d);
    if (examples.length < nExamples) {
      examples.push({ page, at: key, name: m.name, shipped: entry.r, auto: auto.rect, src: auto.src, shift: d, iou: overlap });
    }
  }
}

shifts.sort((a, b) => a - b);
const q = (p) => shifts[Math.min(shifts.length - 1, Math.floor(p * shifts.length))];
const mean = shifts.reduce((s, v) => s + v, 0) / (shifts.length || 1);
const near = shifts.filter((d) => d < 0.15).length; // effectively the same rectangle → a twin

const bars = [];
const edges = [0, 0.15, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, Infinity];
for (let i = 0; i < edges.length - 1; i += 1) {
  const n = shifts.filter((d) => d >= edges[i] && d < edges[i + 1]).length;
  const lab = edges[i + 1] === Infinity ? `${edges[i]}+` : `${edges[i]}–${edges[i + 1]}`;
  bars.push(`  ${lab.padEnd(9)} ${"█".repeat(Math.round((60 * n) / (shifts.length || 1)))} ${n}`);
}

process.stdout.write(
  `hand marks measured: ${shifts.length} over ${pagesWithHand} pages\n` +
    `rival tier (what the machine alone would draw): ink ${bySrc.ink} · reach ${bySrc.reach} · tilt ${bySrc.tilt}\n\n` +
    `centre-to-centre shift, shipped(hand) vs automatic, in page units:\n` +
    `  min ${q(0).toFixed(2)} · p25 ${q(0.25).toFixed(2)} · median ${q(0.5).toFixed(2)} · ` +
    `mean ${mean.toFixed(2)} · p75 ${q(0.75).toFixed(2)} · p95 ${q(0.95).toFixed(2)} · max ${q(0.999).toFixed(2)}\n` +
    `  within 0.15u (a twin, no honest contest): ${near} of ${shifts.length} (${((100 * near) / (shifts.length || 1)).toFixed(0)}%)\n\n` +
    `distribution:\n${bars.join("\n")}\n\n` +
    `examples (page · ayah · mark — shipped rect vs automatic rect):\n` +
    examples
      .map(
        (e) =>
          `  p${e.page} ${e.at} ${e.name}: shift ${e.shift.toFixed(2)}u iou ${e.iou.toFixed(2)} [${e.src}]\n` +
          `      shipped [${e.shipped.join(", ")}]  auto [${e.auto.join(", ")}]`,
      )
      .join("\n") +
    "\n",
);

/**
 * The least-sure marks, each with the two rectangles a blind reader will be shown:
 * the one that ships, and the one the machine would have drawn on its own.
 *
 * ## Why this file exists, and why it is only the hand marks for now
 *
 * The rebuilt placement sitting (`build-placement-contest.mjs`) asks a reader to
 * choose, for a mark, between the rectangle the app draws today and the rectangle
 * the automatic pipeline would draw with the person left out. That is an honest
 * contest only where the two genuinely differ — and they differ on exactly one
 * class of mark. Option H places every mark automatically (its own ink, a reach
 * for nearby ink, or a fall to the printed line) and then a person redraws a few
 * hundred by hand. On an ink, reach or tilt mark the shipped rectangle *is* the
 * automatic one, so `automaticPlacement` returns it back and the trial is a twin.
 * Only on a **hand** mark did a person overrule the machine, so only there is
 * "shipped vs the machine's own guess" a real question with a real answer.
 *
 * So this builds the contest for the 892 hand marks: the 892 places a person
 * looked at where the machine put a mark and moved it. The reach and tilt marks
 * are a separate, later contest — their honest rival is the tier *below* them (the
 * plain shifted box they would have had if the reach or the fall had not fired),
 * not `automaticPlacement`, which is themselves. `--classes hand,reach,tilt` is
 * left as the seam for that; the default, and all this writes today, is `hand`.
 *
 * ## The join needs no ruling resolver
 *
 * `build-mark-placements` walks `marksOf(page)` in order and buckets each mark into
 * its ayah, so the i-th entry of a shard ayah is the i-th `marksOf` mark of that
 * ayah. A shard entry marked `s:"hand"` therefore names its live mark exactly, and
 * its automatic rival is that mark's `automaticPlacement`. The `rival` is computed
 * by the very function the ship asset uses, so the contest can never end up judging
 * a rival the app no longer draws.
 *
 * ## What it does not carry
 *
 * Rectangles and mark names, never scripture. A mark name (fatha, damma) is UI
 * chrome; the rectangles are positions the committed shards already publish. So
 * this file is publishable under the held-copy rule, and it is what both the
 * contest builder and, later, the scorer read — fingerprinted into the sitting's
 * head so a re-measure turns into a refusal rather than a quietly wrong number.
 *
 *   node packages/etl/scripts/build-least-sure.mjs [--classes hand] [--out <file>]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const ROWS = join(ETL, "out", "mark-rows.line-tilt.json");

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const classes = new Set(arg("--classes", "hand").split(",").filter(Boolean));
const outPath = arg("--out", join(ETL, "out", "least-sure.json"));

const rows = JSON.parse(readFileSync(ROWS, "utf8"));
const byPage = new Map();
for (const r of rows) {
  if (!byPage.has(r.page)) byPage.set(r.page, new Map());
  byPage.get(r.page).set(r.k, r);
}

const out = [];
const tally = { hand: 0, reach: 0, tilt: 0, ink: 0 };
let pagesWith = 0;

for (let page = 1; page <= 604; page += 1) {
  let shard;
  try {
    shard = JSON.parse(readFileSync(join(SHARDS, `${page}.json`), "utf8"));
  } catch {
    continue;
  }
  const anyHere = Object.values(shard.marks).some((a) => a.some((m) => classes.has(m.s)));
  if (!anyHere) continue;

  const rmap = byPage.get(page);
  if (!rmap) throw new Error(`page ${page} has ${classes.size ? "" : "no "}least-sure marks but no rows`);
  const ms = marksOf(page);
  const corr = correctionFor("line-tilt", [...rmap.values()]);
  const ink = readPageInk(readFileSync(join(PAGES, `${page}.svg`), "utf8"), 1 / 16).shapes;

  const seen = new Map();
  let usedPage = false;
  for (const m of ms) {
    const key = `${m.surah}:${m.aya}`;
    const i = seen.get(key) ?? 0;
    seen.set(key, i + 1);
    const entry = shard.marks[key]?.[i];
    if (!entry || !classes.has(entry.s)) continue;
    tally[entry.s] += 1;
    const row = rmap.get(m.k);
    if (!row) throw new Error(`page ${page} mark ${m.k} (${m.name}) has no measured row`);
    // The rows and the corpus must be the same extract, or the join is a lie —
    // the same guard `build-mark-placements` enforces.
    if (m.box.some((v, j) => Math.abs(v - row.box[j]) > 0.2)) {
      throw new Error(`page ${page} mark ${m.k}: corpus box ${JSON.stringify(m.box)} ≠ rows box ${JSON.stringify(row.box)}`);
    }
    const auto = automaticPlacement({ mark: m, row, ink, corr });
    out.push({
      page,
      k: m.k,
      name: m.name,
      class: entry.s,
      surah: m.surah,
      aya: m.aya,
      idx: m.idx,
      box: m.box,
      // What the app draws today (the person's rectangle) …
      shipped: entry.r,
      // … against what the machine would have drawn with the person left out.
      rival: auto.rect,
      // Which tier the machine's own guess fell into — provenance, not the answer.
      rivalTier: auto.src,
    });
    usedPage = true;
  }
  if (usedPage) pagesWith += 1;
}

const doc = {
  built: new Date().toISOString(),
  classes: [...classes],
  rows: { file: "packages/etl/out/mark-rows.line-tilt.json", builtBy: "node scripts/probe-mark-ink.mjs --pages 1-604 --rows-out packages/etl/out/mark-rows.line-tilt.json" },
  corpus: "apps/web/public/assets/marks/hafs-kfqc (committed shards) + apps/web/public/assets/pages/hafs-kfqc (shipped page ink)",
  count: out.length,
  pages: pagesWith,
  marks: out,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(doc, null, 0)}\n`);

process.stdout.write(
  `${out.length} least-sure marks over ${pagesWith} pages · classes ${[...classes].join(",")}\n` +
    `  hand ${tally.hand} · reach ${tally.reach} · tilt ${tally.tilt}${tally.ink ? ` · ink ${tally.ink}` : ""}\n` +
    `  rival tiers the machine would have used → ` +
    `ink ${out.filter((m) => m.rivalTier === "ink").length} · ` +
    `reach ${out.filter((m) => m.rivalTier === "reach").length} · ` +
    `tilt ${out.filter((m) => m.rivalTier === "tilt").length}\n` +
    `→ ${outPath}\n`,
);

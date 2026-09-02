#!/usr/bin/env node
/**
 * The ayah-end ornaments, turned from the thing we fit on into the thing we check.
 *
 * Every other measurement in this line of work has the same shape and the same
 * weakness: a correction is fitted to make our rectangles agree with the print's
 * ink, and then it is graded by how well those rectangles agree with the ink.
 * That number goes up every time the model is given more parameters, *including*
 * when what it is fitting is noise. Split halves and shuffled controls
 * (`lib/registration-grain.mjs`) answer that from inside — this answers it from
 * outside, with an object the ink fit has never seen and could not have been
 * fitted to.
 *
 * The ornaments are the only objects both corpora label. Ours are
 * `<g ayah:x ayah:y>`, theirs `<g id="md-aya-mark-NNN">`, and the four numbers
 * every page's geometry rides — `word-boxes.pin.json`, via `applierFromPin` —
 * were fitted on exactly these points and nothing else. So the question this
 * asks is the inverse of the one that fit answered:
 *
 *   **if we correct the text to sit on its ink, where do the ornaments end up?**
 *
 * Two answers, and they mean opposite things:
 *
 * - **About where they are now.** Then the two prints differ by a single
 *   displacement, the ornaments were merely an unlucky place to have measured
 *   it, and the correction is a correction of the whole page.
 * - **Worse, by about the size of the correction.** Then the two prints really do
 *   agree about their ornaments and disagree about their text — which is the
 *   diagnosis this work started from, and it carries a consequence for what
 *   ships: the correction belongs to the text, and moving the ayah-end markers
 *   with it would break the one thing that is currently right.
 *
 * That second reading is what the corpus says, and it says it on every page it
 * was asked. The numbers are in `docs/design/mark-registration.md`.
 *
 * Nothing here is fitted. The correction comes from the rows a scoring run
 * dumped (`probe-mark-ink.mjs --rows-out`), the pairing is the one `fitFrames`
 * uses, and this only reads. It is a probe and not a gate for the usual reason:
 * a red line here is a finding somebody reads, not a build failure.
 *
 * Usage:
 *   node packages/etl/scripts/probe-mark-ink.mjs --pages-n 120 --sample 200000 \
 *     --rows-out rows.json --out /tmp/x.html --shift-out /tmp/x.json
 *   node packages/etl/scripts/probe-ornament-witness.mjs --rows rows.json
 *   node packages/etl/scripts/probe-ornament-witness.mjs --rows rows.json --grain page
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readOurs, readTheirs, readingOrder } from "./lib/mushaf-frame.mjs";
import { GRAINS, SPLIT_FLOOR, correctionFor } from "./lib/registration-grain.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");
const REPO = join(ETL, "..", "..");
const CACHE = join(ETL, "data", "pages", ".cache", "words");
const OURS = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");
const PIN = JSON.parse(readFileSync(join(ETL, "data", "pages", "word-boxes.pin.json"), "utf8"));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const rowsPath = arg("--rows", null);
const GRAIN = arg("--grain", "line");
if (!rowsPath) {
  console.error("--rows <file> is required; produce it with probe-mark-ink.mjs --rows-out");
  process.exit(2);
}
if (!GRAINS.includes(GRAIN)) {
  console.error(`--grain must be ${GRAINS.join(", ")}; got ${GRAIN}`);
  process.exit(2);
}

const pad3 = (n) => String(n).padStart(3, "0");
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

const rows = JSON.parse(readFileSync(rowsPath, "utf8")).filter((r) => r.ink >= 0.02);
const { apply: correct } = correctionFor(GRAIN, rows, SPLIT_FLOOR);
const pages = [...new Set(rows.map((r) => r.page))].sort((a, b) => a - b);

const shipped = [];
const corrected = [];
const perPage = [];
const skipped = [];

for (const page of pages) {
  const pin = PIN.pages.find((r) => r.page === page);
  if (!pin || pin.sx === undefined) {
    skipped.push(page);
    continue;
  }
  let theirs;
  let ours;
  try {
    theirs = readTheirs(readFileSync(join(CACHE, `${pad3(page)}.svg`), "utf8"));
    ours = readOurs(readFileSync(join(OURS, `${page}.svg`), "utf8"));
  } catch {
    skipped.push(page);
    continue;
  }

  // The pairing `fitFrames` uses, and for the same reason: emitted order is not
  // reading order, and pairing on it fits a mirror. Using the same one here means
  // these are the very points the shipped four numbers were fitted on, rather
  // than a second opinion about which ornament is which.
  const T = readingOrder(
    theirs.marks.map((t) => [(t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2]),
    8,
  );
  const O = readingOrder(ours.marks, 11);
  if (T.length !== O.length || T.length < 3) {
    skipped.push(page);
    continue;
  }

  // Which printed line an ornament sits on. Their ornaments carry no line number
  // — only their words do — so the line is the word band whose centre is nearest.
  // A per-line correction has to be asked about the line the ornament is on, and
  // asking about the wrong one would make this test easier than it should be.
  const bands = new Map();
  for (const w of theirs.words) {
    if (!Number.isFinite(w.line)) continue;
    if (!bands.has(w.line)) bands.set(w.line, []);
    bands.get(w.line).push((w.box[1] + w.box[3]) / 2);
  }
  const centres = [...bands.entries()].map(([line, ys]) => [line, med(ys)]);
  const lineOf = (y) =>
    centres.reduce((best, c) => (Math.abs(c[1] - y) < Math.abs(best[1] - y) ? c : best), centres[0])?.[0];

  const before = [];
  const after = [];
  for (let i = 0; i < T.length; i += 1) {
    const x = pin.sx * T[i][0] + pin.tx;
    const y = pin.sy * T[i][1] + pin.ty;
    const c = correct({ page, line: lineOf(T[i][1]), box: [x - 2.8, y - 1.8, 5.6, 3.6], ink: 1 });
    before.push(Math.hypot(x - O[i][0], y - O[i][1]));
    after.push(Math.hypot(x + c.dx - O[i][0], y + c.dy - O[i][1]));
  }
  shipped.push(...before);
  corrected.push(...after);
  perPage.push({ page, n: T.length, before: med(before), after: med(after) });
}

const worse = perPage.filter((r) => r.after > r.before).length;
const out = {
  grain: GRAIN,
  pairs: shipped.length,
  pages: perPage.length,
  skipped,
  underShippedFit: med(shipped),
  underInkCorrection: med(corrected),
  pagesMovedFurtherOut: worse,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`${out.pairs} ornament pairs over ${out.pages} pages, corrected at the "${GRAIN}" grain\n`);
  console.log(`  where the ornaments sit under the shipped fit      ${out.underShippedFit.toFixed(3)} units`);
  console.log(`  where they would sit under the ink correction      ${out.underInkCorrection.toFixed(3)} units`);
  console.log(`  pages the correction moves them further out        ${worse} of ${out.pages}`);
  if (skipped.length) console.log(`  pages with nothing to pair                        ${skipped.length}`);
  console.log("\n  The ink fit never saw an ornament, so none of this was available to it.");
  console.log("  A difference the whole page shared would read the same on both lines.");
}

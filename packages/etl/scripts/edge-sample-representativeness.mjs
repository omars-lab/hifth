/**
 * Is the sat sample of the "still placed at the edge" marks representative?
 *
 * mark-registration.md ㉛ holds an open question. A population of 339 marks ran out of
 * room during the ink search and still shipped as placed (iouBest in [0.55, 1.01)). Two
 * sittings of forty looked at 80 of them by eye: every one carried a complaint, but a
 * small one. The remaining 259 have never been looked at, and the doc asks whether "the
 * rate and size hold across the rest."
 *
 * Sitting the 259 needs a human eye and this script cannot supply one. What it can do is
 * ask the question that decides whether the eighty even generalise: are the 80 that were
 * sat a fair draw from the 339, or are the 259 that were skipped systematically different
 * on the features we CAN measure without an eye — the match quality (iouBest), how far the
 * search was allowed to look (searchedAt), the ink under the mark, and which axis ran out?
 *
 * If sat and unsat are indistinguishable on all of these, the eighty are a representative
 * sample and their finding is far more likely to hold across the rest — which is the
 * evidence the "sit them or ship them as-is" decision is missing. If they diverge, the
 * divergent unsat marks are exactly where an eye is still owed.
 *
 * Reads out/mark-rows.line-tilt.json (the placement probe's rows, not committed — a build
 * artifact) and the two committed edge sittings under docs/validation/rulings/. Writes a
 * ruling JSON beside them and prints the comparison. No eye, no network, deterministic.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ranOutOfRoom } from "./lib/mark-ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

const RADIUS = 3;
const BAND = [0.55, 1.01]; // iouBest in [lo, hi)
const ROWS = join(ROOT, "packages/etl/out/mark-rows.line-tilt.json");
const SITTINGS = [
  "packages/etl/out/mark-report-edge-b0.55_1.01-a8edff256.23.json",
  "packages/etl/out/mark-report-edge-b0.55_1.01-ab3a14b92.23.json",
];
const OUT = join(
  ROOT,
  "docs/validation/rulings/2026-09-04-edge-still-placed-sample-representativeness.json",
);

const rows = JSON.parse(readFileSync(ROWS, "utf8"));

// The population, by the repo's own predicate: ran out of room, match in the band.
const inBand = (r) => r.iouBest >= BAND[0] && r.iouBest < BAND[1];
const population = rows.filter((r) => ranOutOfRoom(r, RADIUS) && inBand(r));

// Which marks were sat, from the committed sittings' answers. `said` ids are "page:k".
const satIds = new Set();
for (const rel of SITTINGS) {
  const j = JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  for (const s of j.said ?? []) satIds.add(s.id);
}

const idOf = (r) => `${r.page}:${r.k}`;
const sat = population.filter((r) => satIds.has(idOf(r)));
const unsat = population.filter((r) => !satIds.has(idOf(r)));

// ---- summaries -------------------------------------------------------------------

const quantile = (xs, q) => {
  const a = [...xs].sort((x, y) => x - y);
  if (a.length === 0) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo);
};
const round = (x, n = 4) => (x == null ? null : Number(x.toFixed(n)));

function feature(rows, pick) {
  const xs = rows.map(pick);
  return {
    n: xs.length,
    min: round(Math.min(...xs)),
    p25: round(quantile(xs, 0.25)),
    median: round(quantile(xs, 0.5)),
    p75: round(quantile(xs, 0.75)),
    max: round(Math.max(...xs)),
    mean: round(xs.reduce((a, b) => a + b, 0) / xs.length),
  };
}

// Which axis hit the wall — direction, the one thing worth reading off an out-of-room mark.
function axisMix(rows) {
  const reach = (r) => r.searchedAt ?? RADIUS;
  const at = (v, r) => Math.abs(Math.abs(v) - reach(r)) < 1e-6;
  let x = 0,
    y = 0,
    both = 0;
  for (const r of rows) {
    const ax = at(r.dx, r),
      ay = at(r.dy, r);
    if (ax && ay) both++;
    else if (ax) x++;
    else if (ay) y++;
  }
  const n = rows.length || 1;
  return {
    xAxisOnly: x,
    yAxisOnly: y,
    both,
    xAxisOnlyPct: round((100 * x) / n, 1),
    yAxisOnlyPct: round((100 * y) / n, 1),
    bothPct: round((100 * both) / n, 1),
  };
}

// A two-sample Kolmogorov–Smirnov statistic: the largest gap between the two empirical
// distributions, and the 0.05 critical value. D above critical means the sat and unsat
// draws differ on that feature more than sampling noise would explain.
function ks(a, b) {
  const A = [...a].sort((x, y) => x - y);
  const B = [...b].sort((x, y) => x - y);
  const all = [...new Set([...A, ...B])].sort((x, y) => x - y);
  const cdf = (S, v) => {
    let lo = 0,
      hi = S.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (S[mid] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo / S.length;
  };
  let D = 0;
  for (const v of all) D = Math.max(D, Math.abs(cdf(A, v) - cdf(B, v)));
  const crit = 1.36 * Math.sqrt((A.length + B.length) / (A.length * B.length));
  return { D: round(D), crit05: round(crit), differs: D > crit };
}

const FEATURES = {
  iouBest: (r) => r.iouBest,
  searchedAt: (r) => r.searchedAt ?? RADIUS,
  ink: (r) => r.ink,
  iou0: (r) => r.iou0,
};

const compare = {};
for (const [name, pick] of Object.entries(FEATURES)) {
  compare[name] = {
    sat: feature(sat, pick),
    unsat: feature(unsat, pick),
    all: feature(population, pick),
    ks: ks(sat.map(pick), unsat.map(pick)),
  };
}

const report = {
  built: new Date().toISOString(),
  question:
    "Are the 80 sat 'still placed at the edge' marks a representative sample of the 339, on the features measurable without an eye?",
  rowsFile: "packages/etl/out/mark-rows.line-tilt.json",
  predicate: { ranOutOfRoom: true, radius: RADIUS, band: BAND },
  population: population.length,
  sat: sat.length,
  unsat: unsat.length,
  axis: { sat: axisMix(sat), unsat: axisMix(unsat), all: axisMix(population) },
  compare,
  verdict: Object.fromEntries(
    Object.entries(compare).map(([k, v]) => [k, v.ks.differs ? "DIFFERS" : "same"]),
  ),
  reading:
    "For each feature: KS D is the largest gap between the sat and unsat distributions; " +
    "crit05 is the 0.05 threshold. differs=false on every feature means the eighty are a " +
    "representative draw and their eye-finding is likely to hold across the 259. A feature " +
    "with differs=true marks where the unsat marks are systematically unlike the sat ones, " +
    "and where an eye is therefore still specifically owed.",
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

// ---- print -----------------------------------------------------------------------
console.log(`\npopulation ${report.population}  sat ${report.sat}  unsat ${report.unsat}\n`);
for (const [name, v] of Object.entries(compare)) {
  const f = (s) => `med ${s.median} [${s.p25}..${s.p75}]`;
  console.log(
    `${name.padEnd(11)}  sat ${f(v.sat).padEnd(26)} unsat ${f(v.unsat).padEnd(26)} ` +
      `KS D=${v.ks.D} crit=${v.ks.crit05} -> ${v.ks.differs ? "DIFFERS" : "same"}`,
  );
}
console.log("\naxis reached the wall (sat / unsat):");
console.log(`  x-only  ${report.axis.sat.xAxisOnlyPct}% / ${report.axis.unsat.xAxisOnlyPct}%`);
console.log(`  y-only  ${report.axis.sat.yAxisOnlyPct}% / ${report.axis.unsat.yAxisOnlyPct}%`);
console.log(`  both    ${report.axis.sat.bothPct}% / ${report.axis.unsat.bothPct}%`);
console.log(`\nwrote ${OUT.replace(ROOT + "/", "")}`);

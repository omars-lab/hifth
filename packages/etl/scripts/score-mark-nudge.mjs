/**
 * Reads a set of placements, and says how far our correction still misses.
 *
 * ## What this measures that the forced choice cannot
 *
 * The forced-choice session answers a yes/no: is the corrected rectangle
 * preferred to the one that ships? That is the right question to ask first, and
 * it is the wrong question to stop at, because a correction that is right in
 * direction and short by a third wins every trial and is still wrong. Two
 * answers on offer means at most one bit of an answer.
 *
 * Here a person put each rectangle where they thought it went, having never been
 * shown where we think it goes. Subtracting our proposed move from theirs leaves
 * the **residual**: the further move, in page units, that would put our
 * rectangles where a reader puts them. That is a number that can be applied.
 *
 * ## Why a number needs a noise floor before it means anything
 *
 * A residual of a fifth of a unit is a finding if a hand is repeatable to a
 * fiftieth, and it is nothing at all if a hand wanders by half a unit between
 * two goes at the same mark. So some marks come round twice, with independent
 * starting positions, and the spread between the two landings is this reader's
 * own precision — measured here, on this screen, in this session, rather than
 * assumed. Everything else is printed against it, and a residual inside it is
 * reported as *not distinguishable from the hand*.
 *
 * ## And the pull of the starting point
 *
 * Every rectangle starts displaced, and a hand that stops short drags the
 * landing back toward wherever it started. The starts are spread evenly around
 * the shipped rectangle precisely so that this cancels in the average — but
 * "should cancel" is a claim, so it is measured: the landings are regressed on
 * the starts, and the slope is printed. A slope near nought means the starts did
 * their job. A large one means the placements are partly a record of where they
 * began, and widens what the residual can be trusted to.
 *
 * Exits non-zero when the session says the correction is not going the right
 * way, so it can sit inside something larger without being read.
 *
 *   node packages/etl/scripts/score-mark-nudge.mjs placements.json
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planNudge } from "./lib/adjudication.mjs";
import { wilson } from "./lib/mark-ink.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ETL = join(HERE, "..");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
let path = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith("--")) i += 1;
  else if (!path) path = argv[i];
}
if (!path) {
  process.stderr.write("usage: score-mark-nudge.mjs <placements.json> [--shift path]\n");
  process.exit(2);
}
const shiftPath = arg("--shift", join(ETL, "out", "mark-shift.json"));

const ruling = JSON.parse(readFileSync(path, "utf8"));
const shiftText = readFileSync(shiftPath, "utf8");

function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const fp = fingerprint(shiftText);
if (fp !== ruling.shiftFingerprint) {
  process.stderr.write(
    `these placements were made against different displacements (${ruling.shiftFingerprint}, measured ${ruling.shiftRan})\n` +
      `${shiftPath} is now ${fp}. Read them against the file they were made from, or build a fresh session.\n`,
  );
  process.exit(2);
}
if (ruling.kind !== "nudge") {
  process.stderr.write(`${path} is not a placement session (kind ${ruling.kind || "absent"}).\n`);
  process.exit(2);
}

const shift = JSON.parse(shiftText);
const { trials } = planNudge({ seed: ruling.seed, count: ruling.count, shifts: shift.shifts });
const byIndex = new Map(trials.map((t) => [t.i, t]));

const rows = [];
for (const a of ruling.answers) {
  if (!a || !a.u) continue;
  const t = byIndex.get(a.i);
  if (!t) throw new Error(`placement ${a.i} has no trial; the file and the seed disagree`);
  if (t.id !== a.id) throw new Error(`trial ${a.i} is ${t.id} but the file says ${a.id}`);
  rows.push({ t, a, r: [a.u[0] - t.shift[0], a.u[1] - t.shift[1]] });
}
if (!rows.length) {
  process.stderr.write("nothing placed.\n");
  process.exit(1);
}

const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const median = (xs) => {
  const a = xs.slice().sort((p, q) => p - q);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};
/**
 * A normal interval on a mean, which is the right shape here and not elsewhere
 * in this check: a residual is an average of continuous displacements, where the
 * forced choice's numbers are counts of successes and get Wilson intervals. The
 * two are not interchangeable, and a count reported with one of these would be
 * wrong at exactly the small samples this check runs at.
 */
function meanCI(xs) {
  const m = mean(xs);
  const n = xs.length;
  if (n < 2) return { m, lo: -Infinity, hi: Infinity, sd: 0, n };
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  const half = (1.96 * sd) / Math.sqrt(n);
  return { m, lo: m - half, hi: m + half, sd, n };
}

/**
 * The reader's own precision, from the marks that came round twice.
 *
 * Two independent goes at the same mark differ by the sum of two placements'
 * worth of wobble, so the spread of the difference is √2 times the spread of a
 * single placement — hence the halving of the variance. Without this the
 * residual below is a number with no scale, and a number with no scale is an
 * opinion with decimal places.
 */
const pairs = new Map();
for (const row of rows) {
  if (!pairs.has(row.t.id)) pairs.set(row.t.id, []);
  pairs.get(row.t.id).push(row);
}
const twice = [...pairs.values()].filter((g) => g.length >= 2).map((g) => g.slice(0, 2));
const gaps = twice.map(([p, q]) => Math.hypot(p.a.u[0] - q.a.u[0], p.a.u[1] - q.a.u[1]));
const axisNoise = (k) =>
  twice.length ? Math.sqrt(mean(twice.map(([p, q]) => (p.a.u[k] - q.a.u[k]) ** 2)) / 2) : NaN;
const noise = { n: twice.length, typical: median(gaps), sx: axisNoise(0), sy: axisNoise(1) };
noise.floor = twice.length ? Math.hypot(noise.sx, noise.sy) : NaN;

/**
 * The headline, in the currency the forced choice already speaks.
 *
 * A landing is either nearer the corrected rectangle than the one that ships, or
 * it is not. That is the same claim the two-panel session makes, arrived at by a
 * different route and without ever putting our answer on the screen, so the two
 * results are comparable — and if they disagree, one of the two instruments is
 * telling us something the other cannot see.
 */
const nearer = rows.filter((r) => Math.hypot(...r.r) < Math.hypot(r.a.u[0], r.a.u[1]));
const [wLo, wHi] = wilson(nearer.length, rows.length);
const head = {
  k: nearer.length,
  n: rows.length,
  pct: (100 * nearer.length) / rows.length,
  lo: 100 * wLo,
  hi: 100 * wHi,
};

const rx = meanCI(rows.map((r) => r.r[0]));
const ry = meanCI(rows.map((r) => r.r[1]));
const toShipped = rows.map((r) => Math.hypot(r.a.u[0], r.a.u[1]));
const toCorrected = rows.map((r) => Math.hypot(...r.r));

/**
 * Did the starting point pull the landing?
 *
 * The starts are drawn uniformly around the shipped rectangle, so their mean is
 * nought and a slope here does not bias the residual — but it inflates the
 * spread, which is what the residual's interval is made of. Reported rather than
 * corrected for: a correction would be a model of the hand, and this check is
 * meant to measure the hand, not to assume one.
 */
const slope = (k) => {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    num += r.a.from[k] * r.a.u[k];
    den += r.a.from[k] ** 2;
  }
  return den ? num / den : 0;
};
const pull = { x: slope(0), y: slope(1) };

const asksSize = (ruling.asks || []).includes("size");
const big = ruling.answers.filter((a) => a && a.wrongSize);
const NAMED = 12;
const names =
  big.slice(0, NAMED).map((a) => a.id).join(", ") + (big.length > NAMED ? `, and ${big.length - NAMED} more` : "");

const ms = rows.map((r) => r.a.ms).sort((x, y) => x - y);
const u3 = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
const u2 = (v) => v.toFixed(2);
const W = 30;
const say = (label, body) => `${label.padEnd(W)} ${body}`;

const clears = head.lo > 50;
const readable = Number.isFinite(noise.floor) && noise.floor > 0;
const residual = Math.hypot(rx.m, ry.m);
const beyondNoise = readable && residual > noise.floor;
const xReal = rx.lo > 0 || rx.hi < 0;
const yReal = ry.lo > 0 || ry.hi < 0;

const out = [
  `placements ${path}`,
  `seed ${ruling.seed} · ${rows.length} of ${ruling.count} placed · displacements ${ruling.shiftRan} (${fp})`,
  `median ${(median(ms) / 1000).toFixed(1)}s a placement`,
  "",
  `${say("landed nearer our correction", `${head.pct.toFixed(1)}%`.padStart(6))}  [${head.lo.toFixed(1)}% – ${head.hi.toFixed(1)}%]  ${head.k}/${head.n}`,
  say("typical miss, from as-shipped", `${u2(median(toShipped))} units`),
  say("typical miss, from corrected", `${u2(median(toCorrected))} units`),
  "",
  say("what is left over, across", `x ${u3(rx.m)}  [${u3(rx.lo)} – ${u3(rx.hi)}]`),
  say("what is left over, down", `y ${u3(ry.m)}  [${u3(ry.lo)} – ${u3(ry.hi)}]`),
  readable
    ? say("this hand's own precision", `${u2(noise.floor)} units, from ${noise.n} marks placed twice (typical gap ${u2(noise.typical)})`)
    : "this hand's own precision: unknown — no mark was placed twice, so nothing below has a scale.",
  say("pull of the starting point", `x ${pull.x.toFixed(2)}  y ${pull.y.toFixed(2)}  (0 is none, 1 is 'never moved')`),
  "",
  asksSize
    ? say("the box was the wrong size", `${big.length}/${ruling.answers.length}` + (big.length ? ` — ${names}` : ""))
    : "wrong-size: not asked. These placements come from a page built before the question existed, so they say nothing about how big the rectangles are.",
  "",
  clears
    ? "the correction goes the right way: placements land nearer it than they do the shipped box, and the interval clears half"
    : head.hi < 50
      ? "the correction goes the WRONG way: placements land nearer the shipped box than the corrected one"
      : "no direction either way: the interval straddles half, so these placements do not separate the two",
  !readable
    ? "no residual can be read: without a repeated mark there is no telling a real offset from a wandering hand."
    : !beyondNoise
      ? `the residual (${u2(residual)} units) is inside this hand's own precision (${u2(noise.floor)}). Our correction is as close as this session can resolve — which is a result, and it is not the same as being right.`
      : `the residual is ${u2(residual)} units, larger than this hand's precision (${u2(noise.floor)}).\n` +
        `A correction of (${u3(rx.m)}, ${u3(ry.m)}) on top of what is proposed would land where this reader puts them.\n` +
        (xReal || yReal
          ? `The ${[xReal ? "across" : "", yReal ? "down" : ""].filter(Boolean).join(" and ")} component${xReal && yReal ? "s are" : " is"} distinguishable from nought at 95%; anything not named here is not.`
          : "Neither component is distinguishable from nought at 95% on its own, so treat the size as suggestive and the direction as unsettled."),
  Math.abs(pull.x) > 0.25 || Math.abs(pull.y) > 0.25
    ? `\nCaution: the landings track their starting points (x ${pull.x.toFixed(2)}, y ${pull.y.toFixed(2)}). The starts are\n` +
      "spread evenly, so this does not tilt the residual in any one direction — but it widens every interval\n" +
      "above, and a pull this size usually means the placements were made faster than they were judged."
    : "",
  big.length && rows.length && big.length / rows.length > 0.15
    ? `\nAnd a second finding, which is not about placement: the rectangle was the wrong size on ${big.length} of\n` +
      `${ruling.answers.length}. That is fixed by measuring the boxes again, not by moving them, and nothing above addresses it.`
    : "",
]
  .filter((l) => l !== "")
  .join("\n");

process.stdout.write(`${out}\n`);
process.exit(clears ? 0 : 1);

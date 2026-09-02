#!/usr/bin/env node
/**
 * ㉝ scored the symmetric area-ratio guard against 89 marks and found it —
 * catches three in four of the marks that disagree with a reader by two
 * combined units or more, at the cost of one false refusal in fifty-two —
 * and said plainly that the number was not settled: "this run's own 89 marks
 * happen to sit a line, not a number checked against any wider population."
 * This is that wider check, kept as a script rather than a one-off, because
 * the ground truth it needs keeps growing as more wrong-size sittings finish
 * and a number worth trusting should be able to grow with it.
 *
 * ## What "readerD" and "ruleD" mean
 *
 * Both are a change in size — width, height — away from the rectangle we
 * ship, in page units. `readerD` is the reader's own answer, recovered from
 * a settled ruling's `size`/`was` fields (no wrong-shape answer means the
 * reader is read as having kept the shipped size, `[0, 0]`). `ruleD` is the
 * piece-union candidate's `grow`, from `probe-piece-union.mjs --ids`. Their
 * Euclidean distance is `combined`; a mark disagrees ("bad") once that
 * distance reaches `--bad` (default 2, matching ㉚'s own "two combined units
 * or more"). The candidate's own area ratio is scored against `--grow` and
 * `--shrink` (default 2 and 0.5 — "roughly double, or under about half"):
 * a mark whose ratio clears either edge is one the guard would refuse.
 *
 * ## Usage
 *
 *   node packages/etl/scripts/probe-piece-union.mjs --rows <rows.json> \
 *     --ids <id,id,...> --out packages/etl/out/piece-union.guard.json
 *   node packages/etl/scripts/score-piece-union-guard.mjs \
 *     --piece-union packages/etl/out/piece-union.guard.json \
 *     [--grow 2] [--shrink 0.5] [--bad 2] [--sweep] [--out <path>] \
 *     <ruling1.settled.json> [ruling2.settled.json ...]
 *
 * A mark named by more than one ruling file is read once, from whichever
 * file names it last — rulings are never expected to overlap, and this only
 * guards against a mistake in the file list rather than a real case.
 */
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(k);
// Positional args are everything not consumed as a flag or a flag's value.
const FLAGS_WITH_VALUE = new Set(["--piece-union", "--grow", "--shrink", "--bad", "--out"]);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (FLAGS_WITH_VALUE.has(argv[i])) { i++; continue; }
  if (argv[i].startsWith("--")) continue;
  positional.push(argv[i]);
}

const pieceUnionPath = arg("--piece-union", null);
const growCutoff = Number(arg("--grow", 2));
const shrinkCutoff = Number(arg("--shrink", 0.5));
const badFloor = Number(arg("--bad", 2));
const sweep = flag("--sweep");
const outPath = arg("--out", null);

if (!pieceUnionPath || !positional.length) {
  console.error("usage: score-piece-union-guard.mjs --piece-union <file> <ruling1.json> [ruling2.json ...]");
  process.exit(2);
}

const n3 = (v) => Math.round(v * 1000) / 1000;
const isDoubled = (name) => name.startsWith("successive ");

const candidates = new Map();
for (const row of JSON.parse(readFileSync(pieceUnionPath, "utf8"))) {
  candidates.set(`${row.page}:${row.k}`, row);
}

const marks = new Map();
for (const path of positional) {
  const ruling = JSON.parse(readFileSync(path, "utf8"));
  for (const m of ruling.settledMarks) marks.set(m.id, { ...m, from: path });
}

const rows = [];
for (const [id, m] of marks) {
  const cand = candidates.get(id);
  if (!cand) {
    console.error(`  no piece-union row for ${id} (${m.name}) — skipping, not in --piece-union file`);
    continue;
  }
  const was = m.was ?? [m.box[2], m.box[3]];
  const readerD = m.size ? [n3(m.size[0] - was[0]), n3(m.size[1] - was[1])] : [0, 0];
  const zeroPiece = !cand.candidate;
  const row = {
    id,
    name: m.name,
    doubled: isDoubled(m.name),
    from: m.from,
    readerD,
    zeroPiece,
    ruleD: cand.grow,
    ratio: cand.ratio,
  };
  if (!zeroPiece) {
    row.combined = n3(Math.hypot(readerD[0] - cand.grow[0], readerD[1] - cand.grow[1]));
    row.logdist = n3(Math.abs(Math.log(cand.ratio)));
    row.bad = row.combined >= badFloor;
  }
  rows.push(row);
}

if (outPath) writeFileSync(outPath, JSON.stringify(rows, null, 2));

// --------------------------------------------------------------- scoring --
function score(scored, grow, shrink) {
  const caught = (r) => r.ratio >= grow || r.ratio <= shrink;
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;
  for (const r of scored) {
    const c = caught(r);
    if (r.bad) {
      if (c) tp++; else fn++;
    } else if (c) fp++; else tn++;
  }
  return { tp, fn, fp, tn, recall: tp + fn ? tp / (tp + fn) : null, falseRefusal: fp + tn ? fp / (fp + tn) : null };
}

const scored = rows.filter((r) => !r.zeroPiece);
const zero = rows.filter((r) => r.zeroPiece);
const bad = scored.filter((r) => r.bad);
const ok = scored.filter((r) => !r.bad);

console.error(`${marks.size} marks named across ${positional.length} ruling file(s); ${rows.length} matched a piece-union row.`);
console.error(`${zero.length} have no piece to point to (candidate refused itself, excluded from scoring).`);
console.error(`${scored.length} scored: ${bad.length} disagree with the reader by ${badFloor}+ combined units, ${ok.length} agree closer than that.`);

function report(label, grow, shrink) {
  const all = score(scored, grow, shrink);
  const doubled = score(scored.filter((r) => r.doubled), grow, shrink);
  const single = score(scored.filter((r) => !r.doubled), grow, shrink);
  console.error(
    `${label} (ratio >= ${grow} or <= ${shrink}): catches ${all.tp}/${all.tp + all.fn} disagreeing ` +
      `(recall ${all.recall === null ? "n/a" : n3(all.recall)}), ` +
      `wrongly refuses ${all.fp}/${all.fp + all.tn} agreeing (${all.falseRefusal === null ? "n/a" : n3(all.falseRefusal)}). ` +
      `doubled ${doubled.tp}/${doubled.tp + doubled.fn} caught, ${doubled.fp}/${doubled.fp + doubled.tn} false; ` +
      `single ${single.tp}/${single.tp + single.fn} caught, ${single.fp}/${single.fp + single.tn} false.`,
  );
}

report("cutoff", growCutoff, shrinkCutoff);

if (sweep) {
  console.error("sweep:");
  for (const g of [1.5, 1.75, 2, 2.5, 3, 4]) {
    report(`  ${g}`, g, 1 / g);
  }
}

if (outPath) console.error(`wrote ${rows.length} rows to ${outPath}`);

#!/usr/bin/env node
/**
 * CI gate: the pen can draw every ayah box as lines, except the ones we know.
 *
 * Sweeps all 6,236 ayah boxes with the app's own pen (see lib/box-sweep.mjs for
 * what is classified and why) and holds two counts at what they measured on
 * 2026-09-01:
 *
 *   FALLBACK  8 — every one on pages 1 and 2, the decorated opening spread,
 *             whose ayah shapes are true polygons that no run of rectangles
 *             could be. The fallback is right there, and the page set is held
 *             as tightly as the count: a ninth fallback on page 300 is a
 *             defect even if one on page 1 were repaired the same day.
 *   OFF-GRID  2 — p564 68:3 and p602 107:2, the same shape twice: an ayah's
 *             short tail at the left margin cut to ~28 units on a 36-unit line,
 *             with the next ayah's box starting 8 units early. PLAN 17.
 *
 * Both are ceilings *and* floors: a count that falls is also reported, because
 * a fallback that disappears means either a polygon was repaired (then lower
 * the number here, in the same change) or the pen started accepting something
 * it used to refuse — and the second is exactly the kind of change this gate
 * exists to make deliberate. `--list` prints every flagged box.
 *
 * The other two classes (FUSED, DOT) are counted and printed on every run but
 * not held: both are handled by the pen, and their numbers are here so that
 * "how common is a six-line ayah" is an output rather than a guess.
 */
import { sweep } from "./lib/box-sweep.mjs";

const FALLBACK_COUNT = 8;
const FALLBACK_PAGES = new Set([1, 2]);
const OFF_GRID_COUNT = 2;

const list = process.argv.includes("--list");
const failures = [];
const fail = (msg) => failures.push(msg);

const { census, flagged } = await sweep();

const fallbackPages = [
  ...new Set(flagged.filter((f) => f.rule === "fallback").map((f) => f.page)),
];
const stray = fallbackPages.filter((p) => !FALLBACK_PAGES.has(p));

console.log(
  `gate:boxes — ${census.polygons} boxes on ${census.pages} pages, ${census.rects} rectangles: ` +
    `${census.fallback} fallback (pages ${fallbackPages.join(", ") || "none"}; ` +
    `${census.fallbackByKind.polygon} polygon, ${census.fallbackByKind.slanted} slanted, ${census.fallbackByKind.other} other), ` +
    `${census.offGrid} off-grid, ${census.fused} fused (up to ${census.fusedMaxLines} lines), ${census.dot} dots`,
);

if (list) {
  for (const f of flagged) {
    const detail =
      f.rule === "fallback"
        ? `${f.kind}  ${f.d.slice(0, 60)}${f.d.length > 60 ? "…" : ""}`
        : `rect ${f.rect} is ${f.height.toFixed(1)} tall on a ${f.lineHeight} line (${f.lines} lines)`;
    console.log(
      `  p${String(f.page).padStart(3)}  ${f.key.padEnd(7)}  ${f.rule.padEnd(9)}  ${detail}`,
    );
  }
}

if (census.polygons !== 6236) {
  fail(
    `expected 6236 ayah boxes, found ${census.polygons} — a page is missing polygons or has extras`,
  );
}
if (census.fallback !== FALLBACK_COUNT) {
  fail(
    `${census.fallback} boxes fall back to the raw shape; the gate holds ${FALLBACK_COUNT}. ` +
      (census.fallback > FALLBACK_COUNT
        ? "A new box the pen cannot read as lines — run with --list, then either repair the polygon or teach the pen."
        : "Fewer than held — if a polygon was repaired or the pen learnt a shape, lower FALLBACK_COUNT in this change."),
  );
}
if (stray.length) {
  fail(
    `fallback boxes on page(s) ${stray.join(", ")} — only the decorated pages 1 and 2 are expected to have any`,
  );
}
if (census.offGrid !== OFF_GRID_COUNT) {
  fail(
    `${census.offGrid} rectangles are off the page's line grid; the gate holds ${OFF_GRID_COUNT}. ` +
      (census.offGrid > OFF_GRID_COUNT
        ? "Run with --list; a new one is a polygon-layer quirk to record in PLAN 17 and repair."
        : "Fewer than held — lower OFF_GRID_COUNT in the change that repaired it."),
  );
}

if (failures.length) {
  console.error(`FAIL gate:boxes — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("gate:boxes — OK");

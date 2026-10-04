/**
 * The page check must refuse a committed page that was edited after it was
 * vendored, a pinned page that is missing, a page or stray file nobody pinned,
 * a printed glyph that no ayah outline covers (scripture nobody can tap), and a
 * gap above a surah's first ayah too tall to be only its title and basmala.
 * It must pass clean pages, and refuse a page with no outlines at all, one it
 * cannot place, and a pin that is missing or lists nothing.
 *
 * The pages are made up: a few plain shapes stand in for the ink, and ayah
 * outlines are drawn as one band per printed line, fifteen lines to a page as
 * in the real print. The pin's hashes are worked out when the test runs.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PIN = "packages/etl/data/pages/quran-svg.pin.json";
const PAGES = "apps/web/public/assets/pages/hafs-kfqc";
const LINE = 36;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** One ayah outline covering printed lines `first`..`last` (0-based, inclusive). */
function outline(surah, ayah, first, last) {
  let d = "";
  for (let l = first; l <= last; l++) d += `M20 ${l * LINE}H325v${LINE}H20Z`;
  return `<path fill-opacity="0" d="${d}" ayah="${ayah}" class="ayahPolygon" number="${surah * 1000 + ayah}" surah="${surah}"/>`;
}
/** A small square of ink centred on (x, y). */
const glyph = (x, y) => `<path d="M${x - 4} ${y - 4}h8v8h-8Z"/>`;
const page = (ink, outlines) =>
  `<svg viewBox="0 0 345 540"><g transform="matrix(1 0 0 1 0 0)"><g id="content">${ink.join("")}</g></g>${outlines.join("")}</svg>`;

/** Two ayahs filling all fifteen lines, every glyph inside one of them. */
const full = page([glyph(100, 18), glyph(200, 400)], [outline(2, 6, 0, 6), outline(2, 7, 7, 14)]);
/** A surah ending, then a two-line gap holding its successor's title, then that surah's first ayah. */
const opening = page([glyph(100, 18), glyph(170, 216), glyph(200, 400)], [outline(2, 286, 0, 4), outline(3, 1, 7, 14)]);
/** The opening spread is decorated, not fifteen lines; the coverage tests skip it. */
const spread = `<svg viewBox="0 0 400 600"><g id="content">${glyph(5, 5)}</g></svg>`;

const clean = { 1: spread, 3: full, 4: opening };

/** Build the pages and a pin for them, run the check, clean up. */
function run(pages = clean, { rows = (r) => r, extra = {}, pin } = {}) {
  const files = { ...extra };
  const pinRows = [];
  for (const [n, svg] of Object.entries(pages)) {
    if (svg !== null) files[`${PAGES}/${n}.svg`] = svg;
    pinRows.push({ page: Number(n), vendored: sha256(svg ?? "a page that was never committed") });
  }
  if (pin !== null) {
    files[PIN] = JSON.stringify(pin ?? { repo: "made-up/pages", commit: "fedcba9876543210", svgo: { version: "0.0.0" }, pages: rows(pinRows) });
  }
  const root = makeFixture(files);
  try {
    return runGate("pages", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:pages passes pages that match the pin, with every glyph inside a tappable ayah", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /3\/3 page SVGs match made-up\/pages@fedcba98 via svgo 0\.0\.0/);
  assert.match(r.out, /every glyph on 2 of them falls inside a tappable ayah/);
  assert.match(r.out, /4 ayah polygons in 28 straight-line subpaths, of which 0 are general polygons on 0 pages/);
});

test("gate:pages refuses a page edited after it was vendored", () => {
  const r = run(clean, { rows: (rows) => rows.map((e) => (e.page === 3 ? { ...e, vendored: sha256("as vendored") } : e)) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 page SVG\(s\) do not match the pin \(first: page 3\)/);
});

test("gate:pages refuses a pinned page that is not committed", () => {
  const r = run({ ...clean, 5: null });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 pinned page\(s\) are not committed \(first: 5\)/);
});

test("gate:pages refuses a page nobody pinned, and a file that is not a page", () => {
  const r = run(clean, { extra: { [`${PAGES}/9.svg`]: full, [`${PAGES}/9.svg.orig`]: full } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 page SVG\(s\) are committed but not in the pin \(first: page 9\)/);
  assert.match(r.out, /1 file\(s\) in the page directory are not page SVGs: 9\.svg\.orig/);
});

test("gate:pages refuses a printed glyph that no ayah outline covers", () => {
  const holed = page([glyph(100, 18), glyph(342, 300)], [outline(2, 6, 0, 6), outline(2, 7, 7, 14)]);
  const r = run({ ...clean, 3: holed });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: 1 glyph\(s\) fall outside every ayah polygon \(first at 342\.0,300\.0\)/);
});

test("gate:pages refuses a gap above a first ayah taller than a title and a basmala", () => {
  const tall = page([glyph(100, 18)], [outline(2, 286, 0, 3), outline(3, 1, 7, 14)]);
  const r = run({ ...clean, 4: tall });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 4: a band of 3\.00 line-heights at y 144\.0–252\.0 carries no ayah polygon/);
});

test("gate:pages refuses a glyph in a gap that does not open a surah", () => {
  const gap = page([glyph(170, 216)], [outline(2, 5, 0, 4), outline(2, 6, 7, 14)]);
  const r = run({ ...clean, 4: gap });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 4: 1 glyph\(s\) fall outside every ayah polygon \(first at 170\.0,216\.0\)/);
});

test("gate:pages refuses a page with no outlines, one it cannot place, and outlines it cannot read", () => {
  const bare = page([glyph(100, 18)], []);
  const unplaced = full.replace(' transform="matrix(1 0 0 1 0 0)"', "");
  const unnamed = page([glyph(100, 18)], [outline(2, 6, 0, 14).replace(' surah="2"', "")]);
  const curved = page([glyph(100, 18)], [outline(2, 6, 0, 14).replace("H325v36H20Z", "H325c0 9 0 27 0 36H20Z")]);
  const r = run({ ...clean, 3: bare, 5: unplaced, 6: unnamed, 7: curved });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: no ayah polygons at all — nothing on this page can be tapped/);
  assert.match(r.out, /page 5: no viewBox or no page transform — the ink cannot be placed/);
  assert.match(r.out, /page 6: an ayahPolygon is missing its d\/surah\/ayah/);
  assert.match(r.out, /page 7 2:6: polygon path uses "c" — only straight-line commands are understood/);
});

test("gate:pages refuses a missing pin, or one that lists nothing, rather than passing nothing", () => {
  const missing = run(clean, { pin: null });
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /no page pin/);
  const empty = run(clean, { pin: { repo: "made-up/pages", commit: "fedcba9876543210", svgo: { version: "0.0.0" }, pages: [] } });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /the pin lists no pages/);
});

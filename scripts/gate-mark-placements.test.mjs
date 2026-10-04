/**
 * The mark-placement check must refuse a mark file edited after it was built,
 * marks for an ayah the page does not have, a mark box that is malformed or off
 * the page, a pin whose counts disagree with the files, and — the reason it
 * exists — a mark a person placed by hand that no longer ships (or a "by hand"
 * mark that no ruling placed). It must pass a clean page where the later of two
 * rulings about one mark wins, and refuse a missing pin or one that lists
 * nothing rather than passing it.
 *
 * Each tree is one made-up page with two ayah outlines, a mark file, a pin
 * whose hash is worked out when the test runs, and one or two rulings.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PIN = "packages/etl/data/pages/mark-boxes.pin.json";
const MARKS = "apps/web/public/assets/marks/hafs-kfqc";
const PAGES = "apps/web/public/assets/pages/hafs-kfqc";
const RULINGS = "docs/validation/rulings";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const outline = (surah, ayah, y0) =>
  `<path fill-opacity="0" d="M0 ${y0}h345v40H0Z" ayah="${ayah}" class="ayahPolygon" number="${surah * 1000 + ayah}" surah="${surah}"/>`;
const svg = `<svg viewBox="0 0 345 550">${outline(2, 6, 0)}${outline(2, 7, 40)}</svg>`;

/** Where the fatha shipped before anyone moved it, and where two sittings put it. */
const BASE = [100, 10, 6, 3];
const EARLY = [101, 12, 6, 3];
const LATE = [102.5, 13, 6, 3];

const ruling = (settledAt, settled, more = []) =>
  JSON.stringify({ settledAt, settledMarks: [{ fault: "edge", settled, page: 3, name: "fatha", box: BASE }, ...more] });

/** The earlier sitting also looked at a kasra and left it alone; that is not a placement. */
const cleanRulings = {
  "2026-08-14-a.settled.json": ruling("2026-08-14T10:00", EARLY, [{ fault: null, page: 3, name: "kasra", box: [50, 30, 4, 2] }]),
  "2026-08-20-b.settled.json": ruling("2026-08-20T10:00", LATE),
};

const cleanMarks = {
  "2:6": [
    { w: 1, n: "kasra", r: [50, 30, 4, 2], s: "ink" },
    { w: 2, n: "fatha", r: LATE, s: "hand" },
  ],
  "2:7": [
    { w: 1, n: "shadda", r: [200, 45, 4.3, 3.3], s: "tilt" },
    { w: 3, n: "sukun", r: [180.1, 48, 3, 3], s: "reach" },
  ],
};

function counts(marks) {
  const t = { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 };
  for (const list of Object.values(marks)) {
    for (const m of list) {
      t.marks += 1;
      t[m.s] = (t[m.s] ?? 0) + 1;
    }
  }
  return t;
}

/**
 * Build the tree, run the check, clean up. `edit` gets the pin before it is
 * written, so a test can make it disagree with the files on purpose.
 */
function run({ marks = cleanMarks, rulings = cleanRulings, edit = (p) => p, page = svg, extra = {}, pin } = {}) {
  const body = JSON.stringify({ page: 3, marks });
  const t = counts(marks);
  const placed = Object.fromEntries(
    Object.entries(rulings ?? {}).map(([f, j]) => [f, JSON.parse(j).settledMarks.filter((m) => m.fault && m.settled).length]),
  );
  const made = {
    pages: [{ page: 3, sha256: sha256(body), ...t, ayahs: Object.keys(marks).length }],
    totals: t,
    authored: { sources: Object.entries(placed).map(([file, n]) => ({ file, placed: n })), resolved: 1, unresolved: 0 },
  };
  const files = { [`${MARKS}/3.json`]: body, ...extra };
  if (page !== null) files[`${PAGES}/3.svg`] = page;
  if (rulings !== null) files[`${RULINGS}/README.md`] = "what each sitting settled\n";
  for (const [f, j] of Object.entries(rulings ?? {})) files[`${RULINGS}/${f}`] = j;
  if (pin !== null) files[PIN] = JSON.stringify(pin ?? edit(made));
  const root = makeFixture(files);
  try {
    return runGate("mark-placements", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:mark-placements passes a page whose one hand placement is the later ruling's", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 shard\(s\) match the pin; 4 marks drawn \(1 on ink, 1 reaching for the ink, 1 on the line's tilt, 1 by hand\)/);
  assert.match(r.out, /all 1 hand placements trace to a committed ruling and none is stranded/);
});

test("gate:mark-placements refuses a mark file that no longer matches its pin", () => {
  const r = run({ edit: (p) => ({ ...p, pages: [{ ...p.pages[0], sha256: sha256("as built") }] }) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: shard does not match the pin — it was edited/);
});

test("gate:mark-placements refuses marks for an ayah the page does not carry", () => {
  const r = run({ marks: { ...cleanMarks, "2:8": [{ w: 1, n: "fatha", r: [10, 90, 4, 2], s: "ink" }] } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: 2:8 has marks but no polygon on the page/);
});

test("gate:mark-placements refuses mark boxes that are malformed or off the page", () => {
  const marks = {
    ...cleanMarks,
    "2:7": [
      { w: 0, n: "", r: [200.25, 45, 4, 3], s: "guess" },
      { w: 1, n: "sukun", r: [340, 45, 9, 0], s: "ink" },
      { w: 1, n: "sukun", r: [1, 2, 3], s: "ink" },
    ],
  };
  const r = run({ marks });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3 2:7: mark word index is 0/);
  assert.match(r.out, /page 3 2:7: mark has no name/);
  assert.match(r.out, /page 3 2:7: mark source is "guess"/);
  assert.match(r.out, /rectangle \[200\.25,45,4,3\] is not at one decimal/);
  assert.match(r.out, /page 3 2:7: rectangle has no area/);
  assert.match(r.out, /rectangle \[340,45,9,0\] falls outside the page's 0 0 345 550 viewBox/);
  assert.match(r.out, /page 3 2:7: rectangle is not four finite numbers/);
  const empty = run({ marks: { ...cleanMarks, "2:7": [] } });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /page 3 2:7: no marks/);
});

test("gate:mark-placements refuses a pin whose counts disagree with the files", () => {
  const r = run({
    edit: (p) => ({ ...p, pages: [{ ...p.pages[0], ink: 2, hand: 0, ayahs: 3 }], totals: { ...p.totals, tilt: 5 } }),
  });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: pin says 2 ink, the shard holds 1/);
  assert.match(r.out, /page 3: pin says 0 hand, the shard holds 1/);
  assert.match(r.out, /page 3: pin says 3 ayahs, the shard holds 2/);
  assert.match(r.out, /pin totals say tilt=5, the shards hold 1/);
  const extra = run({ extra: { [`${MARKS}/4.json`]: "{}", [`${MARKS}/notes.txt`]: "x" } });
  assert.equal(extra.status, 1, extra.out);
  assert.match(extra.out, /the pin lists 1 shard\(s\); 2 are committed/);
  assert.match(extra.out, /1 file\(s\) in the marks directory are not shards: notes\.txt/);
});

test("gate:mark-placements refuses a hand placement that no longer ships", () => {
  // The file ships the earlier sitting's box; the later sitting is the one that won.
  const marks = { ...cleanMarks, "2:6": [cleanMarks["2:6"][0], { w: 2, n: "fatha", r: EARLY, s: "hand" }] };
  const r = run({ marks });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hand placement stranded — fatha on page 3 at 102\.5,13,6,3 is in a ruling but no shard/);
  assert.match(r.out, /shipped hand mark not in any ruling — fatha on page 3 at 101,12,6,3/);
});

test("gate:mark-placements refuses a by-hand mark when no ruling placed it", () => {
  const r = run({ rulings: {}, edit: (p) => ({ ...p, authored: { ...p.authored, resolved: 0 } }) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /shipped hand mark not in any ruling — fatha on page 3 at 102\.5,13,6,3/);
  assert.match(r.out, /0 winning hand placement\(s\), but 1 shipped hand mark\(s\)/);
});

test("gate:mark-placements refuses a pin that disagrees with the committed rulings", () => {
  const r = run({
    edit: (p) => ({
      ...p,
      authored: {
        sources: [{ file: "2026-08-14-a.settled.json", placed: 2 }, { file: "2026-09-01-gone.settled.json", placed: 1 }],
        resolved: 2,
        unresolved: 1,
      },
    }),
  });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /pin says 2026-08-14-a\.settled\.json placed 2; it places 1/);
  assert.match(r.out, /pin names ruling 2026-09-01-gone\.settled\.json, which is not committed/);
  assert.match(r.out, /ruling 2026-08-20-b\.settled\.json is committed but the pin does not name it/);
  assert.match(r.out, /pin says 2 placement\(s\) resolved; 1 win by rectangle/);
  assert.match(r.out, /pin records 1 unresolved placement\(s\) — the build should have refused to write/);
});

test("gate:mark-placements refuses a mark file whose page is missing, and a tree with no rulings", () => {
  const r = run({ page: null });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: shard is committed but the page SVG it measures is not/);
  const blind = run({ rulings: null });
  assert.equal(blind.status, 1, blind.out);
  assert.match(blind.out, /no rulings directory — the hand placements cannot be reconciled/);
});

test("gate:mark-placements refuses a missing pin, or one that lists nothing, rather than passing nothing", () => {
  const missing = run({ pin: null });
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /no pin/);
  const empty = run({ pin: { pages: [], totals: { marks: 0, ink: 0, reach: 0, tilt: 0, hand: 0 }, authored: { sources: [], resolved: 0, unresolved: 0 } }, rulings: {} });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /the pin lists no shards, so nothing is being checked/);
});

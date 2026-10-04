/**
 * The word-map check must refuse a map between the print's words and the
 * corpus's words that no longer adds up: an exceptions list that differs
 * between the code and the map, or carries no real reason; an ayah on two
 * pages, or missing from the corpus; a joined or split word that is not a word
 * of that ayah, a join on an ayah's first word, a "split" over one word; an
 * ayah whose word count comes out wrong; the map naming an ayah no page holds;
 * stale totals; and a root placed on no word, on a pause mark, out of order, on
 * fewer words than it has parts, or on an ayah the map leaves out. It must pass
 * a tree where all of these agree, and refuse a tree with no pages, no map or
 * no roots rather than passing nothing.
 *
 * The tree is made up and written in Latin letters: five ayahs mapped (plain,
 * a join, a split, a join that also splits, and one more), plus the four
 * ayahs the code names as exceptions. Those four come from the code itself,
 * so the test follows the list if it changes.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";
import { EXCEPTIONS } from "../packages/etl/scripts/lib/segmentation.mjs";

const MORPH = "packages/etl/data/roots/quranic-corpus-morphology-0.4.txt";
const PIN = "packages/etl/data/pages/word-alignment.pin.json";
const WORDS = "apps/web/public/assets/words/hafs-kfqc";
const ROOTS = "apps/web/public/assets/roots/hafs-kfqc/ayah";
const EXCEPTED = Object.keys(EXCEPTIONS);

/** The corpus's word count for each ayah, and the print's word boxes for it. */
const ayahs = {
  "1:1": { qac: 3, boxes: 4, marks: [4] }, //    plain: three words and a pause mark
  "1:2": { qac: 2, boxes: 3 }, //                 print 2 continues print 1's word
  "1:3": { qac: 3, boxes: 2 }, //                 print 1 holds two corpus words
  "1:4": { qac: 3, boxes: 2 }, //                 print 2 continues print 1, and holds two
  "1:5": { qac: 4, boxes: 4 },
  ...Object.fromEntries(EXCEPTED.map((k) => [k, { qac: 1, boxes: 1 }])),
};
const cleanMap = { "1:2": { j: [2] }, "1:3": { s: { 1: 2 } }, "1:4": { j: [2], s: { 2: 3 } } };
const cleanExceptions = Object.fromEntries(EXCEPTED.map((k) => [k, "the print and the corpus spell this word apart"]));

function morphology(table) {
  const rows = ["# made-up word list for the gate test"];
  for (const [key, { qac }] of Object.entries(table)) {
    for (let w = 1; w <= qac; w += 1) rows.push(`(${key}:${w}:1)\tktb\tN\tSTEM`);
  }
  return rows.join("\n") + "\n";
}

function shard(table) {
  const box = [0, 0, 1, 1];
  const words = Object.fromEntries(
    Object.entries(table).map(([key, { boxes, marks }]) => [key, { from: 1, boxes: Array(boxes).fill(box), ...(marks && { marks }) }]),
  );
  return JSON.stringify({ page: 1, words });
}

/** The totals the pin reports, worked out the way the check works them out. */
function measured(table, map) {
  const out = { ayahsAligned: 0, ayahsTotal: 0, printWords: 0, qacWords: 0, joins: 0, splits: 0 };
  for (const [key, { qac, boxes, marks = [] }] of Object.entries(table)) {
    out.ayahsTotal += 1;
    out.printWords += boxes - marks.length;
    out.qacWords += qac;
    if (EXCEPTIONS[key]) continue;
    out.ayahsAligned += 1;
    out.joins += map[key]?.j?.length ?? 0;
    out.splits += Object.keys(map[key]?.s ?? {}).length;
  }
  return out;
}

const cleanRoots = {
  "1.json": { 1: [{ r: "ktb", n: 1, w: [1] }, { r: "qwl", n: 2, w: [2, 3] }], 3: [{ r: "Elm", n: 1, w: [1, 2] }] },
  [`${EXCEPTED[0].split(":")[0]}.json`]: { [EXCEPTED[0].split(":")[1]]: [{ r: "rHm", n: 1 }] },
};

/**
 * Build the tree and run the check. `table` drives the corpus and the pages
 * unless they are given; pass `null` for a part to leave it out.
 */
function run({ table = ayahs, map = cleanMap, exceptions = cleanExceptions, pin, morph, pages, roots = cleanRoots, extra = {} } = {}) {
  const files = {
    [MORPH]: morph ?? morphology(table),
    [`${WORDS}/README`]: "made-up pages",
    ...extra,
  };
  if (pages !== null) files[`${WORDS}/1.json`] = pages ?? shard(table);
  if (pin !== null) files[PIN] = JSON.stringify(pin ?? { ayahs: map, exceptions, measured: measured(table, map) });
  if (roots !== null) for (const [name, body] of Object.entries(roots)) files[`${ROOTS}/${name}`] = JSON.stringify(body);
  const root = makeFixture(files);
  try {
    return runGate("align", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:align passes a map whose joins and splits add up to the corpus's word count", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK: 5 ayahs map print→QAC exactly \(18 print words → 19 QAC words, 2 joins, 2 splits\), 4 named exceptions/);
  assert.match(r.out, /OK: 3 root-ayah pairs sit on lexical print words \(1 spread wider than their segment count\), 1 unplaced/);
});

test("gate:align refuses an exceptions list that differs from the code's, or gives no reason", () => {
  const { [EXCEPTED[0]]: _dropped, ...rest } = cleanExceptions;
  const r = run({ exceptions: { ...rest, "1:5": "short" } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /exceptions differ — segmentation\.mjs has \[/);
  assert.match(r.out, /exception 1:5 has no reason worth reading: "short"/);
});

test("gate:align refuses an ayah on two pages, or one the corpus does not have", () => {
  const twice = run({ extra: { [`${WORDS}/2.json`]: shard({ "1:5": ayahs["1:5"] }) } });
  assert.equal(twice.status, 1, twice.out);
  assert.match(twice.out, /1:5 appears in two shards — the map assumes one page per ayah/);
  const unknown = run({ table: { ...ayahs, "9:9": { qac: 1, boxes: 1 } }, morph: morphology(ayahs) });
  assert.equal(unknown.status, 1, unknown.out);
  assert.match(unknown.out, /9:9 is in the word shards but not in the QAC morphology/);
});

test("gate:align refuses a join or split that is not a word of that ayah", () => {
  const r = run({ map: { ...cleanMap, "1:1": { j: [4, 1] }, "1:5": { s: { 9: 2, 2: 1 } } } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1:1: join at print 4, which is not a lexical word here/);
  assert.match(r.out, /1:1: print 1 is the ayah's first word and cannot continue one/);
  assert.match(r.out, /1:5: split at print 9, which is not a lexical word here/);
  assert.match(r.out, /1:5: split at print 2 spans 1, which is not a split/);
});

test("gate:align refuses an ayah whose word count comes out wrong, a join that also splits included", () => {
  const plain = run({ map: { ...cleanMap, "1:2": {} } });
  assert.equal(plain.status, 1, plain.out);
  assert.match(plain.out, /1:2: the map yields 3 QAC words, the morphology has 2/);
  const both = run({ map: { ...cleanMap, "1:4": { j: [2], s: { 2: 2 } } } });
  assert.equal(both.status, 1, both.out);
  assert.match(both.out, /1:4: the map yields 2 QAC words, the morphology has 3/);
});

test("gate:align refuses a map naming an ayah no page holds, and stale totals", () => {
  const map = { ...cleanMap, "7:7": { j: [2] } };
  const pin = { ayahs: map, exceptions: { ...cleanExceptions, "8:8": "an ayah that is on no page at all" }, measured: measured(ayahs, cleanMap) };
  const r = run({ pin });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /the pin maps 7:7, which no word shard carries/);
  assert.match(r.out, /the pin excepts 8:8, which no word shard carries/);
  const stale = run({ pin: { ayahs: cleanMap, exceptions: cleanExceptions, measured: { ...measured(ayahs, cleanMap), joins: 9 } } });
  assert.equal(stale.status, 1, stale.out);
  assert.match(stale.out, /measured\.joins says 9, applying the map gives 2/);
});

test("gate:align refuses a root placed on no word, on a pause mark, out of order, or too few words", () => {
  const [es, ea] = EXCEPTED[0].split(":");
  const roots = {
    "1.json": {
      1: [{ r: "ktb", n: 1 }, { r: "qwl", n: 1, w: [4] }, { r: "Elm", n: 1, w: [3, 2] }, { r: "xyr", n: 1, w: [1, 1.5] }],
      2: [{ r: "wjh", n: 1, w: [] }, { r: "Hyy", n: 1, w: "2" }],
      5: [{ r: "Eyn", n: 3, w: [1, 2] }],
    },
    [`${es}.json`]: { [ea]: [{ r: "rHm", n: 1, w: [1] }] },
  };
  const r = run({ roots });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1:1 ktb: no w, but 1:1 is not an excepted ayah/);
  assert.match(r.out, /1:1 qwl: w has print word 4, which 1:1 has no lexical box for/);
  assert.match(r.out, /1:1 Elm: w is 3,2 — not ascending and unique/);
  assert.match(r.out, /1:1 xyr: w contains 1\.5, which is not an index/);
  assert.match(r.out, /1:2 wjh: w is \[\], which is not a non-empty list/);
  assert.match(r.out, /1:2 Hyy: w is "2", which is not a non-empty list/);
  assert.match(r.out, /1:5 Eyn: w places 2 words for 3 rooted segments/);
  assert.match(r.out, new RegExp(`${EXCEPTED[0]} rHm: carries w, but ${EXCEPTED[0]} is excepted`));
});

test("gate:align refuses a tree with no pages, no map or no roots", () => {
  const nopages = run({ pages: null });
  assert.equal(nopages.status, 1, nopages.out);
  assert.match(nopages.out, /no word shards carry any ayah under apps\/web\/public\/assets\/words\/hafs-kfqc/);
  const nopin = run({ pin: null });
  assert.equal(nopin.status, 1, nopin.out);
  assert.match(nopin.out, /gate:align — FAIL: no .*word-alignment\.pin\.json/);
  const noroots = run({ roots: null });
  assert.equal(noroots.status, 1, noroots.out);
  assert.match(noroots.out, /no .*roots\/hafs-kfqc\/ayah — run/);
});

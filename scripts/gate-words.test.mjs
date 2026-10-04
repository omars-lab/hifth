/**
 * The word-box check must refuse a word file that was edited after it was
 * built, a word whose middle lands on a different ayah from the one it claims,
 * a pause mark that sits too far above its own ayah, an ayah with words but no
 * outline on the page (or the other way round), an ayah placed on two pages,
 * and a pin whose counts disagree with the files. It must pass a clean page,
 * and refuse a missing pin or one that lists nothing rather than passing it.
 *
 * Each tree is one or two made-up pages: two ayah outlines stacked one above
 * the other, and a word file whose boxes sit inside them. The pin's hashes are
 * worked out when the test runs, so only the edit a test makes on purpose
 * breaks them.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PIN = "packages/etl/data/pages/word-boxes.pin.json";
const WORDS = "apps/web/public/assets/words/hafs-kfqc";
const PAGES = "apps/web/public/assets/pages/hafs-kfqc";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** One ayah outline: a full-width band from y0 to y0 + 40. */
const outline = (surah, ayah, d) =>
  `<path fill-opacity="0" d="${d}" ayah="${ayah}" class="ayahPolygon" number="${surah * 1000 + ayah}" surah="${surah}"/>`;
const band = (y0) => `M0 ${y0}h345v40H0Z`;
const svg = (...outlines) => `<svg viewBox="0 0 345 550"><g>${outlines.join("")}</g></svg>`;

/** 2:6 is the band from 0 to 40, 2:7 the band from 40 to 80. */
const cleanSvg = svg(outline(2, 6, band(0)), outline(2, 7, band(40)));

/**
 * Two words each. 2:7's second box is a pause mark set just above its line,
 * so it has to be dropped two units to meet its own outline — inside the
 * allowance of four.
 */
const cleanWords = {
  "2:6": { from: 1, boxes: [[10, 10, 20, 20], [50, 10, 20, 20]] },
  "2:7": { from: 1, boxes: [[10, 50, 20, 20], [60, 30, 10, 8]], marks: [2] },
};

/** A pin row for a shard, counted from the shard itself unless told otherwise. */
function pinRow(page, body, over = {}) {
  const { words } = JSON.parse(body);
  const boxes = Object.values(words).reduce((n, e) => n + e.boxes.length, 0);
  return { page, sha256: sha256(body), words: boxes, ayahs: Object.keys(words).length, ...over };
}

/**
 * Build a tree from `{ page: { svg, words } }`, run the check, clean up.
 * `rows` rewrites the pin's rows after they are counted; `extra` adds files.
 */
function run(pages = { 3: { svg: cleanSvg, words: cleanWords } }, { rows = (r) => r, extra = {}, pin } = {}) {
  const files = { ...extra };
  const pinRows = [];
  for (const [page, { svg: s, words }] of Object.entries(pages)) {
    const body = JSON.stringify({ page: Number(page), words });
    files[`${WORDS}/${page}.json`] = body;
    if (s !== null) files[`${PAGES}/${page}.svg`] = s;
    pinRows.push(pinRow(Number(page), body));
  }
  if (pin !== null) {
    files[PIN] = JSON.stringify(pin ?? { source: { repo: "made-up/print", commit: "0123456789abcdef" }, pages: rows(pinRows) });
  }
  const root = makeFixture(files);
  try {
    return runGate("words", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:words passes a page whose words and marks all land on their own ayah", () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 shard\(s\) match made-up\/print@01234567/);
  assert.match(r.out, /3 word boxes land inside their own ayah, and all 1 pause marks meet theirs \(1 needed a drop, worst 2\.0 of 4\)/);
  assert.match(r.out, /2 ayahs, each on exactly one page/);
});

test("gate:words refuses a word file that no longer matches its pin", () => {
  const r = run(undefined, { rows: ([row]) => [{ ...row, sha256: sha256("the file as it was built") }] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: shard does not match the pin — it was edited/);
});

test("gate:words refuses a word whose middle lands on the next ayah", () => {
  const words = { ...cleanWords, "2:6": { from: 1, boxes: [[10, 10, 20, 20], [50, 50, 20, 20]] } };
  const r = run({ 3: { svg: cleanSvg, words } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3 2:6#2: word centre lands on 2:7, not 2:6/);
});

test("gate:words refuses a pause mark set too far above its own ayah", () => {
  const words = { ...cleanWords, "2:7": { from: 1, boxes: [[10, 50, 20, 20], [60, 20, 10, 8]], marks: [2] } };
  const r = run({ 3: { svg: cleanSvg, words } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3 2:7#2: pause mark does not meet 2:7 within 4 units below its box/);
});

test("gate:words refuses an outline with no words, and words with no outline", () => {
  const words = { "2:6": cleanWords["2:6"], "2:9": cleanWords["2:7"] };
  const r = run({ 3: { svg: cleanSvg, words } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: 2:9 has boxes but no polygon/);
  assert.match(r.out, /page 3: 2:7 has a polygon but no boxes/);
});

test("gate:words refuses an ayah whose words are placed on two pages", () => {
  const r = run({ 3: { svg: cleanSvg, words: cleanWords }, 4: { svg: cleanSvg, words: cleanWords } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 4: 2:6 also has boxes on page 3/);
});

test("gate:words refuses boxes off the page, boxes with no size, and a mark outside its ayah's words", () => {
  const words = {
    "2:6": { from: 1, boxes: [[10, 10, 20, 20], [340, 10, 20, 20]], marks: [5] },
    "2:7": { from: 1, boxes: [[10, 50, 0, 20], [60, 50, 10, 8]] },
  };
  const r = run({ 3: { svg: cleanSvg, words } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /2:6#2: box falls outside the page's 0 0 345 550 viewBox/);
  assert.match(r.out, /2:7#1: box has no area/);
  assert.match(r.out, /2:6: mark 5 is outside 1\.\.2/);
});

test("gate:words refuses an outline drawn with curves it cannot measure", () => {
  const curved = svg(outline(2, 6, "M0 0h345c0 10 0 30 0 40H0Z"), outline(2, 7, band(40)));
  const r = run({ 3: { svg: curved, words: cleanWords } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3 2:6: tap polygon uses "c" — only straight-line commands are understood/);
});

test("gate:words refuses a pin whose counts disagree with the files", () => {
  const r = run(undefined, { rows: ([row]) => [{ ...row, words: 5, ayahs: 3 }] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: pin says 5 words, the shard holds 4/);
  assert.match(r.out, /page 3: pin says 3 ayahs, the shard holds 2/);
  const extra = run(undefined, { extra: { [`${WORDS}/9.json`]: "{}", [`${WORDS}/notes.txt`]: "x" } });
  assert.equal(extra.status, 1, extra.out);
  assert.match(extra.out, /the pin lists 1 shard\(s\); 2 are committed/);
  assert.match(extra.out, /1 file\(s\) in the word directory are not shards: notes\.txt/);
});

test("gate:words refuses a word file whose page is missing", () => {
  const r = run({ 3: { svg: null, words: cleanWords } });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /page 3: shard is committed but the page SVG it measures is not/);
});

test("gate:words refuses a missing pin, or one that lists nothing, rather than passing nothing", () => {
  const missing = run(undefined, { pin: null });
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /no word-boxes pin/);
  const empty = run({}, { pin: { source: { repo: "made-up/print", commit: "0123456789abcdef" }, pages: [] }, extra: { [`${WORDS}/.keep`]: "" } });
  assert.equal(empty.status, 1, empty.out);
  assert.match(empty.out, /the word-boxes pin lists no shards, so nothing is being checked/);
});

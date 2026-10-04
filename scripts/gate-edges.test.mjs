/**
 * The look-alike-links check must refuse shipped data where too many links
 * join two ayahs that share no words (the sign that ayah numbering broke), and
 * refuse a word range on a link that is lopsided, too narrow, too wide, lands
 * on a pause mark, sits on the wrong kind of link, or disagrees with the same
 * link read the other way. It must pass a clean set, and refuse a set with no
 * links or an incomplete word list rather than passing nothing.
 *
 * The word list is a made-up stand-in for the vendored morphology: one row per
 * word, written in Latin letters the check reads the same way, padded with one
 * unshared word per ayah so it covers all 6,236 ayahs as the real one does
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const MORPH = "packages/etl/data/roots/quranic-corpus-morphology-0.4.txt";
const ADJ = "apps/web/public/assets/adj/hafs-kfqc";
const WORDS = "apps/web/public/assets/words/hafs-kfqc";

/**
 * Ayahs 2:1 and 2:2 share a run of three words; every other ayah has one word
 * of its own, spelt from letters the shared words never use.
 */
const SHARED = { "2:1": ["ktb", "qwl", "Elm", "rHm"], "2:2": ["ktb", "qwl", "Elm", "xyr", "wjh", "Hyy", "Eyn"] };
const LETTERS = "bdfklmnqrstz";
const unshared = (i) => [0, 1, 2, 3].map((d) => LETTERS[Math.floor(i / 12 ** d) % 12]).join("");

function morphology(total = 6236) {
  const rows = ["# made-up word list for the gate test"];
  const add = (key, words) => words.forEach((w, i) => rows.push(`(${key}:${i + 1}:1)\t${w}\tN\tSTEM`));
  for (const [key, words] of Object.entries(SHARED)) add(key, words);
  for (let i = 0; i < total - 2; i += 1) add(`1:${i + 1}`, [unshared(i)]);
  return rows.join("\n") + "\n";
}

/** The print's word boxes: 2:1 has four words; 2:2 has eight, the fourth a pause mark. */
const box = [0, 0, 1, 1];
const page = JSON.stringify({
  page: 1,
  words: {
    "2:1": { from: 1, boxes: [box, box, box, box] },
    "2:2": { from: 1, boxes: Array(8).fill(box), marks: [4] },
  },
});

const link = (to, extra = {}) => ({ type: "mutashabih", to: `quran/hafs-kfqc/${to}`, ...extra });
const spans = (here, there) => ({ span: { from: here }, toSpan: { from: there } });
const shard = (byAyah) =>
  JSON.stringify(Object.fromEntries(Object.entries(byAyah).map(([a, edges]) => [a, { edges, ext: [] }])));

/** A clean pair: 2:1 ↔ 2:2 both ways with mirrored ranges, plus an unscored root link. */
const clean = {
  1: [link("2:2", spans([1, 3], [1, 3])), { type: "shared-root", to: "quran/hafs-kfqc/1:9" }],
  2: [link("2:1", spans([1, 3], [1, 3]))],
};

function run(byAyah, { words = morphology() } = {}) {
  const root = makeFixture({ [MORPH]: words, [`${ADJ}/2.json`]: shard(byAyah), [`${WORDS}/1.json`]: page });
  try {
    return runGate("edges", root);
  } finally {
    dropFixture(root);
  }
}

test("gate:edges passes links that share words and carry matching word ranges", () => {
  const r = run(clean);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK \(0\/2 scored edges share no words/);
  assert.match(r.out, /OK \(2 edges carry a word span, all inside their ayah; 2 have a reverse that mirrors them\)/);
  assert.match(r.out, /shared-root .* \(reported, not gated\)/);
});

test("gate:edges refuses data where too many links join ayahs with no words in common", () => {
  const r = run({ ...clean, 1: [...clean[1], link("1:7")] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1\/3 scored edges \(33\.3%\) share no words/);
  assert.match(r.out, /2:1 → 1:7 \(mutashabih\)/);
});

test("gate:edges refuses a word range narrower than the words the two ayahs share", () => {
  const r = run({ ...clean, 1: [link("2:2", spans([1, 2], [1, 3]))] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /2:1 span is 2 print words for a 3-word run — too narrow/);
});

test("gate:edges refuses a word range over twice the shared words", () => {
  const r = run({ ...clean, 1: [link("2:2", spans([1, 3], [1, 7]))] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /2:2 span is 7 print words for a 3-word run — over the 2× ceiling/);
});

test("gate:edges refuses a word range that ends on a pause mark", () => {
  const r = run({ ...clean, 1: [link("2:2", spans([1, 3], [1, 4]))] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /2:2 span endpoint 4 is not a lexical word of that ayah/);
});

test("gate:edges refuses a range on one end only, or on a link that is not a look-alike", () => {
  const r = run({
    ...clean,
    1: [link("2:2", { span: { from: [1, 3] } }), link("2:2", { type: "related-meaning", ...spans([1, 3], [1, 3]) })],
  });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /2:1 → 2:2: has span but not the other/);
  assert.match(r.out, /a related-meaning edge carries a span; only mutashabih may/);
});

test("gate:edges refuses a link whose reverse names different word ranges", () => {
  const r = run({ ...clean, 2: [link("2:1", spans([2, 5], [1, 3]))] });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /the derivation is order-dependent/);
});

test("gate:edges refuses an incomplete word list", () => {
  const r = run(clean, { words: morphology(6000) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /morphology covers 6000 ayahs, expected 6236/);
});

test("gate:edges refuses data with no links, or no look-alike links, rather than passing nothing", () => {
  const none = run({ 1: [] });
  assert.equal(none.status, 1, none.out);
  assert.match(none.out, /no edges found in the shipped shards/);
  const rootsOnly = run({ 1: [{ type: "shared-root", to: "quran/hafs-kfqc/2:2" }] });
  assert.equal(rootsOnly.status, 1, rootsOnly.out);
  assert.match(rootsOnly.out, /no mutashabih\/related-meaning edges found/);
});

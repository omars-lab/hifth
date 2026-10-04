/**
 * The structure-table check must refuse a surah's verse count, a juz start or
 * a hizb start that does not match the vendored Tanzil metadata, refuse a
 * table with an entry missing, refuse a metadata file that is not the whole
 * of it, and refuse hizb starts made by cutting each juz in half — the one
 * shortcut it was written to stop. It must pass the real tables.
 *
 * The rules are about the real 114 surahs, 30 juz and 240 quarters, so a
 * made-up table would prove nothing: each test copies the two committed files
 * (the metadata and core's tables, numbers only) into a made-up tree and
 * changes one thing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const XML = "packages/etl/data/meta/quran-data.xml";
const META = "packages/core/src/quran-meta.ts";
const repo = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const realXml = repo(XML);
const realMeta = repo(META);

/** Replace exactly one occurrence, so a test cannot silently change nothing. */
function once(text, from, to) {
  const n = text.split(from).length - 1;
  assert.equal(n, 1, `expected one ${JSON.stringify(from)}, found ${n}`);
  return text.replace(from, to);
}

function withTables({ xml = realXml, meta = realMeta } = {}, fn) {
  const root = makeFixture({ [XML]: xml, [META]: meta });
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:quran-meta passes the committed tables against the committed metadata", () => {
  withTables({}, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(114 ayah counts, 30 juz, 60 hizb from 240 quarters/);
  });
});

test("gate:quran-meta refuses a mistyped verse count", () => {
  withTables({ meta: once(realMeta, "7, 286, 200,", "7, 285, 200,") }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /AYAH_COUNTS\[1\] is 285, but the Tanzil metadata says 286/);
  });
});

test("gate:quran-meta refuses a juz that starts one verse early", () => {
  withTables({ meta: once(realMeta, "[1, 1], [2, 142], [2, 253],", "[1, 1], [2, 142], [2, 252],") }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /JUZ_STARTS\[2\] is 2:252, but the Tanzil metadata says 2:253/);
  });
});

test("gate:quran-meta refuses a hizb that starts one verse early", () => {
  withTables({ meta: once(realMeta, "[1, 1], [2, 75],", "[1, 1], [2, 74],") }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /HIZB_STARTS\[1\] is 2:74, but the Tanzil metadata says 2:75/);
  });
});

test("gate:quran-meta refuses a table with an entry missing", () => {
  withTables({ meta: once(realMeta, "[1, 1], [2, 75],", "[2, 75],") }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /HIZB_STARTS has 59 entries; the Tanzil metadata has 60/);
  });
});

test("gate:quran-meta refuses a metadata file that is not the whole of it", () => {
  const short = once(realXml, '<quarter index="2" sura="2" aya="26" />', "");
  withTables({ xml: short }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /does not look like the Tanzil metadata \(found 114 sura, 30 juz, 239 quarter/);
  });
});

test("gate:quran-meta refuses hizb starts made by cutting each juz in half", () => {
  // Move every even hizb's opening quarter to its juz's arithmetic midpoint.
  const counts = [...realXml.matchAll(/<sura\s+index="\d+"\s+ayas="(\d+)"/g)].map((m) => Number(m[1]));
  const offsets = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const abs = (s, a) => offsets[s - 1] + a;
  const at = (n) => {
    const s = offsets.findLastIndex((o) => o < n) + 1;
    return [s, n - offsets[s - 1]];
  };
  const juz = [...realXml.matchAll(/<juz\s+index="\d+"\s+sura="(\d+)"\s+aya="(\d+)"/g)].map((m) =>
    abs(Number(m[1]), Number(m[2])),
  );
  let halved = realXml;
  for (let k = 0; k < 30; k++) {
    const end = k === 29 ? total + 1 : juz[k + 1];
    const [s, a] = at(Math.floor((juz[k] + end) / 2));
    // Hizb 2k+2 opens at quarter 8k+5.
    halved = halved.replace(
      new RegExp(`<quarter index="${8 * k + 5}" sura="\\d+" aya="\\d+"`),
      `<quarter index="${8 * k + 5}" sura="${s}" aya="${a}"`,
    );
  }
  withTables({ xml: halved }, (root) => {
    const r = runGate("quran-meta", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /30 of 30 even hizbs sit at their juz's arithmetic midpoint — the real division has 4/);
  });
});

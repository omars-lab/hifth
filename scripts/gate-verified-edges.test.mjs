/**
 * The checked-links check must refuse a link a reader marked right that has
 * gone missing from the shipped data, refuse a link a reader marked wrong that
 * is shipping again, refuse a verdict it cannot read, and refuse a verdict list
 * that has been emptied out. It must pass when every verdict still holds
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const VERDICTS = "packages/etl/data/qa/verified-edges.json";
const ADJ = "apps/web/public/assets/adj/hafs-kfqc";

const right = { from: "2:48", to: "2:123", type: "mutashabih", verdict: "correct", verifiedBy: "t", verifiedOn: "2026-01-01" };
const rejected = { from: "2:48", to: "2:200", type: "mutashabih", verdict: "wrong", verifiedBy: "t", verifiedOn: "2026-01-02" };

const verdicts = (entries, edition = "hafs-kfqc") => JSON.stringify({ edition, entries });
const shard = (...tos) =>
  JSON.stringify({ 48: { edges: tos.map((to) => ({ type: "mutashabih", to: `quran/hafs-kfqc/${to}` })), ext: [] } });

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:verified-edges passes when every verdict still holds", () => {
  withFixture({ [VERDICTS]: verdicts([right, rejected]), [`${ADJ}/2.json`]: shard("2:123", "2:5") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(1 verified edges still present, 1 rejected edges still absent\)/);
  });
});

test("gate:verified-edges refuses a link marked right that is no longer shipped", () => {
  withFixture({ [VERDICTS]: verdicts([right, rejected]), [`${ADJ}/2.json`]: shard("2:5") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /LOST — 2:48 → 2:123 \(mutashabih\)/);
  });
});

test("gate:verified-edges refuses a link marked right whose whole surah is missing", () => {
  withFixture({ [VERDICTS]: verdicts([right]), [`${ADJ}/3.json`]: shard("2:123") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /LOST — 2:48 → 2:123 .* no shard for surah 2/);
  });
});

test("gate:verified-edges refuses a link marked wrong that is shipping again", () => {
  withFixture({ [VERDICTS]: verdicts([right, rejected]), [`${ADJ}/2.json`]: shard("2:123", "2:200") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /RETURNED — 2:48 → 2:200 \(mutashabih\)/);
    assert.doesNotMatch(r.out, /LOST/);
  });
});

test("gate:verified-edges refuses a verdict it cannot read", () => {
  const odd = { ...right, verdict: "maybe" };
  const { verdict: _none, ...bare } = right;
  withFixture({ [VERDICTS]: verdicts([odd, bare]), [`${ADJ}/2.json`]: shard("2:123") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /unknown verdict "maybe"/);
    assert.match(r.out, /malformed entry/);
  });
});

test("gate:verified-edges refuses a verdict list with no edition, or no list at all", () => {
  withFixture({ [VERDICTS]: verdicts([right], ""), [`${ADJ}/2.json`]: shard("2:123") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /fixture has no `edition`/);
  });
  withFixture({ [`${ADJ}/2.json`]: shard("2:123") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /fixture missing/);
  });
});

test("gate:verified-edges refuses an emptied verdict list rather than passing nothing", () => {
  withFixture({ [VERDICTS]: verdicts([]), [`${ADJ}/2.json`]: shard("2:123") }, (root) => {
    const r = runGate("verified-edges", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /holds no verdicts/);
  });
});

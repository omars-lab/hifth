/**
 * The screenshot-size check must refuse a set of saved screenshots that has
 * grown past its 12 MB budget, counting every platform's set together, and
 * refuse a set that is empty or missing — a picture check with nothing to
 * compare against passes everything. It must pass a small set, and count only
 * the pictures, not other files lying beside them.
 *
 * The big files are made by stretching an empty file to size, so the test
 * writes almost nothing to disk.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const SHOTS = "apps/web/e2e/__screenshots__";
const MB = 1024 * 1024;

/** A tree holding the given shots, each `{ "darwin/page-1.png": bytes }`. */
function withShots(sizes, fn, extra = {}) {
  const files = { ...extra };
  for (const rel of Object.keys(sizes)) files[`${SHOTS}/${rel}`] = "";
  const root = makeFixture(files);
  try {
    for (const [rel, bytes] of Object.entries(sizes)) truncateSync(join(root, SHOTS, rel), bytes);
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:golden-size passes a small set of screenshots", () => {
  withShots({ "darwin/page-1.png": 2 * MB, "darwin/page-2.png": MB }, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(3\.0 MB \/ 12\.0 MB budget, 2 baselines\)/);
  });
});

test("gate:golden-size counts only the pictures, not other files beside them", () => {
  withShots({ "darwin/page-1.png": MB, "darwin/notes.txt": 20 * MB }, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(1\.0 MB \/ 12\.0 MB budget, 1 baselines\)/);
  });
});

test("gate:golden-size refuses a set that has grown past its budget", () => {
  withShots({ "darwin/page-1.png": 13 * MB }, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /13\.0 MB of baselines over a 12\.0 MB budget/);
  });
});

test("gate:golden-size adds every platform's set together against the budget", () => {
  withShots({ "darwin/page-1.png": 7 * MB, "linux/page-1.png": 7 * MB }, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /14\.0 MB of baselines over a 12\.0 MB budget/);
  });
});

test("gate:golden-size refuses a set with no screenshots in it", () => {
  withShots({}, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no baselines found/);
  }, { [`${SHOTS}/darwin/.keep`]: "" });
});

test("gate:golden-size refuses a tree where the screenshots folder is gone, and says why", () => {
  withShots({}, (root) => {
    const r = runGate("golden-size", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no baselines found/);
  }, { "apps/web/package.json": "{}" });
});

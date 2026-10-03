/**
 * The revision-record check must refuse a module outside its allow-list that
 * imports the record, refuse a way off the device inside the record's own
 * modules, and pass a tree where only the allowed modules touch it. The check
 * reads this file too, so the offending import is assembled at run time rather
 * than written out (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const RECORD = "packages/core/src/revision.ts";
const STORE = "apps/web/src/revision-store.ts";
const importStore = "import { x } " + "from " + '"../revision-store";';
const importBarrel = "import { rollUp } " + "from " + '"@hifth/core";';
const JUMPS = "packages/core/src/confusions.ts";
const JUMP_STORE = "apps/web/src/bookmark-store.ts";
const importJumps = "import {\n  markConfusion,\n} " + "from " + '"@hifth/core";';

/** The record, its store, and every module the check already permits. */
const clean = {
  [RECORD]: "export function rollUp() { return 1; }",
  [STORE]: "import { rollUp } " + "from " + '"@hifth/core/src/revision.js";\nexport const s = rollUp();',
  "apps/web/src/App.tsx": importBarrel,
  "apps/web/src/components/RevisionMap.tsx": importBarrel,
  "packages/core/src/index.ts": "export * " + "from " + '"./revision.js";',
  "scripts/build-thing.mjs": "export const nothing = 0;",
  [JUMPS]: "export function markConfusion() { return []; }",
  [JUMP_STORE]: importJumps,
  "apps/web/src/useBookmarks.ts": "import { x } " + "from " + '"./bookmark-store";',
  "packages/core/src/bookmarks.ts": "import { isConfusion } " + "from " + '"./confusions.js";',
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:revision-privacy passes when only the allowed modules reach the record", () => {
  withFixture(clean, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(4 record modules/);
  });
});

test("gate:revision-privacy refuses a new importer of the record", () => {
  withFixture({ ...clean, "apps/web/src/components/ShareSheet.tsx": importStore }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /ShareSheet\.tsx imports the revision record/);
  });
});

test("gate:revision-privacy refuses a module that reaches the record through the barrel", () => {
  withFixture({ ...clean, "apps/web/src/analytics.ts": importBarrel }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /analytics\.ts imports the revision record/);
  });
});

test("gate:revision-privacy refuses a way off the device inside the record's own module", () => {
  const hatch = "fet" + "ch(";
  withFixture({ ...clean, [RECORD]: `export function rollUp() { ${hatch}"/x"); return 1; }` }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /revision\.ts contains `fetch\(`/);
  });
});

test("gate:revision-privacy lets a test file see the record", () => {
  withFixture({ ...clean, "apps/web/src/revision-store.test.ts": importStore }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 0, r.out);
  });
});

test("gate:revision-privacy refuses an allow-list that names a file which is gone", () => {
  const { "apps/web/src/components/RevisionMap.tsx": _gone, ...without } = clean;
  withFixture(without, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /RevisionMap\.tsx, which no longer exists/);
  });
});

test("gate:revision-privacy refuses a new importer of the confusion-jump record", () => {
  withFixture({ ...clean, "apps/web/src/components/ShareSheet.tsx": importJumps }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /ShareSheet\.tsx imports the confusion-jump record/);
  });
});

test("gate:revision-privacy refuses a way off the device inside the jump store", () => {
  const hatch = "navigator.send" + "Beacon(";
  withFixture({ ...clean, [JUMP_STORE]: `${importJumps}\n${hatch}"/x");` }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /bookmark-store\.ts contains `sendBeacon`/);
  });
});

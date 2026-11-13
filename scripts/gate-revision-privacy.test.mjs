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
const DAYS = "packages/core/src/revision-days.ts";
const importDays = "import { daysOf, type DayCount } " + "from " + '"@hifth/core";';
const JUMPS = "packages/core/src/confusions.ts";
const JUMP_STORE = "apps/web/src/bookmark-store.ts";
const importJumps = "import {\n  markConfusion,\n} " + "from " + '"@hifth/core";';
const USAGE = "apps/web/src/usage.ts";
const USAGE_STORE = "apps/web/src/usage-store.ts";
const importUsage = "import { countUse } " + "from " + '"./usage-store";';

/** The record, its store, and every module the check already permits. */
const clean = {
  [RECORD]: "export function rollUp() { return 1; }",
  [STORE]: "import { rollUp } " + "from " + '"@hifth/core/src/revision.js";\nexport const s = rollUp();',
  "apps/web/src/App.tsx": importBarrel,
  "apps/web/src/components/RevisionMap.tsx": importBarrel,
  "apps/web/src/components/RevisionDays.tsx": importDays,
  [DAYS]: "import { dayOf } " + "from " + '"./revision.js";\nexport function daysOf() { return [dayOf]; }',
  "packages/core/src/index.ts": "export * " + "from " + '"./revision.js";',
  "scripts/build-thing.mjs": "export const nothing = 0;",
  [JUMPS]: "export function markConfusion() { return []; }",
  [JUMP_STORE]: importJumps,
  "apps/web/src/useBookmarks.ts": "import { x } " + "from " + '"./bookmark-store";',
  "packages/core/src/bookmarks.ts": "import { isConfusion } " + "from " + '"./confusions.js";',
  [USAGE]: "export function rollUpUse() { return []; }",
  [USAGE_STORE]: "import { rollUpUse } " + "from " + '"./usage.js";',
  "apps/web/src/use-count.ts": importUsage,
  "apps/web/src/components/UsageReadout.tsx": importUsage,
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
    assert.match(r.out, /OK \(7 record modules/);
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

test("gate:revision-privacy refuses a new reader of the day-by-day count", () => {
  withFixture({ ...clean, "apps/web/src/components/ShareDays.tsx": importDays }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /ShareDays\.tsx imports the revision record/);
  });
});

test("gate:revision-privacy refuses a way off the device inside the day-by-day count", () => {
  withFixture({ ...clean, [DAYS]: clean[DAYS] + "\nfetch" + '("/days");' }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /revision-days\.ts contains/);
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

test("gate:revision-privacy refuses a new importer of the usage counts", () => {
  withFixture({ ...clean, "apps/web/src/components/ShareSheet.tsx": importUsage }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /ShareSheet\.tsx imports the usage counts/);
  });
});

test("gate:revision-privacy refuses a way off the device inside the usage store", () => {
  const hatch = "fet" + "ch(";
  withFixture({ ...clean, [USAGE_STORE]: `export function countUse() { ${hatch}"/x"); }` }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /usage-store\.ts contains `fetch\(`/);
  });
});

// The record leaves the device one way the reader chooses: the carry to
// hifth.app, sent only when they tick the box that names it. The app hands the
// record's reader to that card and to nothing else.
const readerImport = "import { readRecord, recordLook } " + "from " + '"./revision-store";\n';
const toCard = "<MovedSheet readRecord={readRecord} />";

test("gate:revision-privacy passes when the app hands the record only to the carry card", () => {
  withFixture({ ...clean, "apps/web/src/App.tsx": readerImport + toCard }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 0, r.out);
  });
});

test("gate:revision-privacy refuses the app handing the record anywhere else", () => {
  withFixture({ ...clean, "apps/web/src/App.tsx": readerImport + toCard + "\n<ShareSheet read={readRecord} />" }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /App\.tsx uses readRecord outside the carry card/);
  });
});

test("gate:revision-privacy refuses the record's reader under another name", () => {
  const renamed = "import { readRecord as everything } " + "from " + '"./revision-store";\n';
  withFixture({ ...clean, "apps/web/src/App.tsx": renamed + "<ShareSheet read={everything} />" }, (root) => {
    const r = runGate("revision-privacy", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /App\.tsx uses readRecord outside the carry card/);
  });
});

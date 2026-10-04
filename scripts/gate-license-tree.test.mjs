/**
 * The package-licence check must refuse a shipped package — reached from the
 * app's own dependencies or through the service worker's toolkit, however many
 * steps away — whose licence is copyleft, unstated, or one it has never
 * classified, and refuse a dependency that is not installed at all. It must
 * pass a tree where everything that ships is permissive, without being fooled
 * by build-only tools that never ship, and must refuse an empty install rather
 * than passing nothing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

/** One installed package, laid out the way pnpm's store lays it out. */
const pkg = (name, license, dependencies = {}, extra = {}) => ({
  [`node_modules/.pnpm/${name.replace("/", "+")}@1.0.0/node_modules/${name}/package.json`]: JSON.stringify({
    name,
    version: "1.0.0",
    ...(license === undefined ? {} : { license }),
    dependencies,
    ...extra,
  }),
});

const app = (dependencies) => ({
  "apps/web/package.json": JSON.stringify({ name: "web", dependencies }),
});

const clean = {
  ...app({ "ui-lib": "^1.0.0", "@hifth/core": "workspace:*" }),
  // Its devDependencies are its own build tools; they do not ship, so the
  // copyleft one below must not be judged.
  ...pkg("ui-lib", "MIT", { "small-helper": "^1.0.0" }, { devDependencies: { "copyleft-tool": "^1.0.0" } }),
  ...pkg("small-helper", "(MIT OR GPL-3.0)"),
  ...pkg("copyleft-tool", "GPL-3.0"),
  ...pkg("workbox-window", "MIT"),
  // The service worker: whatever workbox-* the generator lists, and what they read.
  ...pkg("workbox-build", "MIT", { "workbox-expiration": "^1.0.0", "unrelated-builder": "^1.0.0" }),
  ...pkg("workbox-expiration", "MIT", { "tiny-db": "^1.0.0" }),
  ...pkg("tiny-db", "ISC"),
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:license-tree passes when everything that ships is permissive", () => {
  withFixture(clean, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 0, r.out);
    // ui-lib, small-helper, workbox-window, workbox-expiration, tiny-db.
    assert.match(r.out, /OK \(5 shipped package\(s\)/);
    assert.doesNotMatch(r.out, /copyleft-tool|unrelated-builder/);
  });
});

test("gate:license-tree refuses a copyleft package two steps from the app", () => {
  withFixture({ ...clean, ...pkg("small-helper", "GPL-3.0") }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /small-helper@1\.0\.0: GPL-3\.0/);
  });
});

test("gate:license-tree refuses a package that only reaches the reader through the service worker", () => {
  withFixture({ ...clean, ...pkg("tiny-db", "SSPL-1.0") }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /tiny-db@1\.0\.0: SSPL-1\.0/);
  });
});

test("gate:license-tree refuses a package that states no licence", () => {
  withFixture({ ...clean, ...pkg("small-helper", undefined) }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /small-helper@1\.0\.0: UNSTATED/);
  });
});

test("gate:license-tree refuses a pair of licences when one of them must be taken", () => {
  withFixture({ ...clean, ...pkg("small-helper", "MIT AND GPL-3.0") }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /small-helper@1\.0\.0: MIT AND GPL-3\.0/);
  });
});

test("gate:license-tree refuses a dependency that is not installed", () => {
  withFixture({ ...clean, ...app({ "ui-lib": "^1.0.0", "ghost-lib": "^1.0.0" }) }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /ghost-lib@\?: UNRESOLVED/);
  });
});

test("gate:license-tree stops judging the service worker's packages once the worker is gone", () => {
  const noWorker = Object.fromEntries(Object.entries(clean).filter(([p]) => !p.includes("/workbox-build/")));
  withFixture({ ...noWorker, ...pkg("tiny-db", "SSPL-1.0") }, (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 0, r.out);
    // ui-lib, small-helper, workbox-window: nothing from the worker.
    assert.match(r.out, /OK \(3 shipped package\(s\)/);
  });
});

test("gate:license-tree refuses an empty install rather than passing nothing", () => {
  withFixture(app({ "ui-lib": "^1.0.0" }), (root) => {
    const r = runGate("license-tree", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no installed packages found/);
  });
});

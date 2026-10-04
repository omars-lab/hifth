/**
 * The data-script list check must pass when the committed list of data scripts
 * was built from the scripts on disk and what the code map says about them. It
 * must refuse a list built before a script was added, renamed, or described
 * differently in the code map; a list that is missing or carries no stamp; and
 * a scripts folder with nothing in it. Asked only to list, it prints the count
 * and never fails (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const DIR = "packages/etl/scripts";
const DOC = "docs/design/etl-scripts.md";

const map = (note) =>
  JSON.stringify({
    features: [{ id: "shards", entry: [{ file: `${DIR}/build-shards.mjs`, symbol: "build", note }] }],
  });

// The renderer writes into a design folder that is always there in the repository.
const design = { "docs/design/README.md": "# Designs\n" };

const files = () => ({
  ...design,
  [`${DIR}/build-shards.mjs`]: "export function build() {}\n",
  [`${DIR}/probe-edges.mjs`]: "export function probe() {}\n",
  [`${DIR}/lib/read.mjs`]: "export function read() {}\n",
  "docs/map.json": map("Writes the committed page shards. Run it after a print change."),
});

const env = (root) => ({ ...fixtureEnv(), HIFTH_GATE_ROOT: root });

/** Run the real renderer so the list is stamped from what the fixture holds. */
function stamp(root) {
  const r = spawnSync(process.execPath, [new URL("./build-etl-scripts.mjs", import.meta.url).pathname], {
    encoding: "utf8",
    env: env(root),
  });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
}

function withTree(tree, fn, { after, stamped = true } = {}) {
  const root = makeFixture(tree);
  try {
    if (stamped) stamp(root);
    if (after) after(root);
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

function refuses(tree, pattern, opts) {
  withTree(
    tree,
    (root) => {
      const r = runGate("etl-scripts", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /✗/);
      assert.match(r.out, pattern);
    },
    opts,
  );
}

const STALE = /etl-scripts\.md was built from [0-9a-f]+, the scripts on disk now hash to [0-9a-f]+/;

test("gate:etl-scripts passes a list built from the scripts on disk", () => {
  withTree(files(), (root) => {
    const r = runGate("etl-scripts", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /✓ docs\/design\/etl-scripts\.md matches the 3 scripts on disk/);
  });
});

test("gate:etl-scripts refuses a list built before a script was added", () => {
  refuses(files(), STALE, { after: (root) => writeFileSync(join(root, DIR, "score-marks.mjs"), "export {};\n") });
});

test("gate:etl-scripts refuses a list built before a script was renamed", () => {
  refuses(files(), STALE, {
    after: (root) => renameSync(join(root, DIR, "probe-edges.mjs"), join(root, DIR, "probe-margins.mjs")),
  });
});

test("gate:etl-scripts refuses a list built before the code map described a script differently", () => {
  refuses(files(), STALE, {
    after: (root) => writeFileSync(join(root, "docs/map.json"), map("Writes the shards the app reads.")),
  });
});

test("gate:etl-scripts refuses a missing list", () => {
  refuses(files(), /etl-scripts\.md is missing or has no hash stamp/, { stamped: false });
});

test("gate:etl-scripts refuses a list with no stamp", () => {
  refuses(files(), /etl-scripts\.md is missing or has no hash stamp/, {
    after: (root) => writeFileSync(join(root, DOC), "# The data scripts\n\nA hand-written list.\n"),
  });
});

test("gate:etl-scripts refuses a scripts folder with nothing in it", () => {
  // The folder is there and the list was built from it; it simply holds no scripts.
  const tree = { [`${DIR}/README.md`]: "Nothing here yet.\n", "docs/map.json": JSON.stringify({ features: [] }), ...design };
  refuses(tree, /holds no scripts at all/);
});

test("gate:etl-scripts only lists, and never fails, when asked to list", () => {
  withTree(
    files(),
    (root) => {
      const r = spawnSync(process.execPath, [new URL("./gate-etl-scripts.mjs", import.meta.url).pathname, "--list"], {
        encoding: "utf8",
        env: env(root),
      });
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      assert.match(r.stdout, /4 scripts, 1 in the code map, 3 not:/);
    },
    { after: (root) => writeFileSync(join(root, DIR, "score-marks.mjs"), "export {};\n") },
  );
});

/**
 * The code-map check must pass a map whose every pointer names a file that
 * exists and a name that still appears in its code. It must refuse a pointer at
 * a file that is gone, at a name no line contains, and at a name that survives
 * only in a comment, and refuse a map that names no code at all rather than
 * print OK for checking nothing. On the commit path it stays quiet when nothing
 * staged is on the map, and still refuses a staged file whose pointer broke
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const STAGE = "apps/web/src/PageStage.tsx";
const EDGES = "packages/core/src/edges.ts";

const feature = (entry) => ({
  id: "page-turn",
  layer: "web",
  what: "How a page turns.",
  entry,
  extend: ["Add a new turn."],
  gates: ["the page-turn tests"],
});

const pointers = [
  { file: STAGE, symbol: "navigateTo", note: "Where a turn starts." },
  { file: EDGES, symbol: "bucketEdges", note: "Where the edges are sorted." },
];

const code = {
  [STAGE]: "// navigateTo moves the stage.\nexport function navigateTo(page) {\n  return page;\n}\n",
  [EDGES]: "export const bucketEdges = (e) => e;\n",
  "apps/web/src/unmapped.ts": "export const nothing = 0;\n",
};

function withMap(features, fn, files = code) {
  const root = makeFixture({ "docs/map.json": JSON.stringify({ features }, null, 2), ...files });
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

/** The commit hook's path: only pointers into the staged files are checked. */
function runStaged(root, staged) {
  const r = spawnSync(
    process.execPath,
    [new URL("./gate-map.mjs", import.meta.url).pathname, "--files", ...staged.map((f) => join(root, f))],
    { encoding: "utf8", env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root } },
  );
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test("gate:map passes a map whose every pointer resolves", () => {
  withMap([feature(pointers)], (root) => {
    const r = runGate("map", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(1 features, 2 pointers, all resolve\)/);
  });
});

test("gate:map refuses a pointer at a file that is gone", () => {
  const { [EDGES]: _gone, ...files } = code;
  withMap(
    [feature(pointers)],
    (root) => {
      const r = runGate("map", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /page-turn → packages\/core\/src\/edges\.ts \(bucketEdges\): file does not exist/);
    },
    files,
  );
});

test("gate:map refuses a pointer at a name no line contains", () => {
  withMap([feature(pointers)], (root) => {
    const r = runGate("map", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /edges\.ts \(bucketEdges\): no line contains "bucketEdges"/);
  }, { ...code, [EDGES]: "export const sortEdges = (e) => e;\n" });
});

test("gate:map refuses a name that survives only in a comment", () => {
  withMap([feature(pointers)], (root) => {
    const r = runGate("map", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /PageStage\.tsx \(navigateTo\): "navigateTo" appears only in comments here/);
  }, { ...code, [STAGE]: "// navigateTo used to live here.\nexport function go(page) {\n  return page;\n}\n" });
});

test("gate:map refuses a map that names no code at all", () => {
  withMap([], (root) => {
    const r = runGate("map", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /names no code at all/);
  });
});

test("gate:map says nothing on a commit that touches nothing on the map", () => {
  withMap([feature(pointers)], (root) => {
    const r = runStaged(root, ["apps/web/src/unmapped.ts"]);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.out, "");
  }, { ...code, [EDGES]: "export const sortEdges = (e) => e;\n" });
});

test("gate:map refuses a commit that breaks a pointer into a staged file", () => {
  withMap([feature(pointers)], (root) => {
    const r = runStaged(root, [EDGES]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no line contains "bucketEdges"/);
  }, { ...code, [EDGES]: "export const sortEdges = (e) => e;\n" });
});

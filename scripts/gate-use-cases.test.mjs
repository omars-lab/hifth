/**
 * The use-case check must pass a file whose every use case belongs to a known
 * reader, joins a feature on the code map, points at code that is still there,
 * and is proven by a test that still carries its title or by a check the
 * project runs. It must refuse a reader with no use cases, a use case with no
 * proof, a feature the map does not know, a proof naming a check nobody runs, a
 * proof whose test title drifted or is not a test, a code pointer that broke, a
 * stale summary page, and a file with no use cases at all
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const SPEC = "apps/web/e2e/turn.spec.ts";
const STAGE = "apps/web/src/PageStage.tsx";
const TITLE = "a swipe turns the page";

const data = () => ({
  actors: [{ id: "hafiz", name: "A hafiz", what: "Revises from memory." }],
  useCases: [
    {
      id: "turn-a-page",
      actor: "hafiz",
      goal: "Turn to the next page.",
      feature: "page-turn",
      code: [{ file: STAGE, symbol: "navigateTo" }],
      proof: [{ file: SPEC, test: TITLE }],
    },
    {
      id: "read-offline",
      actor: "hafiz",
      goal: "Read with no signal.",
      feature: "page-turn",
      proof: [{ gate: "gate:budget" }],
      includes: ["turn-a-page"],
    },
  ],
});

const files = (d) => ({
  "docs/use-cases.json": JSON.stringify(d, null, 2),
  "docs/map.json": JSON.stringify({ features: [{ id: "page-turn" }] }),
  "package.json": JSON.stringify({ scripts: { "gate:budget": "node scripts/gate-budget.mjs" } }),
  [STAGE]: "export function navigateTo(page) {\n  return page;\n}\n",
  [SPEC]: `test("${TITLE}", async () => {});\n`,
});

/** Run the real renderer so the summary page is stamped from what the fixture holds. */
function withTree(tree, fn, { after } = {}) {
  const root = makeFixture(tree);
  try {
    const r = spawnSync(process.execPath, [new URL("./build-use-cases.mjs", import.meta.url).pathname], {
      encoding: "utf8",
      env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
    });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
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
      const r = runGate("use-cases", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /gate:use-cases — FAIL/);
      assert.match(r.out, pattern);
    },
    opts,
  );
}

const patched = (id, patch) => {
  const d = data();
  d.useCases = d.useCases.map((u) => (u.id === id ? { ...u, ...patch } : u));
  return d;
};

test("gate:use-cases passes a file whose every promise is proven", () => {
  withTree(files(data()), (root) => {
    const r = runGate("use-cases", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(1 actors, 2 use cases, 2 pointers, all proven\)/);
  });
});

test("gate:use-cases refuses a reader with no use cases", () => {
  const d = data();
  d.actors.push({ id: "teacher", name: "A teacher", what: "Listens." });
  refuses(files(d), /actor "teacher" has no use cases/);
});

test("gate:use-cases refuses a use case for a reader nobody described", () => {
  refuses(files(patched("read-offline", { actor: "imam" })), /read-offline: no such actor "imam"/);
});

test("gate:use-cases refuses a use case that needs one that does not exist", () => {
  refuses(files(patched("read-offline", { includes: ["open-the-app"] })), /read-offline: includes "open-the-app", which is not a use case/);
});

test("gate:use-cases refuses a use case that needs itself", () => {
  refuses(files(patched("read-offline", { includes: ["read-offline"] })), /read-offline: includes itself/);
});

test("gate:use-cases refuses a use case with no proof", () => {
  refuses(files(patched("read-offline", { proof: [] })), /read-offline: no proof/);
});

test("gate:use-cases refuses a feature the code map does not know", () => {
  refuses(files(patched("read-offline", { feature: "page-curl" })), /read-offline: feature "page-curl" is not in docs\/map\.json/);
});

test("gate:use-cases refuses a proof naming a check nobody runs", () => {
  refuses(files(patched("read-offline", { proof: [{ gate: "gate:nothing" }] })), /proof names "gate:nothing", which package\.json does not define/);
});

test("gate:use-cases refuses a proof whose test title drifted", () => {
  const tree = { ...files(data()), [SPEC]: 'test("a swipe turns a page", async () => {});\n' };
  refuses(tree, /turn-a-page → apps\/web\/e2e\/turn\.spec\.ts: no test in this file is titled "a swipe turns the page"/);
});

test("gate:use-cases refuses a proof that is only a string, not a test", () => {
  const tree = { ...files(data()), [SPEC]: `const note = "${TITLE}";\n` };
  refuses(tree, /appears in this file but not as a test title/);
});

test("gate:use-cases refuses a code pointer that broke", () => {
  const tree = { ...files(data()), [STAGE]: "export function go(page) {\n  return page;\n}\n" };
  refuses(tree, /turn-a-page → apps\/web\/src\/PageStage\.tsx \(navigateTo\): no line contains "navigateTo"/);
});

test("gate:use-cases refuses a summary page built from an older file", () => {
  const edit = (root) => {
    const path = join(root, "docs/use-cases.json");
    const d = JSON.parse(readFileSync(path, "utf8"));
    d.useCases[0].goal = "Turn back a page.";
    writeFileSync(path, JSON.stringify(d));
  };
  refuses(files(data()), /docs\/use-cases\.md was built from [0-9a-f]+, the source is now [0-9a-f]+/, { after: edit });
});

test("gate:use-cases refuses a file with no use cases at all", () => {
  refuses(files({ actors: [], useCases: [] }), /names no use case at all/);
});

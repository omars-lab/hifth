/**
 * The decision-register check must pass a register whose open decision has two
 * options, a page checked in, a script that rebuilds it and the page's own
 * address on the site, and whose records all have a row. It must refuse an open
 * decision with one option, a link to anywhere but the page's own address, a link
 * with no checked-in copy, a question that names a file, a settled decision that
 * does not say who settled it, a related decision that does not name it back, a
 * record with no row, and an index page built from an older register
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

const SITE = "https://blog.bytesofpurpose.com/hifth";
const PAGE = "docs/design/page-bar-options.html";
const BUILDER = "scripts/build-page-bar-options.mjs";
const RECORD = "docs/decisions/page-bar.md";
const SETTLED = "docs/decisions/colours.md";

const open = () => ({
  id: "page-bar",
  question: "How should the bar along the foot of the page look?",
  status: "open",
  options: [
    { id: "A", label: "A thin line" },
    { id: "B", label: "A row of dots" },
  ],
  artifact: `${SITE}/${PAGE}`,
  page: PAGE,
  builtBy: BUILDER,
  doc: RECORD,
  related: ["colours"],
});

const settled = () => ({
  id: "colours",
  question: "Which colours mark a rule of recitation?",
  status: "decided",
  options: [
    { id: "A", label: "The printed colours" },
    { id: "B", label: "Our own" },
  ],
  decided: "A",
  by: "owner",
  date: "2026-09-01",
  doc: SETTLED,
  related: ["page-bar"],
});

/**
 * A register of the given rows, its records, the page and its builder, with the
 * index page stamped by the real renderer so only what a test changes is stale.
 */
function withRegister(rows, fn, { extra = {}, stamp = true, after } = {}) {
  const root = makeFixture({
    "docs/decisions.json": JSON.stringify({ decisions: rows }, null, 2),
    [RECORD]: `# A thin line reads at a glance\n\nLook at [the options](../design/page-bar-options.html), or open ${SITE}/${PAGE}.\n`,
    [SETTLED]: "# The printed colours\n\nThe reasons.\n",
    [PAGE]: "<!doctype html><title>Page bar</title>",
    [BUILDER]: "export {};\n",
    ...extra,
  });
  try {
    if (stamp) {
      const r = spawnSync(process.execPath, [new URL("./build-decisions-doc.mjs", import.meta.url).pathname], {
        encoding: "utf8",
        env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
      });
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    }
    if (after) after(root);
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:decisions passes a register a stranger could take part in", () => {
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK: 2 decisions, 2 records, 1 open/);
  });
});

test("gate:decisions refuses an open decision with only one option", () => {
  const row = { ...open(), options: [{ id: "A", label: "A thin line" }] };
  withRegister([row, settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /page-bar\]: an open decision names two or more options/);
  });
});

test("gate:decisions refuses a link that is not the page's own address on the site", () => {
  const row = { ...open(), artifact: "https://claude.ai/code/artifact/0000" };
  withRegister([row, settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /artifact must be the page's own address on the site/);
  });
});

test("gate:decisions refuses a link with no checked-in copy", () => {
  // The index renderer cannot draw this row at all, so the page is stamped from
  // the good register and the copy is dropped from the row afterwards.
  const drop = (root) => {
    const rows = [{ ...open(), page: null, builtBy: null }, settled()];
    writeFileSync(join(root, "docs/decisions.json"), JSON.stringify({ decisions: rows }));
  };
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /artifact with no checked-in page/);
  }, { after: drop });
});

test("gate:decisions refuses a checked-in page nobody could rebuild", () => {
  const row = { ...open(), builtBy: null };
  withRegister([row, settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /has no builtBy — nobody could rebuild it/);
  });
});

test("gate:decisions refuses a record that never links its own picture", () => {
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /page-bar\.md never links page-bar-options\.html/);
  }, { extra: { [RECORD]: "# A thin line reads at a glance\n\nNo picture here.\n" } });
});

test("gate:decisions refuses a question that names a file", () => {
  const row = { ...open(), question: "Should the bar in page-bar.css be thinner?" };
  withRegister([row, settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /question is not plain language: page-bar\.css/);
  });
});

test("gate:decisions refuses a settled decision that does not say who settled it", () => {
  const { by: _by, ...row } = settled();
  withRegister([open(), row], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /colours\]: decided, but does not say who decided it and when/);
  });
});

test("gate:decisions refuses a related decision that does not name it back", () => {
  withRegister([open(), { ...settled(), related: [] }], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /related "colours" does not name it back/);
  });
});

test("gate:decisions refuses a record with no row in the register", () => {
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /docs\/decisions\/forgotten\.md: a decision record with no row/);
  }, { extra: { "docs/decisions/forgotten.md": "# Something nobody indexed\n" } });
});

test("gate:decisions refuses an index page built from an older register", () => {
  const edit = (root) => {
    const path = join(root, "docs/decisions.json");
    const reg = JSON.parse(readFileSync(path, "utf8"));
    reg.decisions[0].question = "How thick should the bar along the foot of the page be?";
    writeFileSync(path, JSON.stringify(reg));
  };
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /README\.md is stale/);
  }, { after: edit });
});

test("gate:decisions refuses a register with no index page at all", () => {
  withRegister([open(), settled()], (root) => {
    const r = runGate("decisions", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /README\.md is missing or unstamped/);
  }, { stamp: false });
});

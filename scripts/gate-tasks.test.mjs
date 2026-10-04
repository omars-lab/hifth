/**
 * The open-work page check must pass when the backlog page and the note of what
 * is waiting on the owner were both built from the registers as they stand. It
 * must refuse either page built from older registers or missing altogether, a
 * picture of a decision that is no longer open, and a picture on disk that the
 * picture list does not name. Asked only to list, it prints and never fails
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const DESIGN = "docs/design/page-turning.md";
const RECORD = "docs/decisions/page-bar.md";

const plan = (status) =>
  "# Plan\n\n| Loop | Status | Exit | Record |\n| --- | --- | --- | --- |\n" +
  "| 1 | complete | a page turns | done |\n" +
  `| 2 | ${status} | the bar reads | open |\n\n### Open follow-ups\n\n### Done\n`;

const files = ({ shots } = {}) => ({
  "docs/issues.json": JSON.stringify({
    issues: [{ id: "late-turn", source: { file: DESIGN, item: "②" }, status: "open", severity: "question", owner: "user" }],
  }),
  [DESIGN]:
    "# Page turning\n\n## Open questions, and what would answer each\n\n### ② A turn can feel late · **open**\n\nSometimes.\n",
  "docs/PLAN.md": plan("in flight"),
  "docs/validation/ledger.json": JSON.stringify({
    checks: [{ id: "on-device", title: "Try it on a phone", status: "pending", owner: "user", blocks: [] }],
  }),
  "docs/decisions.json": JSON.stringify({
    decisions: [
      {
        id: "page-bar",
        status: "open",
        question: "How thick should the page bar be?",
        doc: RECORD,
        options: [
          { id: "A", label: "Thick" },
          { id: "B", label: "Thin" },
        ],
      },
      { id: "colours", status: "decided", date: "2026-09-01" },
    ],
  }),
  [RECORD]: "# Page bar\n\n**Recommendation:** B. Keep the bar thin.\n",
  ...(shots ? { "docs/waiting-on-you/shots.json": JSON.stringify(shots) } : {}),
});

/** Run the real renderers so both pages are stamped from what the fixture holds. */
function stamp(root) {
  for (const builder of ["build-tasks-doc.mjs", "build-waiting-doc.mjs"]) {
    const r = spawnSync(process.execPath, [new URL(`./${builder}`, import.meta.url).pathname], {
      encoding: "utf8",
      env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
    });
    assert.equal(r.status, 0, `${builder}: ${r.stdout}${r.stderr}`);
  }
}

function withTree(tree, fn, { after } = {}) {
  const root = makeFixture(tree);
  try {
    stamp(root);
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
      const r = runGate("tasks", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /gate:tasks — FAIL/);
      assert.match(r.out, pattern);
    },
    opts,
  );
}

const SUMMARY =
  /1 decision\(s\) open, 1 check\(s\) only a person can run, 1 other item\(s\) yours, 0 for whoever picks them up, 1 loop\(s\) unfinished/;

const replanned = (root) => writeFileSync(join(root, "docs/PLAN.md"), plan("gated on a phone"));

test("gate:tasks passes when both pages were built from the registers as they stand", () => {
  withTree(files(), (root) => {
    const r = runGate("tasks", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /gate:tasks — OK/);
    assert.match(r.out, SUMMARY);
  });
});

test("gate:tasks refuses a backlog page built from older registers", () => {
  refuses(files(), /docs\/backlog\.md was built from [0-9a-f]+, the source is now [0-9a-f]+/, { after: replanned });
});

test("gate:tasks refuses a missing backlog page", () => {
  refuses(files(), /docs\/backlog\.md is missing or unstamped/, {
    after: (root) => rmSync(join(root, "docs/backlog.md")),
  });
});

test("gate:tasks refuses a waiting-on-you note built from an older recommendation", () => {
  const edit = (root) => writeFileSync(join(root, RECORD), "# Page bar\n\n**Recommendation:** A. Make it thick.\n");
  withTree(
    files(),
    (root) => {
      const r = runGate("tasks", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /docs\/waiting-on-you\.md was built from [0-9a-f]+, the source is now [0-9a-f]+/);
      // Only the note reads the record's words; the backlog is still current.
      assert.doesNotMatch(r.out, /docs\/backlog\.md/);
    },
    { after: edit },
  );
});

test("gate:tasks refuses a missing waiting-on-you note", () => {
  refuses(files(), /docs\/waiting-on-you\.md is missing or unstamped/, {
    after: (root) => rmSync(join(root, "docs/waiting-on-you.md")),
  });
});

test("gate:tasks refuses a picture of a decision that is no longer open", () => {
  const shots = { colours: { shots: [{ file: "colours-1.png", caption: "The old colours" }] } };
  refuses(files({ shots }), /colours — pictured, but no longer an open decision/);
});

test("gate:tasks refuses a picture on disk that the list does not name", () => {
  const shots = { "page-bar": { shots: [{ file: "page-bar-1.png", caption: "Thick and thin" }] } };
  const tree = { ...files({ shots }), "docs/waiting-on-you/page-bar-1.png": "", "docs/waiting-on-you/stray.png": "" };
  refuses(tree, /stray\.png — on disk, but not in the picture list/);
});

test("gate:tasks only lists, and never fails, when asked to list", () => {
  withTree(
    files(),
    (root) => {
      const r = spawnSync(process.execPath, [new URL("./gate-tasks.mjs", import.meta.url).pathname, "--list"], {
        encoding: "utf8",
        env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
      });
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      assert.match(r.stdout, SUMMARY);
    },
    { after: replanned },
  );
});

// The made-up registers above must stay readable to the renderers; if a field
// they need is renamed, this is the test that says so, not a confusing hash.
test("gate:tasks fixture builds a backlog page that names the open item", () => {
  withTree(files(), (root) => {
    assert.match(readFileSync(join(root, "docs/backlog.md"), "utf8"), /late-turn|A turn can feel late/);
  });
});

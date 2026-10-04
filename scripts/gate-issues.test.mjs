/**
 * The open-work index check must pass an index that names every item its
 * registers hold, with the same status each register gives it. It must refuse
 * an entry pointing at a row that is gone, an entry whose status disagrees with
 * the register, a register item nobody indexed (in a design page, the plan, or
 * the by-hand checks list), "fixed" with no test named or a test that is not
 * there, a blocker that matches nothing, an item still waiting on a decision
 * already made, and an index page built from an older index
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

const DESIGN = "docs/design/page-turning.md";
const HEADING = "## Open questions, and what would answer each";
const TEST = "apps/web/e2e/fade-in.spec.ts";

const register = (rows) =>
  `# Page turning\n\nSome design.\n\n${HEADING}\n\n${rows.join("\n\n")}\n\n## Alternatives rejected\n\n### ③ An idea we dropped · **open**\n`;

const designRows = ["### ① The page fade-in never runs · **fixed**", "### ② A turn can feel late · **open**"];

const entries = () => [
  {
    id: "fade-in",
    source: { file: DESIGN, item: "①" },
    status: "fixed",
    severity: "defect",
    owner: "agent",
    closedBy: TEST,
  },
  { id: "late-turn", source: { file: DESIGN, item: "②" }, status: "open", severity: "question", owner: "user" },
  {
    id: "plan-licence",
    source: { file: "docs/PLAN.md", item: "1" },
    status: "blocked",
    severity: "risk",
    owner: "user",
    blockedBy: ["a hafiz", "on-device"],
  },
  { id: "on-device", source: { ledger: "on-device" }, severity: "risk", owner: "user", blockedBy: ["page-bar"] },
];

const files = (issues, { rows = designRows, plan = ["1. **Read the licence** before holding anything."] } = {}) => ({
  "docs/issues.json": JSON.stringify({ issues }, null, 2),
  [DESIGN]: register(rows),
  "docs/PLAN.md": `# Plan\n\n### Open follow-ups\n\n${plan.join("\n")}\n\n### Done\n`,
  "docs/validation/ledger.json": JSON.stringify({
    checks: [{ id: "on-device", title: "Try it on a phone", status: "pending", blocks: ["loop-7"] }],
  }),
  "docs/decisions.json": JSON.stringify({
    decisions: [
      { id: "page-bar", status: "open" },
      { id: "colours", status: "decided", date: "2026-09-01" },
    ],
  }),
  [TEST]: "test('fade-in runs', () => {});\n",
});

/** Run the real renderer so the index page is stamped from what the fixture holds. */
function stamp(root) {
  const r = spawnSync(process.execPath, [new URL("./build-issues-doc.mjs", import.meta.url).pathname], {
    encoding: "utf8",
    env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
  });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
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
      const r = runGate("issues", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /gate:issues — FAIL/);
      assert.match(r.out, pattern);
    },
    opts,
  );
}

const patched = (id, patch) => entries().map((i) => (i.id === id ? { ...i, ...patch } : i));

test("gate:issues passes an index that accounts for every register item", () => {
  withTree(files(entries()), (root) => {
    const r = runGate("issues", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(4 indexed across 4 registers, 3 open, every register item accounted for\)/);
  });
});

test("gate:issues refuses an entry pointing at a row that is gone", () => {
  refuses(files(patched("late-turn", { source: { file: DESIGN, item: "④" } })), /late-turn: .*page-turning\.md has no ④ row/);
});

test("gate:issues refuses an entry whose status disagrees with the register", () => {
  refuses(files(patched("late-turn", { status: "confirmed" })), /late-turn: this file says "confirmed", .*says "open"/);
});

test("gate:issues refuses a register item nobody indexed", () => {
  const rows = [...designRows, "### ③ Nobody wrote this down · **suspected**"];
  refuses(files(entries(), { rows }), /page-turning\.md:\d+ — ③ “Nobody wrote this down” \(suspected\) is not in docs\/issues\.json/);
});

test("gate:issues refuses a plan follow-up nobody indexed", () => {
  const plan = ["1. **Read the licence** first.", "2. **Measure the turn** on a phone."];
  refuses(files(entries(), { plan }), /follow-up 2 “Measure the turn” is not in docs\/issues\.json/);
});

test("gate:issues refuses a by-hand check nobody indexed", () => {
  const issues = entries().filter((i) => i.id !== "on-device");
  const tree = files(issues.map((i) => (i.id === "plan-licence" ? { ...i, blockedBy: ["a hafiz"] } : i)));
  refuses(tree, /ledger check "on-device" is not in docs\/issues\.json/);
});

test("gate:issues refuses a by-hand check entry that keeps its own status", () => {
  refuses(files(patched("on-device", { status: "open" })), /on-device: a ledger-backed entry must not carry its own status/);
});

test("gate:issues refuses \"fixed\" with no test named", () => {
  refuses(files(patched("fade-in", { closedBy: null })), /fade-in: "fixed" with no closedBy/);
});

test("gate:issues refuses \"fixed\" naming a test that is not there", () => {
  refuses(files(patched("fade-in", { closedBy: "apps/web/e2e/gone.spec.ts" })), /closedBy names apps\/web\/e2e\/gone\.spec\.ts, which does not exist/);
});

test("gate:issues refuses a blocker that matches nothing", () => {
  refuses(files(patched("late-turn", { blockedBy: ["loop-99"] })), /late-turn: blockedBy "loop-99" matches no issue, ledger check or milestone/);
});

test("gate:issues refuses an item still waiting on a decision already made", () => {
  refuses(files(patched("late-turn", { blockedBy: ["colours"] })), /late-turn: still open, waiting on the decision "colours", which was decided on 2026-09-01/);
});

test("gate:issues refuses an index page built from an older index", () => {
  const edit = (root) => {
    const path = join(root, "docs/issues.json");
    const reg = JSON.parse(readFileSync(path, "utf8"));
    reg.issues[1].severity = "risk";
    writeFileSync(path, JSON.stringify(reg));
  };
  refuses(files(entries()), /docs\/issues\.md was built from [0-9a-f]+, the source is now [0-9a-f]+/, { after: edit });
});

/**
 * The by-hand checks list must pass a list whose every check says why it is
 * run and what its result feeds, whose pending checks for a person carry steps
 * that can each be failed and a short version to lead with, and whose guide
 * page is built from the list as it stands. It must refuse a check with a
 * required field missing, one that feeds nothing, a pending check for a person
 * with no steps or no short version, a step with no expectation or no reason, a
 * done check with no result, a recurring check whose result has gone stale, an
 * automated run that claims a step that does not exist or names nothing it
 * leaves for a person, a guide picture never drawn, and a guide page built from
 * an older list (docs/design/robust-validation.md ⑦). It must not refuse a
 * check for being pending.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate, fixtureEnv } from "./gate-fixture.mjs";

const LEDGER_MODULE = new URL("./validation-ledger.mjs", import.meta.url).href;

const step = (id) => ({
  id,
  do: "Open the app on a phone.",
  expect: "The first page shows, whole.",
  why: "Proves the build you are holding is the one being checked.",
  short: "Open the app on a phone.",
});

const pendingCheck = () => ({
  id: "try-on-a-phone",
  title: "Try it on a phone",
  why: "Nothing on the laptop can feel a page turn.",
  how: "Open it and turn a page.",
  owner: "user",
  status: "pending",
  blocks: ["loop-7"],
  tunes: ["the turn timing"],
  runbook: { steps: [step("open"), step("turn")] },
  brief: {
    label: "Phone feel",
    ask: "Does a page turn feel right?",
    what: "So the turn timing is set by a hand, not a guess.",
    need: "A phone.",
    time: "5 minutes",
    done: "You have turned ten pages.",
  },
});

const doneCheck = (patch = {}) => ({
  id: "read-the-terms",
  title: "Read the terms at the source",
  why: "The colophon states them to every reader.",
  how: "Open the publisher's page in a browser.",
  owner: "user",
  status: "done",
  tunes: ["the colophon wording"],
  verifiedOn: "2026-09-01",
  result: "The terms still say free for digital use.",
  ...patch,
});

/**
 * A list of `checks`, with the guide page stamped and every picture drawn from
 * what that list holds — read through the same module the check reads — unless
 * a test says otherwise.
 */
function withLedger(checks, fn, { guide = true, draw = true } = {}) {
  const root = makeFixture({ "docs/validation/ledger.json": JSON.stringify({ checks }, null, 2) });
  try {
    const code =
      `const m = await import(${JSON.stringify(LEDGER_MODULE)});` +
      `const { checks } = m.readLedger();` +
      `console.log(JSON.stringify({ hash: m.ledgerHash(checks), keys: m.guideDiagrams(checks).map(m.diagramKey) }));`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      env: { ...fixtureEnv(), HIFTH_GATE_ROOT: root },
    });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    const { hash, keys } = JSON.parse(r.stdout);
    if (guide) writeFileSync(join(root, "docs/validation/guide.html"), `<html data-ledger-hash="${hash}"></html>`);
    if (draw) {
      mkdirSync(join(root, "docs/validation/diagrams"), { recursive: true });
      for (const k of keys) writeFileSync(join(root, `docs/validation/diagrams/${k}.svg`), "<svg/>");
    }
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

function refuses(checks, pattern, opts) {
  withLedger(
    checks,
    (root) => {
      const r = runGate("validation", root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /gate:validation — FAIL/);
      assert.match(r.out, pattern);
    },
    opts,
  );
}

test("gate:validation passes a well-formed list, and reports what is pending without failing on it", () => {
  withLedger([pendingCheck(), doneCheck()], (root) => {
    const r = runGate("validation", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(2 checks, ledger well-formed\)/);
    assert.match(r.out, /1 manual validation\(s\) outstanding/);
    assert.match(r.out, /\[user\] Try it on a phone → blocks loop-7/);
  });
});

test("gate:validation refuses a check with a required field missing", () => {
  const { why: _why, ...check } = doneCheck();
  refuses([pendingCheck(), check], /check "read-the-terms": missing "why"/);
});

test("gate:validation refuses two checks with the same id", () => {
  refuses([pendingCheck(), doneCheck({ id: "try-on-a-phone" })], /duplicate id "try-on-a-phone"/);
});

test("gate:validation refuses a check whose result feeds nothing", () => {
  refuses([pendingCheck(), doneCheck({ tunes: [] })], /check "read-the-terms": tunes nothing/);
});

test("gate:validation refuses a pending check for a person with no steps", () => {
  const check = { ...pendingCheck(), runbook: { steps: [] } };
  refuses([check], /check "try-on-a-phone": pending, owned by a human, and has no "runbook\.steps"/);
});

test("gate:validation refuses a step with no expectation", () => {
  const check = pendingCheck();
  delete check.runbook.steps[1].expect;
  refuses([check], /runbook\.steps\[1\] needs both "do" and "expect"/);
});

test("gate:validation refuses a step with no reason", () => {
  const check = pendingCheck();
  delete check.runbook.steps[0].why;
  refuses([check], /runbook\.steps\[0\] has no "why"/);
});

test("gate:validation refuses a pending check for a person with no short version", () => {
  const { brief: _brief, ...check } = pendingCheck();
  refuses([check], /check "try-on-a-phone": pending, owned by a person, and has no "brief"/);
});

test("gate:validation refuses a done check with no result", () => {
  refuses([doneCheck({ result: undefined })], /check "read-the-terms": done, but no "result"/);
});

test("gate:validation refuses a recurring check whose result has gone stale", () => {
  const old = doneCheck({ staleAfterDays: 30, verifiedOn: "2026-08-01" });
  const recent = doneCheck({ id: "second-look", verifiedOn: "2026-09-15" });
  refuses([old, recent], /STALE — read-the-terms: last verified 2026-08-01, 45d ago \(limit 30d\)/);
});

test("gate:validation refuses an automated run that claims a step that does not exist", () => {
  const check = { ...pendingCheck(), evidence: { run: "make phone-check", covers: ["open", "pinch"], residue: ["the feel"] } };
  refuses([check], /evidence covers "pinch", which is not a runbook step id/);
});

test("gate:validation refuses an automated run that names nothing it leaves for a person", () => {
  const check = { ...pendingCheck(), evidence: { run: "make phone-check", covers: ["open"], residue: [] } };
  refuses([check], /evidence declares no "residue"/);
});

test("gate:validation refuses a guide picture that was never drawn", () => {
  refuses([pendingCheck()], /docs\/validation\/diagrams\/[0-9a-f]{12}\.svg is not drawn/, { draw: false });
});

test("gate:validation refuses a guide page built from an older list", () => {
  withLedger([pendingCheck()], (root) => {
    writeFileSync(join(root, "docs/validation/guide.html"), '<html data-ledger-hash="000000000000"></html>');
    const r = runGate("validation", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /guide\.html is stale \(built from 000000000000, ledger is [0-9a-f]{12}\)/);
  });
});

test("gate:validation refuses a list with no guide page at all", () => {
  refuses([pendingCheck()], /guide\.html is missing or unstamped/, { guide: false });
});

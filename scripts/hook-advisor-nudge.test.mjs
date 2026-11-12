import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WINDOW_MS, currentGoal, sessionFocus, sessionTitle, taskFor, verdict } from "./hook-advisor-nudge.mjs";

const NOW = Date.parse("2026-10-08T15:00:00Z");

test("the first stop of a session is sent back to ask what matters most next", () => {
  const r = verdict({ stopHookActive: false, now: NOW, lastNudgeAt: null });
  assert.match(r, /advisor/);
  // It works in a session that has no advisor to call.
  assert.match(r, /if you have/i);
  // And the answer lands in the one place open work is kept.
  assert.match(r, /docs\/backlog\.md/);
});

// Omar, 2026-11-11: "why do we keep on going back to the walk? our session focus is the hifth
// app landing page", then "our hook should ask for the task at hand ... not a static objective".
// The question named the pitch in fixed words, so a session set on other work was steered back.
test("a named session is asked about its own work, not a fixed goal", () => {
  const r = verdict({
    stopHookActive: false, now: NOW, lastNudgeAt: null,
    objective: { session: "made-up-front-page", goal: "A made-up standing goal" },
  });
  assert.match(r, /made-up-front-page/);
  assert.doesNotMatch(r, /made-up standing goal/i);
  assert.doesNotMatch(r, /Study Quran/);
  assert.match(r, /do not steer/i);
});

test("the branch's task is named beside the session", () => {
  const r = verdict({
    stopHookActive: false, now: NOW, lastNudgeAt: null,
    objective: { session: "a-session", task: { id: "made-up-row", summary: "Make up a row." } },
  });
  assert.match(r, /a-session/);
  assert.match(r, /made-up-row/);
  assert.match(r, /Make up a row/);
});

test("with no focus set, the project's current goal is read, not written into the hook", () => {
  const r = verdict({ stopHookActive: false, now: NOW, lastNudgeAt: null, objective: { goal: "A made-up standing goal" } });
  assert.match(r, /A made-up standing goal/);
  assert.match(r, /no focus/i);
});

test("the session's recorded goal comes first, read from the repo's own record", () => {
  const dir = mkdtempSync(join(tmpdir(), "nudge-focus-"));
  mkdirSync(join(dir, ".claude", "data", "intent"), { recursive: true });
  writeFileSync(join(dir, ".claude", "data", "intent", "sessions.jsonl"), [
    JSON.stringify({ session: "s1", date: "2026-11-12", focus: { kind: "task", id: "old-row" }, by: "branch" }),
    JSON.stringify({ session: "s2", date: "2026-11-12", focus: { kind: "goal", id: "other" }, by: "owner" }),
    JSON.stringify({ session: "s1", date: "2026-11-12", focus: { kind: "task", id: "made-up-row" }, by: "owner" }),
    "not json",
  ].join("\n"));
  assert.deepEqual(sessionFocus(dir, "s1"), { kind: "task", id: "made-up-row" });
  assert.equal(sessionFocus(dir, "s3"), null);
  assert.equal(sessionFocus(join(dir, "nowhere"), "s1"), null);

  const r = verdict({
    stopHookActive: false, now: NOW, lastNudgeAt: null,
    objective: { focus: { kind: "plan", id: "made-up-plan" }, session: "a-name", goal: "A made-up standing goal" },
  });
  assert.match(r, /plan made-up-plan/);
  assert.doesNotMatch(r, /made-up standing goal/i);
});

test("the session's name is the last one it was given in its log", () => {
  const dir = mkdtempSync(join(tmpdir(), "nudge-title-"));
  const log = join(dir, "s.jsonl");
  writeFileSync(log, [
    JSON.stringify({ type: "user", message: { content: "hello" } }),
    JSON.stringify({ type: "custom-title", customTitle: "first-name" }),
    JSON.stringify({ type: "custom-title", customTitle: "second-name" }),
    "not json",
  ].join("\n"));
  assert.equal(sessionTitle(log), "second-name");
  assert.equal(sessionTitle(join(dir, "missing.jsonl")), null);
});

test("the current goal is the row marked current in the goals list", () => {
  const dir = mkdtempSync(join(tmpdir(), "nudge-goal-"));
  mkdirSync(join(dir, ".claude", "goals"), { recursive: true });
  writeFileSync(join(dir, ".claude", "goals", "README.md"),
    "| Goal | Status |\n|---|---|\n| [An old goal](old.md) | **done** |\n| [A made-up goal](x.md) | **current** |\n");
  assert.equal(currentGoal(dir), "A made-up goal");
  assert.equal(currentGoal(join(dir, "nowhere")), null);
});

test("the branch's task comes from intent start, with the backlog row's first sentence", () => {
  const dir = mkdtempSync(join(tmpdir(), "nudge-task-"));
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "docs", "issues.json"), JSON.stringify({ issues: [
    { id: "made-up-row", note: "Make up a row. Then more detail." },
  ] }));
  assert.deepEqual(taskFor(dir, "made-up-row"), { id: "made-up-row", summary: "Make up a row." });
  assert.deepEqual(taskFor(dir, "not-a-row"), { id: "not-a-row", summary: null });
});

test("a stop soon after the last nudge is let through", () => {
  assert.equal(verdict({ stopHookActive: false, now: NOW, lastNudgeAt: NOW - 60_000 }), null);
});

test("a long session is asked again once the window has passed", () => {
  assert.notEqual(verdict({ stopHookActive: false, now: NOW, lastNudgeAt: NOW - WINDOW_MS - 1 }), null);
});

test("never loops: a stop this hook already sent back is let through", () => {
  assert.equal(verdict({ stopHookActive: true, now: NOW, lastNudgeAt: null }), null);
});

const script = fileURLToPath(new URL("./hook-advisor-nudge.mjs", import.meta.url));
const run = (input, dir) =>
  spawnSync(process.execPath, [script], { input, encoding: "utf8", env: { ...process.env, TMPDIR: dir, HOME: dir } });

test("run as a hook: blocks the first stop of a session, then lets the next through", () => {
  const dir = mkdtempSync(join(tmpdir(), "advisor-nudge-"));
  const payload = JSON.stringify({ session_id: "s-1", stop_hook_active: false });
  const first = run(payload, dir);
  assert.equal(first.status, 0);
  assert.equal(JSON.parse(first.stdout).decision, "block");
  const second = run(payload, dir);
  assert.equal(second.status, 0);
  assert.equal(second.stdout, "");
});

test("run as a hook: unreadable input lets the stop through", () => {
  const dir = mkdtempSync(join(tmpdir(), "advisor-nudge-"));
  const r = run("not json", dir);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

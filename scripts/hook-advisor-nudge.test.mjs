import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WINDOW_MS, verdict } from "./hook-advisor-nudge.mjs";

const NOW = Date.parse("2026-10-08T15:00:00Z");

test("the first stop of a session is sent back to ask what matters most next", () => {
  const r = verdict({ stopHookActive: false, now: NOW, lastNudgeAt: null });
  assert.match(r, /advisor/);
  // It says who the users are, so the answer is not generic.
  assert.match(r, /huffaz/);
  assert.match(r, /Study Quran/);
  // It works in a session that has no advisor to call.
  assert.match(r, /if you have/i);
  // And the answer lands in the one place open work is kept.
  assert.match(r, /docs\/backlog\.md/);
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

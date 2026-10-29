/**
 * The push check skips its suite only for a push that deletes branches and
 * sends nothing else. Each test feeds the real script what git would hand
 * the hook and reads its exit code.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("push-deletes-only.mjs", import.meta.url));
const ZERO = "0".repeat(40);
const SHA = "d119b1ad".repeat(5);
const skips = (input) => spawnSync("node", [SCRIPT], { input, encoding: "utf8" }).status === 0;

const del = (b) => `(delete) ${ZERO} refs/heads/${b} ${SHA}\n`;
const code = (b) => `refs/heads/${b} ${SHA} refs/heads/${b} ${ZERO}\n`;

test("a push that only deletes one branch skips the checks", () => {
  assert.equal(skips(del("old")), true);
});

test("a push that deletes several branches skips the checks", () => {
  assert.equal(skips(del("a") + del("b") + del("c")), true);
});

test("a push that sends code runs the checks", () => {
  assert.equal(skips(code("main")), false);
});

test("a delete mixed with code runs the checks", () => {
  assert.equal(skips(del("old") + code("main")), false);
});

test("no input (make pre-push run by hand) runs the checks", () => {
  assert.equal(skips(""), false);
});

test("a line it cannot read runs the checks", () => {
  assert.equal(skips(`${ZERO}\n`), false);
});

test("the push check asks the script first and falls back to every check", () => {
  // Read off a dry run, so it is what `make pre-push` would do. With no
  // input the script says no, and the full plan must follow.
  const ROOT = fileURLToPath(new URL("..", import.meta.url));
  const plan = spawnSync("make", ["-n", "-C", ROOT, "pre-push"], { input: "", encoding: "utf8" }).stdout;
  assert.match(plan, /push-deletes-only\.mjs/);
  assert.match(plan, /playwright test/);
});

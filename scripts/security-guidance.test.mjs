/**
 * The project's security rules for the Security Guidance plugin stay readable and true.
 *
 * `.claude/claude-security-guidance.md` is added to the plugin's review of every change. The
 * plugin keeps only the first 8 KB of all its rule files together (the owner's own, then this
 * one), so a long file silently loses its last rules. And the rules name files in this repo;
 * when one of those moves, the rule points at nothing and the reviewer stops checking it.
 * Added 2026-11-13 with the file (owner: "make sure user privacy, who accesses their data,
 * is in their control").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, ".claude", "claude-security-guidance.md");

/** Paths in this repo the rules name in backticks (apps/, packages/, scripts/, native/). */
export function namedPaths(md) {
  return [...md.matchAll(/`((?:apps|packages|scripts|native)\/[^`\s]+)`/g)].map((m) => m[1]);
}

test("the path finder reads repo paths and skips commands and code", () => {
  const md = "See `scripts/gate-x.mjs` and `apps/web/src/` but not `dotenvx`, `using (true)` or `fetch`.";
  assert.deepEqual(namedPaths(md), ["scripts/gate-x.mjs", "apps/web/src/"]);
});

test("the security rules fit well inside the plugin's 8 KB, leaving room for the owner's own", () => {
  const size = readFileSync(FILE).length;
  assert.ok(size < 6_500, `${size} bytes; the plugin drops whatever is past 8 KB of all rule files together`);
});

test("every file the security rules name still exists", () => {
  const missing = namedPaths(readFileSync(FILE, "utf8")).filter((p) => !existsSync(join(ROOT, p)));
  assert.deepEqual(missing, [], "a rule names a file that moved; update the rule");
});

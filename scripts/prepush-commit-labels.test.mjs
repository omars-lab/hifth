/**
 * A push refuses a commit that does not say what it was for, and it says so
 * in the first second, not after the ten minutes of slower checks.
 *
 * Until 2026-11-11 the push only counted such commits, and did it after the
 * quick checks. This reads the Makefile, so the day somebody moves the check
 * back behind the slow ones, or drops the word that makes it refuse, it fails.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const makefile = readFileSync(new URL("../Makefile", import.meta.url), "utf8");

/** One target: the names after its colon, and its recipe lines. */
function target(name) {
  const start = makefile.indexOf(`\n${name}:`);
  assert.ok(start >= 0, `the Makefile has a ${name} target`);
  const end = makefile.indexOf("\n.PHONY", start + 1);
  const lines = makefile.slice(start + 1, end < 0 ? undefined : end).split("\n");
  const needs = lines[0].slice(name.length + 1).split("##")[0].trim().split(/\s+/).filter(Boolean);
  const recipe = lines.slice(1).filter((line) => line.startsWith("\t") && !line.trim().startsWith("@#"));
  return { needs, recipe };
}

test("the push checks what each commit was for before any slow check", () => {
  const { needs } = target("pre-push-checks");
  const at = needs.indexOf("commit-labels");
  assert.ok(at >= 0, `commit-labels is one of the things pre-push-checks needs first: ${needs.join(" ")}`);
  const slow = needs.indexOf("checks-fast");
  assert.ok(slow < 0 || at < slow, `commit-labels comes before checks-fast: ${needs.join(" ")}`);
});

test("the push does not run that check a second time, after the slow ones", () => {
  const { recipe } = target("pre-push-checks");
  const again = recipe.filter((line) => line.includes("commit-labels"));
  assert.deepEqual(again, [], "commit-labels is named once, at the start");
});

test("a commit that does not say what it was for is refused, not only counted", () => {
  const { recipe } = target("commit-labels");
  const runs = recipe.filter((line) => /\bintent check\b/.test(line));
  assert.equal(runs.length, 1, "one line runs the check");
  assert.match(runs[0], /intent check --strict\b/, "it runs with the word that makes it refuse");
});

test("without the tool the check still says so, and lets the push through", () => {
  const { recipe } = target("commit-labels");
  assert.match(recipe.join("\n"), /not checked: the intent tool is not installed/);
});

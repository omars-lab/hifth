/**
 * The thread walk follows two references deep from a note and comes back. Its
 * second step must skip a reference back to where the walk started or to the
 * verse it stands on; in Arabic the links name their verses in Arabic digits,
 * and the walk once took a link back to its own start for a second reference
 * (found walking the short laptop window, 2026-10-25).
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../.claude/skills/walk-app/scripts/thread-walk.js", import.meta.url), "utf8");

test("the thread walk compiles as one program for the probe", () => {
  assert.doesNotThrow(() => new vm.Script(src));
});

test("a link's verse reads the same in either digits", () => {
  const line = src.split("\n").find((l) => l.startsWith("const verseOf ="));
  assert.ok(line, "the walk has no verseOf helper");
  const verseOf = vm.runInNewContext(`(${line.replace(/^const verseOf =/, "").replace(/;\s*$/, "")})`);
  assert.equal(verseOf("Go to Al-Baqarah · 2:255"), "2:255");
  assert.equal(verseOf("اذهب إلى البقرة، ٢:٢٥٥"), "2:255");
  assert.equal(verseOf("اذهب إلى آل عمران، ٣:٢"), "3:2");
  assert.equal(verseOf("Close"), "");
});

/**
 * The visit walk runs inside the real app, so it must compile as the program the
 * probe hands to eval, and its answer must never carry the words of a note: it
 * reads text only from a note's verse number, its buttons and the menu items.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../.claude/skills/walk-app/scripts/visit-walk.js", import.meta.url), "utf8");

test("the visit walk compiles as one program for the probe", () => {
  assert.doesNotThrow(() => new vm.Script(src));
});

test("the visit walk reads no text but verse numbers, buttons and menu items", () => {
  assert.ok(!/innerText|innerHTML|outerHTML/.test(src), "reads a whole element's text");
  const reads = [...src.matchAll(/(\w+)\.textContent/g)].map((m) => m[1]);
  assert.ok(reads.length > 0);
  assert.deepEqual([...new Set(reads)].sort(), ["b", "e", "ref"]);
});

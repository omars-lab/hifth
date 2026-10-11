/**
 * The fresh-launch look runs inside the real app on the pitch build, where a
 * page can carry The Study Quran's words, and its answer is pasted into a
 * record. So it must compile as the program the probe hands to eval and read
 * no words at all: only times, page numbers, counts and stored-setting names.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const look = readFileSync(new URL("../.claude/skills/walk-app/scripts/fresh-look.js", import.meta.url), "utf8");

test("the fresh-launch look compiles as one program for the probe", () => {
  assert.doesNotThrow(() => new vm.Script(look));
});

test("the fresh-launch look reads no words off the page", () => {
  assert.ok(!/innerText|innerHTML|outerHTML|textContent|aria-label"|ariaLabel\b|\.title\b|\.value\b/.test(look), "reads words");
  // The one attribute it reads names a page, never a verse's words.
  const attrs = [...new Set([...look.matchAll(/getAttribute\("([^"]+)"\)/g)].map((m) => m[1]))];
  assert.deepEqual(attrs, ["aria-labelledby"]);
});

test("the fresh-launch look gives only stored-setting names, not what they hold", () => {
  assert.ok(!/localStorage\.getItem|localStorage\[/.test(look), "reads a stored value");
});

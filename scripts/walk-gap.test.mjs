/**
 * The gap walk times the silence between two verses of a run inside the real
 * app, so it must compile as the program the probe hands to eval, and read no
 * text but the menu items. Its Chromium runner sets the reader's choice of how
 * the next verse is made ready by the setting's own key, so the two must agree.
 *
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const dir = new URL("../.claude/skills/walk-app/scripts/", import.meta.url);
const walk = readFileSync(new URL("gap-walk.js", dir), "utf8");
const runner = readFileSync(new URL("gap-throttle.mjs", dir), "utf8");
const setting = readFileSync(new URL("../apps/web/src/run-ahead.ts", import.meta.url), "utf8");

test("the gap walk compiles as one program for the probe", () => {
  assert.doesNotThrow(() => new vm.Script(walk));
});

test("the gap walk reads no text but the menu items", () => {
  assert.ok(!/innerText|innerHTML|outerHTML/.test(walk), "reads a whole element's text");
  const reads = [...walk.matchAll(/(\w+)\.textContent/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(reads)], ["e"]);
});

test("the runner sets the next-verse choice by the setting's own key and words", () => {
  const key = setting.match(/RUN_AHEAD_KEY = "([^"]+)"/)?.[1];
  assert.ok(key, "the setting names its key");
  assert.ok(runner.includes(`"${key}"`), `the runner does not use ${key}`);
  const ways = setting.match(/export type RunAhead = ([^;]+);/)?.[1].match(/"(\w+)"/g).map((w) => w.slice(1, -1));
  assert.deepEqual(runner.match(/arg\("ahead", "([^"]+)"\)/)?.[1].split(","), ways);
});

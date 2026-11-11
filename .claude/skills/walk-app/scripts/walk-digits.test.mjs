/**
 * In Arabic the app names its verses in Arabic digits (٢:٢٥٥), and a pattern
 * for digits only matches Western ones. A walk script that reads a verse out of
 * a button's or a note's spoken name must turn the digits Western first, or in
 * Arabic it reads no verse at all, or takes a link back to its own start for a
 * new one (the thread walk, found 2026-10-25).
 *
 * Run with the other script tests: pnpm -s test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// The tests live beside the walk scripts they check, and are not walk scripts
// themselves: this one names the very pattern it looks for.
const dir = new URL("./", import.meta.url);
const scripts = readdirSync(dir).filter((f) => /\.(m?js)$/.test(f) && !/\.test\.mjs$/.test(f));

test("the tests beside the walk scripts are not read as walk scripts", () => {
  assert.ok(scripts.length > 10, `only ${scripts.length} walk scripts found`);
  assert.deepEqual(scripts.filter((f) => f.includes(".test.")), []);
});

test("every walk script reads a verse from a spoken name in either digits", () => {
  const bad = [];
  for (const f of scripts) {
    readFileSync(new URL(f, dir), "utf8").split("\n").forEach((line, i) => {
      if (!/aria-label/.test(line) || !line.includes("\\d+:\\d+")) return;
      if (/west\(|verseOf\(|٠-٩|\\u0660/.test(line)) return;
      bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

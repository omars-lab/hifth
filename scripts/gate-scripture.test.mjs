/**
 * The scripture check must refuse a source file holding a run of consecutive
 * vowelled Arabic words and pass one holding single words. This file is itself
 * one the check reads, so every Arabic letter below is written as an escape
 * and the words are made up — a run of the same nonsense syllable, never a
 * passage (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

// ba + fatha, twice: two letters, two marks — "fully vowelled" by the check's
// ratio, and not a word of anything.
const VOWELLED_WORD = "\u0628\u064E\u0628\u064E";
// A run of three is the check's threshold for a passage.
const RUN = [VOWELLED_WORD, VOWELLED_WORD, VOWELLED_WORD].join(" ");

/** A made-up tree never holds the real specimen files; the check is told so. */
const NO_SPECIMENS = { HIFTH_GATE_SPECIMENS: "none" };

/** The check lists files with git, so the made-up tree has to be a repository. */
function repo(files) {
  const root = makeFixture(files);
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

test("gate:scripture passes sources that hold at most single vowelled words", () => {
  const root = repo({
    "packages/core/src/a.ts": `export const one = "${VOWELLED_WORD}";`,
    "apps/web/src/b.tsx": "export const plain = 1;",
  });
  try {
    const r = runGate("scripture", root, NO_SPECIMENS);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(2 sources/);
  } finally {
    dropFixture(root);
  }
});

test("gate:scripture refuses a run of vowelled words, and names the file", () => {
  const root = repo({
    "packages/core/src/a.ts": "export const plain = 1;",
    "apps/web/src/leak.ts": `export const text = "${RUN}";`,
  });
  try {
    const r = runGate("scripture", root, NO_SPECIMENS);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /running scripture in source/);
    assert.match(r.out, /apps\/web\/src\/leak\.ts — 3 consecutive vowelled words/);
  } finally {
    dropFixture(root);
  }
});

test("gate:scripture ignores the folders it is told to: data, dist, test results", () => {
  const root = repo({
    "packages/core/src/a.ts": "export const plain = 1;",
    "packages/etl/data/x.mjs": `export const t = "${RUN}";`,
    "apps/web/dist/app.js": `const t = "${RUN}";`,
  });
  try {
    const r = runGate("scripture", root, NO_SPECIMENS);
    assert.equal(r.status, 0, r.out);
  } finally {
    dropFixture(root);
  }
});

test("gate:scripture refuses a stale specimen list rather than passing quietly", () => {
  // The list names real files in the real tree; none of them exist in a made-up
  // one, so the check must say so instead of counting the fixture as clean.
  const root = repo({ "packages/core/src/a.ts": "export const plain = 1;" });
  try {
    const r = runGate("scripture", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /SPECIMENS names files that no longer hold vowelled words/);
  } finally {
    dropFixture(root);
  }
});

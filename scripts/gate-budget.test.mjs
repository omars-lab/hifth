/**
 * The size check also refuses commentary code in a build that has nothing to
 * show in it: the drawer in a build with no commentary source, and the pitch's
 * held book in anything but the pitch. A build that does have a source — the
 * pitch, or a public build set up for the live commentary service — carries the
 * drawer on purpose and must pass.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const DIST = "apps/web/dist";
const PLAIN = 'console.log("hifth");';
const DRAWER = 'const label = "Surah introduction";';
const HELD = 'fetch("assets/private/study-quran/2.json");';

/** A built app of one script, with a baseline that matches it so only the leak check can fail. */
function build(app) {
  return {
    [`${DIST}/assets/app.js`]: app,
    "scripts/budget-baseline.json": JSON.stringify({
      totalGz: gzipSync(Buffer.from(app)).length,
      chunks: { "assets/app.js": gzipSync(Buffer.from(app)).length },
    }),
  };
}

function check(app, env = {}) {
  const root = makeFixture(build(app));
  try {
    // Clear the build switches the caller's shell may carry; each test sets its own.
    return runGate("budget", root, { VITE_PITCH: "", VITE_TAFSIR_QF_BASE: "", VITE_TAFSIR_QF_ID: "", ...env });
  } finally {
    dropFixture(root);
  }
}

const LIVE = { VITE_TAFSIR_QF_BASE: "https://example.test/api", VITE_TAFSIR_QF_ID: "169" };

test("gate:budget passes a public build with no commentary code", () => {
  const r = check(PLAIN);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /gate:budget — OK/);
});

test("gate:budget refuses the drawer in a build with no commentary source", () => {
  const r = check(DRAWER);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /commentary code is in a build with no commentary source/);
  assert.match(r.out, /"Surah introduction"/);
});

test("gate:budget passes the drawer in a public build set up for the live service", () => {
  const r = check(DRAWER, LIVE);
  assert.equal(r.status, 0, r.out);
});

test("gate:budget still refuses the pitch's held book in a live-service build", () => {
  const r = check(`${DRAWER}${HELD}`, LIVE);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /"private\/study-quran"/);
});

test("gate:budget passes the drawer and the held book in the pitch build", () => {
  const r = check(`${DRAWER}${HELD}`, { VITE_PITCH: "1" });
  assert.equal(r.status, 0, r.out);
});

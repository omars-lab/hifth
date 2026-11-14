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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const DIST = "apps/web/dist";
const PLAIN = 'console.log("hifth");';
const DRAWER = 'h("div", { "data-tall": tall });';
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
  assert.match(r.out, /"data-tall"/);
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

// The developer page is for the laptop's dev server alone (docs/design/app-pages.md ②).
const DEVELOPER = 'h("div", { "data-developer-page": "" });';

test("gate:budget refuses the developer page in a public build", () => {
  const r = check(DEVELOPER);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /the developer page is in a build/);
  assert.match(r.out, /"data-developer-page"/);
});

test("gate:budget refuses the developer page in the pitch build too", () => {
  const r = check(`${DRAWER}${HELD}${DEVELOPER}`, { VITE_PITCH: "1" });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /the developer page is in a build/);
});

test("gate:budget does not mistake the drawer's words for its code", () => {
  // Its words sit in the shared word list, which every build carries.
  const r = check('const words = { surahIntro: "Surah introduction" };');
  assert.equal(r.status, 0, r.out);
});

test("the size limit is the one the last line of its written history gives", () => {
  // The limit may only move with the start-up numbers that justified it written
  // down (the optimizing-performance skill, "Cap history"). This fails when the
  // number in the check moves and no line was added, or the other way round.
  const here = new URL(".", import.meta.url).pathname;
  const gate = readFileSync(join(here, "gate-budget.mjs"), "utf8");
  const limit = Number(/const BUDGET_GZ = (\d+) \* 1024/.exec(gate)?.[1]);
  const skill = readFileSync(
    join(here, "..", ".claude", "skills", "optimizing-performance", "SKILL.md"),
    "utf8",
  );
  const rows = [...skill.split("## Cap history")[1].matchAll(/^\| \d{4}-\d{2}[^|]*\| (\d+) KB \|/gm)];
  assert.ok(rows.length > 0, "no dated lines found under Cap history");
  assert.equal(limit, Number(rows.at(-1)[1]), "the limit and its last history line disagree");
  assert.match(gate, new RegExp(`must stay under\\s+\\* ${limit} KB`), "the check's own opening comment names another limit");
});

/**
 * What a reader downloads before the first page can be used (the main script,
 * the English words and the style sheet) has a limit of its own, apart from
 * the total (docs/performance.md ⑳). Start-up time goes up in steps of about
 * 150 ms as that download grows, and the total could stay under its cap while
 * code moved from a late-loading file into start-up. Written before the check
 * (2026-11-11) and seen failing.
 */
import { randomBytes } from "node:crypto";

/** Text that will not squeeze: about `kb` KB once gzipped. */
const heavy = (kb) => `"${randomBytes(kb * 1024).toString("base64")}"`;

function startupBuild({ script, words = PLAIN, style = "a{}", late = PLAIN }) {
  const files = {
    [`${DIST}/assets/index-AAAAAAAA.js`]: script,
    [`${DIST}/assets/en.gen-BBBBBBBB.js`]: words,
    [`${DIST}/assets/index-CCCCCCCC.css`]: style,
    [`${DIST}/assets/rarely-used-DDDDDDDD.js`]: late,
  };
  const gz = (s) => gzipSync(Buffer.from(s)).length;
  const chunks = {
    "assets/index.js": gz(script),
    "assets/en.gen.js": gz(words),
    "assets/rarely-used.js": gz(late),
  };
  return {
    ...files,
    "scripts/budget-baseline.json": JSON.stringify({ totalGz: Object.values(chunks).reduce((a, b) => a + b, 0), chunks }),
  };
}

function checkStartup(parts) {
  const root = makeFixture(startupBuild(parts));
  try {
    return runGate("budget", root, { VITE_PITCH: "", VITE_TAFSIR_QF_BASE: "", VITE_TAFSIR_QF_ID: "" });
  } finally {
    dropFixture(root);
  }
}

test("gate:budget says how much is downloaded at start-up, style sheet included", () => {
  const r = checkStartup({ script: heavy(100), style: heavy(20) });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /start-up download: 1[12]\d\.\d KB/);
});

test("gate:budget refuses a start-up download over its limit while the total is under the cap", () => {
  const r = checkStartup({ script: heavy(170), style: heavy(20) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /start-up download/);
  assert.match(r.out, /150 ms/);
  assert.doesNotMatch(r.out, /KB budget/);
});

test("gate:budget refuses a start-up download back on the slower step (2026-11-14)", () => {
  // At 162.6 KB start-up read about 2257 ms; at 159.5 KB, about 2107
  // (docs/performance.md ㉑). The limit sits between them so the app cannot
  // drift back up a step unnoticed.
  const r = checkStartup({ script: heavy(143), style: heavy(20) });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /start-up download: 16[2-4]\.\d KB/);
});

test("gate:budget does not count a late-loading file against the start-up limit", () => {
  const r = checkStartup({ script: heavy(100), late: heavy(95) });
  assert.equal(r.status, 0, r.out);
});

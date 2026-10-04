/**
 * The published-page check must pass a register where every row is a link on
 * the one other host, says what a reader sees and when it went out, and either
 * belongs to a real decision, keeps a checked-in copy, or says why it has none.
 * It must refuse a link on any other host, the same link twice, a row with
 * nothing in `shows`, a decision that does not exist, a row whose copy of the
 * page differs from its decision's, a page that is not checked in, a page with
 * no script and no note saying it is written by hand, and a row with no
 * decision and no page that does not say why (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const HOST = "https://claude.ai/code/artifact/";
const PAGE = "docs/design/sitting-hosting.html";
const BUILDER = "scripts/build-sitting-hosting-options.mjs";

const decisions = [
  { id: "sitting-hosting", status: "decided", page: PAGE, builtBy: BUILDER },
  { id: "confusion-map-export", status: "decided", page: null, builtBy: null },
];

/** One row of each kind the register holds. */
const rows = () => [
  {
    url: `${HOST}1111`,
    title: "Copy your map off the phone?",
    published: "2026-08-31",
    shows: "Three ways to copy a private record off the phone, drawn at phone size.",
    decision: "confusion-map-export",
    page: null,
    builtBy: null,
    note: null,
  },
  {
    url: `${HOST}2222`,
    title: "Where should the sittings live?",
    published: "2026-08-17",
    shows: "One checking session drawn at phone size, with three places it could live.",
    decision: "sitting-hosting",
    page: PAGE,
    builtBy: BUILDER,
    note: "Keeps its own copy of the page because the row says why it was republished.",
  },
  {
    url: `${HOST}3333`,
    title: "Where You Slip",
    published: "2026-08-29",
    shows: "An eight-screen walkthrough of marking where a reader slips.",
    decision: null,
    page: "docs/design/where-you-slip.html",
    builtBy: null,
    note: "Written by hand; the checked-in copy is the source.",
  },
  {
    url: `${HOST}4444`,
    title: "A diagnosis",
    published: "2026-08-10",
    shows: "What went wrong with a page turn, measured.",
    decision: null,
    page: null,
    builtBy: null,
    note: "Drawn in a scratch folder that was later emptied; only the link survives.",
  },
];

function withRegister(artifacts, fn) {
  const root = makeFixture({
    "docs/artifacts.json": JSON.stringify({ artifacts }, null, 2),
    "docs/decisions.json": JSON.stringify({ decisions }, null, 2),
    [PAGE]: "<!doctype html><title>Sittings</title>",
    [BUILDER]: "export {};\n",
    "docs/design/where-you-slip.html": "<!doctype html><title>Where you slip</title>",
  });
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

/** The register with row `i` changed by `patch`. */
const patched = (i, patch) => rows().map((a, j) => (j === i ? { ...a, ...patch } : a));

function refuses(artifacts, pattern) {
  withRegister(artifacts, (root) => {
    const r = runGate("artifacts", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /gate:artifacts — FAIL/);
    assert.match(r.out, pattern);
  });
}

test("gate:artifacts passes a register whose every row keeps its books", () => {
  withRegister(rows(), (root) => {
    const r = runGate("artifacts", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK: 4 published pages, 1 with no copy anywhere/);
  });
});

test("gate:artifacts refuses a link on any other host", () => {
  refuses(patched(0, { url: "https://example.com/page" }), /url must be an absolute https:\/\/claude\.ai\/… link/);
});

test("gate:artifacts refuses the same link twice", () => {
  refuses(patched(1, { url: `${HOST}1111` }), /Where should the sittings live\?\]: duplicate url/);
});

test("gate:artifacts refuses a row that does not say what a reader sees", () => {
  refuses(patched(0, { shows: "  " }), /shows is empty/);
});

test("gate:artifacts refuses a published date that is not a date", () => {
  refuses(patched(0, { published: "last week" }), /published must be YYYY-MM-DD, got last week/);
});

test("gate:artifacts refuses a decision that does not exist", () => {
  refuses(patched(0, { decision: "nobody-wrote-this" }), /decision "nobody-wrote-this" matches no row/);
});

test("gate:artifacts refuses a row whose copy of the page differs from its decision's", () => {
  refuses(
    patched(1, { page: "docs/design/where-you-slip.html" }),
    /decision "sitting-hosting" names page docs\/design\/sitting-hosting\.html — this row must match it exactly/,
  );
});

test("gate:artifacts refuses a row whose rebuild script differs from its decision's", () => {
  refuses(
    patched(1, { builtBy: "scripts/build-something-else.mjs" }),
    /decision "sitting-hosting" names builtBy scripts\/build-sitting-hosting-options\.mjs/,
  );
});

test("gate:artifacts refuses a page that is not checked in", () => {
  refuses(patched(2, { page: "docs/design/gone.html" }), /page docs\/design\/gone\.html does not exist/);
});

test("gate:artifacts refuses a page outside docs/", () => {
  refuses(patched(2, { page: "apps/web/index.html" }), /page must live under docs\/, got apps\/web\/index\.html/);
});

test("gate:artifacts refuses a page with no script and no note saying it is written by hand", () => {
  refuses(patched(2, { note: null }), /has no builtBy and no note saying it is written by hand/);
});

test("gate:artifacts refuses a rebuild script with no page to check in", () => {
  refuses(patched(3, { builtBy: BUILDER }), /builtBy is set but page is not/);
});

test("gate:artifacts refuses a row with no copy anywhere that does not say why", () => {
  refuses(patched(3, { note: "" }), /A diagnosis\]: no decision and no page — note must say why/);
});

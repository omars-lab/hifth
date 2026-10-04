/**
 * The edition check must refuse a page edition, or a manifest edition, that
 * SOURCES.md has no entry for, refuse a tree with no SOURCES.md or no editions
 * at all, and pass a tree where every edition is written up.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PAGES = "apps/web/public/assets/pages";
const MANIFEST = "apps/web/public/assets/manifest.json";
const sources = (...ids) => `# Sources\n\n${ids.map((id) => `### ${id}\n\nSome words.\n`).join("\n")}`;

const clean = {
  "SOURCES.md": sources("edition-a"),
  [`${PAGES}/edition-a/p1.svg`]: "<svg/>",
  [MANIFEST]: JSON.stringify({ edition: "edition-a" }),
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:license passes when every edition has an entry in SOURCES.md", () => {
  withFixture(clean, (root) => {
    const r = runGate("license", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(1 edition\(s\) documented: edition-a\)/);
  });
});

test("gate:license refuses a page edition that SOURCES.md does not write up", () => {
  withFixture({ ...clean, [`${PAGES}/edition-b/p1.svg`]: "<svg/>" }, (root) => {
    const r = runGate("license", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /edition "edition-b" has no "### edition-b" entry/);
    assert.doesNotMatch(r.out, /edition "edition-a"/);
  });
});

test("gate:license refuses a manifest edition that SOURCES.md does not write up", () => {
  withFixture({ ...clean, [MANIFEST]: JSON.stringify({ edition: "edition-z" }) }, (root) => {
    const r = runGate("license", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /manifest edition "edition-z" is not documented/);
  });
});

test("gate:license refuses a tree with no SOURCES.md", () => {
  const { "SOURCES.md": _gone, ...without } = clean;
  withFixture(without, (root) => {
    const r = runGate("license", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /SOURCES\.md is missing/);
  });
});

test("gate:license refuses a tree that ships no editions rather than passing nothing", () => {
  withFixture({ "SOURCES.md": sources("edition-a"), [`${PAGES}/.keep`]: "" }, (root) => {
    const r = runGate("license", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no asset editions found/);
  });
});

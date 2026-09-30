/**
 * The page-SVG check must refuse a page that carries a <text> element and pass
 * a page drawn only from outlined paths. A check that passes both has stopped
 * checking (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const PAGES = "apps/web/public/assets/pages";
const outlined = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1H0z"/></svg>';
const withText = '<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="0">a</text></svg>';

test("gate:notext passes pages made only of paths", () => {
  const root = makeFixture({ [`${PAGES}/p1.svg`]: outlined, [`${PAGES}/deep/p2.svg`]: outlined });
  try {
    const r = runGate("notext", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(2 pages/);
  } finally {
    dropFixture(root);
  }
});

test("gate:notext refuses a page with a <text> element, and names it", () => {
  const root = makeFixture({ [`${PAGES}/p1.svg`]: outlined, [`${PAGES}/p2.svg`]: withText });
  try {
    const r = runGate("notext", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /FAIL/);
    assert.match(r.out, /p2\.svg/);
    assert.doesNotMatch(r.out, /p1\.svg/);
  } finally {
    dropFixture(root);
  }
});

test("gate:notext refuses an empty page folder rather than passing nothing", () => {
  const root = makeFixture({ [`${PAGES}/.keep`]: "" });
  try {
    const r = runGate("notext", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no SVG pages found/);
  } finally {
    dropFixture(root);
  }
});

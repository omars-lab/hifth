/**
 * The built-bundle check must refuse a shell file that carries one of the
 * outside library's private letters, or a word of the development-only loader,
 * and pass a bundle with neither. Source maps and the staged docs/ pages are
 * out of its scope and must not trip it (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const DIST = "apps/web/dist";
// A private-use code point, written as an escape so this file carries none.
const PRIVATE = "\uE001";
const clean = {
  [`${DIST}/index.html`]: "<!doctype html><script src=assets/app.js></script>",
  [`${DIST}/assets/app.js`]: 'console.log("hifth");',
  [`${DIST}/assets/app.css`]: "body{margin:0}",
  // The interface's own Arabic is fine: normal Arabic letters, not the store's.
  [`${DIST}/assets/ar.js`]: 'export const t = "\u0627\u0644\u0645\u0635\u062D\u0641";',
};

function withFixture(files, fn) {
  const root = makeFixture(files);
  try {
    return fn(root);
  } finally {
    dropFixture(root);
  }
}

test("gate:bundle-notext passes a bundle with no held letters and no loader words", () => {
  withFixture(clean, (root) => {
    const r = runGate("bundle-notext", root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK \(4 shell file/);
  });
});

test("gate:bundle-notext refuses a private-use letter in a script", () => {
  withFixture({ ...clean, [`${DIST}/assets/app.js`]: `const w = "${PRIVATE}";` }, (root) => {
    const r = runGate("bundle-notext", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /held letters — apps\/web\/dist\/assets\/app\.js: 1 /);
  });
});

test("gate:bundle-notext refuses a word of the development-only loader", () => {
  const word = "mountQul" + "Overlay"; // split so this test file never carries it whole
  withFixture({ ...clean, [`${DIST}/assets/app.js`]: `${word}();` }, (root) => {
    const r = runGate("bundle-notext", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /store loader — apps\/web\/dist\/assets\/app\.js/);
  });
});

test("gate:bundle-notext ignores source maps and the staged docs pages", () => {
  withFixture(
    {
      ...clean,
      [`${DIST}/assets/app.js.map`]: `{"x":"${PRIVATE}"}`,
      [`${DIST}/docs/design/page.html`]: `<p>${PRIVATE}</p>`,
    },
    (root) => {
      const r = runGate("bundle-notext", root);
      assert.equal(r.status, 0, r.out);
    },
  );
});

test("gate:bundle-notext refuses to run without a build to weigh", () => {
  withFixture({ "apps/web/.keep": "" }, (root) => {
    const r = runGate("bundle-notext", root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /dist\/ not found/);
  });
});

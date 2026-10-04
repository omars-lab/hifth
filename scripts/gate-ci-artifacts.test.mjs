/**
 * The upload check must pass a workflow whose every upload is of something the
 * project still builds: today, the site going to GitHub Pages. It must refuse a
 * workflow that uploads nothing at all, an upload of a path nothing claims to
 * write, an upload whose builder is gone or no longer builds it, an upload of
 * several paths it cannot read, an upload that would quietly succeed with no
 * files, and an upload of a hidden folder the uploader skips
 * (docs/design/robust-validation.md ⑦).
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture, dropFixture, runGate } from "./gate-fixture.mjs";

const WORKFLOW = ".github/workflows/deploy.yml";

const workflow = (...steps) =>
  `name: deploy\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n` +
  `      - uses: actions/checkout@v4\n      - run: make site\n${steps.join("")}`;

const PAGES =
  "      - name: Upload the site\n        uses: actions/upload-pages-artifact@v3\n        with:\n          path: apps/web/dist\n";

const upload = (path, extra = "") =>
  `      - name: Keep the report\n        uses: actions/upload-artifact@v4\n        with:\n          name: report\n          path: ${path}\n${extra}`;

const BUILDS = JSON.stringify({ scripts: { build: "tsc -p tsconfig.json && vite build" } });

const files = (wf, { build = BUILDS } = {}) => ({
  [WORKFLOW]: wf,
  ...(build === null ? {} : { "apps/web/package.json": build }),
});

function run(tree) {
  const root = makeFixture(tree);
  try {
    return runGate("ci-artifacts", root);
  } finally {
    dropFixture(root);
  }
}

function refuses(tree, pattern) {
  const r = run(tree);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /gate:ci-artifacts — FAIL/);
  assert.match(r.out, pattern);
}

test("gate:ci-artifacts passes a site upload whose builder still builds it", () => {
  const r = run(files(workflow(PAGES)));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK \(1 upload step\(s\), each with a producer that still exists\)/);
});

test("gate:ci-artifacts passes a general upload that refuses to upload nothing", () => {
  const r = run(files(workflow(PAGES, upload("apps/web/dist", "          if-no-files-found: error\n"))));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK \(2 upload step\(s\)/);
});

test("gate:ci-artifacts refuses a workflow that uploads nothing at all", () => {
  refuses(files(workflow()), /no upload-artifact steps found; CI keeps no evidence at all/);
});

test("gate:ci-artifacts refuses an upload of a path nothing claims to write", () => {
  refuses(files(workflow(PAGES.replace("apps/web/dist", "apps/web/playwright-report"))), /deploy\.yml › Upload the site: uploads "apps\/web\/playwright-report", which no producer/);
});

test("gate:ci-artifacts refuses an upload whose builder is gone", () => {
  refuses(files(workflow(PAGES), { build: null }), /Upload the site: apps\/web\/package\.json no longer runs `vite build`/);
});

test("gate:ci-artifacts refuses an upload whose builder no longer builds it", () => {
  const build = JSON.stringify({ scripts: { build: "tsc -p tsconfig.json" } });
  refuses(files(workflow(PAGES), { build }), /Upload the site: apps\/web\/package\.json no longer runs `vite build`/);
});

test("gate:ci-artifacts refuses an upload of several paths it cannot read", () => {
  const multi = PAGES.replace("path: apps/web/dist", "path: |\n            apps/web/dist\n            apps/web/report");
  refuses(files(workflow(multi)), /Upload the site: no single-line "path:" found/);
});

test("gate:ci-artifacts refuses an upload that would quietly succeed with no files", () => {
  refuses(files(workflow(PAGES, upload("apps/web/dist"))), /Keep the report: needs "if-no-files-found: error" \(found nothing\)/);
});

test("gate:ci-artifacts refuses an upload that only warns when there are no files", () => {
  refuses(files(workflow(PAGES, upload("apps/web/dist", "          if-no-files-found: warn\n"))), /needs "if-no-files-found: error" \(found warn\)/);
});

test("gate:ci-artifacts refuses an upload of a hidden folder the uploader skips", () => {
  const step = upload(".lighthouseci", "          if-no-files-found: error\n");
  refuses(files(workflow(PAGES, step)), /uploads the hidden path "\.lighthouseci" without "include-hidden-files: true"/);
});

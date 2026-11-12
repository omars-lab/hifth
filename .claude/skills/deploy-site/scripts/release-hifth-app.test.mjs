/**
 * Putting the release folder together: the front page at the root, the app under read/.
 *
 * The copy leaves out only what the build always writes and the site never needs: the design
 * pages, the debug copies of the source, and the app's own _headers and _redirects (Cloudflare
 * reads those only at the root). It does not quietly leave out a pitch folder. A pitch build
 * means the app itself was built with the private pitch switched on, so the folder check must
 * see it and refuse the whole release. Written before assemble() and seen failing.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assemble } from "./release-hifth-app.mjs";
import { auditShipped, readFolder } from "./shipped.mjs";

function tree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

function fixture(appExtra = {}) {
  const root = mkdtempSync(join(tmpdir(), "hifth-release-"));
  const landing = join(root, "landing");
  const app = join(root, "dist");
  tree(landing, {
    "index.html": "<h1>Hifth</h1>",
    "privacy.html": "<p>privacy</p>",
    "styles.css": "body{}",
    "notify.js": "fetch('/api/notify')",
    "page-shot.png": "png",
    "_headers": "/read/sw.js\n  Cache-Control: no-cache\n",
    "_redirects": "/read/*  /read/index.html  200\n",
    "package.json": "{}",
    "wrangler.toml": "name = 'x'",
    "schema.sql": "create table t (x)",
    "notify.test.mjs": "",
    "functions/api/notify.js": "export {}",
    "lib/notify.js": "",
  });
  tree(app, {
    "index.html": "<script src=\"./assets/index-abc.js\"></script>",
    "sw.js": "//",
    "sw.js.map": "{}",
    "_headers": "/*\n",
    "_redirects": "/*  /index.html  200\n",
    "assets/index-abc.js": "const c='HEAD';",
    "assets/index-abc.js.map": "{}",
    "docs/index.html": "<html>",
    ...appExtra,
  });
  return { landing, app, out: join(root, "out") };
}

test("the front page goes at the root and the app under read/, and nothing the site never needs", () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out });
  assert.deepEqual(readFolder(out).files.map((f) => f.path), [
    "_headers",
    "_redirects",
    "index.html",
    "notify.js",
    "page-shot.png",
    "privacy.html",
    "read/assets/index-abc.js",
    "read/index.html",
    "read/sw.js",
    "styles.css",
  ]);
});

test("a pitch build is copied, so the check refuses the release instead of hiding it", () => {
  const { landing, app, out } = fixture({ "pitch/index.html": "<html>" });
  assemble({ landing, app, out });
  const problems = auditShipped(readFolder(out).files).problems;
  assert.deepEqual(problems.map((p) => p.path), ["read/pitch/index.html"]);
});

test("putting it together again starts from an empty folder", () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out });
  writeFileSync(join(out, "left-over.txt"), "from last time");
  assemble({ landing, app, out });
  assert.ok(!readFolder(out).files.some((f) => f.path === "left-over.txt"));
});

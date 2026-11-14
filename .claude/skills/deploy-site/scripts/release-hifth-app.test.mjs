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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LOCAL_LIST_KEY, TEST_TURNSTILE_SECRET, assemble, changesThatShip, configProblems, localListFrom, serveArgs } from "./release-hifth-app.mjs";
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
    "ar/index.html": "<h1>حفظ</h1>",
    "ar/privacy.html": "<p>privacy</p>",
    "ar/draft.md": "draft",
    "404.html": "<h1>No page here</h1>",
    "styles.css": "body{}",
    "notify.js": "fetch('/api/notify')",
    "shots/feature-notes.jpg": "jpg",
    "shots/notes.md": "draft",
    "fonts/aref-ruqaa-wordmark.woff2": "woff2",
    "fonts/aref-ruqaa-OFL.txt": "licence",
    "_headers": "/read/sw.js\n  Cache-Control: no-cache\n",
    "_redirects": "/read/*  /read/index.html  200\n",
    "package.json": "{}",
    "wrangler.toml": "name = 'x'",
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
    "404.html",
    "_headers",
    "_redirects",
    "ar/index.html",
    "ar/privacy.html",
    "fonts/aref-ruqaa-OFL.txt",
    "fonts/aref-ruqaa-wordmark.woff2",
    "index.html",
    "notify.js",
    "privacy.html",
    "read/assets/index-abc.js",
    "read/index.html",
    "read/sw.js",
    "shots/feature-notes.jpg",
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

test("the site's Cloudflare settings name no database and hold no list address or secret", () => {
  const base = 'name = "hifth-app"\npages_build_output_dir = "dist"\n';
  assert.deepEqual(configProblems(base), []);
  // Talking about the settings in a comment is fine; only real lines count.
  assert.deepEqual(configProblems(base + "# SUPABASE_URL and LIST_KEY are Pages secrets\n"), []);
  assert.match(configProblems(base + '[[d1_databases]]\nbinding = "DB"\n').map((p) => p.why).join(" "), /database/);
  assert.match(configProblems(base + '[vars]\nSUPABASE_URL = "https://made-up.supabase.co"\n').map((p) => p.why).join(" "), /secret/);
  assert.match(configProblems(base + '[vars]\nLIST_KEY = "x"\n').map((p) => p.why).join(" "), /secret/);
  assert.match(configProblems(null).map((p) => p.why).join(" "), /settings/);
});

test("only a list on this laptop is taken from supabase status", () => {
  const status = (o) => JSON.stringify(o);
  assert.deepEqual(localListFrom(status({ API_URL: "http://127.0.0.1:56321", PUBLISHABLE_KEY: "made-up" })), { url: "http://127.0.0.1:56321", key: "made-up" });
  assert.deepEqual(localListFrom(status({ API_URL: "http://localhost:54321", ANON_KEY: "made-up" })), { url: "http://localhost:54321", key: "made-up" });
  assert.equal(localListFrom(status({ API_URL: "https://made-up.supabase.co", PUBLISHABLE_KEY: "made-up" })), null);
  assert.equal(localListFrom(status({ API_URL: "http://127.0.0.1:56321" })), null);
  assert.equal(localListFrom("not json"), null);
  assert.equal(localListFrom(""), null);
});

test("serving on this laptop listens only here, uses the always-pass test secret, and never the real database", () => {
  const args = serveArgs(7124);
  assert.deepEqual(args.slice(0, 3), ["pages", "dev", "dist"]);
  assert.equal(args[args.indexOf("--ip") + 1], "127.0.0.1");
  assert.equal(args[args.indexOf("--port") + 1], "7124");
  assert.ok(args.includes(`TURNSTILE_SECRET=${TEST_TURNSTILE_SECRET}`));
  assert.ok(!args.includes("--remote"));
  assert.equal(TEST_TURNSTILE_SECRET, "1x0000000000000000000000000000000AA");
  // No local list: no list settings, so the form says the list is not open yet.
  assert.ok(!args.some((a) => /^(SUPABASE_|LIST_KEY|MAIL_SENDER)/.test(a)));
  assert.ok(!args.includes("--d1"));
});

test("with a local list, serving hands it the local address, the made-up site key and the log-only sender", () => {
  const args = serveArgs(7124, { url: "http://127.0.0.1:56321", key: "made-up" });
  assert.ok(args.includes("SUPABASE_URL=http://127.0.0.1:56321"));
  assert.ok(args.includes("SUPABASE_PUBLISHABLE_KEY=made-up"));
  assert.ok(args.includes(`LIST_KEY=${LOCAL_LIST_KEY}`));
  assert.ok(args.includes("MAIL_SENDER=dev-log"));
  // The same made-up key supabase/seed.sql stores the hash of.
  assert.match(readFileSync(new URL("../../../../supabase/seed.sql", import.meta.url), "utf8"), new RegExp(LOCAL_LIST_KEY));
});

test("a change to the page-comment files does not stop a release; any other change does", () => {
  // The comment tool adds a line to its thread files after every commit, and none of them
  // ships, so counting them would refuse every release until someone committed them.
  const porcelain = [
    " M .page-comments/threads/t_000001.jsonl",
    "?? .page-comments/threads/t_000002.jsonl",
  ].join("\n");
  assert.deepEqual(changesThatShip(porcelain), []);
  assert.deepEqual(changesThatShip(`${porcelain}\n M apps/landing/index.html`), [" M apps/landing/index.html"]);
  // A file merely named like the folder, elsewhere, still counts.
  assert.deepEqual(changesThatShip(" M docs/.page-comments-notes.md"), [" M docs/.page-comments-notes.md"]);
  assert.deepEqual(changesThatShip(""), []);
  // git() trims its output, so the first line can arrive without its leading space.
  assert.deepEqual(changesThatShip("M .page-comments/threads/t_000001.jsonl\n M apps/web/src/App.tsx"), [" M apps/web/src/App.tsx"]);
});

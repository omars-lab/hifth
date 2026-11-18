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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LOCAL_LIST_KEY, TEST_TURNSTILE_SECRET, assemble, cleanCopy, configProblems, localListFrom, serveArgs, withoutScriptRule } from "./release-hifth-app.mjs";
import { auditShipped, inlineScriptHashes, readFolder } from "./shipped.mjs";
import { fixtureEnv } from "../../../../scripts/gate-fixture.mjs";
import { APP_LINKS_FILE, appSiteAssociation } from "./app-links.mjs";

const MADE_UP_TEAM = "Q9Z8Y7X6W5";

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
    "ar/sources.html": "<p>sources</p>",
    "ar/support.html": "<p>support</p>",
    "sources.html": "<p>sources</p>",
    "support.html": "<p>support</p>",
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
    "app-status.json": '{"format":1,"lowest":{"ios":"0.1.0","macos":"0.1.0"},"notice":null,"off":[]}',
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
    "app-status.json",
    "ar/index.html",
    "ar/privacy.html",
    "ar/sources.html",
    "ar/support.html",
    "fonts/aref-ruqaa-OFL.txt",
    "fonts/aref-ruqaa-wordmark.woff2",
    "index.html",
    "notify.js",
    "privacy.html",
    "read/assets/index-abc.js",
    "read/index.html",
    "read/sw.js",
    "shots/feature-notes.jpg",
    "sources.html",
    "styles.css",
    "support.html",
  ]);
});

test("putting it together writes the fingerprint of the app page's own script into the app's rule", () => {
  const { landing, app, out } = fixture({
    "index.html": "<script>window.lang='en'</script><script src=\"./assets/index-abc.js\"></script>",
  });
  writeFileSync(join(landing, "_headers"), "/read/\n  Content-Security-Policy: script-src 'self' {app-inline-scripts}; object-src 'none'\n");
  assemble({ landing, app, out });
  const headers = readFileSync(join(out, "_headers"), "utf8");
  const [hash] = inlineScriptHashes("<script>window.lang='en'</script>");
  assert.equal(headers, `/read/\n  Content-Security-Policy: script-src 'self' ${hash}; object-src 'none'\n`);
  assert.deepEqual(auditShipped(readFolder(out).files).problems.filter((p) => /script/.test(p.why)), []);
  // The front page's own copy keeps the gap, so the next build fills it again.
  assert.match(readFileSync(join(landing, "_headers"), "utf8"), /\{app-inline-scripts\}/);
});

// The file that tells Apple which hifth.app links open the app names the signing team, which is
// read at release time and never written into the repo (launch item 9). A made-up team here.
test("given the signing team, putting it together writes Apple's links file, and the check passes it", () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out, team: MADE_UP_TEAM });
  const text = readFileSync(join(out, APP_LINKS_FILE), "utf8");
  assert.equal(text, appSiteAssociation(MADE_UP_TEAM));
  const problems = auditShipped(readFolder(out).files).problems;
  assert.deepEqual(problems.filter((p) => p.path === APP_LINKS_FILE), []);
});

test("with no signing team, no links file is written, and the check says it is missing", () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out });
  assert.equal(existsSync(join(out, ".well-known")), false);
  const problems = auditShipped(readFolder(out).files).problems.filter((p) => p.path === APP_LINKS_FILE);
  assert.equal(problems.length, 1);
  assert.match(problems[0].why, /missing/);
});

test("a pitch build is copied, so the check refuses the release instead of hiding it", () => {
  const { landing, app, out } = fixture({ "pitch/index.html": "<html>" });
  assemble({ landing, app, out, team: MADE_UP_TEAM });
  const problems = auditShipped(readFolder(out).files).problems;
  assert.deepEqual(problems.map((p) => p.path), ["read/pitch/index.html"]);
});

// Finder writes a .DS_Store into any build folder it has open (seen 2026-11-15 in the app's
// build folder). It is never part of the site, so the copy leaves it out rather than letting
// the check refuse the whole release over it.
test("Finder's .DS_Store files are not copied", () => {
  const { landing, app, out } = fixture({ ".DS_Store": "x", "assets/.DS_Store": "x" });
  assemble({ landing, app, out });
  assert.deepEqual(readFolder(out).files.filter((f) => f.path.endsWith(".DS_Store")), []);
});

test("putting it together again starts from an empty folder", () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out });
  writeFileSync(join(out, "left-over.txt"), "from last time");
  assemble({ landing, app, out });
  assert.ok(!readFolder(out).files.some((f) => f.path === "left-over.txt"));
});

// Finder writes a .DS_Store into a folder it has open, and it can do so while the old folder
// is being deleted, so the delete fails with "directory not empty" (seen 2026-11-14 on
// apps/landing/dist/read). Another process writing in a loop stands in for Finder.
test("putting it together again works while another program keeps writing into the old folder", async () => {
  const { landing, app, out } = fixture();
  assemble({ landing, app, out });
  const read = join(out, "read");
  const writer = spawn(process.execPath, ["-e",
    `const fs=require("fs");const end=Date.now()+800;while(Date.now()<end){try{fs.writeFileSync(${JSON.stringify(join(read, ".DS_Store"))},"x")}catch{}}`]);
  await new Promise((r) => setTimeout(r, 100));
  try {
    assert.doesNotThrow(() => assemble({ landing, app, out }));
  } finally {
    await new Promise((r) => writer.on("exit", r));
  }
  assert.ok(existsSync(join(out, "read", "index.html")));
});

test("the site's Cloudflare settings name only the accounts database and hold no list address or secret", () => {
  const base = 'name = "hifth-app"\npages_build_output_dir = "dist"\n';
  const accounts = '[[d1_databases]]\nbinding = "ACCOUNTS"\ndatabase_name = "hifth-accounts"\ndatabase_id = "00000000-0000-4000-8000-000000000000"\n';
  assert.deepEqual(configProblems(base), []);
  // The sign-in server's own database is the one allowed.
  assert.deepEqual(configProblems(base + accounts), []);
  // Talking about the settings in a comment is fine; only real lines count.
  assert.deepEqual(configProblems(base + "# SUPABASE_URL and LIST_KEY are Pages secrets\n"), []);
  assert.match(configProblems(base + '[[d1_databases]]\nbinding = "DB"\n').map((p) => p.why).join(" "), /database/);
  assert.match(configProblems(base + accounts + '[[d1_databases]]\nbinding = "LIST"\n').map((p) => p.why).join(" "), /LIST/);
  assert.match(configProblems(base + "[[d1_databases]]\ndatabase_name = \"x\"\n").map((p) => p.why).join(" "), /database/);
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

// The copy on this laptop writes the side bar and the comment button into each page, which the
// front pages' script rule refuses. Only that rule is left out there; every other header stays.
test("the laptop's copy leaves out only the script rule from the site's headers", () => {
  const live = readFileSync(join(dirname(new URL(import.meta.url).pathname), "../../../../apps/landing/_headers"), "utf8");
  assert.match(live, /Content-Security-Policy:/);
  const local = withoutScriptRule(live);
  assert.doesNotMatch(local, /Content-Security-Policy/i);
  const others = (t) => t.split("\n").filter((l) => !/Content-Security-Policy/i.test(l));
  assert.deepEqual(others(local), others(live));
  assert.match(local, /X-Frame-Options: DENY/);
});

// GitHub's publish built from a fresh copy, which is what proved the site never held the private
// pitch folder (git ignores it, so it sits only in the laptop's working tree). The laptop release
// keeps that: it builds a clean copy of the released commit, never the working tree. Owner,
// 2026-11-17: the laptop publishes (docs/design/laptop-publish.md).
test("a release builds from a clean copy of the commit, with no ignored private folder and no uncommitted work", () => {
  const env = fixtureEnv();
  const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();
  const repo = mkdtempSync(join(tmpdir(), "hifth-release-repo-"));
  git(repo, "init", "--quiet", "--initial-branch=main");
  tree(repo, {
    ".gitignore": "apps/web/public/assets/private\n",
    "apps/web/index.html": "<p>released</p>",
  });
  git(repo, "add", ".gitignore", "apps/web/index.html");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "--quiet", "--no-verify", "-m", "one");
  const released = git(repo, "rev-parse", "HEAD");
  // Made-up stand-ins: a private file git ignores, and an edit nobody committed.
  tree(repo, {
    "apps/web/public/assets/private/held.json": "{\"made\":\"up\"}",
    "apps/web/index.html": "<p>not committed</p>",
  });

  const copy = cleanCopy({ repo, commit: released });

  assert.equal(git(copy, "rev-parse", "HEAD"), released);
  assert.equal(existsSync(join(copy, "apps/web/public/assets/private")), false);
  assert.equal(readFileSync(join(copy, "apps/web/index.html"), "utf8"), "<p>released</p>");
  assert.equal(git(copy, "status", "--porcelain"), "");
});

test("a clean copy refuses a commit the repo does not have", () => {
  const env = fixtureEnv();
  const repo = mkdtempSync(join(tmpdir(), "hifth-release-repo-"));
  execFileSync("git", ["-C", repo, "init", "--quiet"], { env });
  assert.throws(() => cleanCopy({ repo, commit: "0123456789abcdef0123456789abcdef01234567" }), /0123456789ab/);
});

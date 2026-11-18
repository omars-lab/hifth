import { test } from "node:test";
import assert from "node:assert/strict";
import { firstUpload } from "./first-upload.mjs";

// Before hifth.app's first upload, several things have to be in place, some by the owner on
// Cloudflare and Apple, some in the repo. This check says which, one line each, with names and
// yes or no only. Everything here is made up: the token, the account and the setting values.
const env = { CLOUDFLARE_API_TOKEN: "made-up-token", CLOUDFLARE_ACCOUNT_ID: "made-up-account" };
const FORM = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "LIST_KEY", "TURNSTILE_SECRET"];
const APPLE = ["APPLE_SIGN_IN_KEY", "APPLE_SIGN_IN_KEY_ID", "APPLE_TEAM_ID"];
const secret = { type: "secret_text", value: "made-up-secret-value" };

/** A stand-in for Cloudflare: the project, its domains, its uploads and the account's spam-check widgets. */
function cloudflare({ project = true, branch = "main", vars = {}, domains = [], uploads = 0, widgets = [], widgetsRefused = false } = {}) {
  const asked = [];
  const reply = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
  const fetch = async (url) => {
    asked.push(url);
    if (url.endsWith("/challenges/widgets?per_page=50")) {
      return widgetsRefused
        ? reply({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }, false, 403)
        : reply({ success: true, result: widgets });
    }
    if (!project) return reply({ success: false, errors: [{ code: 8000007, message: "Project not found" }] }, false, 404);
    if (url.endsWith("/domains")) return reply({ success: true, result: domains });
    if (url.includes("/deployments")) return reply({ success: true, result: Array.from({ length: uploads }, (_, i) => ({ id: `d${i}` })) });
    return reply({ success: true, result: { name: "hifth-app", production_branch: branch, deployment_configs: { production: { env_vars: vars } } } });
  };
  return { fetch, asked };
}

const page = (key) => `<form><div class="cf-turnstile" data-sitekey="${key}"></div></form>`;
const TEST_KEY = "1x00000000000000000000AA";
const REAL_KEY = "0x4AAAAAAAmadeupkey";
/** What main holds, by path; a missing path is a file main does not have. */
const main = (files) => (path) => (path in files ? files[path] : null);
const ready = { "apps/landing/index.html": page(REAL_KEY), "apps/landing/ar/index.html": page(REAL_KEY), "apps/landing/functions/api/sign-in/index.js": "x" };

const said = () => {
  const lines = [];
  return { say: (l) => lines.push(l), text: () => lines.join("\n") };
};

const allVars = Object.fromEntries([...FORM, ...APPLE].map((n) => [n, secret]));
const allSet = () => ({
  vars: { ...allVars },
  domains: [{ name: "hifth.app", status: "active" }],
  widgets: [{ name: "hifth.app", domains: ["hifth.app"], sitekey: REAL_KEY }],
});

test("everything in place: ready, and the two after-upload switches are named as next", async () => {
  const out = said();
  const ok = await firstUpload({ env: { ...env, SUPABASE_DB_URL: "postgres://made-up" }, fetch: cloudflare(allSet()).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, true);
  assert.match(out.text(), /ready for the first upload/i);
  assert.match(out.text(), /SIGN_IN/);
  assert.match(out.text(), /after the first upload/i);
});

test("prints names and yes or no, never a value, the token or the account", async () => {
  const out = said();
  await firstUpload({ env: { ...env, SUPABASE_DB_URL: "postgres://made-up" }, fetch: cloudflare(allSet()).fetch, readMain: main(ready), say: out.say });
  for (const hidden of ["made-up-secret-value", "made-up-token", "made-up-account", "postgres://made-up", REAL_KEY]) {
    assert.ok(!out.text().includes(hidden), `printed ${hidden}`);
  }
});

test("without the saved Cloudflare keys it says so and looks no further", async () => {
  const out = said();
  const cf = cloudflare(allSet());
  const ok = await firstUpload({ env: {}, fetch: cf.fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.equal(cf.asked.length, 0);
  assert.match(out.text(), /not loaded/);
});

test("no project on Cloudflare yet: not ready, and says who makes it", async () => {
  const out = said();
  const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), project: false }).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /✗.*project/i);
});

test("a live branch other than main is refused", async () => {
  const out = said();
  const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), branch: "production" }).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /✗.*main/);
});

test("hifth.app not attached, or attached but not yet active, is not ready", async () => {
  for (const domains of [[], [{ name: "hifth.app", status: "pending" }]]) {
    const out = said();
    const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), domains }).fetch, readMain: main(ready), say: out.say });
    assert.equal(ok, false);
    assert.match(out.text(), /✗.*hifth\.app/);
  }
});

test("each missing site setting is named on its own line", async () => {
  const out = said();
  const vars = { ...allVars };
  delete vars.LIST_KEY;
  delete vars.TURNSTILE_SECRET;
  const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), vars }).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /✗.*LIST_KEY/);
  assert.match(out.text(), /✗.*TURNSTILE_SECRET/);
  assert.match(out.text(), /✓.*SUPABASE_URL/);
});

test("no spam-check widget on the account is not ready", async () => {
  const out = said();
  const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), widgets: [] }).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /✗.*spam-check widget/i);
});

test("a token that cannot look at widgets says it could not look, and is not counted as ready", async () => {
  const out = said();
  const ok = await firstUpload({ env, fetch: cloudflare({ ...allSet(), widgetsRefused: true }).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /could not look/i);
});

// The repo's front page keeps the test key so the form works on this laptop; the release swaps in
// the real one from the saved keys. So the test key on main is fine once the real one is saved.
test("main's front page with the test key and no real key saved is not ready, in either language", async () => {
  for (const which of ["apps/landing/index.html", "apps/landing/ar/index.html"]) {
    const out = said();
    const ok = await firstUpload({ env, fetch: cloudflare(allSet()).fetch, readMain: main({ ...ready, [which]: page(TEST_KEY) }), say: out.say });
    assert.equal(ok, false, which);
    assert.match(out.text(), /✗.*HIFTH_APP_TURNSTILE_SITEKEY/);
  }
});

test("main's test key with the real one saved is ready, and the saved key is never printed", async () => {
  const out = said();
  const both = { ...ready, "apps/landing/index.html": page(TEST_KEY), "apps/landing/ar/index.html": page(TEST_KEY) };
  const ok = await firstUpload({ env: { ...env, HIFTH_APP_TURNSTILE_SITEKEY: REAL_KEY }, fetch: cloudflare(allSet()).fetch, readMain: main(both), say: out.say });
  assert.equal(ok, true);
  assert.match(out.text(), /✓.*HIFTH_APP_TURNSTILE_SITEKEY/);
  assert.ok(!out.text().includes(REAL_KEY));
});

test("only live uploads are counted, not previews", async () => {
  const cf = cloudflare(allSet());
  await firstUpload({ env, fetch: cf.fetch, readMain: main(ready), say: () => {} });
  assert.ok(cf.asked.some((u) => u.includes("/deployments?env=production")), cf.asked.join("\n"));
});

test("sign-in code not yet on main is a warning about sign-in, not a block on the upload", async () => {
  const out = said();
  const files = { ...ready };
  delete files["apps/landing/functions/api/sign-in/index.js"];
  const ok = await firstUpload({ env: { ...env, SUPABASE_DB_URL: "x" }, fetch: cloudflare(allSet()).fetch, readMain: main(files), say: out.say });
  assert.equal(ok, true);
  assert.match(out.text(), /sign-in.*not on main/i);
});

test("an earlier upload means this is no longer the first one", async () => {
  const out = said();
  await firstUpload({ env: { ...env, SUPABASE_DB_URL: "x" }, fetch: cloudflare({ ...allSet(), uploads: 2 }).fetch, readMain: main(ready), say: out.say });
  assert.match(out.text(), /already has 2 upload/i);
  assert.match(out.text(), /without --no-carry/);
});

test("the database address missing from the saved keys is named, but does not block the upload", async () => {
  const out = said();
  const ok = await firstUpload({ env, fetch: cloudflare(allSet()).fetch, readMain: main(ready), say: out.say });
  assert.equal(ok, true);
  assert.match(out.text(), /SUPABASE_DB_URL/);
});

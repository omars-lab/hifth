import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, handleNotify, handleUnsubscribe } from "./notify.mjs";

/*
 * The "tell me when the Mac app is out" list (docs/design/hifth-app-site.md ①). Every address
 * here is made up; real ones never go in the repo. The spam check is stood in for by what
 * Cloudflare's Siteverify answers for its published always-pass and always-fail test secrets.
 * Written before the handler, and watched failing.
 */

/** An in-memory stand-in for the D1 table `notify (email PK, created_at, unsubscribe_token UNIQUE)`. */
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/^INSERT INTO notify/.test(sql)) {
                const [email, created_at, unsubscribe_token] = args;
                if (rows.has(email)) return { meta: { changes: 0 } };
                rows.set(email, { email, created_at, unsubscribe_token });
                return { meta: { changes: 1 } };
              }
              if (/^DELETE FROM notify WHERE unsubscribe_token/.test(sql)) {
                for (const [email, row] of rows) {
                  if (row.unsubscribe_token === args[0]) {
                    rows.delete(email);
                    return { meta: { changes: 1 } };
                  }
                }
                return { meta: { changes: 0 } };
              }
              throw new Error(`unexpected statement: ${sql}`);
            },
          };
        },
      };
    },
  };
}

/** What Siteverify answers, and a record of how often it was asked. */
function siteverify(answer) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: init.body });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer), { headers: { "content-type": "application/json" } });
  };
  return { fetch, calls };
}

const PASS = { success: true, hostname: "hifth.app" };
const FAIL = { success: false, "error-codes": ["invalid-input-response"] };
const ENV = (db) => ({ DB: db, TURNSTILE_SECRET: "made-up-secret" });

function signup(fields, { json = true } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request("https://hifth.app/api/notify", {
    method: "POST",
    headers: json ? { Accept: "application/json", "CF-Connecting-IP": "203.0.113.7" } : {},
    body,
  });
}

const OPTS = (fetch) => ({ fetch, now: () => new Date("2026-11-12T10:00:00Z"), newToken: () => "made-up-unsubscribe-token-0001" });

test("a new email is kept with its date and a way to leave", async () => {
  const db = fakeDb();
  const sv = siteverify(PASS);
  const res = await handleNotify(signup({ email: "  Reader@Example.COM ", "cf-turnstile-response": "tok" }), ENV(db), OPTS(sv.fetch));
  assert.equal(res.status, 200);
  assert.match((await res.json()).message, /on the list/);
  assert.deepEqual(db.rows.get("reader@example.com"), {
    email: "reader@example.com",
    created_at: "2026-11-12T10:00:00.000Z",
    unsubscribe_token: "made-up-unsubscribe-token-0001",
  });
});

test("the spam check is asked once, with the secret, the token and the reader's address", async () => {
  const sv = siteverify(PASS);
  await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "tok-1" }), ENV(fakeDb()), OPTS(sv.fetch));
  assert.equal(sv.calls.length, 1);
  assert.equal(sv.calls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  const sent = sv.calls[0].body;
  assert.equal(sent.get("secret"), "made-up-secret");
  assert.equal(sent.get("response"), "tok-1");
  assert.equal(sent.get("remoteip"), "203.0.113.7");
});

test("signing up twice says you are already on the list, not an error", async () => {
  const db = fakeDb();
  const sv = siteverify(PASS);
  await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(sv.fetch));
  const res = await handleNotify(signup({ email: "A@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(sv.fetch));
  assert.equal(res.status, 200);
  assert.match((await res.json()).message, /already on the list/);
  assert.equal(db.rows.size, 1);
});

test("a failed spam check keeps nothing", async () => {
  const db = fakeDb();
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(siteverify(FAIL).fetch));
  assert.equal(res.status, 403);
  assert.match((await res.json()).message, /spam check/);
  assert.equal(db.rows.size, 0);
});

test("a spam check passed on another site keeps nothing", async () => {
  const db = fakeDb();
  const sv = siteverify({ success: true, hostname: "example.com" });
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(sv.fetch));
  assert.equal(res.status, 403);
  assert.equal(db.rows.size, 0);
});

test("the sites a spam check may come from can be set, for a preview address", async () => {
  const db = fakeDb();
  const sv = siteverify({ success: true, hostname: "preview.hifth-app.pages.dev" });
  const env = { ...ENV(db), TURNSTILE_HOSTNAMES: "hifth.app, preview.hifth-app.pages.dev" };
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), env, OPTS(sv.fetch));
  assert.equal(res.status, 200);
});

test("when the spam check cannot be reached, nothing is kept and it is not asked again", async () => {
  const db = fakeDb();
  const sv = siteverify(new Error("offline"));
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(sv.fetch));
  assert.equal(res.status, 502);
  assert.equal(sv.calls.length, 1);
  assert.equal(db.rows.size, 0);
});

test("a bad email or a missing spam-check token is turned away before asking Cloudflare", async () => {
  for (const fields of [
    { email: "not-an-email", "cf-turnstile-response": "t" },
    { email: "a@b", "cf-turnstile-response": "t" },
    { email: `${"x".repeat(250)}@example.com`, "cf-turnstile-response": "t" },
    { email: "a@example.com" },
  ]) {
    const sv = siteverify(PASS);
    const res = await handleNotify(signup(fields), ENV(fakeDb()), OPTS(sv.fetch));
    assert.equal(res.status, 400, JSON.stringify(fields).slice(0, 40));
    assert.equal(sv.calls.length, 0);
  }
});

test("without the database or the secret, it says the list is not open yet", async () => {
  for (const env of [{ TURNSTILE_SECRET: "s" }, { DB: fakeDb() }]) {
    const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), env, OPTS(siteverify(PASS).fetch));
    assert.equal(res.status, 503);
  }
});

test("a browser without JavaScript gets a plain page back, with a way home", async () => {
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }, { json: false }), ENV(fakeDb()), OPTS(siteverify(PASS).fetch));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const html = await res.text();
  assert.match(html, /on the list/);
  assert.match(html, /href="\/"/);
});

test("the answer never repeats the email back", async () => {
  const res = await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }, { json: false }), ENV(fakeDb()), OPTS(siteverify(PASS).fetch));
  assert.doesNotMatch(await res.text(), /a@example\.com/);
});

test("the leave link takes the email off the list", async () => {
  const db = fakeDb();
  await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(siteverify(PASS).fetch));
  const res = await handleUnsubscribe(new Request("https://hifth.app/api/unsubscribe?t=made-up-unsubscribe-token-0001"), ENV(db));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /off the list/);
  assert.equal(db.rows.size, 0);
});

test("an unknown or malformed leave link says the same, and changes nothing", async () => {
  const db = fakeDb();
  await handleNotify(signup({ email: "a@example.com", "cf-turnstile-response": "t" }), ENV(db), OPTS(siteverify(PASS).fetch));
  for (const t of ["made-up-unsubscribe-token-9999", "x", ""]) {
    const res = await handleUnsubscribe(new Request(`https://hifth.app/api/unsubscribe?t=${t}`), ENV(db));
    assert.equal(res.status, 200);
    assert.match(await res.text(), /off the list/);
  }
  assert.equal(db.rows.size, 1);
});

test("an email is cleaned the same way every time", () => {
  assert.equal(cleanEmail("  A.Reader+hifth@Example.org "), "a.reader+hifth@example.org");
  assert.equal(cleanEmail("two@at@signs.org"), null);
  assert.equal(cleanEmail("space in@example.org"), null);
  assert.equal(cleanEmail(""), null);
  assert.equal(cleanEmail(undefined), null);
});

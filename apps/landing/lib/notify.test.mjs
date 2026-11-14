import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, handleConfirm, handleNotify, handleUnsubscribe, pickSender } from "./notify.mjs";

/*
 * The "tell me when the Mac app is out" list (docs/design/hifth-app-mailing-list.md). Every
 * address here is made up; real ones never go in the repo. Two outside services are stood in
 * for: Cloudflare's spam check (what Siteverify answers for its published always-pass and
 * always-fail test secrets), and the list's three database functions on Supabase
 * (supabase/migrations/20261113000001_notify_list.sql; supabase/tests/ checks those for real).
 * Written before the handlers, and watched failing.
 */

const PASS = { success: true, hostname: "hifth.app" };
const FAIL = { success: false, "error-codes": ["invalid-input-response"] };
const LIST = "https://list.example.test";

/**
 * The outside world, as the handlers see it through fetch. `verdict` is what the spam check
 * answers (an Error when it cannot be reached); `list` is how the database answers: "up",
 * "asleep" (a paused free project answers 503), or "offline" (the fetch itself fails).
 * `confirmed` is what notify_confirm returns.
 */
function world({ verdict = PASS, list = "up", confirmed = true } = {}) {
  const spamChecks = [];
  const calls = [];
  const fetch = async (url, init = {}) => {
    if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      spamChecks.push({ url, body: init.body });
      if (verdict instanceof Error) throw verdict;
      return Response.json(verdict);
    }
    if (url.startsWith(`${LIST}/rest/v1/rpc/`)) {
      calls.push({ name: url.slice(`${LIST}/rest/v1/rpc/`.length), headers: new Headers(init.headers), args: JSON.parse(init.body) });
      if (list === "offline") throw new Error("offline");
      if (list === "asleep") return new Response("paused", { status: 503 });
      if (calls.at(-1).name === "notify_confirm") return Response.json(confirmed);
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetch, spamChecks, calls };
}

/** A stand-in mail service that records what it was asked to send. */
function mailbox({ fails = false } = {}) {
  const sent = [];
  const send = async (message) => {
    if (fails) throw new Error("mail service down");
    sent.push(message);
  };
  return { send, sent };
}

const ENV = {
  SUPABASE_URL: LIST,
  SUPABASE_PUBLISHABLE_KEY: "made-up-publishable-key",
  LIST_KEY: "made-up-list-key",
  TURNSTILE_SECRET: "made-up-secret",
};
const CODE = "c0de".repeat(12);
const LEAVE = "1ea5e".repeat(12) + "abcd";

function signup(fields, { json = true, host = "hifth.app" } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request(`https://${host}/api/notify`, {
    method: "POST",
    headers: json ? { Accept: "application/json", "CF-Connecting-IP": "203.0.113.7" } : {},
    body,
  });
}

const OK_FORM = { email: "  Reader@Example.COM ", "cf-turnstile-response": "tok" };

async function signUp(fields = OK_FORM, { w = world(), mail = mailbox(), env = ENV, json, host } = {}) {
  const res = await handleNotify(signup(fields, { json, host }), env, { fetch: w.fetch, send: mail.send, newCode: () => CODE });
  return { res, w, mail };
}

// Signing up.

test("a new sign-up is kept waiting for its confirmation, and one email is sent to confirm it", async () => {
  const { res, w, mail } = await signUp();
  assert.equal(res.status, 200);
  assert.match((await res.json()).message, /Check your inbox/);
  assert.equal(w.calls.length, 1);
  const [call] = w.calls;
  assert.equal(call.name, "notify_add");
  assert.deepEqual(call.args, { p_key: "made-up-list-key", p_email: "reader@example.com", p_lang: "en", p_confirm: CODE });
  assert.equal(call.headers.get("apikey"), "made-up-publishable-key");
  assert.equal(call.headers.get("authorization"), null, "the publishable key only, never a secret one");
  assert.equal(mail.sent.length, 1);
  assert.equal(mail.sent[0].to, "reader@example.com");
  assert.equal(mail.sent[0].lang, "en");
  assert.equal(mail.sent[0].confirmUrl, `https://hifth.app/api/confirm?c=${CODE}`);
});

test("the confirm code is fresh and long enough that nobody can guess it", async () => {
  const w = world();
  const req = () => signup({ email: "a@example.com", "cf-turnstile-response": "t" });
  await handleNotify(req(), ENV, { fetch: w.fetch, send: mailbox().send });
  await handleNotify(req(), ENV, { fetch: w.fetch, send: mailbox().send });
  const [a, b] = w.calls.map((c) => c.args.p_confirm);
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, b);
});

test("the spam check is asked once, with the secret, the token and the reader's address", async () => {
  const { w } = await signUp({ email: "a@example.com", "cf-turnstile-response": "tok-1" });
  assert.equal(w.spamChecks.length, 1);
  const sent = w.spamChecks[0].body;
  assert.equal(sent.get("secret"), "made-up-secret");
  assert.equal(sent.get("response"), "tok-1");
  assert.equal(sent.get("remoteip"), "203.0.113.7");
});

test("signing up twice answers exactly the same, so the form never tells anyone who is on the list", async () => {
  const w = world();
  const first = await signUp(OK_FORM, { w });
  const second = await signUp(OK_FORM, { w });
  assert.equal(first.res.status, second.res.status);
  assert.deepEqual(await first.res.json(), await second.res.json());
});

test("a failed spam check keeps nothing and sends nothing", async () => {
  const { res, w, mail } = await signUp(OK_FORM, { w: world({ verdict: FAIL }) });
  assert.equal(res.status, 403);
  assert.match((await res.json()).message, /spam check/);
  assert.equal(w.calls.length, 0);
  assert.equal(mail.sent.length, 0);
});

test("a spam check passed on another site keeps nothing", async () => {
  const { res, w } = await signUp(OK_FORM, { w: world({ verdict: { success: true, hostname: "example.com" } }) });
  assert.equal(res.status, 403);
  assert.equal(w.calls.length, 0);
});

test("the sites a spam check may come from can be set, for a preview address", async () => {
  const w = world({ verdict: { success: true, hostname: "preview.hifth-app.pages.dev" } });
  const env = { ...ENV, TURNSTILE_HOSTNAMES: "hifth.app, preview.hifth-app.pages.dev" };
  const { res } = await signUp(OK_FORM, { w, env });
  assert.equal(res.status, 200);
});

test("when the spam check cannot be reached, nothing is kept and it is not asked again", async () => {
  const { res, w } = await signUp(OK_FORM, { w: world({ verdict: new Error("offline") }) });
  assert.equal(res.status, 502);
  assert.equal(w.spamChecks.length, 1);
  assert.equal(w.calls.length, 0);
});

test("a bad email or a missing spam-check token is turned away before asking anyone", async () => {
  for (const fields of [
    { email: "not-an-email", "cf-turnstile-response": "t" },
    { email: "a@b", "cf-turnstile-response": "t" },
    { email: `${"x".repeat(250)}@example.com`, "cf-turnstile-response": "t" },
    { email: "a@example.com" },
  ]) {
    const { res, w } = await signUp(fields);
    assert.equal(res.status, 400, JSON.stringify(fields).slice(0, 40));
    assert.equal(w.spamChecks.length + w.calls.length, 0);
  }
});

test("with any setting missing, or no way to send the confirm email, it says the list is not open yet", async () => {
  const missing = Object.keys(ENV).map((k) => ({ ...ENV, [k]: undefined }));
  for (const env of missing) {
    const { res, w } = await signUp(OK_FORM, { env });
    assert.equal(res.status, 503);
    assert.match((await res.json()).message, /isn't open yet/);
    assert.equal(w.spamChecks.length + w.calls.length, 0);
  }
  const w = world();
  const res = await handleNotify(signup(OK_FORM), ENV, { fetch: w.fetch, send: null });
  assert.equal(res.status, 503);
  assert.equal(w.spamChecks.length, 0, "the spam token is not spent on a list that cannot confirm anyone");
});

test("when the list is asleep or out of reach, it asks the reader to try later, and sends nothing", async () => {
  for (const list of ["asleep", "offline"]) {
    const { res, mail } = await signUp(OK_FORM, { w: world({ list }) });
    assert.equal(res.status, 503, list);
    assert.match((await res.json()).message, /try again later/);
    assert.equal(mail.sent.length, 0);
  }
});

test("when the confirm email cannot be sent, it asks the reader to try later", async () => {
  const { res } = await signUp(OK_FORM, { mail: mailbox({ fails: true }) });
  assert.equal(res.status, 503);
  assert.match((await res.json()).message, /try again later/);
});

test("a browser without JavaScript gets a plain page back, with a way home", async () => {
  const { res } = await signUp(OK_FORM, { json: false });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const html = await res.text();
  assert.match(html, /Check your inbox/);
  assert.match(html, /href="\/"/);
  // The line under the heading adds to it, never repeats it (see the test below for the rest).
  const heading = html.match(/<h1>(.*?)<\/h1>/)[1];
  assert.ok(!html.match(/<\/h1>\s*<p>(.*?)<\/p>/)[1].startsWith(heading));
});

test("the answer never repeats the email back", async () => {
  const { res } = await signUp({ email: "a@example.com", "cf-turnstile-response": "t" }, { json: false });
  assert.doesNotMatch(await res.text(), /a@example\.com/);
});

// The only mail sender built so far writes the confirm link to this laptop's server log.

test("the laptop's mail stand-in works only on this laptop, and logs the link, never the address", async () => {
  const lines = [];
  const send = pickSender({ MAIL_SENDER: "dev-log" }, new Request("http://127.0.0.1:7124/api/notify"), (line) => lines.push(line));
  assert.equal(typeof send, "function");
  await send({ to: "a@example.com", lang: "en", confirmUrl: `http://127.0.0.1:7124/api/confirm?c=${CODE}` });
  assert.equal(lines.length, 1);
  assert.match(lines[0], new RegExp(CODE));
  assert.doesNotMatch(lines[0], /a@example\.com/);

  for (const url of ["https://hifth.app/api/notify", "https://preview.hifth-app.pages.dev/api/notify"]) {
    assert.equal(pickSender({ MAIL_SENDER: "dev-log" }, new Request(url)), null, url);
  }
  assert.equal(pickSender({}, new Request("http://127.0.0.1:7124/api/notify")), null);
  assert.equal(pickSender({ MAIL_SENDER: "something-else" }, new Request("http://127.0.0.1:7124/api/notify")), null);
});

// Confirming. The email's link opens a page with a button; only pressing it confirms, so a mail
// program that opens links to scan them confirms nobody.

const confirmAt = (method, query = `c=${CODE}`, init = {}) =>
  new Request(`https://hifth.app/api/confirm?${query}`, { method, ...init });

test("opening the confirm link shows a button and changes nothing", async () => {
  const w = world();
  const res = await handleConfirm(confirmAt("GET"), ENV, { fetch: w.fetch });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<form method="post" action="\/api\/confirm\?c=[0-9a-f]{48}">/);
  assert.match(html, /<button[^>]*>Join the list<\/button>/);
  assert.equal(w.calls.length, 0);
});

test("pressing the button confirms, with the list key and the code", async () => {
  const w = world();
  const res = await handleConfirm(confirmAt("POST"), ENV, { fetch: w.fetch });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /You're on the list/);
  assert.deepEqual(w.calls.map((c) => [c.name, c.args]), [["notify_confirm", { p_key: "made-up-list-key", p_code: CODE }]]);
});

test("an old, unknown or malformed confirm link says it has expired", async () => {
  const w = world({ confirmed: false });
  const res = await handleConfirm(confirmAt("POST"), ENV, { fetch: w.fetch });
  assert.match(await res.text(), /expired/);
  for (const query of ["c=nope", "c=", ""]) {
    const w2 = world();
    const r = await handleConfirm(confirmAt("POST", query), ENV, { fetch: w2.fetch });
    assert.match(await r.text(), /expired/, query);
    assert.equal(w2.calls.length, 0, "a malformed code is not sent to the list");
  }
});

test("confirming while the list is asleep asks the reader to try later", async () => {
  const res = await handleConfirm(confirmAt("POST"), ENV, { fetch: world({ list: "asleep" }).fetch });
  assert.equal(res.status, 503);
  assert.match(await res.text(), /try again later/);
});

// Seen on the local site 2026-11-13: "You're on the list" as the heading, then "You're on the
// list. We'll write once…" under it. The line under a heading adds to it; it never says it again.
test("no answer page says its heading twice", async () => {
  const pages = [];
  for (const lang of ["en", "ar"]) {
    const q = lang === "ar" ? "&lang=ar" : "";
    pages.push(await handleConfirm(confirmAt("GET", `c=${CODE}${q}`), ENV, { fetch: world().fetch }));
    pages.push(await handleConfirm(confirmAt("POST", `c=${CODE}${q}`), ENV, { fetch: world().fetch }));
    pages.push(await handleConfirm(confirmAt("POST", `c=nope${q}`), ENV, { fetch: world().fetch }));
    pages.push(await handleConfirm(confirmAt("POST", `c=${CODE}${q}`), ENV, { fetch: world({ list: "asleep" }).fetch }));
    pages.push(await handleUnsubscribe(leaveAt("GET", `t=${LEAVE}${q}`), ENV, { fetch: world().fetch }));
    pages.push(await handleUnsubscribe(leaveAt("POST", `t=${LEAVE}${q}`), ENV, { fetch: world().fetch }));
    pages.push(await handleConfirm(confirmAt("GET", `c=${CODE}${q}`), {}, { fetch: world().fetch }));
  }
  assert.equal(pages.length, 14);
  for (const res of pages) {
    const html = await res.text();
    const heading = html.match(/<h1>(.*?)<\/h1>/)[1];
    const line = html.match(/<\/h1>\s*<p>(.*?)<\/p>/)[1];
    assert.ok(!line.startsWith(heading), `"${heading}" is said again under it: "${line}"`);
  }
});

// Leaving. The same two steps; the mail program's own one-click leave (a POST to the link) works
// without the page.

const leaveAt = (method, query = `t=${LEAVE}`, init = {}) =>
  new Request(`https://hifth.app/api/unsubscribe?${query}`, { method, ...init });

test("opening the leave link shows a button and changes nothing", async () => {
  const w = world();
  const res = await handleUnsubscribe(leaveAt("GET"), ENV, { fetch: w.fetch });
  const html = await res.text();
  assert.match(html, /<form method="post" action="\/api\/unsubscribe\?t=[0-9a-f]{64}">/);
  assert.match(html, /<button[^>]*>Leave the list<\/button>/);
  assert.equal(w.calls.length, 0);
});

test("pressing it, or the mail program's one-click leave, takes the address off the list", async () => {
  const oneClick = { body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } };
  for (const init of [{}, oneClick]) {
    const w = world();
    const res = await handleUnsubscribe(leaveAt("POST", `t=${LEAVE}`, init), ENV, { fetch: w.fetch });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /off the list/);
    assert.deepEqual(w.calls.map((c) => [c.name, c.args]), [["notify_leave", { p_key: "made-up-list-key", p_code: LEAVE }]]);
  }
});

test("an unknown or malformed leave link says the same, and a malformed one asks nobody", async () => {
  for (const query of ["t=nope", "t=", ""]) {
    const w = world();
    const res = await handleUnsubscribe(leaveAt("POST", query), ENV, { fetch: w.fetch });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /off the list/);
    assert.equal(w.calls.length, 0);
  }
});

test("without the list's settings, the links say they do not work yet", async () => {
  for (const handle of [handleConfirm, handleUnsubscribe]) {
    const res = await handle(confirmAt("POST"), {}, { fetch: world().fetch });
    assert.equal(res.status, 503);
    assert.match(await res.text(), /doesn't work yet/);
  }
});

test("an email is cleaned the same way every time", () => {
  assert.equal(cleanEmail("  A.Reader+hifth@Example.org "), "a.reader+hifth@example.org");
  assert.equal(cleanEmail("two@at@signs.org"), null);
  assert.equal(cleanEmail("space in@example.org"), null);
  assert.equal(cleanEmail(""), null);
  assert.equal(cleanEmail(undefined), null);
});

// The Arabic front page sends lang=ar with the form (owner, 2026-11-12, the language bar), so
// its reader is answered in Arabic, with scripts or without, and so are their links.

const noEnglish = (html) => html.replace(/<[^>]*>/g, "").replace(/Hifth/g, "");

test("a sign-up from the Arabic page is answered in Arabic, and its confirm link stays Arabic", async () => {
  const { res, w, mail } = await signUp({ ...OK_FORM, lang: "ar" });
  const { message } = await res.json();
  assert.match(message, /[؀-ۿ]/, "the message is in Arabic");
  assert.doesNotMatch(message, /[A-Za-z]/, "with no English left in it");
  assert.equal(w.calls[0].args.p_lang, "ar");
  assert.equal(mail.sent[0].lang, "ar");
  assert.equal(mail.sent[0].confirmUrl, `https://hifth.app/api/confirm?c=${CODE}&lang=ar`);
});

test("without JavaScript, the Arabic page gets an Arabic page back, right to left, with a way home", async () => {
  const { res } = await signUp({ email: "bad", lang: "ar" }, { json: false });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /href="\/ar\/"/);
  assert.doesNotMatch(noEnglish(html), /[A-Za-z]{3,}/, "no English words on it");
});

test("every answer has an Arabic copy", async () => {
  const cases = [
    [{}, OK_FORM],
    [ENV, { email: "bad" }],
    [ENV, { email: "a@example.com" }],
    [ENV, OK_FORM, world({ verdict: FAIL })],
    [ENV, OK_FORM, world({ list: "asleep" })],
    [ENV, OK_FORM],
  ];
  for (const [env, fields, w = world()] of cases) {
    const { res } = await signUp({ ...fields, lang: "ar" }, { env, w });
    assert.doesNotMatch((await res.json()).message, /[A-Za-z]/, JSON.stringify(fields));
  }
  for (const [handle, at] of [[handleConfirm, confirmAt], [handleUnsubscribe, leaveAt]]) {
    for (const method of ["GET", "POST"]) {
      const query = at === confirmAt ? `c=${CODE}&lang=ar` : `t=${LEAVE}&lang=ar`;
      const res = await handle(at(method, query), ENV, { fetch: world().fetch });
      const html = await res.text();
      assert.match(html, /<html lang="ar" dir="rtl">/);
      assert.doesNotMatch(noEnglish(html), /[A-Za-z]{3,}/, `${handle.name} ${method}`);
      if (method === "GET") assert.match(html, /action="\/api\/[a-z]+\?[ct]=[0-9a-f]+&amp;lang=ar"/, "the button keeps the language");
    }
  }
});

test("any other language, or none, is answered in English", async () => {
  for (const lang of ["fr", "", undefined]) {
    const fields = { ...OK_FORM, ...(lang === undefined ? {} : { lang }) };
    const { res } = await signUp(fields);
    assert.match((await res.json()).message, /Check your inbox/);
  }
});

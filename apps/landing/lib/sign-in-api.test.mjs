import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, SignJWT } from "jose";
import { handleAppleNotice, handleDeleteAccount, handleWord, handleSignIn, handleSignOut } from "./sign-in-api.mjs";
import { inviteHash } from "./invites.mjs";
import { MOST_WORDS_A_STRETCH, whoIs } from "./accounts.mjs";
import { localD1 } from "./test-d1.mjs";

/*
 * hifth.app's sign-in addresses (step 10 of docs/design/sign-in.md):
 *   POST /api/sign-in/word   hands out a one-off word
 *   POST /api/sign-in        Apple's note and the word in, a session out
 *   POST /api/sign-out       ends the session named in the Authorization line
 * The work behind them is accounts.mjs; these tests check what the app sees. Apple's check is
 * stood in for as in accounts.test.mjs: a note "apple:<user>" passes, anything else fails.
 * Written before sign-in-api.mjs, and watched failing.
 */

const check = async (note) =>
  typeof note === "string" && note.startsWith("apple:")
    ? { ok: true, appleUser: note.slice("apple:".length) }
    : { ok: false, reason: "bad-signature" };

function setUp(extra = {}) {
  const { db, rows } = localD1();
  const env = { SIGN_IN: "on", ACCOUNTS: db, APPLE_APP_IDS: "app.example.hifth", ...extra };
  return { db, rows, env };
}

const post = (path, body, headers = {}) =>
  new Request(`https://hifth.app${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function getWord(env) {
  const res = await handleWord(post("/api/sign-in/word", {}), env);
  return (await res.json()).word;
}

test("the whole way: a word, then Apple's note, gives a session that finds the account", async () => {
  const { db, env } = setUp();
  const word = await getWord(env);
  assert.match(word, /^[0-9a-f]{64}$/);
  const res = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }), env, { check });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.session, "string");
  assert.ok(await whoIs(db, body.session));
});

test("the sign-in reply carries the session and when it ends, nothing else", async () => {
  const { env } = setUp();
  const word = await getWord(env);
  const res = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }), env, { check });
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["expiresAt", "session"]);
  assert.ok(!JSON.stringify(body).includes("made-up.0001"), "Apple's user number is never sent back");
});

test("every reply says not to keep a copy anywhere on the way", async () => {
  const { env } = setUp();
  const word = await getWord(env);
  const replies = [
    await handleWord(post("/api/sign-in/word", {}), env),
    await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }), env, { check }),
    await handleSignIn(post("/api/sign-in", { note: "forged", word: "x" }), env, { check }),
    await handleSignOut(post("/api/sign-out", {}), env),
  ];
  for (const res of replies) assert.equal(res.headers.get("cache-control"), "no-store", String(res.status));
});

test("with sign-in switched off, every address answers as if it was not there, and keeps nothing", async () => {
  const { env, rows } = setUp({ SIGN_IN: undefined });
  const replies = [
    await handleWord(post("/api/sign-in/word", {}), env),
    await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word: "x" }), env, { check }),
    await handleSignOut(post("/api/sign-out", {}, { authorization: "Bearer x" }), env),
  ];
  for (const res of replies) assert.equal(res.status, 404);
  assert.equal(rows("sign_in_words").length, 0);
});

test("no reply lets another site's page read it: the Swift app calls hifth.app, never the page", async () => {
  const { env } = setUp();
  const word = await getWord(env);
  const asApp = { origin: "hifth-app://app" };
  const replies = [
    await handleWord(post("/api/sign-in/word", {}, asApp), env),
    await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }, asApp), env, { check }),
    await handleSignOut(post("/api/sign-out", {}, asApp), env),
  ];
  for (const res of replies) {
    assert.equal(res.headers.get("access-control-allow-origin"), null, String(res.status));
    assert.equal(res.headers.get("access-control-allow-credentials"), null, String(res.status));
  }
});

test("switched on but missing its database or app ids, it says it is not set up", async () => {
  for (const extra of [{ ACCOUNTS: undefined }, { APPLE_APP_IDS: undefined }, { APPLE_APP_IDS: " , " }]) {
    const { env } = setUp(extra);
    const res = await handleWord(post("/api/sign-in/word", {}), env);
    assert.equal(res.status, 503, JSON.stringify(Object.keys(extra)));
    assert.equal((await res.json()).reason, "not-set-up");
  }
});

test("a note that fails Apple's check is refused with the reason, and no session", async () => {
  const { env, rows } = setUp();
  const word = await getWord(env);
  const res = await handleSignIn(post("/api/sign-in", { note: "forged", word }), env, { check });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { reason: "bad-signature" });
  assert.equal(rows("sessions").length, 0);
});

test("a word that was never handed out is refused", async () => {
  const { env } = setUp();
  const res = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word: "never" }), env, { check });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { reason: "word-unknown" });
});

test("a body that is not the expected shape is refused before anything is spent", async () => {
  const { env, rows } = setUp();
  await getWord(env);
  for (const body of ["not json", "[]", "null", JSON.stringify({ note: 1, word: "x" }), JSON.stringify({ note: "x" })]) {
    const res = await handleSignIn(post("/api/sign-in", body), env, { check });
    assert.equal(res.status, 400, body);
    assert.deepEqual(await res.json(), { reason: "bad-request" });
  }
  assert.equal(rows("sign_in_words").length, 1, "the handed-out word is still there");
});

test("an oversized body is refused without being read into a note", async () => {
  const { env } = setUp();
  const huge = JSON.stringify({ note: "apple:" + "0".repeat(20_000), word: "x" });
  const res = await handleSignIn(post("/api/sign-in", huge), env, { check });
  assert.equal(res.status, 413);
});

// Step 13: the one-time code, Apple's cancel ticket, and Apple's notices. Apple is a stand-in
// function here, the key file is made up in the test, and the team id is a made-up one.

const APPLE = "https://appleid.apple.com";
const APP = "app.example.hifth";
const TICKET = "made-up-cancel-ticket.r.0001";
const ourKey = await generateKeyPair("ES256", { extractable: true });
const secrets = {
  APPLE_SIGN_IN_KEY: await exportPKCS8(ourKey.privateKey),
  APPLE_SIGN_IN_KEY_ID: "MADEUPKEY1",
  APPLE_TEAM_ID: "Q9Z8Y7X6W5",
};
const checkWithApp = async (note) => ({ ...(await check(note)), appId: APP });

function standInApple({ status = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), form: new URLSearchParams(init.body) });
    return new Response(JSON.stringify(status === 200 ? { refresh_token: TICKET } : { error: "invalid_grant" }), { status });
  };
  return { fetch, calls };
}

test("a sign-in that carries Apple's one-time code keeps the cancel ticket, locked", async () => {
  const { env, rows } = setUp(secrets);
  const apple = standInApple();
  const word = await getWord(env);
  const res = await handleSignIn(
    post("/api/sign-in", { note: "apple:000001.made-up.0001", word, code: "made-up-code" }),
    env,
    { check: checkWithApp, fetch: apple.fetch },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(await res.json()).sort(), ["expiresAt", "session"]);
  assert.equal(apple.calls.length, 1);
  assert.equal(apple.calls[0].url, "https://appleid.apple.com/auth/token");
  assert.equal(apple.calls[0].form.get("code"), "made-up-code");
  assert.equal(apple.calls[0].form.get("client_id"), APP);
  const kept = rows("apple_tickets");
  assert.equal(kept.length, 1);
  assert.ok(!JSON.stringify(kept).includes(TICKET), "the ticket itself must not be kept in plain");
  assert.ok(!JSON.stringify(kept).includes("made-up-code"));
});

test("a sign-in still works when Apple turns the trade down, when the key file is not set, or with no code", async () => {
  const refused = standInApple({ status: 400 });
  const fine = standInApple();
  for (const [extra, body, apple, asked] of [
    [secrets, { code: "old-code" }, refused, 1],
    [{}, { code: "made-up-code" }, fine, 0],
    [secrets, {}, fine, 0],
    [secrets, { code: 42 }, fine, 0],
  ]) {
    const { env, rows } = setUp(extra);
    const word = await getWord(env);
    const res = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word, ...body }), env, {
      check: checkWithApp,
      fetch: apple.fetch,
    });
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(rows("apple_tickets").length, 0);
    assert.equal(apple.calls.length, asked, JSON.stringify(body));
  }
});

test("after the key file is replaced, the next sign-in swaps the ticket that no longer opens, and delete my account can hand it back", async () => {
  const { env, rows } = setUp(secrets);
  const apple = standInAppleBoth();
  await signedInWithTicket(env, apple);
  const before = rows("apple_tickets")[0].sealed;

  const newKey = await generateKeyPair("ES256", { extractable: true });
  Object.assign(env, { APPLE_SIGN_IN_KEY: await exportPKCS8(newKey.privateKey), APPLE_SIGN_IN_KEY_ID: "MADEUPKEY2" });
  const session = await signedInWithTicket(env, apple);
  assert.equal(apple.calls.filter((c) => c.url.endsWith("/auth/token")).length, 2, "the second sign-in traded again");
  const kept = rows("apple_tickets");
  assert.equal(kept.length, 1);
  assert.notEqual(kept[0].sealed, before);

  // A third sign-in with the same key file keeps the ticket it has.
  await signedInWithTicket(env, apple);
  assert.equal(apple.calls.filter((c) => c.url.endsWith("/auth/token")).length, 2);

  const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, { authorization: `Bearer ${session}` }), env, { fetch: apple.fetch });
  assert.deepEqual(await res.json(), { deleted: true, appleLink: "cut" });
});

const appleKey = await generateKeyPair("RS256", { extractable: true });
const forger = await generateKeyPair("RS256", { extractable: true });
const keys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(appleKey.publicKey)), kid: "apple-1", alg: "RS256", use: "sig" }],
});

async function notice(type, user, { key = appleKey.privateKey, at = Date.now() + 1000 } = {}) {
  const payload = await new SignJWT({ events: JSON.stringify({ type, sub: user, event_time: at }) })
    .setProtectedHeader({ alg: "RS256", kid: "apple-1" })
    .setIssuer(APPLE)
    .setAudience(APP)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
  return { payload };
}

async function signedIn(env, user) {
  const word = await getWord(env);
  const res = await handleSignIn(post("/api/sign-in", { note: `apple:${user}`, word }), env, { check: checkWithApp });
  return (await res.json()).session;
}

test("Apple's notice that a reader stopped using Apple sign-in signs them out everywhere", async () => {
  const { db, env, rows } = setUp();
  const session = await signedIn(env, "000001.made-up.0001");
  const other = await signedIn(env, "000002.made-up.0002");
  const res = await handleAppleNotice(
    post("/api/sign-in/apple-notice", await notice("consent-revoked", "000001.made-up.0001")),
    env,
    { keys },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await whoIs(db, session), null);
  assert.ok(await whoIs(db, other));
  assert.equal(rows("accounts").length, 2);
});

test("Apple's notice that a reader deleted their Apple account deletes what is kept about them", async () => {
  const { db, env, rows } = setUp();
  const session = await signedIn(env, "000001.made-up.0001");
  await signedIn(env, "000002.made-up.0002");
  const res = await handleAppleNotice(
    post("/api/sign-in/apple-notice", await notice("account-delete", "000001.made-up.0001")),
    env,
    { keys },
  );
  assert.equal(res.status, 200);
  assert.equal(await whoIs(db, session), null);
  assert.deepEqual(rows("accounts").map((r) => r.apple_user), ["000002.made-up.0002"]);
});

test("a notice Apple did not sign changes nothing and is refused", async () => {
  const { db, env } = setUp();
  const session = await signedIn(env, "000001.made-up.0001");
  const forged = await notice("account-delete", "000001.made-up.0001", { key: forger.privateKey });
  const res = await handleAppleNotice(post("/api/sign-in/apple-notice", forged), env, { keys });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { reason: "bad-signature" });
  assert.ok(await whoIs(db, session));
});

test("a notice about a reader we do not know, or about email forwarding, is taken with thanks and changes nothing", async () => {
  const { db, env } = setUp();
  const session = await signedIn(env, "000001.made-up.0001");
  for (const body of [
    await notice("account-delete", "000009.nobody.0009"),
    await notice("email-disabled", "000001.made-up.0001"),
  ]) {
    const res = await handleAppleNotice(post("/api/sign-in/apple-notice", body), env, { keys });
    assert.equal(res.status, 200);
  }
  assert.ok(await whoIs(db, session));
});

test("the reply to a notice says nothing about whether the reader is known", async () => {
  const { env } = setUp();
  await signedIn(env, "000001.made-up.0001");
  const known = await handleAppleNotice(
    post("/api/sign-in/apple-notice", await notice("account-delete", "000001.made-up.0001")),
    env,
    { keys },
  );
  const unknown = await handleAppleNotice(
    post("/api/sign-in/apple-notice", await notice("account-delete", "000009.nobody.0009")),
    env,
    { keys },
  );
  assert.equal(await known.text(), await unknown.text());
});

test("a notice body that is not the expected shape, or far too big, is refused", async () => {
  const { env } = setUp();
  for (const body of ["not json", "[]", "null", JSON.stringify({ payload: 1 }), JSON.stringify({ other: "x" })]) {
    const res = await handleAppleNotice(post("/api/sign-in/apple-notice", body), env, { keys });
    assert.equal(res.status, 400, body);
  }
  const huge = JSON.stringify({ payload: "0".repeat(20_000) });
  assert.equal((await handleAppleNotice(post("/api/sign-in/apple-notice", huge), env, { keys })).status, 413);
});

test("with sign-in switched off, the notice address answers as if it was not there", async () => {
  const { env } = setUp({ SIGN_IN: undefined });
  const res = await handleAppleNotice(
    post("/api/sign-in/apple-notice", await notice("account-delete", "000001.made-up.0001")),
    env,
    { keys },
  );
  assert.equal(res.status, 404);
});

// Step 14: delete my account.

/** Apple's two addresses stood in for: the trade hands out a ticket, and the revoke answers `revoke`. */
function standInAppleBoth({ revoke = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const form = new URLSearchParams(init.body);
    calls.push({ url: String(url), form });
    if (String(url).endsWith("/auth/token")) return new Response(JSON.stringify({ refresh_token: TICKET }), { status: 200 });
    return new Response("", { status: revoke });
  };
  return { fetch, calls };
}

async function signedInWithTicket(env, apple, user = "000001.made-up.0001") {
  const word = await getWord(env);
  const res = await handleSignIn(post("/api/sign-in", { note: `apple:${user}`, word, code: "made-up-code" }), env, {
    check: checkWithApp,
    fetch: apple.fetch,
  });
  return (await res.json()).session;
}

const asReader = (session) => ({ authorization: `Bearer ${session}` });

test("delete my account: everything kept about the reader goes, and Apple is handed the ticket back", async () => {
  const { db, env, rows } = setUp(secrets);
  const apple = standInAppleBoth();
  const session = await signedInWithTicket(env, apple);
  const other = await signedInWithTicket(env, apple, "000002.made-up.0002");
  const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(session)), env, { fetch: apple.fetch });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { deleted: true, appleLink: "cut" });
  const revoked = apple.calls.filter((c) => c.url === "https://appleid.apple.com/auth/revoke");
  assert.equal(revoked.length, 1);
  assert.equal(revoked[0].form.get("token"), TICKET, "the ticket was opened and handed back whole");
  assert.equal(revoked[0].form.get("client_id"), APP);
  assert.equal(await whoIs(db, session), null);
  assert.ok(await whoIs(db, other), "another reader is untouched");
  assert.deepEqual(rows("accounts").map((r) => r.apple_user), ["000002.made-up.0002"]);
  assert.equal(rows("sessions").length, 1);
  assert.equal(rows("apple_tickets").length, 1);
});

test("delete my account still deletes everything when Apple says no, and tells the app the link was left", async () => {
  const { env, rows } = setUp(secrets);
  const apple = standInAppleBoth({ revoke: 400 });
  const session = await signedInWithTicket(env, apple);
  const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(session)), env, { fetch: apple.fetch });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deleted: true, appleLink: "left" });
  assert.equal(rows("accounts").length, 0);
  assert.equal(rows("sessions").length, 0);
  assert.equal(rows("apple_tickets").length, 0);
});

test("delete my account with no ticket kept, or no key file set, deletes and says the link was left", async () => {
  const apple = standInAppleBoth();
  {
    const { env, rows } = setUp(secrets);
    const session = await signedIn(env, "000001.made-up.0001");
    const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(session)), env, { fetch: apple.fetch });
    assert.deepEqual(await res.json(), { deleted: true, appleLink: "left" });
    assert.equal(rows("accounts").length, 0);
  }
  {
    const { env, rows } = setUp(secrets);
    const session = await signedInWithTicket(env, apple);
    const before = apple.calls.length;
    for (const name of Object.keys(secrets)) delete env[name];
    const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(session)), env, { fetch: apple.fetch });
    assert.deepEqual(await res.json(), { deleted: true, appleLink: "left" });
    assert.equal(rows("accounts").length, 0);
    assert.equal(apple.calls.length, before, "Apple is not called without the key file");
  }
});

test("delete my account needs a live session: none, a made-up one or a signed-out one deletes nothing", async () => {
  const { env, rows } = setUp(secrets);
  const apple = standInAppleBoth();
  const session = await signedInWithTicket(env, apple);
  const gone = await signedIn(env, "000002.made-up.0002");
  await handleSignOut(post("/api/sign-out", {}, asReader(gone)), env);
  const before = apple.calls.length;
  for (const headers of [{}, { authorization: "Bearer made-up" }, { authorization: `Basic ${session}` }, asReader(gone)]) {
    const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, headers), env, { fetch: apple.fetch });
    assert.equal(res.status, 401, JSON.stringify(Object.keys(headers)));
    assert.deepEqual(await res.json(), { reason: "signed-out" });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(rows("accounts").length, 2);
  assert.equal(apple.calls.length, before);
});

test("the session cannot be named in the body or the address to delete an account", async () => {
  const { env, rows } = setUp(secrets);
  const session = await signedIn(env, "000001.made-up.0001");
  const res = await handleDeleteAccount(post(`/api/sign-in/delete-account?session=${session}`, { session }), env, {});
  assert.equal(res.status, 401);
  assert.equal(rows("accounts").length, 1);
});

test("with sign-in switched off, delete my account answers as if it was not there", async () => {
  const { env } = setUp({ SIGN_IN: undefined });
  const res = await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader("x")), env, {});
  assert.equal(res.status, 404);
});

test("signing out ends the session named in the Authorization line", async () => {
  const { db, env } = setUp();
  const word = await getWord(env);
  const { session } = await (
    await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }), env, { check })
  ).json();
  const res = await handleSignOut(post("/api/sign-out", {}, { authorization: `Bearer ${session}` }), env);
  assert.equal(res.status, 204);
  assert.equal(await whoIs(db, session), null);
});

test("signing out with no session, or one nobody was given, is quietly fine", async () => {
  const { env } = setUp();
  for (const headers of [{}, { authorization: "Bearer made-up" }, { authorization: "Basic abc" }]) {
    const res = await handleSignOut(post("/api/sign-out", {}, headers), env);
    assert.equal(res.status, 204, JSON.stringify(headers));
  }
});

// Step 17: a limit on how many one-off words are handed out in each ten minutes.

/** Asks for words until the stretch is used up; hands back the last one given. */
async function useUpTheStretch(env) {
  let word;
  // Twice the limit, in case the clock crosses into a new stretch partway through.
  for (let i = 0; i <= MOST_WORDS_A_STRETCH * 2; i += 1) {
    const res = await handleWord(post("/api/sign-in/word", {}), env);
    if (res.status === 429) return word;
    ({ word } = await res.json());
  }
  throw new Error("the limit never came");
}

test("when too many sign-ins have been started, the word address says try again shortly", async () => {
  const { env, rows } = setUp();
  await useUpTheStretch(env);
  const kept = rows("sign_in_words").length;
  const res = await handleWord(post("/api/sign-in/word", {}), env);
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { reason: "too-many" });
  const wait = Number(res.headers.get("retry-after"));
  assert.ok(Number.isInteger(wait) && wait >= 1 && wait <= 600, `retry-after ${wait}`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(rows("sign_in_words").length, kept);
});

test("a used-up stretch stops nothing else: a word already in hand, sign-out, delete my account and Apple's notice all still work", async () => {
  const { db, env } = setUp();
  const first = await getWord(env);
  const signedInRes = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word: first }), env, { check });
  const { session } = await signedInRes.json();
  const other = await signedIn(env, "000002.made-up.0002");

  const inHand = await useUpTheStretch(env);
  assert.equal((await handleWord(post("/api/sign-in/word", {}), env)).status, 429);

  const late = await handleSignIn(post("/api/sign-in", { note: "apple:000003.made-up.0003", word: inHand }), env, { check });
  assert.equal(late.status, 200);
  assert.equal((await handleSignOut(post("/api/sign-out", {}, asReader(session)), env)).status, 204);
  assert.equal(await whoIs(db, session), null);
  assert.equal((await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(other)), env)).status, 200);
  const res = await handleAppleNotice(post("/api/sign-in/apple-notice", await notice("consent-revoked", "000003.made-up.0003")), env, { keys });
  assert.equal(res.status, 200);
});

// Step 18, the server half: with invite codes set, only someone holding one can start a sign-in.
// The codes here are made up. The setting holds each code's scrambled copy, never the code.

const INVITE = "0a1b-2c3d-4e5f-6g7h";
const OTHER_INVITE = "zzzz-zzzz-zzzz-zzzz";
const invited = async (extra = {}) =>
  setUp({ SIGN_IN_INVITES: ` ${await inviteHash(INVITE)} , ${await inviteHash(OTHER_INVITE)}`, ...extra });
const askWord = (env, body) => handleWord(post("/api/sign-in/word", body), env);

test("with invite codes set, an ask with no code or a wrong one is refused before the database is touched", async () => {
  const { env, rows } = await invited();
  const asks = [{}, { invite: "" }, { invite: "not-a-code" }, { invite: " - " }, { invite: "0a1b-2c3d-4e5f-6g7j" }, { invite: 7 }, { invite: [INVITE] }, { invite: await inviteHash(INVITE) }, "not json"];
  for (const body of asks) {
    const res = await askWord(env, body);
    assert.equal(res.status, 403, JSON.stringify(body));
    assert.deepEqual(await res.json(), { reason: "invite-needed" });
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  assert.equal(rows("sign_in_words").length, 0);
  assert.equal(rows("sign_in_counts").length, 0);
});

test("with invite codes set, any one of the codes starts a sign-in that goes the whole way", async () => {
  const { db, env } = await invited();
  for (const invite of [INVITE, OTHER_INVITE]) {
    const res = await askWord(env, { invite });
    assert.equal(res.status, 200, invite);
    const { word } = await res.json();
    const signedInRes = await handleSignIn(post("/api/sign-in", { note: "apple:000001.made-up.0001", word }), env, { check });
    assert.equal(signedInRes.status, 200);
    assert.ok(await whoIs(db, (await signedInRes.json()).session));
  }
});

test("a code typed with capitals, spaces and no dashes still starts a sign-in", async () => {
  const { env } = await invited();
  for (const invite of ["0A1B 2C3D 4E5F 6G7H", " 0a1b2c3d4e5f6g7h\n", "Oalb-2c3d-4e5f-6g7h"]) {
    assert.equal((await askWord(env, { invite })).status, 200, invite);
  }
});

test("refused asks never use up the ten-minute limit for people who hold a code", async () => {
  const { env } = await invited();
  for (let i = 0; i < MOST_WORDS_A_STRETCH + 5; i += 1) assert.equal((await askWord(env, {})).status, 403);
  assert.equal((await askWord(env, { invite: INVITE })).status, 200);
});

test("an ask far too big to be an invite code is refused", async () => {
  const { env, rows } = await invited();
  const res = await askWord(env, { invite: "x".repeat(20 * 1024) });
  assert.equal(res.status, 413);
  assert.equal(rows("sign_in_counts").length, 0);
});

test("invite codes gate only the start of a sign-in: sign-out, delete my account and Apple's notice never ask for one", async () => {
  const { db, env } = await invited();
  const reader = await signedInWithInvite(env, "000001.made-up.0001");
  const other = await signedInWithInvite(env, "000002.made-up.0002");
  assert.equal((await handleSignOut(post("/api/sign-out", {}, asReader(reader)), env)).status, 204);
  assert.equal(await whoIs(db, reader), null);
  assert.equal((await handleDeleteAccount(post("/api/sign-in/delete-account", {}, asReader(other)), env)).status, 200);
  const res = await handleAppleNotice(post("/api/sign-in/apple-notice", await notice("consent-revoked", "000003.made-up.0003")), env, { keys });
  assert.equal(res.status, 200);
});

async function signedInWithInvite(env, appleUser) {
  const { word } = await (await askWord(env, { invite: INVITE })).json();
  const res = await handleSignIn(post("/api/sign-in", { note: `apple:${appleUser}`, word }), env, { check });
  return (await res.json()).session;
}

test("with no invite codes set, or a setting with nothing usable in it, anyone may start a sign-in as before", async () => {
  for (const SIGN_IN_INVITES of [undefined, "", " , ,"]) {
    const { env } = setUp({ SIGN_IN_INVITES });
    assert.equal((await askWord(env, {})).status, 200, String(SIGN_IN_INVITES));
    assert.equal((await askWord(env, "not json")).status, 200, String(SIGN_IN_INVITES));
  }
});

test("a setting that holds something other than scrambled copies lets nobody in, rather than everybody", async () => {
  const { env } = setUp({ SIGN_IN_INVITES: INVITE });
  assert.equal((await askWord(env, { invite: INVITE })).status, 403);
  assert.equal((await askWord(env, {})).status, 403);
});

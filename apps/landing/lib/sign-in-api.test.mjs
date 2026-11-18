import { test } from "node:test";
import assert from "node:assert/strict";
import { handleWord, handleSignIn, handleSignOut } from "./sign-in-api.mjs";
import { whoIs } from "./accounts.mjs";
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

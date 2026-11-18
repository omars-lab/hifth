import { test } from "node:test";
import assert from "node:assert/strict";
import { handOutWord, signIn, signOut, whoIs, SESSION_SECONDS, WORD_SECONDS } from "./accounts.mjs";
import { localD1 } from "./test-d1.mjs";

/*
 * Accounts and sessions on hifth.app (step 10 of docs/design/sign-in.md). The database is Node's
 * own SQLite running the real migration files (test-d1.mjs), standing in for Cloudflare's D1.
 * Apple's check is stood in for: a note here is "apple:<made-up user number>", and any other
 * note fails it. apple-signin.test.mjs checks the real note checker. Written before accounts.mjs,
 * and watched failing.
 */

const T0 = 1_800_000_000;
const check = async (note) =>
  typeof note === "string" && note.startsWith("apple:")
    ? { ok: true, appleUser: note.slice("apple:".length) }
    : { ok: false, reason: "bad-signature" };

let counter = 0;
const newCode = () => `made-up-code-${(counter += 1)}`;

async function freshSignIn(db, user, at = T0) {
  const word = await handOutWord(db, { now: at, newCode });
  return signIn(db, { note: `apple:${user}`, word, check, now: at, newCode });
}

test("a first sign-in makes an account and a session, and the session finds the account", async () => {
  const { db } = localD1();
  const result = await freshSignIn(db, "000001.made-up.0001");
  assert.equal(result.ok, true);
  assert.equal(typeof result.session, "string");
  assert.equal(result.expiresAt, T0 + SESSION_SECONDS);
  assert.equal(await whoIs(db, result.session, { now: T0 + 60 }), result.accountId);
});

test("the same Apple user signing in on a second device finds the same account, with its own session", async () => {
  const { db } = localD1();
  const ipad = await freshSignIn(db, "000001.made-up.0001");
  const phone = await freshSignIn(db, "000001.made-up.0001", T0 + 30);
  assert.equal(phone.accountId, ipad.accountId);
  assert.notEqual(phone.session, ipad.session);
  assert.equal(await whoIs(db, ipad.session, { now: T0 + 60 }), ipad.accountId);
  assert.equal(await whoIs(db, phone.session, { now: T0 + 60 }), ipad.accountId);
});

test("two Apple users get two accounts, and our account number is not Apple's", async () => {
  const { db, rows } = localD1();
  const a = await freshSignIn(db, "000001.made-up.0001");
  const b = await freshSignIn(db, "000002.made-up.0002");
  assert.notEqual(a.accountId, b.accountId);
  assert.equal(rows("accounts").length, 2);
  for (const row of rows("accounts")) assert.ok(!row.id.includes(row.apple_user), row.id);
});

test("the database keeps only scrambled copies: no session and no one-off word in plain", async () => {
  const { db, rows } = localD1();
  const word = await handOutWord(db, { now: T0, newCode });
  assert.ok(!JSON.stringify(rows("sign_in_words")).includes(word));
  const result = await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0, newCode });
  const kept = JSON.stringify(rows("sessions"));
  assert.ok(!kept.includes(result.session), "the session itself must not be kept");
  assert.equal(rows("sessions").length, 1);
});

test("a one-off word works once", async () => {
  const { db } = localD1();
  const word = await handOutWord(db, { now: T0, newCode });
  assert.equal((await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0, newCode })).ok, true);
  assert.deepEqual(await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0, newCode }), {
    ok: false,
    reason: "word-unknown",
  });
});

test("a one-off word stops working after its few minutes", async () => {
  const { db } = localD1();
  const word = await handOutWord(db, { now: T0, newCode });
  const late = await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0 + WORD_SECONDS + 1, newCode });
  assert.deepEqual(late, { ok: false, reason: "word-unknown" });
});

test("a word hifth.app never handed out is refused", async () => {
  const { db, rows } = localD1();
  const result = await signIn(db, { note: "apple:000001.made-up.0001", word: "never-handed-out", check, now: T0, newCode });
  assert.deepEqual(result, { ok: false, reason: "word-unknown" });
  assert.equal(rows("accounts").length, 0);
});

test("a note that fails Apple's check makes no account and no session, and spends the word", async () => {
  const { db, rows } = localD1();
  const word = await handOutWord(db, { now: T0, newCode });
  assert.deepEqual(await signIn(db, { note: "forged", word, check, now: T0, newCode }), {
    ok: false,
    reason: "bad-signature",
  });
  assert.equal(rows("accounts").length, 0);
  assert.equal(rows("sessions").length, 0);
  const retry = await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0, newCode });
  assert.deepEqual(retry, { ok: false, reason: "word-unknown" });
});

test("a session stops working when it runs out", async () => {
  const { db } = localD1();
  const { session } = await freshSignIn(db, "000001.made-up.0001");
  assert.equal(await whoIs(db, session, { now: T0 + SESSION_SECONDS + 1 }), null);
});

test("signing out on one device ends that session only", async () => {
  const { db } = localD1();
  const ipad = await freshSignIn(db, "000001.made-up.0001");
  const phone = await freshSignIn(db, "000001.made-up.0001");
  await signOut(db, ipad.session);
  assert.equal(await whoIs(db, ipad.session, { now: T0 + 60 }), null);
  assert.equal(await whoIs(db, phone.session, { now: T0 + 60 }), phone.accountId);
});

test("nothing, or a session nobody was given, finds no one", async () => {
  const { db } = localD1();
  await freshSignIn(db, "000001.made-up.0001");
  for (const junk of [undefined, null, "", "made-up-session", 42]) {
    assert.equal(await whoIs(db, junk, { now: T0 + 60 }), null, String(junk));
  }
});

test("left to itself, a word and a session are long random codes", async () => {
  const { db } = localD1();
  const word = await handOutWord(db, { now: T0 });
  assert.match(word, /^[0-9a-f]{64}$/);
  const { session } = await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0 });
  assert.match(session, /^[0-9a-f]{64}$/);
});

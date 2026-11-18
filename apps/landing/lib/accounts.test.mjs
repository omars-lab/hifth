import { test } from "node:test";
import assert from "node:assert/strict";
import { actOnAppleNotice, deleteAccount, handOutWord, signIn, signOut, whoIs, MOST_WAITING_WORDS, SESSION_SECONDS, WORD_SECONDS } from "./accounts.mjs";
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

// Step 13: Apple's cancel ticket, and Apple's notices that a reader has left. `trade` stands in
// for the trade with Apple and the locking (apple-link.test.mjs checks the real ones).

const APP = "app.example.hifth";
const checkWithApp = async (note) => ({ ...(await check(note)), appId: APP });

function standInTrade(answer = (asked) => `locked(${asked.code})`) {
  const asked = [];
  const trade = async (args) => {
    asked.push(args);
    return answer(args);
  };
  return { trade, asked };
}

async function signInWithCode(db, user, { code = "made-up-code", trade, at = T0 } = {}) {
  const word = await handOutWord(db, { now: at, newCode });
  return signIn(db, { note: `apple:${user}`, word, check: checkWithApp, code, trade, now: at, newCode });
}

test("a first sign-in that carries Apple's one-time code keeps the locked cancel ticket with the account", async () => {
  const { db, rows } = localD1();
  const { trade, asked } = standInTrade();
  const result = await signInWithCode(db, "000001.made-up.0001", { trade });
  assert.equal(result.ok, true);
  assert.deepEqual(asked, [{ code: "made-up-code", appId: APP, accountId: result.accountId }]);
  assert.deepEqual(rows("apple_tickets"), [
    { account_id: result.accountId, sealed: "locked(made-up-code)", app_id: APP, created_at: T0 },
  ]);
});

test("once a ticket is kept, later sign-ins do not trade again", async () => {
  const { db, rows } = localD1();
  const { trade, asked } = standInTrade();
  await signInWithCode(db, "000001.made-up.0001", { trade });
  const again = await signInWithCode(db, "000001.made-up.0001", { code: "second-code", trade, at: T0 + 30 });
  assert.equal(again.ok, true);
  assert.equal(asked.length, 1);
  assert.equal(rows("apple_tickets").length, 1);
});

test("a sign-in with no one-time code trades nothing and still signs in", async () => {
  const { db, rows } = localD1();
  const { trade, asked } = standInTrade();
  // (Leaving the code out here would fall back to the helper's made-up one, so null stands for that.)
  for (const code of [null, "", 42]) {
    assert.equal((await signInWithCode(db, "000001.made-up.0001", { code, trade })).ok, true, String(code));
  }
  assert.equal(asked.length, 0);
  assert.equal(rows("apple_tickets").length, 0);
});

test("a trade that fails never stops the sign-in, and the next sign-in tries again", async () => {
  const { db, rows } = localD1();
  const none = standInTrade(() => null);
  const first = await signInWithCode(db, "000001.made-up.0001", { trade: none.trade });
  assert.equal(first.ok, true);
  const broken = async () => {
    throw new Error("made-up failure");
  };
  assert.equal((await signInWithCode(db, "000001.made-up.0001", { trade: broken })).ok, true);
  assert.equal(rows("apple_tickets").length, 0);
  const works = standInTrade();
  await signInWithCode(db, "000001.made-up.0001", { code: "third-code", trade: works.trade });
  assert.equal(rows("apple_tickets").length, 1);
});

test("a note that fails Apple's check trades nothing", async () => {
  const { db } = localD1();
  const { trade, asked } = standInTrade();
  const word = await handOutWord(db, { now: T0, newCode });
  await signIn(db, { note: "forged", word, check: checkWithApp, code: "made-up-code", trade, now: T0, newCode });
  assert.equal(asked.length, 0);
});

test("Apple's notice that a reader stopped using Apple sign-in ends every session and drops the ticket, and keeps the account", async () => {
  const { db, rows } = localD1();
  const { trade } = standInTrade();
  const ipad = await signInWithCode(db, "000001.made-up.0001", { trade });
  const phone = await signInWithCode(db, "000001.made-up.0001", { trade, at: T0 + 30 });
  const other = await signInWithCode(db, "000002.made-up.0002", { trade });
  const done = await actOnAppleNotice(db, { type: "consent-revoked", appleUser: "000001.made-up.0001", at: T0 + 60 });
  assert.equal(done, "signed-out");
  assert.equal(await whoIs(db, ipad.session, { now: T0 + 90 }), null);
  assert.equal(await whoIs(db, phone.session, { now: T0 + 90 }), null);
  assert.equal(await whoIs(db, other.session, { now: T0 + 90 }), other.accountId);
  assert.deepEqual(rows("apple_tickets").map((r) => r.account_id), [other.accountId]);
  assert.equal(rows("accounts").length, 2);
});

test("an old notice sent again does not undo a sign-in made after it", async () => {
  const { db, rows } = localD1();
  const { trade } = standInTrade();
  const back = await signInWithCode(db, "000001.made-up.0001", { trade, at: T0 + 600 });
  await actOnAppleNotice(db, { type: "consent-revoked", appleUser: "000001.made-up.0001", at: T0 + 60 });
  assert.equal(await whoIs(db, back.session, { now: T0 + 700 }), back.accountId);
  assert.equal(rows("apple_tickets").length, 1);
});

test("Apple's notice that a reader deleted their Apple account deletes everything kept about them", async () => {
  const { db, rows } = localD1();
  const { trade } = standInTrade();
  await signInWithCode(db, "000001.made-up.0001", { trade });
  const other = await signInWithCode(db, "000002.made-up.0002", { trade });
  const done = await actOnAppleNotice(db, { type: "account-delete", appleUser: "000001.made-up.0001", at: T0 + 60 });
  assert.equal(done, "deleted");
  assert.deepEqual(rows("accounts").map((r) => r.id), [other.accountId]);
  assert.deepEqual(rows("sessions").map((r) => r.account_id), [other.accountId]);
  assert.deepEqual(rows("apple_tickets").map((r) => r.account_id), [other.accountId]);
});

test("a notice about a reader we do not know, or of a kind we keep nothing for, changes nothing", async () => {
  const { db, rows } = localD1();
  const { trade } = standInTrade();
  const kept = await signInWithCode(db, "000001.made-up.0001", { trade });
  assert.equal(await actOnAppleNotice(db, { type: "account-delete", appleUser: "000009.nobody.0009", at: T0 + 60 }), "nothing");
  assert.equal(await actOnAppleNotice(db, { type: "email-disabled", appleUser: "000001.made-up.0001", at: T0 + 60 }), "nothing");
  assert.equal(await actOnAppleNotice(db, { type: "made-up-kind", appleUser: "000001.made-up.0001", at: T0 + 60 }), "nothing");
  assert.equal(await whoIs(db, kept.session, { now: T0 + 90 }), kept.accountId);
  assert.equal(rows("apple_tickets").length, 1);
});

// Step 14: delete my account. `cut` stands in for opening the ticket and Apple's revoke call.

test("deleting an account removes the account, every session and the ticket, and cuts the link with Apple", async () => {
  const { db, rows } = localD1();
  const { trade } = standInTrade();
  const ipad = await signInWithCode(db, "000001.made-up.0001", { trade });
  const phone = await signInWithCode(db, "000001.made-up.0001", { trade, at: T0 + 30 });
  const other = await signInWithCode(db, "000002.made-up.0002", { code: "other-code", trade });
  const asked = [];
  const cut = async (args) => {
    asked.push(args);
    return true;
  };
  const result = await deleteAccount(db, ipad.accountId, { cut });
  assert.deepEqual(result, { appleLink: "cut" });
  assert.deepEqual(asked, [{ sealed: "locked(made-up-code)", appId: APP, accountId: ipad.accountId }]);
  assert.equal(await whoIs(db, ipad.session, { now: T0 + 60 }), null);
  assert.equal(await whoIs(db, phone.session, { now: T0 + 60 }), null);
  assert.deepEqual(rows("accounts").map((r) => r.id), [other.accountId]);
  assert.deepEqual(rows("sessions").map((r) => r.account_id), [other.accountId]);
  assert.deepEqual(rows("apple_tickets").map((r) => r.account_id), [other.accountId]);
  assert.ok(!JSON.stringify([rows("accounts"), rows("sessions"), rows("apple_tickets")]).includes("000001.made-up.0001"));
});

test("when Apple cannot be told, everything is still deleted and the reply says the link was left", async () => {
  for (const cut of [
    async () => false,
    async () => {
      throw new Error("made-up failure");
    },
    undefined,
  ]) {
    const { db, rows } = localD1();
    const { trade } = standInTrade();
    const reader = await signInWithCode(db, "000001.made-up.0001", { trade });
    assert.deepEqual(await deleteAccount(db, reader.accountId, { cut }), { appleLink: "left" });
    assert.equal(rows("accounts").length, 0);
    assert.equal(rows("sessions").length, 0);
    assert.equal(rows("apple_tickets").length, 0);
  }
});

test("an account with no ticket is deleted without asking Apple, and the link is left", async () => {
  const { db, rows } = localD1();
  const reader = await freshSignIn(db, "000001.made-up.0001");
  let asked = 0;
  const cut = async () => {
    asked += 1;
    return true;
  };
  assert.deepEqual(await deleteAccount(db, reader.accountId, { cut }), { appleLink: "left" });
  assert.equal(asked, 0);
  assert.equal(rows("accounts").length, 0);
});

test("after deleting, the same Apple user signing in again starts a new, empty account", async () => {
  const { db } = localD1();
  const before = await freshSignIn(db, "000001.made-up.0001");
  await deleteAccount(db, before.accountId, {});
  const after = await freshSignIn(db, "000001.made-up.0001", T0 + 60);
  assert.equal(after.ok, true);
  assert.notEqual(after.accountId, before.accountId);
});

test("left to itself, a word and a session are long random codes", async () => {
  const { db } = localD1();
  const word = await handOutWord(db, { now: T0 });
  assert.match(word, /^[0-9a-f]{64}$/);
  const { session } = await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0 });
  assert.match(session, /^[0-9a-f]{64}$/);
});

// Step 17: a limit on how many sign-ins can be waiting at once.

test("only so many one-off words can be waiting at once; the next ask gets none and keeps nothing", async () => {
  const { db, rows } = localD1();
  for (let i = 0; i < MOST_WAITING_WORDS; i += 1) {
    assert.equal(typeof (await handOutWord(db, { now: T0, newCode })), "string", `word ${i + 1}`);
  }
  assert.equal(await handOutWord(db, { now: T0, newCode }), null);
  assert.equal(rows("sign_in_words").length, MOST_WAITING_WORDS);
});

test("a word that is used makes room for the next ask", async () => {
  const { db } = localD1();
  let word;
  for (let i = 0; i < MOST_WAITING_WORDS; i += 1) word = await handOutWord(db, { now: T0, newCode });
  assert.equal(await handOutWord(db, { now: T0, newCode }), null);
  await signIn(db, { note: "apple:000001.made-up.0001", word, check, now: T0, newCode });
  assert.equal(typeof (await handOutWord(db, { now: T0, newCode })), "string");
});

test("words that ran out are cleared away when the next one is handed out, so they hold no place", async () => {
  const { db, rows } = localD1();
  for (let i = 0; i < MOST_WAITING_WORDS; i += 1) await handOutWord(db, { now: T0, newCode });
  const later = T0 + WORD_SECONDS + 1;
  assert.equal(typeof (await handOutWord(db, { now: later, newCode })), "string");
  assert.equal(rows("sign_in_words").length, 1);
});

test("a full waiting list never touches readers who are already signed in", async () => {
  const { db } = localD1();
  const reader = await freshSignIn(db, "000001.made-up.0001");
  for (let i = 0; i < MOST_WAITING_WORDS; i += 1) await handOutWord(db, { now: T0, newCode });
  assert.equal(await handOutWord(db, { now: T0, newCode }), null);
  assert.equal(await whoIs(db, reader.session, { now: T0 + 60 }), reader.accountId);
});

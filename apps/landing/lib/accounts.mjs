// Accounts and sessions on hifth.app (docs/design/sign-in.md, step 10). The tables are in
// apps/landing/migrations/0001_accounts.sql, which says what is kept and why only that.
//
// A sign-in goes:
//   1. the app asks for a one-off word (handOutWord); hifth.app keeps only its scrambled copy;
//   2. the app hands the word's scrambled copy to Apple's sign-in sheet, and gets back Apple's
//      signed note carrying it;
//   3. the app sends the note and the plain word (signIn). The word is spent before anything
//      else, so it works once even if the note then fails. `check` is Apple's check
//      (apple-signin.mjs), passed in so the tests can stand in for it;
//   4. the account is found by Apple's lasting user number, or made; a new session is handed
//      back to the app, and only its scrambled copy is kept;
//   5. later calls name the session (whoIs); signing out on a device ends that session only.
//
// `db` is Cloudflare's D1 binding, or the tests' stand-in (test-d1.mjs).

import { hashWord } from "./apple-signin.mjs";

/** How long a session lasts before the app has to sign in again: 60 days. */
export const SESSION_SECONDS = 60 * 24 * 60 * 60;
/** How long a one-off word waits for its sign-in: 10 minutes. */
export const WORD_SECONDS = 10 * 60;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** 32 random bytes as 64 hex letters. */
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hands out a one-off word for one sign-in, and keeps only its scrambled copy. */
export async function handOutWord(db, { now = nowSeconds(), newCode = randomCode } = {}) {
  const word = newCode();
  await db
    .prepare("INSERT INTO sign_in_words (word_hash, expires_at) VALUES (?, ?)")
    .bind(await hashWord(word), now + WORD_SECONDS)
    .run();
  return word;
}

/**
 * Signs a reader in from Apple's note and the one-off word it carries.
 * Returns { ok: true, session, accountId, expiresAt } or { ok: false, reason }.
 */
export async function signIn(db, { note, word, check, code, trade, now = nowSeconds(), newCode = randomCode }) {
  if (typeof word !== "string" || word === "") return { ok: false, reason: "word-unknown" };

  // Spend the word first: one DELETE, so two sign-ins racing with the same word cannot both win.
  const spent = await db
    .prepare("DELETE FROM sign_in_words WHERE word_hash = ? AND expires_at >= ?")
    .bind(await hashWord(word), now)
    .run();
  if (spent.meta.changes !== 1) return { ok: false, reason: "word-unknown" };

  const checked = await check(note, word);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  await db
    .prepare("INSERT INTO accounts (id, apple_user, created_at) VALUES (?, ?, ?) ON CONFLICT (apple_user) DO NOTHING")
    .bind(newCode(), checked.appleUser, now)
    .run();
  const accountId = await db.prepare("SELECT id FROM accounts WHERE apple_user = ?").bind(checked.appleUser).first("id");

  await keepTicket(db, { accountId, appId: checked.appId, code, trade, now });

  const session = newCode();
  const expiresAt = now + SESSION_SECONDS;
  await db
    .prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hashWord(session), accountId, now, expiresAt)
    .run();
  return { ok: true, session, accountId, expiresAt };
}

/**
 * Keeps Apple's cancel ticket for an account that has none yet (step 13). `trade` swaps the
 * one-time code from Apple's sheet for the ticket and hands it back already locked, or null.
 * A reader is never kept out because this failed: without a ticket, deleting the account still
 * deletes everything here, and the reader is told how to remove Hifth on Apple's side themselves.
 */
async function keepTicket(db, { accountId, appId, code, trade, now }) {
  if (typeof trade !== "function" || typeof code !== "string" || code === "") return;
  if (typeof appId !== "string" || appId === "") return;
  try {
    const kept = await db.prepare("SELECT 1 AS kept FROM apple_tickets WHERE account_id = ?").bind(accountId).first("kept");
    if (kept) return;
    const sealed = await trade({ code, appId, accountId });
    if (typeof sealed !== "string" || sealed === "") return;
    await db
      .prepare("INSERT INTO apple_tickets (account_id, sealed, app_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (account_id) DO NOTHING")
      .bind(accountId, sealed, appId, now)
      .run();
  } catch {
    // Nothing is logged: the error could carry the code or the ticket.
  }
}

/**
 * Acts on a notice from Apple that a reader has left from Apple's side (step 13). The notice is
 * checked first (checkAppleNotice in apple-link.mjs); `at` is when it happened, in seconds.
 *
 *   "consent-revoked"  the reader stopped using Apple sign-in with Hifth. Apple says to treat it
 *                      as signing out: every session from before then ends and the ticket, now
 *                      dead, is dropped. The account stays, so signing in again finds it.
 *   "account-delete"   the reader deleted their Apple account. Everything kept about them goes.
 *   anything else      (email forwarding switched on or off) nothing: no email is kept.
 *
 * Only what is older than the notice is touched, so an old notice sent again cannot undo a
 * sign-in made after it. Returns "signed-out", "deleted" or "nothing".
 */
export async function actOnAppleNotice(db, { type, appleUser, at }) {
  if (typeof appleUser !== "string" || appleUser === "" || !Number.isFinite(at)) return "nothing";
  if (type === "account-delete") {
    const gone = await db.prepare("DELETE FROM accounts WHERE apple_user = ? AND created_at <= ?").bind(appleUser, at).run();
    return gone.meta.changes > 0 ? "deleted" : "nothing";
  }
  if (type === "consent-revoked") {
    const accountId = await db.prepare("SELECT id FROM accounts WHERE apple_user = ?").bind(appleUser).first("id");
    if (!accountId) return "nothing";
    await db.prepare("DELETE FROM sessions WHERE account_id = ? AND created_at <= ?").bind(accountId, at).run();
    await db.prepare("DELETE FROM apple_tickets WHERE account_id = ? AND created_at <= ?").bind(accountId, at).run();
    return "signed-out";
  }
  return "nothing";
}

/** The account a session belongs to, or null if it is unknown or has run out. */
export async function whoIs(db, session, { now = nowSeconds() } = {}) {
  if (typeof session !== "string" || session === "") return null;
  const accountId = await db
    .prepare("SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at >= ?")
    .bind(await hashWord(session), now)
    .first("account_id");
  return accountId ?? null;
}

/** Ends one session; the reader's other devices stay signed in. */
export async function signOut(db, session) {
  if (typeof session !== "string" || session === "") return;
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashWord(session)).run();
}

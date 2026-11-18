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
/**
 * The most one-off words handed out in one stretch of WORD_SECONDS, to everyone together
 * (step 17). Past it, the next ask gets none until the next stretch starts.
 *
 * It is sized to the free database, not to the readers. Handing out a word is the one thing
 * someone who has proved nothing can make the server write for; each costs a handful of writes,
 * the free plan allows 100,000 a day, and 60 per ten minutes is at most 8,640 words a day. It
 * counts words handed out, not words waiting: a caller can use a word up with a junk note the
 * moment they get it, so a count of waiting words would never stop them.
 *
 * It is one count shared by everyone, because nothing about a caller is kept. So someone asking
 * for words non-stop can keep new sign-ins out, a stretch at a time. They cannot touch a reader
 * who is already signed in. docs/issues/sign-in-limit-not-the-person-check.md has the rest.
 */
export const MOST_WORDS_A_STRETCH = 60;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** 32 random bytes as 64 hex letters. */
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hands out a one-off word for one sign-in, and keeps only its scrambled copy. Returns null, and
 * keeps nothing, when MOST_WORDS_A_STRETCH have already been handed out in this stretch.
 */
export async function handOutWord(db, { now = nowSeconds(), newCode = randomCode } = {}) {
  const stretch = Math.floor(now / WORD_SECONDS);

  // Count this word in, or refuse it: one statement, so asks racing each other cannot slip past
  // the limit. A refused ask writes nothing.
  const counted = await db
    .prepare(
      "INSERT INTO sign_in_counts (stretch, handed_out) VALUES (?, 1) ON CONFLICT (stretch) DO UPDATE SET handed_out = handed_out + 1 WHERE handed_out < ?",
    )
    .bind(stretch, MOST_WORDS_A_STRETCH)
    .run();
  if (counted.meta.changes !== 1) return null;

  // Words that ran out, and counts for stretches that are over, are not left to pile up.
  await db.prepare("DELETE FROM sign_in_words WHERE expires_at < ?").bind(now).run();
  await db.prepare("DELETE FROM sign_in_counts WHERE stretch < ?").bind(stretch).run();

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

/**
 * Deletes everything kept about one reader (step 14, delete my account): the account, every
 * session on every device, and the cancel ticket.
 *
 * `cut` hands the ticket back to Apple so Apple drops its link with Hifth too; it is given
 * { sealed, appId, accountId } and answers true when Apple agreed. It is tried first, because
 * the ticket is gone once the account is. Whatever Apple says, and even if it cannot be
 * reached, the reader's data here is still deleted: that part is ours to promise.
 *
 * Returns { appleLink: "cut" } or { appleLink: "left" }. "left" means Hifth still shows in the
 * reader's Apple settings and they can remove it there themselves.
 */
export async function deleteAccount(db, accountId, { cut } = {}) {
  let appleLink = "left";
  try {
    const ticket = await db.prepare("SELECT sealed, app_id FROM apple_tickets WHERE account_id = ?").bind(accountId).first();
    if (ticket && typeof cut === "function") {
      if ((await cut({ sealed: ticket.sealed, appId: ticket.app_id, accountId })) === true) appleLink = "cut";
    }
  } catch {
    // Nothing is logged: the error could carry the ticket. The delete below still runs.
  }
  // Sessions and the ticket go with the account (ON DELETE CASCADE in the migrations).
  await db.prepare("DELETE FROM accounts WHERE id = ?").bind(accountId).run();
  return { appleLink };
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

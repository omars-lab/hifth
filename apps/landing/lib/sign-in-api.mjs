// hifth.app's sign-in addresses (docs/design/sign-in.md, step 10). The thin Cloudflare files in
// functions/api/ call these; the work is in accounts.mjs and apple-signin.mjs.
//
//   POST /api/sign-in/word   { invite? } -> 200 { word } | 403 { reason: "invite-needed" }
//                            | 429 { reason: "too-many" } past the ten-minute limit
//   POST /api/sign-in        { note, word, code? } -> 200 { session, expiresAt } | 400 | 401 { reason } | 413
//   POST /api/sign-out       Authorization: Bearer <session> -> 204
//   POST /api/sign-in/apple-notice   { payload } from Apple -> 200 | 400 | 401 { reason } | 413
//   POST /api/sign-in/delete-account Authorization: Bearer <session>
//                                    -> 200 { deleted: true, appleLink: "cut" | "left" } | 401 { reason }
//
// What the server needs, all set in Cloudflare and none of it secret:
//   SIGN_IN        "on" opens the addresses. Anything else and they answer 404, as if they were
//                  not there, so a site published before sign-in is ready shows nothing of it.
//   ACCOUNTS       the D1 database (migrations/).
//   APPLE_APP_IDS  our app ids Apple's note may be meant for, separated by commas.
//   SIGN_IN_INVITES  optional (step 18). The scrambled copies of the invite codes that may
//                  start a sign-in, separated by commas. Unset or empty, anyone may. It is not
//                  a secret only because every code is 80 random bits made by invites.mjs,
//                  never a word someone picked. The codes themselves are never set here, kept
//                  in the database or logged.
// And three secrets, for Apple's cancel ticket (step 13, apple-link.mjs): APPLE_SIGN_IN_KEY,
// APPLE_SIGN_IN_KEY_ID and APPLE_TEAM_ID. With any of them missing a reader can still sign in;
// no ticket is kept. `code` is the one-time code from Apple's sheet; the app may leave it out.
//
// Every reply says "no-store", so no copy of a session is kept anywhere on the way. A reply
// never carries Apple's user number or our account number: the app needs only its session.

import { createRemoteJWKSet } from "jose";
import { APPLE_KEYS, checkAppleNote } from "./apple-signin.mjs";
import { appleConfig, checkAppleNotice, openTicket, revokeTicket, sealTicket, tradeCode } from "./apple-link.mjs";
import { inviteHash, tidyInvite } from "./invites.mjs";
import { WORD_SECONDS, actOnAppleNotice, deleteAccount, handOutWord, signIn, signOut, whoIs } from "./accounts.mjs";

/** A sign-in body is a note of a few kilobytes and a 64-letter word; anything far bigger is not one. */
const MOST_BYTES = 16 * 1024;

const HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const reply = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? { "cache-control": "no-store" } : HEADERS,
  });

const appIds = (env) =>
  String(env?.APPLE_APP_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

/** null when the address may go ahead, or the reply that stops it. */
function closed(env) {
  if (env?.SIGN_IN !== "on") return reply(404, { reason: "not-found" });
  if (!env.ACCOUNTS || appIds(env).length === 0) return reply(503, { reason: "not-set-up" });
  return null;
}

// Apple's published keys, fetched when first needed and kept for the life of the worker.
let appleKeys;
function applePublishedKeys() {
  appleKeys ??= createRemoteJWKSet(new URL(APPLE_KEYS));
  return appleKeys;
}
function appleCheck(env) {
  const audiences = appIds(env);
  return (note, word) => checkAppleNote(note, { keys: applePublishedKeys(), audiences, word });
}

/**
 * null when this ask may start a sign-in, or the reply that turns it away (step 18). It runs
 * before the database is touched, so someone without a code cannot make the server write, or
 * use up the ten-minute limit for those who hold one. The code is tidied first (invites.mjs),
 * so capitals, spaces and dashes do not matter. The comparison is between scrambled copies, so
 * how long it takes says nothing about a code. An entry in the setting that is not a scrambled
 * copy matches nothing: a mistyped setting lets nobody in, never everybody.
 */
async function uninvited(request, env) {
  const allowed = String(env?.SIGN_IN_INVITES ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowed.length === 0) return null;

  const body = await readBody(request);
  if (body.stop) return body.stop;
  const { invite } = body.fields;
  const ok = tidyInvite(invite) !== "" && allowed.includes(await inviteHash(invite));
  return ok ? null : reply(403, { reason: "invite-needed" });
}

/** POST /api/sign-in/word */
export async function handleWord(request, env) {
  const stop = closed(env) ?? (await uninvited(request, env));
  if (stop) return stop;
  const word = await handOutWord(env.ACCOUNTS);
  if (word === null) {
    // Too many sign-ins were started in these ten minutes (step 17). Only this address is
    // limited: a sign-in without a live word writes nothing, and sign-out, delete my account and
    // Apple's notice must never be turned away.
    const res = reply(429, { reason: "too-many" });
    // The limit starts afresh with the next ten-minute stretch; say how far off that is.
    res.headers.set("retry-after", String(WORD_SECONDS - (Math.floor(Date.now() / 1000) % WORD_SECONDS)));
    return res;
  }
  return reply(200, { word });
}

/** The request's JSON body as { fields }, or { stop } with the reply that refuses it. */
async function readBody(request) {
  if (Number(request.headers.get("content-length") ?? 0) > MOST_BYTES) return { stop: reply(413, { reason: "too-big" }) };
  const text = await request.text();
  if (text.length > MOST_BYTES) return { stop: reply(413, { reason: "too-big" }) };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { fields: body && typeof body === "object" && !Array.isArray(body) ? body : {} };
}

/**
 * How a sign-in trades Apple's one-time code for the cancel ticket and locks it (step 13), or
 * undefined when the key file's secrets are not set: sign-in then works without keeping one.
 */
function ticketTrade(env, fetch) {
  const config = appleConfig(env);
  if (!config) return undefined;
  return async ({ code, appId, accountId }) => {
    const traded = await tradeCode({ code, appId, config, fetch });
    return traded.ok ? sealTicket(traded.ticket, { secret: config.key, accountId }) : null;
  };
}

/** Whether a kept ticket still opens with today's key file (question 11), or undefined without one. */
function ticketOpens(env) {
  const config = appleConfig(env);
  if (!config) return undefined;
  return async ({ sealed, accountId }) => (await openTicket(sealed, { secret: config.key, accountId })) !== null;
}

/** POST /api/sign-in */
export async function handleSignIn(request, env, { check, fetch } = {}) {
  const stop = closed(env);
  if (stop) return stop;

  const body = await readBody(request);
  if (body.stop) return body.stop;
  const { note, word, code } = body.fields;
  if (typeof note !== "string" || typeof word !== "string" || !note || !word) {
    return reply(400, { reason: "bad-request" });
  }

  const result = await signIn(env.ACCOUNTS, {
    note,
    word,
    check: check ?? appleCheck(env),
    code: typeof code === "string" ? code : undefined,
    trade: ticketTrade(env, fetch),
    opens: ticketOpens(env),
  });
  if (!result.ok) return reply(401, { reason: result.reason });
  return reply(200, { session: result.session, expiresAt: result.expiresAt });
}

/**
 * POST /api/sign-in/apple-notice. Apple posts { payload: <signed notice> } here when a reader
 * leaves from Apple's side. The reply is the same whether or not we know the reader.
 */
export async function handleAppleNotice(request, env, { keys } = {}) {
  const stop = closed(env);
  if (stop) return stop;

  const body = await readBody(request);
  if (body.stop) return body.stop;
  const { payload } = body.fields;
  if (typeof payload !== "string" || !payload) return reply(400, { reason: "bad-request" });

  const notice = await checkAppleNotice(payload, { keys: keys ?? applePublishedKeys(), audiences: appIds(env) });
  if (!notice.ok) return reply(401, { reason: notice.reason });
  await actOnAppleNotice(env.ACCOUNTS, notice);
  return reply(200, { ok: true });
}

/** The session named in the Authorization line, or "" when there is none. Never read from the body or the address. */
function sessionFrom(request) {
  const [kind, session] = (request.headers.get("authorization") ?? "").split(" ");
  return kind === "Bearer" && session ? session : "";
}

/**
 * How deleting an account hands the cancel ticket back to Apple (step 14), or undefined when the
 * key file's secrets are not set: the account is still deleted, and the link with Apple is left.
 */
function ticketCut(env, fetch) {
  const config = appleConfig(env);
  if (!config) return undefined;
  return async ({ sealed, appId, accountId }) => {
    const ticket = await openTicket(sealed, { secret: config.key, accountId });
    if (!ticket) return false;
    return (await revokeTicket({ ticket, appId, config, fetch })).ok;
  };
}

/**
 * POST /api/sign-in/delete-account. Only the signed-in reader can ask, and only for themselves:
 * the account is the one their session belongs to, never one named in the request. Everything
 * kept about them is deleted whatever Apple answers; `appleLink` tells the app whether Apple
 * dropped its side too ("cut") or the reader should remove Hifth in their Apple settings ("left").
 */
export async function handleDeleteAccount(request, env, { fetch } = {}) {
  const stop = closed(env);
  if (stop) return stop;
  const accountId = await whoIs(env.ACCOUNTS, sessionFrom(request));
  if (!accountId) return reply(401, { reason: "signed-out" });
  const { appleLink } = await deleteAccount(env.ACCOUNTS, accountId, { cut: ticketCut(env, fetch) });
  return reply(200, { deleted: true, appleLink });
}

/** POST /api/sign-out. Quietly fine with no session or an unknown one: the device is signed out either way. */
export async function handleSignOut(request, env) {
  const stop = closed(env);
  if (stop) return stop;
  const session = sessionFrom(request);
  if (session) await signOut(env.ACCOUNTS, session);
  return reply(204);
}

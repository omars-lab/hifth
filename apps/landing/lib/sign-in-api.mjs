// hifth.app's sign-in addresses (docs/design/sign-in.md, step 10). The thin Cloudflare files in
// functions/api/ call these; the work is in accounts.mjs and apple-signin.mjs.
//
//   POST /api/sign-in/word   -> 200 { word }
//   POST /api/sign-in        { note, word, code? } -> 200 { session, expiresAt } | 400 | 401 { reason } | 413
//   POST /api/sign-out       Authorization: Bearer <session> -> 204
//   POST /api/sign-in/apple-notice   { payload } from Apple -> 200 | 400 | 401 { reason } | 413
//
// What the server needs, all set in Cloudflare and none of it secret:
//   SIGN_IN        "on" opens the addresses. Anything else and they answer 404, as if they were
//                  not there, so a site published before sign-in is ready shows nothing of it.
//   ACCOUNTS       the D1 database (migrations/).
//   APPLE_APP_IDS  our app ids Apple's note may be meant for, separated by commas.
// And three secrets, for Apple's cancel ticket (step 13, apple-link.mjs): APPLE_SIGN_IN_KEY,
// APPLE_SIGN_IN_KEY_ID and APPLE_TEAM_ID. With any of them missing a reader can still sign in;
// no ticket is kept. `code` is the one-time code from Apple's sheet; the app may leave it out.
//
// Every reply says "no-store", so no copy of a session is kept anywhere on the way. A reply
// never carries Apple's user number or our account number: the app needs only its session.

import { createRemoteJWKSet } from "jose";
import { APPLE_KEYS, checkAppleNote } from "./apple-signin.mjs";
import { appleConfig, checkAppleNotice, sealTicket, tradeCode } from "./apple-link.mjs";
import { actOnAppleNotice, handOutWord, signIn, signOut } from "./accounts.mjs";

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

/** POST /api/sign-in/word */
export async function handleWord(request, env) {
  const stop = closed(env);
  if (stop) return stop;
  return reply(200, { word: await handOutWord(env.ACCOUNTS) });
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

/** POST /api/sign-out. Quietly fine with no session or an unknown one: the device is signed out either way. */
export async function handleSignOut(request, env) {
  const stop = closed(env);
  if (stop) return stop;
  const [kind, session] = (request.headers.get("authorization") ?? "").split(" ");
  if (kind === "Bearer" && session) await signOut(env.ACCOUNTS, session);
  return reply(204);
}

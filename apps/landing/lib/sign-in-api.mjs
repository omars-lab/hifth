// hifth.app's sign-in addresses (docs/design/sign-in.md, step 10). The thin Cloudflare files in
// functions/api/ call these; the work is in accounts.mjs and apple-signin.mjs.
//
//   POST /api/sign-in/word   -> 200 { word }
//   POST /api/sign-in        { note, word } -> 200 { session, expiresAt } | 400 | 401 { reason } | 413
//   POST /api/sign-out       Authorization: Bearer <session> -> 204
//
// What the server needs, all set in Cloudflare and none of it secret:
//   SIGN_IN        "on" opens the addresses. Anything else and they answer 404, as if they were
//                  not there, so a site published before sign-in is ready shows nothing of it.
//   ACCOUNTS       the D1 database (migrations/0001_accounts.sql).
//   APPLE_APP_IDS  our app ids Apple's note may be meant for, separated by commas.
//
// Every reply says "no-store", so no copy of a session is kept anywhere on the way. A reply
// never carries Apple's user number or our account number: the app needs only its session.

import { createRemoteJWKSet } from "jose";
import { APPLE_KEYS, checkAppleNote } from "./apple-signin.mjs";
import { handOutWord, signIn, signOut } from "./accounts.mjs";

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
function appleCheck(env) {
  appleKeys ??= createRemoteJWKSet(new URL(APPLE_KEYS));
  const audiences = appIds(env);
  return (note, word) => checkAppleNote(note, { keys: appleKeys, audiences, word });
}

/** POST /api/sign-in/word */
export async function handleWord(request, env) {
  const stop = closed(env);
  if (stop) return stop;
  return reply(200, { word: await handOutWord(env.ACCOUNTS) });
}

/** POST /api/sign-in */
export async function handleSignIn(request, env, { check } = {}) {
  const stop = closed(env);
  if (stop) return stop;

  if (Number(request.headers.get("content-length") ?? 0) > MOST_BYTES) return reply(413, { reason: "too-big" });
  const text = await request.text();
  if (text.length > MOST_BYTES) return reply(413, { reason: "too-big" });

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const { note, word } = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  if (typeof note !== "string" || typeof word !== "string" || !note || !word) {
    return reply(400, { reason: "bad-request" });
  }

  const result = await signIn(env.ACCOUNTS, { note, word, check: check ?? appleCheck(env) });
  if (!result.ok) return reply(401, { reason: result.reason });
  return reply(200, { session: result.session, expiresAt: result.expiresAt });
}

/** POST /api/sign-out. Quietly fine with no session or an unknown one: the device is signed out either way. */
export async function handleSignOut(request, env) {
  const stop = closed(env);
  if (stop) return stop;
  const [kind, session] = (request.headers.get("authorization") ?? "").split(" ");
  if (kind === "Bearer" && session) await signOut(env.ACCOUNTS, session);
  return reply(204);
}

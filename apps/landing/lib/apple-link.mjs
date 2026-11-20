// The lasting link between a reader's Apple account and Hifth (docs/design/sign-in.md, steps 13
// and 14), and how hifth.app ends it.
//
// At a sign-in, Apple's sheet hands the app a one-time code, good for five minutes. hifth.app
// trades it with Apple for a long-lived token (Apple calls it a refresh token; the design page
// calls it the cancel ticket). Apple needs that ticket back on the day the reader deletes their
// account, to cut the link on its side. Apple's own technical note (TN3194) says to do it this way.
//
//   - To trade or to cut, hifth.app proves it is Hifth with a short note it signs itself, using
//     the key file the owner made on Apple's site (the three secrets APPLE_SIGN_IN_KEY,
//     APPLE_SIGN_IN_KEY_ID and APPLE_TEAM_ID). A fresh note each time, good for five minutes, so
//     nothing has to be renewed every six months.
//   - The ticket is kept locked (AES-256-GCM). The lock's key is worked out from the key file,
//     which is not in the database, so a copy of the database alone shows no ticket. A ticket is
//     no use to anyone without that same key file, so this adds no weaker link, and needs no
//     further secret. Each locked ticket is tied to its account, so it cannot be moved to another.
//   - Apple also posts a signed notice when a reader leaves from Apple's side (stops using
//     Apple sign-in with Hifth, or deletes their Apple account). checkAppleNotice reads it.
//
// Nothing here throws, logs or echoes a code, a ticket or a key. `fetch` is passed in so the
// tests can stand in for Apple.

import { importPKCS8, SignJWT } from "jose";
import { APPLE_ISSUER, checkSignedByApple } from "./apple-signin.mjs";

export const APPLE_TOKEN = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE = "https://appleid.apple.com/auth/revoke";

const PROOF_SECONDS = 5 * 60;
const APPLE_WAIT_MS = 5000;
const LOCK_VERSION = "v1";
const LOCK_PURPOSE = "hifth.app apple cancel ticket v1";

const text = (value) => new TextEncoder().encode(value);
const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
function fromBase64Url(value) {
  const plain = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(plain, (c) => c.charCodeAt(0));
}

/** The key file and its two ids from the server's secrets, or null when any one is missing. */
export function appleConfig(env) {
  const key = env?.APPLE_SIGN_IN_KEY;
  const keyId = env?.APPLE_SIGN_IN_KEY_ID;
  const teamId = env?.APPLE_TEAM_ID;
  if (![key, keyId, teamId].every((v) => typeof v === "string" && v.trim() !== "")) return null;
  return { key, keyId, teamId };
}

/** Our proof to Apple that the caller is Hifth (Apple calls it a client secret). */
export async function clientSecret(config, appId, { now = Math.floor(Date.now() / 1000) } = {}) {
  const key = await importPKCS8(config.key, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(appId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + PROOF_SECONDS)
    .sign(key);
}

/** One form posted to Apple. Returns { ok, body } or { ok: false, reason }. */
async function askApple(url, fields, { appId, config, fetch }) {
  if (!config || typeof appId !== "string" || !appId) return { ok: false, reason: "not-set-up" };
  let proof;
  try {
    proof = await clientSecret(config, appId);
  } catch {
    return { ok: false, reason: "not-set-up" };
  }
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: appId, client_secret: proof, ...fields }).toString(),
      signal: AbortSignal.timeout(APPLE_WAIT_MS),
    });
  } catch {
    return { ok: false, reason: "apple-unreachable" };
  }
  if (!res.ok) return { ok: false, reason: "apple-refused" };
  let body = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    // Apple's revoke address answers with an empty body; the token address always sends JSON.
  }
  return { ok: true, body };
}

/**
 * Trades the one-time code from Apple's sheet for the cancel ticket.
 * Returns { ok: true, ticket } or { ok: false, reason }.
 */
export async function tradeCode({ code, appId, config, fetch = globalThis.fetch }) {
  if (typeof code !== "string" || !code) return { ok: false, reason: "no-code" };
  const asked = await askApple(APPLE_TOKEN, { grant_type: "authorization_code", code }, { appId, config, fetch });
  if (!asked.ok) return asked;
  const ticket = asked.body?.refresh_token;
  if (typeof ticket !== "string" || !ticket) return { ok: false, reason: "no-ticket" };
  return { ok: true, ticket };
}

/**
 * Cuts the link between a reader's Apple account and Hifth by handing the cancel ticket back to
 * Apple (step 14, delete my account). After it, Hifth is gone from the reader's list of apps
 * using Apple sign-in. Returns { ok: true } or { ok: false, reason }.
 */
export async function revokeTicket({ ticket, appId, config, fetch = globalThis.fetch }) {
  if (typeof ticket !== "string" || !ticket) return { ok: false, reason: "no-ticket" };
  const asked = await askApple(APPLE_REVOKE, { token: ticket, token_type_hint: "refresh_token" }, { appId, config, fetch });
  return asked.ok ? { ok: true } : asked;
}

async function lockKey(secret) {
  const material = await crypto.subtle.importKey("raw", text(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: text(LOCK_PURPOSE) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Locks a ticket for one account. `secret` is the key file's text. */
export async function sealTicket(ticket, { secret, accountId }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const locked = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: text(accountId) },
    await lockKey(secret),
    text(ticket),
  );
  return `${LOCK_VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(locked))}`;
}

/** Opens a locked ticket, or null if it is not one, was changed, or belongs to another account or key. */
export async function openTicket(sealed, { secret, accountId }) {
  if (typeof sealed !== "string") return null;
  const [version, iv, locked, ...rest] = sealed.split(".");
  if (version !== LOCK_VERSION || !iv || !locked || rest.length > 0) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(iv), additionalData: text(accountId) },
      await lockKey(secret),
      fromBase64Url(locked),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/**
 * Reads a notice Apple posts when something changes on a reader's Apple account. `keys` and
 * `audiences` are as for the sign-in note. Returns { ok: true, type, appleUser, at } or
 * { ok: false, reason }. `type` is Apple's word ("consent-revoked", "account-delete",
 * "email-disabled", "email-enabled"); `at` is when it happened, in seconds. A notice may carry an
 * email; it is never handed on.
 */
export async function checkAppleNotice(token, { keys, audiences } = {}) {
  const signed = await checkSignedByApple(token, { keys, audiences });
  if (!signed.ok) return signed;

  let event = signed.payload.events;
  if (typeof event === "string") {
    try {
      event = JSON.parse(event);
    } catch {
      event = null;
    }
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) return { ok: false, reason: "no-event" };
  const { type, sub } = event;
  if (typeof type !== "string" || !type || typeof sub !== "string" || !sub) return { ok: false, reason: "no-event" };

  // Apple has sent this time in seconds and in milliseconds; anything this large is milliseconds.
  let at = Number(event.event_time);
  if (!Number.isFinite(at) || at <= 0) at = signed.payload.iat;
  else if (at > 100_000_000_000) at = Math.floor(at / 1000);
  return { ok: true, type, appleUser: sub, at };
}

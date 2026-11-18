// Checking the note Apple hands the app after a reader signs in (Apple calls it an identity
// token). Step 10 of the sign-in plan: docs/design/sign-in.md, .claude/plans/sign-in-build.md.
//
// The note is a signed JSON Web Token. jose (one small, well-known library, server only) checks
// the signature against Apple's published keys; this file pins everything else:
//
//   - signed with RS256 only, so a note signed any other way, or not at all, is refused;
//   - issued by Apple (https://appleid.apple.com) and not expired;
//   - meant for one of our own app ids (the iPad and iPhone app, the Mac app, the site);
//   - carrying the scrambled copy (hex SHA-256) of the one-off word hifth.app handed out for
//     this sign-in, so a note copied from somewhere else cannot be replayed;
//   - naming a reader by Apple's lasting user number ("sub").
//
// Only that user number comes back. A note may carry an email, but accounts are never found by
// email (a reader may hide it, and it can change) and nothing here keeps it.
//
// The caller passes Apple's keys in: createRemoteJWKSet(new URL(APPLE_KEYS)) on the server, a
// local key set of made-up keys in the tests. Nothing is thrown; a refusal says why in one word,
// and never echoes the note.

import { jwtVerify } from "jose";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_KEYS = "https://appleid.apple.com/auth/keys";
const METHOD = "RS256";
const CLOCK_SLACK_SECONDS = 30;

/** The hex SHA-256 of a one-off word: what the app hands Apple's sheet, and what the note carries back. */
export async function hashWord(word) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(word));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in time that does not depend on where they first differ. */
function sameText(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** jose's error, as one plain word for the log and the tests. */
function reasonFor(error) {
  switch (error?.code) {
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED":
      return "bad-signature";
    case "ERR_JWT_EXPIRED":
      return "expired";
    case "ERR_JOSE_ALG_NOT_ALLOWED":
      return "wrong-method";
    case "ERR_JWKS_NO_MATCHING_KEY":
    case "ERR_JWKS_MULTIPLE_MATCHING_KEYS":
      return "unknown-key";
    case "ERR_JWT_CLAIM_VALIDATION_FAILED":
      if (error.claim === "iss") return "wrong-issuer";
      if (error.claim === "aud") return "wrong-audience";
      if (error.claim === "sub") return "no-user";
      return "bad-claim";
    case "ERR_JWKS_TIMEOUT":
    case "ERR_JOSE_GENERIC":
      return "keys-unreachable";
    default:
      return "not-a-note";
  }
}

/**
 * Checks Apple's note. `keys` is Apple's key set (see above), `audiences` our app ids, and `word`
 * the one-off word handed out for this sign-in. Returns { ok: true, appleUser } or
 * { ok: false, reason }.
 */
export async function checkAppleNote(token, { keys, audiences, word } = {}) {
  if (typeof token !== "string" || !token) return { ok: false, reason: "not-a-note" };
  if (!keys || !Array.isArray(audiences) || audiences.length === 0) return { ok: false, reason: "not-set-up" };
  if (typeof word !== "string" || !word) return { ok: false, reason: "word-mismatch" };

  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      algorithms: [METHOD],
      issuer: APPLE_ISSUER,
      audience: audiences,
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: CLOCK_SLACK_SECONDS,
    }));
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }

  if (!sameText(payload.nonce, await hashWord(word))) return { ok: false, reason: "word-mismatch" };
  if (typeof payload.sub !== "string" || !payload.sub) return { ok: false, reason: "no-user" };
  return { ok: true, appleUser: payload.sub };
}

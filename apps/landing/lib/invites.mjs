// Invite codes for the tester stage of sign-in (docs/design/sign-in.md, step 18).
//
// A code is made here from 80 random bits, never picked by a person. That is what lets the
// server's setting hold only each code's scrambled copy and not be a secret: a scrambled copy of
// a word someone chose can be guessed at leisure, one of 80 random bits cannot. So codes come
// only from newInvite (the deploy-site skill's invite-codes script), and the plain code is never
// set on the server, kept in the database or written to a log.
//
// The server and the script share tidyInvite, so a code is the same code however it was typed.
// Changing what tidyInvite does breaks every code already handed out.

/** 32 letters and digits with no i, l, o or u, so none can be misread for another. */
export const INVITE_LETTERS = "0123456789abcdefghjkmnpqrstvwxyz";

const LETTERS_IN_A_CODE = 16;

/** A new code, shown in four groups: "xxxx-xxxx-xxxx-xxxx". 16 letters of 5 bits each. */
export function newInvite({ random = (array) => crypto.getRandomValues(array) } = {}) {
  const bytes = random(new Uint8Array(LETTERS_IN_A_CODE));
  const letters = Array.from(bytes, (b) => INVITE_LETTERS[b & 31]).join("");
  return letters.match(/.{4}/g).join("-");
}

/**
 * A typed code as it is compared: small letters, the look-alikes read as what they must have
 * been (o as 0, i and l as 1), and everything else that is not one of our letters dropped, so
 * spaces, dashes and capitals never matter. Anything that is not text gives "".
 */
export function tidyInvite(typed) {
  if (typeof typed !== "string") return "";
  return Array.from(typed.toLowerCase(), (c) => (c === "o" ? "0" : c === "i" || c === "l" ? "1" : c))
    .filter((c) => INVITE_LETTERS.includes(c))
    .join("");
}

/** A code's scrambled copy, as the server's setting holds it: SHA-256 of the tidied code, 64 hex letters. */
export async function inviteHash(code) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tidyInvite(code))));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

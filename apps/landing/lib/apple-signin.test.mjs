import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { checkAppleNote, hashWord } from "./apple-signin.mjs";

/*
 * Step 10 of the sign-in plan (docs/design/sign-in.md; .claude/plans/sign-in-build.md): hifth.app
 * checks the note Apple hands the app after a reader signs in (Apple calls it an identity token).
 * Every key, user number and one-off word here is made up inside the test; no real Apple account's
 * note ever goes in the repo. Written before the checker, and watched failing.
 */

const APPLE = "https://appleid.apple.com";
const APP = "app.example.hifth";
const WORD = "made-up-one-off-word";
const USER = "000000.made-up-apple-user.0000";

const good = await generateKeyPair("RS256", { extractable: true });
const forger = await generateKeyPair("RS256", { extractable: true });
const other = await generateKeyPair("ES256", { extractable: true });

/** Apple's published keys, as the checker would fetch them: one RSA key and one EC key. */
const keys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(good.publicKey)), kid: "apple-1", alg: "RS256", use: "sig" },
    { ...(await exportJWK(other.publicKey)), kid: "apple-ec", alg: "ES256", use: "sig" },
  ],
});

const now = () => Math.floor(Date.now() / 1000);

async function note({
  key = good.privateKey,
  alg = "RS256",
  kid = "apple-1",
  iss = APPLE,
  aud = APP,
  sub = USER,
  nonce,
  issuedAt = now(),
  expiresAt = now() + 600,
  extra = {},
} = {}) {
  const claims = { ...extra, nonce: nonce === undefined ? await hashWord(WORD) : nonce };
  if (claims.nonce === null) delete claims.nonce;
  let jwt = new SignJWT(claims).setProtectedHeader({ alg, kid }).setIssuedAt(issuedAt).setExpirationTime(expiresAt);
  if (iss) jwt = jwt.setIssuer(iss);
  if (aud) jwt = jwt.setAudience(aud);
  if (sub) jwt = jwt.setSubject(sub);
  return jwt.sign(key);
}

const opts = { keys, audiences: [APP], word: WORD };

test("a good note names the reader by Apple's lasting user number", async () => {
  const result = await checkAppleNote(await note(), opts);
  assert.equal(result.ok, true);
  assert.equal(result.appleUser, USER);
});

test("the app's id is accepted from a list, so the iPad, iPhone and Mac apps and the site can share one checker", async () => {
  const result = await checkAppleNote(await note({ aud: "app.example.hifth.web" }), {
    ...opts,
    audiences: [APP, "app.example.hifth.web"],
  });
  assert.equal(result.ok, true);
});

test("the email in a note is never handed on: only the user number comes back", async () => {
  const result = await checkAppleNote(
    await note({ extra: { email: "made-up@privaterelay.example", is_private_email: "true", email_verified: "true" } }),
    opts,
  );
  assert.deepEqual(result, { ok: true, appleUser: USER, appId: APP });
});

test("a good note also says which of our apps it was for, so the one-time code can be traded under that name", async () => {
  const result = await checkAppleNote(await note({ aud: "app.example.hifth.mac" }), {
    ...opts,
    audiences: [APP, "app.example.hifth.mac"],
  });
  assert.equal(result.appId, "app.example.hifth.mac");
});

test("a note signed by a key that is not Apple's is refused", async () => {
  const result = await checkAppleNote(await note({ key: forger.privateKey }), opts);
  assert.deepEqual(result, { ok: false, reason: "bad-signature" });
});

test("a note from anyone but Apple is refused", async () => {
  const result = await checkAppleNote(await note({ iss: "https://appleid.example.test" }), opts);
  assert.deepEqual(result, { ok: false, reason: "wrong-issuer" });
});

test("a note meant for another app is refused", async () => {
  const result = await checkAppleNote(await note({ aud: "com.example.someone-else" }), opts);
  assert.deepEqual(result, { ok: false, reason: "wrong-audience" });
});

test("an expired note is refused", async () => {
  const result = await checkAppleNote(await note({ issuedAt: now() - 3600, expiresAt: now() - 1200 }), opts);
  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("a note whose one-off word does not match the one we handed out is refused", async () => {
  const result = await checkAppleNote(await note({ nonce: await hashWord("some-other-word") }), opts);
  assert.deepEqual(result, { ok: false, reason: "word-mismatch" });
});

test("a note with no one-off word is refused", async () => {
  const result = await checkAppleNote(await note({ nonce: null }), opts);
  assert.deepEqual(result, { ok: false, reason: "word-mismatch" });
});

test("a note carrying the word itself, not its scrambled copy, is refused", async () => {
  const result = await checkAppleNote(await note({ nonce: WORD }), opts);
  assert.deepEqual(result, { ok: false, reason: "word-mismatch" });
});

test("a note signed another way than the one we pin is refused, even with a key Apple lists", async () => {
  const result = await checkAppleNote(await note({ key: other.privateKey, alg: "ES256", kid: "apple-ec" }), opts);
  assert.deepEqual(result, { ok: false, reason: "wrong-method" });
});

test("an unsigned note is refused", async () => {
  const [, body] = (await note()).split(".");
  const header = Buffer.from(JSON.stringify({ alg: "none", kid: "apple-1" })).toString("base64url");
  const result = await checkAppleNote(`${header}.${body}.`, opts);
  assert.equal(result.ok, false);
});

test("a note naming a key Apple does not list is refused", async () => {
  const result = await checkAppleNote(await note({ kid: "not-an-apple-key" }), opts);
  assert.deepEqual(result, { ok: false, reason: "unknown-key" });
});

test("a note with no user number is refused", async () => {
  const result = await checkAppleNote(await note({ sub: null }), opts);
  assert.deepEqual(result, { ok: false, reason: "no-user" });
});

test("nothing, or something that is not a note, is refused without throwing", async () => {
  for (const junk of [undefined, null, "", "not-a-note", 42, "a.b.c"]) {
    const result = await checkAppleNote(junk, opts);
    assert.equal(result.ok, false, String(junk));
  }
});

test("a checker with no app ids or no word refuses everything rather than accepting any app", async () => {
  const token = await note();
  assert.equal((await checkAppleNote(token, { ...opts, audiences: [] })).ok, false);
  assert.equal((await checkAppleNote(token, { ...opts, word: "" })).ok, false);
});

test("the scrambled copy of a word is the hex SHA-256 Apple's sheet expects", async () => {
  assert.equal(await hashWord("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

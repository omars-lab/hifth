import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from "jose";
import {
  APPLE_TOKEN,
  appleConfig,
  checkAppleNotice,
  clientSecret,
  openTicket,
  sealTicket,
  tradeCode,
} from "./apple-link.mjs";

/*
 * Step 13 of the sign-in plan (docs/design/sign-in.md): hifth.app trades the one-time code from
 * Apple's sheet for Apple's cancel ticket (Apple calls it a refresh token), keeps it locked, and
 * reads Apple's notices that a reader has left. Every key, team id, code and ticket here is made
 * up inside the test, and Apple is a stand-in function: nothing here calls Apple. Written before
 * apple-link.mjs, and watched failing.
 */

const APPLE = "https://appleid.apple.com";
const APP = "app.example.hifth";
const TEAM = "Q9Z8Y7X6W5";
const KEY_ID = "MADEUPKEY1";
const USER = "000000.made-up-apple-user.0000";
const TICKET = "made-up-cancel-ticket.r.0001";

const ours = await generateKeyPair("ES256", { extractable: true });
const config = { key: await exportPKCS8(ours.privateKey), keyId: KEY_ID, teamId: TEAM };

/** Apple's token address, stood in for. It checks our proof the way Apple would. */
function standInApple({ status = 200, reply = { refresh_token: TICKET, access_token: "made-up-access" } } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const form = new URLSearchParams(init.body);
    calls.push({ url: String(url), method: init.method, type: init.headers["content-type"], form });
    try {
      await jwtVerify(form.get("client_secret"), ours.publicKey, {
        algorithms: ["ES256"],
        issuer: TEAM,
        audience: APPLE,
        subject: form.get("client_id"),
      });
    } catch {
      return new Response(JSON.stringify({ error: "invalid_client" }), { status: 400 });
    }
    return new Response(JSON.stringify(reply), { status });
  };
  return { fetch, calls };
}

test("the server's settings are read from the three secrets, and missing any one means not set up", () => {
  const env = { APPLE_SIGN_IN_KEY: config.key, APPLE_SIGN_IN_KEY_ID: KEY_ID, APPLE_TEAM_ID: TEAM };
  assert.deepEqual(appleConfig(env), config);
  for (const name of Object.keys(env)) assert.equal(appleConfig({ ...env, [name]: "" }), null, name);
  assert.equal(appleConfig(undefined), null);
});

test("our proof to Apple is a short note signed with the key file, naming the team, the app and Apple", async () => {
  const now = Math.floor(Date.now() / 1000);
  const secret = await clientSecret(config, APP);
  const { payload, protectedHeader } = await jwtVerify(secret, ours.publicKey, { algorithms: ["ES256"] });
  assert.equal(protectedHeader.kid, KEY_ID);
  assert.equal(payload.iss, TEAM);
  assert.equal(payload.sub, APP);
  assert.equal(payload.aud, APPLE);
  assert.ok(payload.exp - now <= 10 * 60, "good for minutes, not Apple's most of six months");
});

test("the one-time code is traded at Apple's token address for the cancel ticket", async () => {
  const apple = standInApple();
  const result = await tradeCode({ code: "made-up-code", appId: APP, config, fetch: apple.fetch });
  assert.deepEqual(result, { ok: true, ticket: TICKET });
  assert.equal(apple.calls.length, 1);
  const [call] = apple.calls;
  assert.equal(call.url, APPLE_TOKEN);
  assert.equal(call.url, "https://appleid.apple.com/auth/token");
  assert.equal(call.method, "POST");
  assert.equal(call.type, "application/x-www-form-urlencoded");
  assert.equal(call.form.get("grant_type"), "authorization_code");
  assert.equal(call.form.get("code"), "made-up-code");
  assert.equal(call.form.get("client_id"), APP);
});

test("a trade Apple turns down, or that never reaches Apple, says why and does not throw", async () => {
  const refused = standInApple({ status: 400, reply: { error: "invalid_grant" } });
  assert.deepEqual(await tradeCode({ code: "old-code", appId: APP, config, fetch: refused.fetch }), {
    ok: false,
    reason: "apple-refused",
  });
  const noTicket = standInApple({ reply: { access_token: "made-up-access" } });
  assert.deepEqual(await tradeCode({ code: "made-up-code", appId: APP, config, fetch: noTicket.fetch }), {
    ok: false,
    reason: "no-ticket",
  });
  const down = async () => {
    throw new Error("network down");
  };
  assert.deepEqual(await tradeCode({ code: "made-up-code", appId: APP, config, fetch: down }), {
    ok: false,
    reason: "apple-unreachable",
  });
  const junk = async () => new Response("<html>not json</html>", { status: 200 });
  assert.equal((await tradeCode({ code: "made-up-code", appId: APP, config, fetch: junk })).ok, false);
});

test("with no settings, no code or no app id, nothing is sent to Apple", async () => {
  const apple = standInApple();
  for (const args of [
    { code: "made-up-code", appId: APP, config: null },
    { code: "", appId: APP, config },
    { code: "made-up-code", appId: "", config },
    { code: "made-up-code", appId: APP, config: { ...config, key: "not a key file" } },
  ]) {
    const result = await tradeCode({ ...args, fetch: apple.fetch });
    assert.equal(result.ok, false);
  }
  assert.equal(apple.calls.length, 0);
});

test("a locked ticket opens again for the same account, and the locked form does not show it", async () => {
  const sealed = await sealTicket(TICKET, { secret: config.key, accountId: "account-1" });
  assert.equal(typeof sealed, "string");
  assert.ok(!sealed.includes(TICKET));
  assert.ok(!sealed.includes(Buffer.from(TICKET).toString("base64url")));
  assert.equal(await openTicket(sealed, { secret: config.key, accountId: "account-1" }), TICKET);
});

test("locking the same ticket twice gives two different locked forms", async () => {
  const a = await sealTicket(TICKET, { secret: config.key, accountId: "account-1" });
  const b = await sealTicket(TICKET, { secret: config.key, accountId: "account-1" });
  assert.notEqual(a, b);
});

test("a locked ticket does not open for another account, with another key, or once changed", async () => {
  const sealed = await sealTicket(TICKET, { secret: config.key, accountId: "account-1" });
  const otherKey = await exportPKCS8((await generateKeyPair("ES256", { extractable: true })).privateKey);
  assert.equal(await openTicket(sealed, { secret: config.key, accountId: "account-2" }), null);
  assert.equal(await openTicket(sealed, { secret: otherKey, accountId: "account-1" }), null);
  const parts = sealed.split(".");
  const flipped = [...parts.slice(0, -1), parts.at(-1).replace(/^./, (c) => (c === "A" ? "B" : "A"))].join(".");
  assert.equal(await openTicket(flipped, { secret: config.key, accountId: "account-1" }), null);
  for (const junk of [undefined, null, "", "v1", "v1.a.b", "plain text", 42]) {
    assert.equal(await openTicket(junk, { secret: config.key, accountId: "account-1" }), null, String(junk));
  }
});

// Apple's notices: a signed note posted to hifth.app when a reader leaves.

const apple = await generateKeyPair("RS256", { extractable: true });
const forger = await generateKeyPair("RS256", { extractable: true });
const keys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(apple.publicKey)), kid: "apple-1", alg: "RS256", use: "sig" }],
});
const now = () => Math.floor(Date.now() / 1000);

async function notice({
  key = apple.privateKey,
  iss = APPLE,
  aud = APP,
  events = { type: "consent-revoked", sub: USER, event_time: 1_800_000_000_000 },
  asText = true,
  expiresAt = now() + 600,
  issuedAt = now(),
} = {}) {
  const claims = events === null ? {} : { events: asText ? JSON.stringify(events) : events };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "apple-1" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
}

const opts = { keys, audiences: [APP] };

test("a notice that a reader stopped using Apple sign-in with Hifth is read", async () => {
  assert.deepEqual(await checkAppleNotice(await notice(), opts), {
    ok: true,
    type: "consent-revoked",
    appleUser: USER,
    at: 1_800_000_000,
  });
});

test("a notice that a reader deleted their Apple account is read, with the time in seconds too", async () => {
  const token = await notice({ events: { type: "account-delete", sub: USER, event_time: 1_800_000_123 } });
  assert.deepEqual(await checkAppleNotice(token, opts), {
    ok: true,
    type: "account-delete",
    appleUser: USER,
    at: 1_800_000_123,
  });
});

test("a notice whose event is not wrapped as text is read the same way", async () => {
  const result = await checkAppleNotice(await notice({ asText: false }), opts);
  assert.equal(result.ok, true);
  assert.equal(result.type, "consent-revoked");
});

test("a notice with no time of its own is timed by when Apple signed it", async () => {
  const issuedAt = now() - 5;
  const token = await notice({ events: { type: "consent-revoked", sub: USER }, issuedAt });
  assert.equal((await checkAppleNotice(token, opts)).at, issuedAt);
});

test("a notice about email forwarding is read as its own kind, so nothing is done about it", async () => {
  const token = await notice({ events: { type: "email-disabled", sub: USER, email: "made-up@privaterelay.example" } });
  const result = await checkAppleNotice(token, opts);
  assert.equal(result.ok, true);
  assert.equal(result.type, "email-disabled");
  assert.ok(!JSON.stringify(result).includes("privaterelay"), "the email is never handed on");
});

test("a notice not signed by Apple, from someone else, for another app, or expired is refused", async () => {
  assert.deepEqual(await checkAppleNotice(await notice({ key: forger.privateKey }), opts), {
    ok: false,
    reason: "bad-signature",
  });
  assert.deepEqual(await checkAppleNotice(await notice({ iss: "https://appleid.example.test" }), opts), {
    ok: false,
    reason: "wrong-issuer",
  });
  assert.deepEqual(await checkAppleNotice(await notice({ aud: "com.example.someone-else" }), opts), {
    ok: false,
    reason: "wrong-audience",
  });
  assert.deepEqual(
    await checkAppleNotice(await notice({ issuedAt: now() - 3600, expiresAt: now() - 1200 }), opts),
    { ok: false, reason: "expired" },
  );
});

test("a notice with no event, an event that is not readable, or no reader named is refused", async () => {
  assert.deepEqual(await checkAppleNotice(await notice({ events: null }), opts), { ok: false, reason: "no-event" });
  const junk = await new SignJWT({ events: "{not json" })
    .setProtectedHeader({ alg: "RS256", kid: "apple-1" })
    .setIssuer(APPLE)
    .setAudience(APP)
    .setIssuedAt()
    .setExpirationTime(now() + 600)
    .sign(apple.privateKey);
  assert.deepEqual(await checkAppleNotice(junk, opts), { ok: false, reason: "no-event" });
  assert.deepEqual(await checkAppleNotice(await notice({ events: { type: "account-delete" } }), opts), {
    ok: false,
    reason: "no-event",
  });
  for (const nothing of [undefined, null, "", "a.b.c", 42]) {
    assert.equal((await checkAppleNotice(nothing, opts)).ok, false, String(nothing));
  }
});

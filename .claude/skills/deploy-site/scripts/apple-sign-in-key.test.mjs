import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appleKey, NAMES } from "./apple-sign-in-key.mjs";

// Deleting a reader's account must also end their link with Apple, and Apple only takes that
// from a server holding a Sign in with Apple key. The owner makes the key on Apple's site; this
// script saves it on hifth.app's Cloudflare project with the key's id and the team id, and says
// which of the three are set. Everything here is made up: the key pair is made fresh for the
// test, and the team id is the repo's made-up one.
const TEAM = "Q9Z8Y7X6W5";
const KEY_ID = "MADEUP1234";
const env = { CLOUDFLARE_API_TOKEN: "made-up-token", CLOUDFLARE_ACCOUNT_ID: "made-up-account" };

const outside = () => mkdtempSync(join(tmpdir(), "apple-key-"));
const pem = (type = "ec") =>
  (type === "ec"
    ? generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    : generateKeyPairSync("rsa", { modulusLength: 2048 })
  ).privateKey.export({ type: "pkcs8", format: "pem" });

function keyFile({ name = `AuthKey_${KEY_ID}.p8`, text = pem(), mode = 0o600 } = {}) {
  const path = join(outside(), name);
  writeFileSync(path, text);
  chmodSync(path, mode);
  return { path, text };
}

/** A stand-in for Cloudflare's project address: answers GET with `vars`, records each PATCH. */
function cloudflare(vars = {}) {
  const sent = [];
  const fetch = async (url, init = {}) => {
    if ((init.method ?? "GET") === "PATCH") {
      const body = JSON.parse(init.body);
      sent.push({ url, body });
      Object.assign(vars, body.deployment_configs.production.env_vars);
    }
    return { ok: true, status: 200, json: async () => ({ success: true, result: { deployment_configs: { production: { env_vars: vars } } } }) };
  };
  return { fetch, sent };
}

const said = () => {
  const lines = [];
  return { say: (l) => lines.push(l), text: () => lines.join("\n") };
};

test("check names each of the three settings and says it is not set yet", async () => {
  const out = said();
  const ok = await appleKey({ env, fetch: cloudflare().fetch, say: out.say });
  assert.equal(ok, false);
  for (const name of NAMES) assert.match(out.text(), new RegExp(`${name}: not set`));
});

test("check never prints a value, even one Cloudflare hands back", async () => {
  const out = said();
  const vars = {
    APPLE_SIGN_IN_KEY: { type: "secret_text" },
    APPLE_SIGN_IN_KEY_ID: { type: "plain_text", value: KEY_ID },
    APPLE_TEAM_ID: { type: "plain_text", value: TEAM },
  };
  const ok = await appleKey({ env, fetch: cloudflare(vars).fetch, say: out.say });
  assert.equal(ok, true);
  assert.doesNotMatch(out.text(), new RegExp(`${KEY_ID}|${TEAM}`));
  assert.match(out.text(), /APPLE_TEAM_ID: set/);
});

test("without the saved Cloudflare keys loaded it refuses and asks nothing", async () => {
  const out = said();
  const cf = cloudflare();
  const ok = await appleKey({ env: {}, fetch: cf.fetch, say: out.say });
  assert.equal(ok, false);
  assert.match(out.text(), /not loaded/);
});

test("save sends the key, its id from the file name, and the team id, all as secrets", async () => {
  const out = said();
  const cf = cloudflare();
  const { path, text } = keyFile();
  const ok = await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => TEAM, repo: outside() });
  assert.equal(ok, true, out.text());
  assert.equal(cf.sent.length, 1);
  assert.match(cf.sent[0].url, /\/pages\/projects\/hifth-app$/);
  const vars = cf.sent[0].body.deployment_configs.production.env_vars;
  assert.deepEqual(vars.APPLE_SIGN_IN_KEY, { type: "secret_text", value: text });
  assert.deepEqual(vars.APPLE_SIGN_IN_KEY_ID, { type: "secret_text", value: KEY_ID });
  assert.deepEqual(vars.APPLE_TEAM_ID, { type: "secret_text", value: TEAM });
  // What it printed: names and "set", never the key, its id or the team id.
  assert.doesNotMatch(out.text(), new RegExp(`${KEY_ID}|${TEAM}|PRIVATE KEY`));
  for (const name of NAMES) assert.match(out.text(), new RegExp(`${name}: set`));
});

test("save refuses a file not named the way Apple names the key", async () => {
  const out = said();
  const cf = cloudflare();
  const { path } = keyFile({ name: "my-key.p8" });
  assert.equal(await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => TEAM, repo: outside() }), false);
  assert.equal(cf.sent.length, 0);
  assert.match(out.text(), /AuthKey_/);
});

test("save refuses a key file others on the laptop can read", async () => {
  const out = said();
  const cf = cloudflare();
  const { path } = keyFile({ mode: 0o644 });
  assert.equal(await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => TEAM, repo: outside() }), false);
  assert.equal(cf.sent.length, 0);
  assert.match(out.text(), /chmod 600/);
});

test("save refuses a key file kept inside the repo", async () => {
  const out = said();
  const cf = cloudflare();
  const { path } = keyFile();
  const repo = join(path, "..");
  assert.equal(await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => TEAM, repo }), false);
  assert.equal(cf.sent.length, 0);
  assert.match(out.text(), /inside the repo/);
});

test("save refuses a file that is not an Apple key (wrong kind of key, or not a key)", async () => {
  for (const text of [pem("rsa"), "not a key at all\n"]) {
    const out = said();
    const cf = cloudflare();
    const { path } = keyFile({ text });
    assert.equal(await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => TEAM, repo: outside() }), false);
    assert.equal(cf.sent.length, 0);
    assert.match(out.text(), /not a Sign in with Apple key/);
    assert.doesNotMatch(out.text(), /PRIVATE KEY|not a key at all/);
  }
});

test("save refuses when this laptop has no signing team to read the team id from", async () => {
  const out = said();
  const cf = cloudflare();
  const { path } = keyFile();
  assert.equal(await appleKey({ save: path, env, fetch: cf.fetch, say: out.say, team: () => null, repo: outside() }), false);
  assert.equal(cf.sent.length, 0);
  assert.match(out.text(), /team id/);
});

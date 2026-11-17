// The store-feedback command, against a made-up key and a made-up App Store Connect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API, client, credentials, token } from "../../../../scripts/lib/app-store-connect.mjs";
import { MAX_ANSWER, run, toReviews } from "./store-reviews.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const KEY = privateKey.export({ type: "pkcs8", format: "pem" });
const ENV = { ASC_REVIEWS_KEY_ID: "ABCDE12345", ASC_ISSUER_ID: "00000000-0000-0000-0000-000000000000" };
const readKey = (path) => {
  assert.match(path, /AuthKey_ABCDE12345\.p8$/);
  return KEY;
};

const review = (id, stars, date, answerId) => ({
  type: "customerReviews",
  id,
  attributes: { rating: stars, title: `Made-up title ${id}`, body: `Made-up words ${id}`, reviewerNickname: `made-up-reader-${id}`, createdDate: date, territory: "USA" },
  relationships: { response: { data: answerId ? { type: "customerReviewResponses", id: answerId } : null } },
});

/** A pretend App Store Connect: two pages of reviews, one already answered. */
function fakeStore(calls = []) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    if (url.includes("/v1/apps?filter[bundleId]="))
      return json({ data: [{ type: "apps", id: "999", attributes: { bundleId: "com.bytesofpurpose.hifth" } }] });
    if (url.includes("/v1/apps/999/customerReviews") && !url.includes("cursor"))
      return json({
        data: [review("r1", 5, "2026-11-20T10:00:00Z"), review("r2", 2, "2026-11-19T10:00:00Z", "a2")],
        included: [{ type: "customerReviewResponses", id: "a2", attributes: { responseBody: "Made-up answer", state: "PUBLISHED", lastModifiedDate: "2026-11-19T12:00:00Z" } }],
        links: { next: `${API}/v1/apps/999/customerReviews?cursor=2` },
      });
    if (url.includes("cursor=2")) return json({ data: [review("r3", 4, "2026-11-21T10:00:00Z")], links: {} });
    if (url === `${API}/v1/customerReviewResponses` && init.method === "POST") return json({ data: { id: "new" } }, 201);
    return json({ errors: [{ detail: "made-up refusal" }] }, 404);
  };
}

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "store-reviews-"));
  const lines = [];
  const calls = [];
  const go = (...argv) => run(argv, { env: ENV, dir, readKey, fetch: fakeStore(calls), now: Date.parse("2026-11-22T09:00:00Z"), out: (l) => lines.push(l) });
  return { dir, lines, calls, go };
};

test("the token is signed by the key in Apple's form and lasts under 20 minutes", () => {
  const jwt = token({ keyId: "ABCDE12345", issuerId: "iss", key: KEY, now: 1000 });
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "ES256", kid: "ABCDE12345", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(c, "base64url"));
  assert.equal(claims.aud, "appstoreconnect-v1");
  assert.equal(claims.iss, "iss");
  assert.ok(claims.exp - claims.iat <= 20 * 60);
  const sig = Buffer.from(s, "base64url");
  assert.equal(sig.length, 64, "Apple wants the raw 64-byte signature");
  const v = createVerify("SHA256");
  v.update(`${h}.${c}`);
  assert.ok(v.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, sig));
});

test("a missing setting or key file is named, and no value is printed", () => {
  assert.throws(() => credentials({}, { idName: "ASC_REVIEWS_KEY_ID", readKey }), /ASC_REVIEWS_KEY_ID or ASC_ISSUER_ID is not loaded/);
  const err = (() => {
    try {
      credentials(ENV, { idName: "ASC_REVIEWS_KEY_ID", readKey: () => { throw new Error("ENOENT"); } });
    } catch (e) {
      return e;
    }
  })();
  assert.match(err.message, /no key file/);
  assert.ok(!err.message.includes(ENV.ASC_REVIEWS_KEY_ID), "the key's id is never in a message");
  assert.ok(!err.message.includes(ENV.ASC_ISSUER_ID));
});

test("a next page on another site is refused, not followed with the token", async () => {
  const api = client({ keyId: "K", issuerId: "I", key: KEY }, {
    fetch: async () => ({ ok: true, json: async () => ({ data: [], links: { next: "https://elsewhere.example/steal" } }) }),
  });
  await assert.rejects(api.get("/v1/apps"), /another site/);
});

test("pull keeps every page of reviews and prints only counts", async () => {
  const { dir, lines, go } = setup();
  assert.equal(await go("pull"), 0);
  const kept = JSON.parse(readFileSync(join(dir, "reviews.json"), "utf8"));
  assert.deepEqual(kept.map((r) => r.id), ["r3", "r1", "r2"], "newest first, both pages");
  assert.equal(kept.find((r) => r.id === "r2").answer.body, "Made-up answer");
  assert.deepEqual(lines, [
    "3 reviews in the store, 3 new since the last pull, 2 with no answer",
    "by stars: 5: 1, 4: 1, 3: 0, 2: 1, 1: 0",
  ]);
  const printed = lines.join("\n");
  assert.ok(!/made-up-reader|Made-up words|Made-up title/.test(printed), "no reviewer's name or words in the terminal");
  lines.length = 0;
  await go("pull");
  assert.match(lines[0], /0 new since the last pull/);
});

test("an answer is sent only after a yes, and only the words that got the yes", async () => {
  const { dir, lines, calls, go } = setup();
  await go("pull");
  const draft = join(dir, "draft.txt");
  writeFileSync(draft, "Thank you, a made-up answer.\n");

  await assert.rejects(go("post", "r1"), /no drafted answer/);
  await go("draft", "r1", "--file", draft);
  await assert.rejects(go("post", "r1"), /no yes from the owner/);
  await go("approve", "r1");

  // Edited after the yes: refused.
  const answers = JSON.parse(readFileSync(join(dir, "answers.json"), "utf8"));
  answers.r1.body += " Changed.";
  writeFileSync(join(dir, "answers.json"), JSON.stringify(answers));
  await assert.rejects(go("post", "r1"), /changed after the owner's yes/);
  await go("draft", "r1", "--file", draft);
  await assert.rejects(go("post", "r1"), /no yes from the owner/, "a new draft clears the old yes");
  await go("approve", "r1");

  assert.equal(await go("post", "r1"), 0);
  const sent = calls.find((c) => c.init.method === "POST");
  assert.deepEqual(JSON.parse(sent.init.body), {
    data: {
      type: "customerReviewResponses",
      attributes: { responseBody: "Thank you, a made-up answer." },
      relationships: { review: { data: { type: "customerReviews", id: "r1" } } },
    },
  });
  assert.match(sent.init.headers.authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  await assert.rejects(go("post", "r1"), /already sent/);
  assert.ok(lines.some((l) => /sent the answer to r1/.test(l)));
});

test("a review that already has an answer in the store is not answered twice", async () => {
  const { dir, go } = setup();
  await go("pull");
  const draft = join(dir, "d.txt");
  writeFileSync(draft, "Made-up second answer");
  await go("draft", "r2", "--file", draft);
  await go("approve", "r2");
  await assert.rejects(go("post", "r2"), /already has an answer/);
});

test("waiting lists open reviews with where each stands, and no words", async () => {
  const { dir, lines, go } = setup();
  await go("pull");
  const draft = join(dir, "d.txt");
  writeFileSync(draft, "Made-up answer");
  await go("draft", "r3", "--file", draft);
  lines.length = 0;
  await go("waiting");
  assert.deepEqual(lines, [
    "r3  4 stars  2026-11-21  USA  drafted, waiting for the owner's yes",
    "r1  5 stars  2026-11-20  USA  no draft",
  ]);
});

test("an answer longer than Apple takes is refused when drafted", async () => {
  const { dir, go } = setup();
  await go("pull");
  const draft = join(dir, "long.txt");
  writeFileSync(draft, "a".repeat(MAX_ANSWER + 1));
  await assert.rejects(go("draft", "r1", "--file", draft), /at most 5970/);
});

test("Apple's refusal is reported with its reason", async () => {
  const api = client({ keyId: "K", issuerId: "I", key: KEY }, { fetch: fakeStore() });
  await assert.rejects(api.get("/v1/nothing"), /answered 404 for \/v1\/nothing: made-up refusal/);
});

test("a list with no answers included still reads", () => {
  assert.deepEqual(toReviews({ data: [review("x", 3, "2026-01-01")], included: [] })[0].answer, null);
});

/**
 * Putting the previous hifth.app release back. The tests hand put-back a made-up Cloudflare:
 * a function that answers each address the way Cloudflare's API does, with made-up ids and
 * commits. Written before put-back.mjs and seen failing.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTarget, productionReleases, putBack } from "./put-back.mjs";

const C1 = "1111111111111111111111111111111111111111";
const C2 = "2222222222222222222222222222222222222222";
const C3 = "3333333333333333333333333333333333333333";
const MADE_UP_TOKEN = "made-up-token-not-secret";
const MADE_UP_ACCOUNT = "made-up-account";

/** One deployment as Cloudflare lists it. */
const dep = (id, commit, created, { env = "production", status = "success", stage = "deploy" } = {}) => ({
  id,
  environment: env,
  created_on: created,
  deployment_trigger: { metadata: { commit_hash: commit } },
  latest_stage: { name: stage, status },
});

const LIST = [
  dep("d3", C3, "2026-11-17T10:00:00Z"),
  dep("p1", C3, "2026-11-17T09:30:00Z", { env: "preview" }),
  dep("dfail", C2, "2026-11-17T09:00:00Z", { status: "failure" }),
  dep("d2", C2, "2026-11-16T10:00:00Z"),
  dep("d1", C1, "2026-11-15T10:00:00Z"),
];

test("only finished production releases count, newest first", () => {
  const r = productionReleases(LIST);
  assert.deepEqual(r.map((d) => d.id), ["d3", "d2", "d1"]);
  assert.equal(r[0].commit, C3);
});

test("by default the release before the live one is put back", () => {
  const t = pickTarget(productionReleases(LIST), { live: "d3" });
  assert.equal(t.ok, true);
  assert.equal(t.target.id, "d2");
});

test("after one put-back, the next goes one further back, not forward again", () => {
  const t = pickTarget(productionReleases(LIST), { live: "d2" });
  assert.equal(t.target.id, "d1");
});

test("a release of the same commit as the live one is skipped", () => {
  const list = [dep("d4", C3, "2026-11-17T11:00:00Z"), ...LIST];
  const t = pickTarget(productionReleases(list), { live: "d4" });
  assert.equal(t.target.id, "d2");
});

test("--to picks a release by the start of its commit", () => {
  const t = pickTarget(productionReleases(LIST), { live: "d3", to: C1.slice(0, 8) });
  assert.equal(t.target.id, "d1");
});

test("--to refuses a commit with no finished release, the live one, or too short a start", () => {
  const r = productionReleases(LIST);
  assert.match(pickTarget(r, { live: "d3", to: "9999999" }).why, /no finished release/);
  assert.match(pickTarget(r, { live: "d3", to: C3.slice(0, 8) }).why, /already live/);
  assert.match(pickTarget(r, { live: "d3", to: "22" }).why, /at least 7/);
});

test("with nothing older than the live release, nothing is put back", () => {
  const t = pickTarget(productionReleases([dep("d1", C1, "2026-11-15T10:00:00Z")]), { live: "d1" });
  assert.equal(t.ok, false);
  assert.match(t.why, /nothing older/);
});

/** A made-up Cloudflare API: records each call and answers from the given tables. */
function cloudflare({ live = "d3", list = LIST, rollback = { success: true } } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", auth: init.headers?.Authorization });
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url.endsWith("/deployments/d2/rollback") || /\/deployments\/[\w-]+\/rollback$/.test(url)) return json({ ...rollback, errors: rollback.errors ?? [] });
    if (url.includes("/deployments?")) return json({ success: true, result: list, result_info: { total_pages: 1 } });
    if (url.endsWith("/pages/projects/hifth-app")) return json({ success: true, result: { canonical_deployment: { id: live } } });
    return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ code: 7003, message: "not found" }] }) };
  };
  return { calls, fetch };
}

const env = { CLOUDFLARE_API_TOKEN: MADE_UP_TOKEN, CLOUDFLARE_ACCOUNT_ID: MADE_UP_ACCOUNT };

test("put back asks Cloudflare to make the previous release live, then looks at the live site for its commit", async () => {
  const cf = cloudflare();
  const looked = [];
  const out = [];
  const ok = await putBack({ env, fetch: cf.fetch, verify: async (c) => (looked.push(c), true), say: (l) => out.push(l) });
  assert.equal(ok, true);
  const post = cf.calls.find((c) => c.method === "POST");
  assert.match(post.url, /\/accounts\/made-up-account\/pages\/projects\/hifth-app\/deployments\/d2\/rollback$/);
  assert.equal(post.auth, `Bearer ${MADE_UP_TOKEN}`);
  assert.deepEqual(looked, [C2]);
  const text = out.join("\n");
  assert.ok(!text.includes(MADE_UP_TOKEN) && !text.includes(MADE_UP_ACCOUNT), "never prints the key or the account");
  assert.match(text, /22222222/);
});

test("a dry run says what it would put back and changes nothing", async () => {
  const cf = cloudflare();
  const out = [];
  const ok = await putBack({ env, dry: true, fetch: cf.fetch, verify: async () => assert.fail("no look on a dry run"), say: (l) => out.push(l) });
  assert.equal(ok, true);
  assert.equal(cf.calls.filter((c) => c.method === "POST").length, 0);
  assert.match(out.join("\n"), /would put back/i);
});

test("without the saved keys it refuses before asking Cloudflare anything", async () => {
  const cf = cloudflare();
  const out = [];
  const ok = await putBack({ env: {}, fetch: cf.fetch, verify: async () => true, say: (l) => out.push(l) });
  assert.equal(ok, false);
  assert.equal(cf.calls.length, 0);
  assert.match(out.join("\n"), /CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID not loaded/);
});

test("a refused rollback says so, says the live site is unchanged, and does not look", async () => {
  const cf = cloudflare({ rollback: { success: false, errors: [{ code: 8000000, message: "made-up refusal" }] } });
  const out = [];
  const ok = await putBack({ env, fetch: cf.fetch, verify: async () => assert.fail("no look after a refusal"), say: (l) => out.push(l) });
  assert.equal(ok, false);
  assert.match(out.join("\n"), /made-up refusal/);
  assert.match(out.join("\n"), /unchanged/);
});

test("the list command marks the live release and prints no key", async () => {
  const cf = cloudflare();
  const out = [];
  const ok = await putBack({ env, list: true, fetch: cf.fetch, verify: async () => true, say: (l) => out.push(l) });
  assert.equal(ok, true);
  const text = out.join("\n");
  assert.match(text, /33333333.*live/);
  assert.match(text, /11111111/);
  assert.ok(!text.includes(MADE_UP_TOKEN));
  assert.equal(cf.calls.filter((c) => c.method === "POST").length, 0);
});

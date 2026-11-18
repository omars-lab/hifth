// The store-crashes command, against a made-up key and a made-up App Store Connect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CRASH_FIELDS, run, toCrashes } from "./store-crashes.mjs";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const KEY = privateKey.export({ type: "pkcs8", format: "pem" });
const ENV = { ASC_KEY_ID: "ABCDE12345", ASC_ISSUER_ID: "00000000-0000-0000-0000-000000000000" };
const readKey = () => KEY;

// A tester's own words and address, planted where Apple keeps them. They must never come out.
const COMMENT = "made-up tester comment about page 45";
const EMAIL = "made-up-tester@example.invalid";

const crash = (id, date, build) => ({
  type: "betaFeedbackCrashSubmissions",
  id,
  attributes: { createdDate: date, deviceModel: "iPad14,1", osVersion: "18.5", appPlatform: "IOS", comment: COMMENT, email: EMAIL },
  relationships: { build: { data: { type: "builds", id: build } } },
});

/** A pretend App Store Connect with two test crashes and one build's grouped freezes. */
function fakeStore(calls = [], { refuse = false } = {}) {
  return async (url) => {
    calls.push(url);
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    if (refuse) return json({ errors: [{ detail: "made-up refusal" }] }, 403);
    if (url.includes("/v1/apps?filter[bundleId]="))
      return json({ data: [{ type: "apps", id: "999", attributes: { bundleId: "com.bytesofpurpose.hifth" } }] });
    if (url.includes("/v1/apps/999/betaFeedbackCrashSubmissions"))
      return json({
        data: [crash("c1", "2026-11-16T08:00:00Z", "b7"), crash("c2", "2026-11-17T09:30:00Z", "b8")],
        included: [
          { type: "builds", id: "b7", attributes: { version: "7" } },
          { type: "builds", id: "b8", attributes: { version: "8" } },
        ],
      });
    if (url.includes("/v1/builds?filter[app]=999"))
      return json({ data: [{ type: "builds", id: "b8", attributes: { version: "8" } }] });
    if (url.includes("/v1/builds/b8/diagnosticSignatures"))
      return json({
        data: [
          { type: "diagnosticSignatures", id: "s1", attributes: { diagnosticType: "LAUNCHES", signature: "Hifth ShellModel.load()", weight: 0.2 } },
          { type: "diagnosticSignatures", id: "s2", attributes: { diagnosticType: "HANGS", signature: 'Hifth "Page".layout()', weight: 0.7 } },
        ],
      });
    return json({ errors: [{ detail: "not in the made-up store" }] }, 404);
  };
}

const setup = (opts) => {
  const dir = mkdtempSync(join(tmpdir(), "store-crashes-"));
  const lines = [];
  const calls = [];
  const go = (...argv) => run(argv, { env: ENV, dir, readKey, fetch: fakeStore(calls, opts), out: (l) => lines.push(l) });
  return { dir, lines, calls, go };
};

test("list prints each test crash newest first, then freezes and slow launches heaviest first", async () => {
  const { lines, go } = setup();
  assert.equal(await go("list"), 0);
  assert.deepEqual(lines, [
    "ev=test_crash date=2026-11-17T09:30:00Z build=8 device=iPad14,1 os=18.5 platform=IOS",
    "ev=test_crash date=2026-11-16T08:00:00Z build=7 device=iPad14,1 os=18.5 platform=IOS",
    'ev=signature build=8 kind=froze weight=0.70 where="Hifth_Page.layout()"',
    'ev=signature build=8 kind=slow_to_open weight=0.20 where="Hifth_ShellModel.load()"',
    "ev=done test_crashes=2 signatures=2 builds=1",
  ]);
});

test("a tester's comment and email are never asked for, printed or kept", async () => {
  const { dir, lines, calls, go } = setup();
  await go("list");
  const asked = calls.find((u) => u.includes("betaFeedbackCrashSubmissions"));
  assert.ok(asked.includes(`fields[betaFeedbackCrashSubmissions]=${CRASH_FIELDS.join(",")}`), "names the fields it wants");
  assert.doesNotMatch(asked, /comment|email/);
  const kept = readFileSync(join(dir, "crashes.json"), "utf8");
  for (const text of [lines.join("\n"), kept]) {
    assert.ok(!text.includes(COMMENT) && !text.includes("page 45"), "no comment");
    assert.ok(!text.includes(EMAIL), "no email");
  }
});

test("--since keeps only newer test crashes", async () => {
  const { lines, go } = setup();
  await go("list", "--since", "2026-11-17T00:00:00Z");
  assert.equal(lines.filter((l) => l.startsWith("ev=test_crash")).length, 1);
  assert.match(lines.at(-1), /test_crashes=1 /);
});

test("a refusal from Apple fails the run with its status, never an empty list", async () => {
  const { lines, go } = setup({ refuse: true });
  await assert.rejects(go("list"), /answered 403/);
  assert.ok(!lines.some((l) => l.startsWith("ev=done")));
});

test("an unknown command prints the usage and exits 2", async () => {
  const { lines, go } = setup();
  assert.equal(await go("pull"), 2);
  assert.match(lines[0], /usage/);
});

test("toCrashes reads the build's number from the included builds", () => {
  const [c] = toCrashes({ data: [crash("c1", "2026-11-16T08:00:00Z", "b7")], included: [{ type: "builds", id: "b7", attributes: { version: "7" } }] });
  assert.equal(c.build, "7");
  assert.ok(!("comment" in c) && !("email" in c));
});

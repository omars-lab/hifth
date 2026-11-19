// The daily tidy of the Mac-app list (lib/tidy.mjs, run by the Worker in tidy/).
// No network: a stand-in fetch plays Supabase. Every address and key here is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runTidy } from "./tidy.mjs";

const ENV = {
  SUPABASE_URL: "https://list.example.test/",
  SUPABASE_PUBLISHABLE_KEY: "made-up-publishable",
  LIST_KEY: "made-up-list-key",
};

/** A stand-in for Supabase that answers every call with `status` and `body`, and remembers the calls. */
function fakeList(status = 200, body = "3") {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status });
  };
  return { fetch, calls };
}

const quiet = () => {
  const lines = [];
  return { log: (l) => lines.push(l), lines };
};

test("asks the list's tidy function once, with the site's list key", async () => {
  const { fetch, calls } = fakeList();
  await runTidy(ENV, { fetch, log: quiet().log });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://list.example.test/rest/v1/rpc/notify_tidy");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.apikey, "made-up-publishable");
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_key: "made-up-list-key" });
});

test("says how many unconfirmed addresses went, and nothing about who", async () => {
  const { fetch } = fakeList(200, "3");
  const { log, lines } = quiet();
  assert.equal(await runTidy(ENV, { fetch, log }), 3);
  assert.deepEqual(lines, ["ev=tidy_start", "ev=tidy_ok removed=3"]);
});

test("a sleeping or refusing list fails the run, so Cloudflare shows it as failed", async () => {
  for (const status of [503, 401, 500]) {
    const { fetch } = fakeList(status, '{"message":"paused"}');
    const { log, lines } = quiet();
    await assert.rejects(runTidy(ENV, { fetch, log }));
    assert.equal(lines.at(-1), `ev=tidy_failed status=${status}`);
  }
});

test("a network failure fails the run without writing the list's address", async () => {
  const fetch = async () => {
    throw new TypeError("fetch failed: https://list.example.test/rest/v1/rpc/notify_tidy");
  };
  const { log, lines } = quiet();
  await assert.rejects(runTidy(ENV, { fetch, log }));
  assert.equal(lines.at(-1), "ev=tidy_failed status=none");
  assert.ok(!lines.join("\n").includes("example.test"));
});

test("an answer that is not a count fails the run", async () => {
  const { fetch } = fakeList(200, '[{"email":"someone@example.com"}]');
  const { log, lines } = quiet();
  await assert.rejects(runTidy(ENV, { fetch, log }));
  assert.equal(lines.at(-1), "ev=tidy_failed status=200 why=not_a_count");
  assert.ok(!lines.join("\n").includes("someone@"));
});

test("missing settings fail the run and name the settings, never their values", async () => {
  const { fetch, calls } = fakeList();
  const { log, lines } = quiet();
  await assert.rejects(runTidy({ SUPABASE_URL: "https://list.example.test" }, { fetch, log }));
  assert.equal(calls.length, 0);
  assert.deepEqual(lines, ["ev=tidy_skipped missing=SUPABASE_PUBLISHABLE_KEY,LIST_KEY"]);
});

test("the Worker runs the tidy on its timer", async () => {
  const { default: worker } = await import("../tidy/worker.mjs");
  assert.equal(typeof worker.scheduled, "function");
  assert.equal(worker.fetch, undefined, "it answers no web requests");
  const { fetch, calls } = fakeList(200, "0");
  const saved = { fetch: globalThis.fetch, log: console.log };
  globalThis.fetch = fetch;
  console.log = () => {};
  try {
    await worker.scheduled({ cron: "17 4 * * *" }, ENV, { waitUntil() {} });
  } finally {
    globalThis.fetch = saved.fetch;
    console.log = saved.log;
  }
  assert.equal(calls.length, 1);
});

test("the Worker's settings: one run a day, no web address, no secret in the file", () => {
  const text = readFileSync(new URL("../tidy/wrangler.toml", import.meta.url), "utf8");
  const live = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const crons = live.match(/crons\s*=\s*\[([^\]]*)\]/);
  assert.ok(crons, "it has a timer");
  const times = crons[1].split(",").map((s) => s.trim()).filter(Boolean);
  assert.equal(times.length, 1, "one timer");
  const [minute, hour, ...rest] = JSON.parse(times[0]).split(/\s+/);
  assert.match(minute, /^\d+$/);
  assert.match(hour, /^\d+$/, "once a day, at a set hour");
  assert.deepEqual(rest, ["*", "*", "*"]);
  assert.match(live, /^workers_dev\s*=\s*false/m, "no workers.dev address");
  assert.match(live, /^preview_urls\s*=\s*false/m, "no preview address");
  assert.doesNotMatch(live, /supabase\.co|SUPABASE_|LIST_KEY|\[vars\]/i, "settings go in as secrets, never in this file");
});

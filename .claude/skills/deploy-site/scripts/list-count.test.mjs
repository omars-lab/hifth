import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY, countFrom } from "./list-count.mjs";

// wrangler d1 execute --json answers with a list of results, one per statement.
const answer = (rows) => JSON.stringify([{ results: rows, success: true, meta: {} }]);

test("the count comes out of Cloudflare's answer", () => {
  assert.deepEqual(countFrom(answer([{ n: 3 }])), { count: 3 });
  assert.deepEqual(countFrom(answer([{ n: 0 }])), { count: 0 });
});

test("an answer holding anything but the count is refused, never printed", () => {
  // As if the query had been changed to fetch the rows themselves.
  const leaked = countFrom(answer([{ email: "someone@example.com", created_at: "2026-11-12" }]));
  assert.ok(leaked.error);
  assert.ok(!JSON.stringify(leaked).includes("example.com"));
  assert.ok(countFrom(answer([{ n: 1 }, { n: 2 }])).error);
  assert.ok(countFrom(answer([{ n: 1, email: "someone@example.com" }])).error);
  assert.ok(countFrom(answer([{ n: "3" }])).error);
  assert.ok(countFrom("not json").error);
});

test("the question asked is the count alone", () => {
  assert.match(QUERY, /^SELECT COUNT\(\*\) AS n FROM notify$/);
});

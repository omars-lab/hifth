import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY, countFrom, pgEnvFrom } from "./list-count.mjs";

// psql -At prints the query's one value: here, a small JSON object of two counts.
test("the counts come out of the database's answer", () => {
  assert.deepEqual(countFrom('{"confirmed" : 3, "waiting" : 1}\n'), { confirmed: 3, waiting: 1 });
  assert.deepEqual(countFrom('{"confirmed":0,"waiting":0}'), { confirmed: 0, waiting: 0 });
});

test("an answer holding anything but the two counts is refused, never printed", () => {
  // As if the query had been changed to fetch the rows themselves.
  const leaked = countFrom('{"email":"someone@example.com","signed_up_at":"2026-11-12"}');
  assert.ok(leaked.error);
  assert.ok(!JSON.stringify(leaked).includes("example.com"));
  assert.ok(countFrom('{"confirmed":1,"waiting":0,"email":"someone@example.com"}').error);
  assert.ok(countFrom('{"confirmed":"3","waiting":0}').error);
  assert.ok(countFrom('{"confirmed":-1,"waiting":0}').error);
  assert.ok(countFrom("someone@example.com").error);
  assert.ok(countFrom('{"confirmed":1,"waiting":0}\n{"confirmed":2,"waiting":0}').error);
  assert.ok(countFrom("").error);
});

test("the question asked is the two counts alone", () => {
  assert.match(QUERY, /^select json_build_object\('confirmed', count\(\*\) filter \(where confirmed_at is not null\), 'waiting', count\(\*\) filter \(where confirmed_at is null\)\) from notify\.people$/);
});

test("the database address is split into psql's own settings, so the password is never on a command line", () => {
  const env = pgEnvFrom("postgresql://made-up-user:made%40up-pass@db.example.test:6543/postgres");
  assert.deepEqual(env, { PGHOST: "db.example.test", PGPORT: "6543", PGUSER: "made-up-user", PGPASSWORD: "made@up-pass", PGDATABASE: "postgres", PGSSLMODE: "require" });
  // On this laptop, a local copy needs no encryption.
  assert.equal(pgEnvFrom("postgresql://postgres:postgres@127.0.0.1:56322/postgres").PGSSLMODE, "disable");
  assert.equal(pgEnvFrom("not an address"), null);
  assert.equal(pgEnvFrom("https://example.test/"), null);
});

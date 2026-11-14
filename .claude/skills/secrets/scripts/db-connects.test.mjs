// The database check prints one word and never the address or psql's message.
//
// Every address here is made up and points at a closed local port, so it is always refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "db-connects.mjs");
const MADE_UP = "postgresql://made_up_user.madeupref:made-up-password-123@127.0.0.1:1/postgres";

const run = (env) => spawnSync(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("a refused address prints only 'refused' and the entry's name", () => {
  const r = run({ SUPABASE_DB_URL: MADE_UP });
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim(), "refused: SUPABASE_DB_URL");
  for (const part of ["made_up_user", "madeupref", "made-up-password-123", "127.0.0.1"]) {
    assert.ok(!r.stdout.includes(part) && !r.stderr.includes(part), `printed ${part}`);
  }
});

test("with a key file, two copies of one address match and a different address does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "db-connects-"));
  const k1 = join(dir, "k1");
  const k2 = join(dir, "k2");
  const fp = (url, key) => {
    const r = spawnSync(process.execPath, [SCRIPT, "--salt-file", key], { env: { PATH: process.env.PATH, SUPABASE_DB_URL: url }, encoding: "utf8" });
    assert.ok(!r.stdout.includes(readFileSync(key, "utf8")), "the key is never printed");
    return r.stdout.match(/fingerprint ([0-9a-f]{8})\)/)[1];
  };
  assert.equal(fp(MADE_UP, k1), fp(MADE_UP, k1));
  assert.notEqual(fp(MADE_UP, k1), fp(MADE_UP.replace("123", "456"), k1));
  assert.notEqual(fp(MADE_UP, k1), fp(MADE_UP, k2), "a new key gives a new fingerprint");
});

test("a missing entry says so and exits 2", () => {
  const r = run({});
  assert.equal(r.status, 2);
  assert.match(r.stdout, /missing: SUPABASE_DB_URL/);
});

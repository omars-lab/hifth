#!/usr/bin/env node
// Does the saved database address still let us in? Prints one word and nothing else.
//
// After a password reset, the leak is closed only when the new address connects and the old
// one is refused. psql's own error names the database user, which carries the project's id,
// so this never shows psql's output: it prints "connects" or "refused", and exits 0 or 1.
//
//   npx dotenvx run -q -f .env -- node .claude/skills/secrets/scripts/db-connects.mjs
//   npx dotenvx run -q -f <old>/.env.encrypted -fk .env.keys -- node .claude/skills/secrets/scripts/db-connects.mjs
//
// It reads SUPABASE_DB_URL (or the entry named by --name) from the environment.
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findPsql } from "../../../../packages/etl/scripts/lib/psql.mjs";

const i = process.argv.indexOf("--name");
const name = i > 0 ? process.argv[i + 1] : "SUPABASE_DB_URL";
const url = process.env[name];
if (!url) {
  console.log(`missing: ${name} is not set`);
  process.exit(2);
}

const r = spawnSync(findPsql(), [url, "-t", "-A", "-X", "-q", "-c", "select 1"], {
  env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE || "require", PGCONNECT_TIMEOUT: "10" },
  stdio: "ignore", // never show psql's message: it names the database user
  timeout: 20000,
});

// --salt-file <path>: also print 8 characters of a keyed hash of the address, so two saved
// copies can be told apart (same address, same 8 characters) without showing either. The
// key is random bytes kept in that file, made on first use; pass the same file to both runs,
// then delete it. The key never reaches the screen, so the 8 characters cannot be used to
// test guesses at the password.
const s = process.argv.indexOf("--salt-file");
let salt = "";
if (s > 0) {
  const path = process.argv[s + 1];
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
  salt = readFileSync(path, "utf8");
}
const fp = salt ? ` (fingerprint ${createHmac("sha256", salt).update(url).digest("hex").slice(0, 8)})` : "";

if (r.status === 0) {
  console.log(`connects: ${name}${fp}`);
  process.exit(0);
}
console.log(`refused: ${name}${r.error ? " (psql did not run)" : ""}${fp}`);
process.exit(1);

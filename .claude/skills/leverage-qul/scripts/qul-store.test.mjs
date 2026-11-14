/**
 * The store's move-and-check script (.claude/skills/leverage-qul/scripts/qul-store.mjs), tested offline: the parts that
 * decide whether two stores match and whether a store is closed, plus the settings file it
 * holds the live project to.
 *
 * The settings check was earned the hard way on 2026-11-13: `supabase config push` asks
 * "[Y/n]" and takes an empty answer as yes, so a preview run with no input pushed the file's
 * local defaults live (email confirmation off, sign-ups on). The file now keeps sign-ups and
 * the Data API off, and this test fails if it ever stops saying so.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TABLES,
  compareFingerprints,
  configProblems,
  fingerprintSql,
  folder,
  parseQueryOutput,
  postureProblems,
} from "./qul-store.mjs";

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "supabase", "config.toml");

test("the fingerprint query covers every table, ordered by its key, and returns no row text", () => {
  const sql = fingerprintSql();
  for (const { name, key } of TABLES) {
    assert.match(sql, new RegExp(`from public\\.${name} r`));
    assert.ok(sql.includes(`order by ${key}`), `${name} ordered by ${key}`);
  }
  // Only the name, a count and a hash come back.
  assert.doesNotMatch(sql, /select \*/);
});

test("query output is read whether it is wrapped with a boundary or a bare array", () => {
  const wrapped = 'Initialising login role...\n{"boundary":"x","rows":[{"t":"a","n":1}],"warning":"w"}';
  assert.deepEqual(parseQueryOutput(wrapped), [{ t: "a", n: 1 }]);
  assert.deepEqual(parseQueryOutput('[{"t":"b"}]'), [{ t: "b" }]);
  assert.throws(() => parseQueryOutput("nothing here"));
});

const fp = (n, h) => TABLES.map(({ name }) => ({ t: name, n, h }));

test("two stores match only when every table has the same count and the same rows", () => {
  assert.deepEqual(compareFingerprints(fp(3, "aa"), fp(3, "aa")), []);
  assert.equal(compareFingerprints(fp(3, "aa"), fp(2, "aa")).length, TABLES.length);
  const sameCountDifferentRows = compareFingerprints(fp(3, "aa"), fp(3, "bb"));
  assert.match(sameCountDifferentRows[0], /same row count \(3\) but the rows differ/);
  assert.match(compareFingerprints(fp(3, "aa"), fp(3, "aa").slice(1))[0], /missing on the new store/);
});

const UP_TO_DATE = ["API", "Auth", "DB", "Storage"].map((s) => `Remote ${s} config is up to date.`).join("\n");

test("a closed store has no posture problems", () => {
  const rows = [{ check_name: "sign-ups", found: 0 }, { check_name: "tables without row rules", found: "0" }];
  assert.deepEqual(postureProblems({ rows, sslText: "SSL is being enforced.", configText: UP_TO_DATE }), []);
});

test("each way a store can drift open is reported", () => {
  const rows = [{ check_name: "rights the public roles hold on tables", found: "4" }];
  const problems = postureProblems({
    rows,
    sslText: "SSL is *NOT* being enforced.",
    configText: UP_TO_DATE.replace("Remote Auth config is up to date.", "Updating Auth service with config"),
  });
  assert.deepEqual(problems, [
    "rights the public roles hold on tables: 4",
    "unencrypted connections are allowed",
    "live Auth settings differ from supabase/config.toml",
  ]);
});

test("the checked-in settings keep sign-ups and the Data API off", () => {
  assert.deepEqual(configProblems(readFileSync(CONFIG, "utf8")), []);
});

test("the settings check catches the defaults Supabase writes into a new settings file", () => {
  const defaults = [
    "[api]",
    "enabled = true",
    "[auth]",
    "enable_signup = true",
    "enable_anonymous_sign_ins = false",
    "[auth.email]",
    "enable_signup = true",
    "enable_confirmations = false",
    "[auth.sms]",
    "enable_signup = false",
  ].join("\n");
  const problems = configProblems(defaults);
  assert.equal(problems.length, 4);
  assert.match(problems.join("\n"), /\[api\] enabled should be false/);
  assert.match(problems.join("\n"), /\[auth\.email\] enable_confirmations should be true/);
});

test("every building script that talks to the store asks for an encrypted connection", () => {
  // The store refuses unencrypted connections; the scripts ask for encryption too, so a store
  // whose setting drifted back would still not be spoken to in the clear.
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  for (const name of ["qul-page-fixture.mjs", "qul-page-fixtures-all.mjs", "ingest-qul-supabase.mjs"]) {
    const src = readFileSync(join(ROOT, "packages", "etl", "scripts", name), "utf8");
    const calls = src.split('execFileSync(findPsql()').slice(1);
    assert.ok(calls.length > 0, `${name} still calls psql`);
    for (const call of calls) {
      assert.match(call.slice(0, 400), /PGSSLMODE: process\.env\.PGSSLMODE \|\| "require"/, `${name} asks for encryption`);
    }
  }
});

test("a folder given as ~/... is read from the home folder", async () => {
  const { homedir } = await import("node:os");
  assert.equal(folder("~/.supabase/workdirs/x"), join(homedir(), ".supabase", "workdirs", "x"));
  assert.equal(folder("/tmp/a~b"), "/tmp/a~b");
});

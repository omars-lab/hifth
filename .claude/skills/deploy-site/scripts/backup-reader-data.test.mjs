import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  STORES,
  d1DatabaseName,
  d1ExportCounts,
  insideGitCheckout,
  lastManifest,
  logLine,
  makeRunFolder,
  matchCounts,
  pgDumpCounts,
  poolerProblem,
  runName,
  runsToPrune,
  statusLines,
  unlistedTables,
  wholeCounts,
} from "./backup-reader-data.mjs";

// Made-up rows only, in the shapes pg_dump 18 and wrangler d1 export write them.
const PG = `--
-- PostgreSQL database dump
--

\\restrict madeuptoken

SET statement_timeout = 0;

COPY notify.people (email, lang, signed_up_at, confirmed_at, confirm_code, leave_code) FROM stdin;
one@example.test\ten\t2026-11-19 06:52:55+00\t\\N\taaaa\tbbbb
two@example.test\tar\t2026-11-19 06:52:55+00\t\\N\tcccc\tdddd
\\.


--
-- PostgreSQL database dump complete
--

\\unrestrict madeuptoken
`;
const D1 = `PRAGMA defer_foreign_keys=TRUE;
INSERT INTO "accounts" ("id","apple_user","created_at") VALUES('made-up-1','000000.madeup.0001',1700000000);
INSERT INTO "accounts" ("id","apple_user","created_at") VALUES('made-up-2','000000.madeup.0002',1700000001);
INSERT INTO "apple_tickets" ("account_id","sealed","app_id","created_at") VALUES('made-up-1','x','app.example',1700000000);
`;

// A git with no settings from whatever commit hook is running these tests (see the
// tests-running-git-use-fixture-env note): GIT_DIR would point git init at the real repo.
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

test("only the tables a restore needs are copied; the site's key and sign-in secrets stay out", () => {
  assert.deepEqual(STORES.list.tables, ["notify.people"]);
  assert.deepEqual(STORES.accounts.tables, ["accounts", "apple_tickets"]);
  assert.deepEqual(Object.keys(STORES.list.leftOut), ["notify.server_keys"]);
  assert.deepEqual(Object.keys(STORES.accounts.leftOut).sort(), ["d1_migrations", "sessions", "sign_in_counts", "sign_in_words"]);
  for (const s of Object.values(STORES)) for (const why of Object.values(s.leftOut)) assert.ok(why.length > 20, "each left-out table says why");
});

test("a table the store has that is neither copied nor named as left out is caught", () => {
  assert.deepEqual(unlistedTables("accounts", ["accounts", "apple_tickets", "sessions", "sign_in_words", "sign_in_counts", "d1_migrations", "_cf_KV", "_cf_METADATA", "sqlite_sequence"]), []);
  assert.deepEqual(unlistedTables("accounts", ["accounts", "apple_tickets", "reader_marks"]), ["reader_marks"]);
  assert.deepEqual(unlistedTables("list", ["notify.people", "notify.server_keys", "notify.waitlist"]), ["notify.waitlist"]);
});

test("the list's address is refused when it goes through the pooler that pg_dump cannot use", () => {
  assert.match(poolerProblem({ PGPORT: "6543", PGHOST: "aws-0-x.pooler.supabase.com" }), /6543/);
  assert.equal(poolerProblem({ PGPORT: "5432", PGHOST: "aws-0-x.pooler.supabase.com" }), null);
  assert.equal(poolerProblem({ PGPORT: "5432", PGHOST: "db.example.supabase.co" }), null);
});

test("a Postgres copy is counted table by table", () => {
  assert.deepEqual(pgDumpCounts(PG), { counts: { "notify.people": 2 } });
});

test("an empty or cut-short Postgres copy fails, and the error quotes nothing from it", () => {
  assert.equal(pgDumpCounts("").error, "the copy is empty");
  const noEnd = PG.slice(0, PG.indexOf("-- PostgreSQL database dump complete"));
  assert.match(pgDumpCounts(noEnd).error, /cut short/);
  const openTable = PG.replace("\\.\n", "").replace("\n\n\n--\n-- PostgreSQL database dump complete", "\n-- PostgreSQL database dump complete");
  assert.match(pgDumpCounts(openTable).error, /never ends/);
  for (const r of [pgDumpCounts(noEnd), pgDumpCounts(openTable)]) assert.ok(!JSON.stringify(r).includes("example.test"));
});

test("an accounts copy is counted table by table", () => {
  assert.deepEqual(d1ExportCounts(D1), { counts: { accounts: 2, apple_tickets: 1 } });
  assert.deepEqual(d1ExportCounts("PRAGMA defer_foreign_keys=TRUE;\n"), { counts: {} });
});

test("an empty or cut-short accounts copy fails, and the error quotes nothing from it", () => {
  assert.equal(d1ExportCounts("").error, "the copy is empty");
  const cut = D1.slice(0, D1.lastIndexOf("1700000000);") + 5);
  assert.match(d1ExportCounts(cut).error, /cut short/);
  assert.match(d1ExportCounts("hello\n").error, /does not start/);
  assert.ok(!JSON.stringify(d1ExportCounts(cut)).includes("madeup"));
});

test("a copy whose rows differ from the store's own count fails", () => {
  assert.deepEqual(matchCounts({ "notify.people": 2 }, { "notify.people": 2 }), { ok: true });
  assert.deepEqual(matchCounts({}, { apple_tickets: 0 }), { ok: true });
  assert.match(matchCounts({ "notify.people": 1 }, { "notify.people": 2 }).error, /notify\.people/);
  assert.match(matchCounts({ accounts: 2 }, { accounts: 2, apple_tickets: 1 }).error, /apple_tickets/);
});

test("a store's count answer is taken only when it is whole numbers for exactly the asked tables", () => {
  assert.deepEqual(wholeCounts({ accounts: 2, apple_tickets: 0 }, ["accounts", "apple_tickets"]), { accounts: 2, apple_tickets: 0 });
  assert.equal(wholeCounts({ accounts: "2", apple_tickets: 0 }, ["accounts", "apple_tickets"]), null);
  assert.equal(wholeCounts({ accounts: 2, apple_tickets: 0, email: 1 }, ["accounts", "apple_tickets"]), null);
  assert.equal(wholeCounts({ accounts: -1, apple_tickets: 0 }, ["accounts", "apple_tickets"]), null);
  assert.equal(wholeCounts(null, ["accounts"]), null);
});

test("copies are refused inside any git checkout, and made owner-only outside one", () => {
  const root = mkdtempSync(join(tmpdir(), "backup-test-"));
  try {
    const repo = join(root, "some-repo");
    mkdirSync(repo);
    assert.equal(spawnSync("git", ["init", "-q", repo], { env: cleanEnv() }).status, 0);
    assert.equal(insideGitCheckout(join(repo, "deep/not/made/yet")), true);
    assert.match(makeRunFolder(join(repo, "backups")).error, /inside a git checkout/);

    const out = join(root, "outside/copies");
    assert.equal(insideGitCheckout(out), false);
    const { dir } = makeRunFolder(out, new Date("2026-11-19T07:00:00.123Z"));
    assert.ok(dir.endsWith("2026-11-19T07-00-00Z"));
    assert.equal(statSync(out).mode & 0o777, 0o700);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pruning keeps the newest runs and touches nothing that is not a run folder", () => {
  const names = ["2026-11-01T00-00-00Z", "notes", "2026-11-03T00-00-00Z", "2026-11-02T00-00-00Z", "last-drill.json"];
  assert.deepEqual(runsToPrune(names, 2), ["2026-11-01T00-00-00Z"]);
  assert.deepEqual(runsToPrune(names, 30), []);
  assert.equal(runName(new Date("2026-11-19T07:08:09.5Z")), "2026-11-19T07-08-09Z");
});

test("the last manifest is the newest run's", () => {
  const out = mkdtempSync(join(tmpdir(), "backup-test-"));
  try {
    for (const [run, ok] of [["2026-11-17T00-00-00Z", true], ["2026-11-18T00-00-00Z", false]]) {
      mkdirSync(join(out, run));
      writeFileSync(join(out, run, "manifest.json"), JSON.stringify({ at: run.replace(/T(\d\d)-(\d\d)-(\d\d)Z/, "T$1:$2:$3Z"), ok }));
    }
    assert.equal(lastManifest(out).run, "2026-11-18T00-00-00Z");
    assert.equal(lastManifest(join(out, "none")), null);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the status says when the last copy was made, and calls it stale past the limit or when it failed", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(statusLines({ manifest: null, drillAt: null, now }).stale, true);
  const fresh = statusLines({ manifest: { run: "r", at: "2026-11-19T01:00:00Z", ok: true }, drillAt: "2026-11-18T00:00:00Z", now });
  assert.equal(fresh.stale, false);
  assert.match(fresh.lines.join("\n"), /0 days ago, complete/);
  assert.match(fresh.lines.join("\n"), /practised restore \(made-up rows\): 1 day ago/);
  assert.equal(statusLines({ manifest: { run: "r", at: "2026-11-15T00:00:00Z", ok: true }, drillAt: null, now }).stale, true);
  assert.equal(statusLines({ manifest: { run: "r", at: "2026-11-19T01:00:00Z", ok: false }, drillAt: null, now }).stale, true);
  const listOnly = statusLines({ manifest: null, drillAt: "2026-11-18T00:00:00Z", drillStores: ["list"], now });
  assert.match(listOnly.lines.join("\n"), /made-up rows, for list\): 1 day ago/);
});

test("log lines are ev= lines whose values hold no row content", () => {
  const line = logLine("store_ok", { store: "list", "rows.notify.people": 3, oops: "one@example.test leaked" }, new Date("2026-11-19T00:00:00Z"));
  assert.match(line, /^2026-11-19T00:00:00\.000Z pid=\d+ ev=store_ok store=list rows\.notify\.people=3 oops=\?$/);
  assert.match(logLine("store_failed", { store: "list", msg: 'the copy is "empty"' }), / msg="the copy is 'empty'"$/);
});

test("the accounts database is found only in a d1 block bound as ACCOUNTS", () => {
  const toml = 'name = "x"\n\n[[d1_databases]]\nbinding = "ACCOUNTS"\ndatabase_name = "made-up-accounts"\ndatabase_id = "0"\n';
  assert.equal(d1DatabaseName(toml), "made-up-accounts");
  assert.equal(d1DatabaseName('name = "x"\n'), null);
  assert.equal(d1DatabaseName(toml.replace("ACCOUNTS", "OTHER")), null);
});

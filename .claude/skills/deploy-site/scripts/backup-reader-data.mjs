#!/usr/bin/env node
/**
 * Copies what readers have given hifth.app off the hosts that hold it, onto this laptop, and
 * proves a copy can be put back. Counts only ever reach the screen or the log: no address, no
 * account, no row.
 *
 *   make hifth-app-backup                              copy the real stores (the owner says yes first)
 *   make hifth-app-backup-drill                        the whole round trip on made-up rows, here
 *     ARGS="--accounts-migrations <folder>"            practise accounts from the sign-in branch
 *   make hifth-app-backup-status                       when the last copy and the last drill were
 *
 * Two stores, each a row in STORES:
 *   list      the "tell me when the Mac app is out" list, in Supabase (schema notify). Only
 *             notify.people is copied; notify.server_keys holds the site's own key and stays out.
 *   accounts  the sign-in database on Cloudflare (D1). Only accounts and apple_tickets are copied:
 *             sign-in sessions and one-time words are secrets a restore does not need, because a
 *             reader can sign in again. Switched on only when the site's wrangler.toml names the
 *             database, which it does once sign-in is merged.
 *
 * A copy is checked before it counts: it must not be empty, a Postgres copy must end with its
 * "dump complete" line, and the rows in each copy must match a count asked of the store itself.
 * Copies go to a folder outside any git checkout, owner-only, one folder per run, with a
 * manifest of the counts. Item ㉘ of docs/design/app-store-launch.md says why, and what still
 * waits on the owner (where copies live, how long, whether they are locked, the schedule).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgEnvFrom } from "./list-count.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const LANDING = join(REPO, "apps/landing");
/** Where copies and the drill stamp live: outside every repo, owner-only. Tests point it elsewhere. */
export const BACKUP_HOME = process.env.HIFTH_BACKUP_HOME || join(homedir(), "Library/Application Support/hifth-backups");
const COPIES = join(BACKUP_HOME, "copies");

/**
 * What each store holds: the tables copied, and every other table, named with why it stays out.
 * A table the store has that is in neither list stops the copy (see unlistedTables), so a new
 * table, such as one holding readers' marks, cannot be left out of the copies without anyone
 * deciding it.
 */
export const STORES = {
  list: {
    kind: "postgres",
    tables: ["notify.people"],
    leftOut: {
      "notify.server_keys": "the site's own key; a restore makes a new one, and a copy of it is a leak",
    },
  },
  accounts: {
    kind: "d1",
    tables: ["accounts", "apple_tickets"],
    leftOut: {
      sessions: "sign-ins; after a restore each reader signs in again, and a copy would let anyone holding it sign in as them",
      sign_in_words: "one-time words that run out in minutes; nothing to put back",
      sign_in_counts: "how many words went out in each ten minutes, by everyone together; rebuilt as sign-ins happen",
      d1_migrations: "Cloudflare's note of which migrations ran; the restore runs them itself",
    },
  },
};

/** The store's own bookkeeping tables, never ours to copy or name. */
const INTERNAL = /^(sqlite_|_cf_)/;

/** Tables `store` has that are neither copied nor named as left out. Empty means all is decided. */
export function unlistedTables(store, names) {
  const s = STORES[store];
  return names.filter((n) => !INTERNAL.test(n) && !s.tables.includes(n) && !(n in s.leftOut));
}

/** Why a Postgres address cannot be copied from, or null. pg_dump cannot work through Supabase's
 *  transaction pooler (port 6543); the direct or session address (port 5432) works. */
export function poolerProblem(pg) {
  return pg.PGPORT === "6543" ? "the list's address goes through the pooler on port 6543, which pg_dump cannot use; save the session address (port 5432) instead" : null;
}

// ---------------------------------------------------------------------------------------------
// Checks on a copy. Each answers with counts or an error; an error never quotes the copy.

/** Rows per table in a data-only Postgres dump, or an error when it is empty or cut short. */
export function pgDumpCounts(text) {
  const s = String(text);
  if (!s.trim()) return { error: "the copy is empty" };
  if (!/^-- PostgreSQL database dump complete$/m.test(s)) return { error: "the copy is cut short (no end line)" };
  const counts = {};
  const lines = s.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^COPY ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*) \(.*\) FROM stdin;$/.exec(lines[i]);
    if (!m) continue;
    let n = 0;
    for (i++; i < lines.length && lines[i] !== "\\."; i++) n++;
    if (i >= lines.length) return { error: "the copy is cut short (a table never ends)" };
    counts[m[1]] = n;
  }
  return { counts };
}

/** Rows per table in a data-only D1 export, or an error when it is empty or cut short. */
export function d1ExportCounts(text) {
  const lines = String(text).split("\n").filter((l) => l.trim());
  if (!lines.length) return { error: "the copy is empty" };
  if (lines[0] !== "PRAGMA defer_foreign_keys=TRUE;") return { error: "the copy does not start the way an export does" };
  const counts = {};
  for (const line of lines.slice(1)) {
    const m = /^INSERT INTO "([a-z_][a-z0-9_]*)" \(.*\);$/.exec(line);
    if (!m) return { error: "the copy holds a line that is not a whole row (cut short?)" };
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  return { counts };
}

/**
 * Whether a copy holds exactly the rows the store said it has, table by table. A table the
 * store counted as empty may be missing from the copy; any other difference is an error.
 */
export function matchCounts(fromCopy, fromStore) {
  const tables = new Set([...Object.keys(fromCopy), ...Object.keys(fromStore)]);
  const off = [...tables].filter((t) => (fromCopy[t] ?? 0) !== (fromStore[t] ?? 0)).sort();
  if (!off.length) return { ok: true };
  return { error: `rows differ from the store's own count for ${off.join(", ")} (did it change while copying? run again)` };
}

/** A count answer: an object of whole numbers only, or null. */
export function wholeCounts(answer, tables) {
  if (!answer || typeof answer !== "object") return null;
  const out = {};
  for (const t of tables) {
    const n = answer[t];
    if (!Number.isInteger(n) || n < 0) return null;
    out[t] = n;
  }
  return Object.keys(answer).length === tables.length ? out : null;
}

// ---------------------------------------------------------------------------------------------
// Where copies go.

const gitFreeEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

/** True when `dir` (or the nearest folder above it that exists) is inside any git checkout. */
export function insideGitCheckout(dir) {
  let at = resolve(dir);
  while (!existsSync(at)) at = dirname(at);
  const r = spawnSync("git", ["-C", at, "rev-parse", "--is-inside-work-tree"], { env: gitFreeEnv(), encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() === "true";
}

/** The folder name for a run at `date`: sortable, and the only shape pruning will ever touch. */
export const runName = (date) => date.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
const RUN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;

/** Run folders past the newest `keep`, oldest first; nothing that is not a run folder. */
export function runsToPrune(names, keep) {
  const runs = names.filter((n) => RUN.test(n)).sort();
  return runs.slice(0, Math.max(0, runs.length - keep));
}

/** The newest run folder's manifest, or null. */
export function lastManifest(out) {
  if (!existsSync(out)) return null;
  const runs = readdirSync(out).filter((n) => RUN.test(n)).sort().reverse();
  for (const r of runs) {
    const p = join(out, r, "manifest.json");
    if (existsSync(p)) {
      try {
        return { run: r, ...JSON.parse(readFileSync(p, "utf8")) };
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The log: ev= lines with counts and plain words only.

const SAFE = /^[A-Za-z0-9_.:/@+-]*$/;
/** One log line. A value with anything but plain token characters goes in a quoted msg only if it is a fixed message. */
export function logLine(ev, fields = {}, now = new Date()) {
  const parts = [now.toISOString(), `pid=${process.pid}`, `ev=${ev}`];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "msg") continue;
    const s = String(v);
    parts.push(`${k}=${SAFE.test(s) ? s : "?"}`);
  }
  if (fields.msg) parts.push(`msg="${String(fields.msg).replace(/"/g, "'")}"`);
  return parts.join(" ");
}

function say(ev, fields) {
  console.log(logLine(ev, fields));
}

// ---------------------------------------------------------------------------------------------
// The site's Cloudflare settings: which accounts database, if any.

/** The accounts database's name from wrangler.toml text, or null when it names none. */
export function d1DatabaseName(toml) {
  const block = /\[\[d1_databases\]\]([\s\S]*?)(?=\n\[|$)/.exec(String(toml));
  if (!block) return null;
  if (!/^\s*binding\s*=\s*"ACCOUNTS"\s*$/m.test(block[1])) return null;
  const name = /^\s*database_name\s*=\s*"([a-z0-9-]+)"\s*$/m.exec(block[1]);
  return name ? name[1] : null;
}

// ---------------------------------------------------------------------------------------------
// Talking to the stores. Each returns { text } / { counts } or { error }; never a store's own words.

/** Whether `tool` can be started at all, so a missing tool is named, not mistaken for a failure. */
function hasTool(tool) {
  return !spawnSync(tool, ["--version"], { encoding: "utf8" }).error;
}

function libpq(tool) {
  const brew = `/opt/homebrew/opt/libpq/bin/${tool}`;
  if (existsSync(brew)) return brew;
  const r = spawnSync("which", [tool], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function pgCopy(address, file) {
  const pg = pgEnvFrom(address);
  if (!pg) return { error: "the list's address is not a postgres:// address" };
  const pooler = poolerProblem(pg);
  if (pooler) return { error: pooler };
  const dump = libpq("pg_dump");
  const psql = libpq("psql");
  if (!dump || !psql) return { error: "pg_dump or psql is not installed (brew install libpq)" };
  const env = { ...process.env, ...pg, SUPABASE_DB_URL: "" };
  const t = spawnSync(psql, ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", "select coalesce(string_agg(table_schema || '.' || table_name, ','), '') from information_schema.tables where table_schema = 'notify'"], { env, encoding: "utf8" });
  if (t.status !== 0) return { error: "the list did not say which tables it has" };
  const unlisted = unlistedTables("list", t.stdout.trim().split(",").filter(Boolean));
  if (unlisted.length) return { error: `the list has tables nobody decided to copy or leave out: ${unlisted.join(",")}; add each to STORES` };
  const d = spawnSync(dump, ["--data-only", "--no-owner", "--no-privileges", ...STORES.list.tables.map((t) => `--table=${t}`), "-f", file], { env, encoding: "utf8" });
  if (d.status !== 0) return { error: "pg_dump did not finish" };
  chmodSync(file, 0o600);
  const q = `select json_build_object(${STORES.list.tables.map((t) => `'${t}', (select count(*) from ${t})`).join(", ")})`;
  const c = spawnSync(psql, ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", q], { env, encoding: "utf8" });
  if (c.status !== 0) return { error: "the list did not answer its count" };
  let answer;
  try {
    answer = JSON.parse(c.stdout.trim());
  } catch {
    return { error: "the list's count was not readable" };
  }
  const counts = wholeCounts(answer, STORES.list.tables);
  return counts ? { counts } : { error: "the list's count held something other than counts" };
}

function d1Copy({ name, where, config, file }) {
  const base = ["d1"];
  const at = where === "local" ? ["--local"] : ["--remote"];
  const cfg = config ? ["--config", config] : [];
  const opts = { cwd: config ? dirname(config) : LANDING, encoding: "utf8", env: { ...process.env, CI: "1" } };
  if (!hasTool("wrangler")) return { error: "wrangler is not on the PATH (use the repo's Node, from .nvmrc)" };
  const t = spawnSync("wrangler", [...base, "execute", name, ...at, ...cfg, "--json", "--command", "select name from sqlite_master where type = 'table'"], opts);
  if (t.status !== 0) return { error: "the accounts database did not say which tables it has" };
  let names;
  try {
    names = JSON.parse(t.stdout)[0].results.map((r) => r.name);
  } catch {
    return { error: "the accounts table list was not readable" };
  }
  const unlisted = unlistedTables("accounts", names);
  if (unlisted.length) return { error: `the accounts database has tables nobody decided to copy or leave out: ${unlisted.join(",")}; add each to STORES` };
  const tables = STORES.accounts.tables.flatMap((t) => ["--table", t]);
  const e = spawnSync("wrangler", [...base, "export", name, ...at, ...cfg, ...tables, "--no-schema", "--output", file], opts);
  if (e.status !== 0) return { error: "the accounts export did not finish" };
  chmodSync(file, 0o600);
  const q = `select ${STORES.accounts.tables.map((t) => `(select count(*) from ${t}) as ${t}`).join(", ")}`;
  const c = spawnSync("wrangler", [...base, "execute", name, ...at, ...cfg, "--json", "--command", q], opts);
  if (c.status !== 0) return { error: "the accounts database did not answer its count" };
  let answer;
  try {
    answer = JSON.parse(c.stdout)[0].results[0];
  } catch {
    return { error: "the accounts count was not readable" };
  }
  const counts = wholeCounts(answer, STORES.accounts.tables);
  return counts ? { counts } : { error: "the accounts count held something other than counts" };
}

/** Copy one store into `dir`, check the copy, and answer with its counts or an error. A reader
 *  signing up between the copy and the count makes the two differ, so a mismatch is tried once
 *  more before it counts as a failure. */
function copyStore(store, dir, target, tries = 2) {
  const file = join(dir, `${store}.sql`);
  const got = store === "list" ? pgCopy(target.address, file) : d1Copy({ ...target, file });
  if (got.error) return got;
  const text = readFileSync(file, "utf8");
  const read = store === "list" ? pgDumpCounts(text) : d1ExportCounts(text);
  if (read.error) return read;
  const match = matchCounts(read.counts, got.counts);
  if (match.error) {
    if (tries > 1) {
      say("copy_retry", { store, msg: "the copy and the store's count differed; trying once more" });
      return copyStore(store, dir, target, tries - 1);
    }
    return match;
  }
  const sha256 = createHash("sha256").update(text).digest("hex");
  return { counts: got.counts, bytes: Buffer.byteLength(text), sha256 };
}

/** Make an owner-only run folder under `out`, refusing any place inside a git checkout. */
export function makeRunFolder(out, date = new Date()) {
  if (insideGitCheckout(out)) return { error: "the backup folder is inside a git checkout; copies of readers' data never go in a repo" };
  mkdirSync(out, { recursive: true, mode: 0o700 });
  chmodSync(out, 0o700);
  const dir = join(out, runName(date));
  mkdirSync(dir, { mode: 0o700 });
  return { dir };
}

/** One backup run over `targets` ({ store: target }). Answers true when every store copied. */
export function backup({ out, targets, keep = 30, date = new Date() }) {
  const made = makeRunFolder(out, date);
  if (made.error) {
    say("backup_refused", { msg: made.error });
    return false;
  }
  const manifest = { at: date.toISOString(), stores: {} };
  let ok = true;
  for (const [store, target] of Object.entries(targets)) {
    say("store_start", { store });
    const r = copyStore(store, made.dir, target);
    if (r.error) {
      ok = false;
      rmSync(join(made.dir, `${store}.sql`), { force: true });
      say("store_failed", { store, msg: r.error });
      continue;
    }
    manifest.stores[store] = r;
    say("store_ok", { store, bytes: r.bytes, ...Object.fromEntries(Object.entries(r.counts).map(([t, n]) => [`rows.${t}`, n])) });
  }
  manifest.ok = ok;
  writeFileSync(join(made.dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  if (ok) {
    for (const old of runsToPrune(readdirSync(out), keep)) {
      rmSync(join(out, old), { recursive: true, force: true });
      say("pruned", { run: old });
    }
  }
  say(ok ? "backup_ok" : "backup_failed", { run: runName(date) });
  return ok;
}

// ---------------------------------------------------------------------------------------------
// The drill: the same copy and checks, on made-up rows, then a restore into empty stores.

const MADE_UP_PEOPLE = `insert into notify.people (email, lang, confirm_code, confirmed_at) values
  ('drill-one@example.test', 'en', repeat('a', 48), now()),
  ('drill-two@example.test', 'ar', repeat('b', 48), null),
  ('drill-three@example.test', 'en', repeat('c', 48), now());
insert into notify.server_keys (hash, note) values (sha256('made-up-key'), 'made up');`;
const MADE_UP_ACCOUNTS = `INSERT INTO accounts VALUES ('drill-1','000000.drill.0001',1700000000),('drill-2','000000.drill.0002',1700000001);
INSERT INTO apple_tickets VALUES ('drill-1','made-up-sealed','app.example.drill',1700000000);
INSERT INTO sessions VALUES ('drill-hash','drill-1',1700000000,1800000000);`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return r.status === 0;
}

function listMigration() {
  const dir = join(REPO, "supabase/migrations");
  const f = readdirSync(dir).find((n) => /_notify_list\.sql$/.test(n));
  return f ? join(dir, f) : null;
}

function drillList(work) {
  const migration = listMigration();
  if (!migration) return { error: "no list migration in supabase/migrations" };
  const name = `hifth-backup-drill-${process.pid}`;
  const port = String(55000 + (process.pid % 900));
  const info = spawnSync("docker", ["info"], { encoding: "utf8" });
  if (info.error) return { error: "docker is not on the PATH (Docker Desktop puts it in /usr/local/bin)" };
  if (info.status !== 0) return { error: "docker is not running (open Docker Desktop)" };
  if (!run("docker", ["run", "-d", "--rm", "--name", name, "-e", "POSTGRES_PASSWORD=drill", "-p", `127.0.0.1:${port}:5432`, "postgres:17"])) return { error: "docker could not start postgres:17" };
  try {
    const psql = libpq("psql");
    if (!psql) return { error: "psql is not installed (brew install libpq)" };
    const env = { ...process.env, PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres", PGPASSWORD: "drill", PGSSLMODE: "disable" };
    const ready = libpq("pg_isready");
    if (!ready) return { error: "pg_isready is not installed (brew install libpq)" };
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      up = run(ready, ["-q"], { env }) && run(psql, ["-X", "-q", "-c", "select 1"], { env });
      if (!up) spawnSync("sleep", ["1"]);
    }
    if (!up) return { error: "postgres:17 did not come up" };
    const sql = (db, ...args) => run(psql, ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { env });
    if (!sql("postgres", "-c", "create role anon nologin", "-c", "create role authenticated nologin", "-c", "create database drill_source", "-c", "create database drill_restore")) return { error: "could not make the drill databases" };
    for (const db of ["drill_source", "drill_restore"]) if (!sql(db, "-f", migration)) return { error: "the list migration did not apply" };
    if (!sql("drill_source", "-c", MADE_UP_PEOPLE)) return { error: "could not add the made-up rows" };
    const address = `postgresql://postgres:drill@127.0.0.1:${port}/drill_source`;
    const out = join(work, "copies");
    if (!backup({ out, targets: { list: { address } }, keep: 30 })) return { error: "the copy failed" };
    const runDir = join(out, readdirSync(out).filter((n) => RUN.test(n)).sort().pop());
    if (!sql("drill_restore", "-f", join(runDir, "list.sql"))) return { error: "the copy did not load into the empty database" };
    const c = spawnSync(psql, ["-X", "-A", "-t", "-d", "drill_restore", "-c", "select json_build_object('notify.people', (select count(*) from notify.people), 'notify.server_keys', (select count(*) from notify.server_keys))"], { env, encoding: "utf8" });
    const restored = JSON.parse(c.stdout.trim());
    const copied = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8")).stores.list.counts;
    if (restored["notify.people"] !== copied["notify.people"] || restored["notify.people"] !== 3) return { error: "the restored list holds a different number of rows" };
    if (restored["notify.server_keys"] !== 0) return { error: "the site's key reached the copy" };
    return { counts: { "notify.people": restored["notify.people"] } };
  } finally {
    spawnSync("docker", ["stop", name], { encoding: "utf8" });
  }
}

/** The accounts migrations folder (this repo's, or `given`), or null before sign-in is merged. */
function accountsMigrations(given) {
  const dir = given ? resolve(given) : join(LANDING, "migrations");
  return existsSync(dir) && readdirSync(dir).some((n) => n.endsWith(".sql")) ? dir : null;
}

function drillAccounts(work, given) {
  const migrations = accountsMigrations(given);
  if (!migrations) {
    if (given) return { error: "no .sql files in the accounts migrations folder given" };
    return { skipped: "no accounts database on this branch yet (it comes with sign-in); --accounts-migrations <folder> practises it from another branch" };
  }
  for (const tool of ["wrangler", "sqlite3"]) if (!hasTool(tool)) return { error: `${tool} is not on the PATH (wrangler comes with the repo's Node from .nvmrc; sqlite3 is in /usr/bin)` };
  const here = join(work, "d1");
  mkdirSync(here);
  cpSync(migrations, join(here, "migrations"), { recursive: true });
  const config = join(here, "wrangler.toml");
  writeFileSync(config, 'name = "backup-drill"\ncompatibility_date = "2026-09-01"\n\n[[d1_databases]]\nbinding = "ACCOUNTS"\ndatabase_name = "drill-accounts"\ndatabase_id = "00000000-0000-4000-8000-000000000000"\n');
  const opts = { cwd: here, env: { ...process.env, CI: "1" } };
  if (!run("wrangler", ["d1", "migrations", "apply", "drill-accounts", "--local", "--config", config], opts)) return { error: "the accounts migrations did not apply" };
  if (!run("wrangler", ["d1", "execute", "drill-accounts", "--local", "--config", config, "--command", MADE_UP_ACCOUNTS], opts)) return { error: "could not add the made-up rows" };
  const out = join(work, "copies-accounts");
  if (!backup({ out, targets: { accounts: { name: "drill-accounts", where: "local", config } }, keep: 30 })) return { error: "the copy failed" };
  const runDir = join(out, readdirSync(out).filter((n) => RUN.test(n)).sort().pop());
  const db = join(work, "restored.db");
  const files = readdirSync(migrations).filter((n) => n.endsWith(".sql")).sort();
  const reads = [...files.map((f) => `.read ${join(migrations, f)}`), `.read ${join(runDir, "accounts.sql")}`];
  if (!run("sqlite3", ["-bail", db, ...reads])) return { error: "the copy did not load into the empty database" };
  const c = spawnSync("sqlite3", [db, "select json_object('accounts', (select count(*) from accounts), 'apple_tickets', (select count(*) from apple_tickets), 'sessions', (select count(*) from sessions))"], { encoding: "utf8" });
  const restored = JSON.parse(c.stdout.trim());
  if (restored.accounts !== 2 || restored.apple_tickets !== 1) return { error: "the restored accounts hold a different number of rows" };
  if (restored.sessions !== 0) return { error: "sign-in sessions reached the copy" };
  return { counts: { accounts: restored.accounts, apple_tickets: restored.apple_tickets } };
}

export function drill({ accountsMigrations: given } = {}) {
  const work = mkdtempSync(join(tmpdir(), "hifth-backup-drill-"));
  let ok = true;
  const practised = [];
  try {
    for (const [store, fn] of [["list", drillList], ["accounts", (w) => drillAccounts(w, given)]]) {
      say("drill_start", { store });
      const r = fn(work);
      if (r.skipped) say("drill_skipped", { store, msg: r.skipped });
      else if (r.error) {
        ok = false;
        say("drill_failed", { store, msg: r.error });
      } else {
        practised.push(store);
        say("drill_ok", { store, ...Object.fromEntries(Object.entries(r.counts).map(([t, n]) => [`restored.${t}`, n])) });
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (ok) {
    mkdirSync(BACKUP_HOME, { recursive: true, mode: 0o700 });
    writeFileSync(join(BACKUP_HOME, "last-drill.json"), JSON.stringify({ at: new Date().toISOString(), madeUp: true, stores: practised }) + "\n", { mode: 0o600 });
  }
  say(ok ? "drill_done" : "drill_failed_overall", {});
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Status: how old the last copy and the last drill are.

const daysSince = (iso, now) => Math.floor((now - Date.parse(iso)) / 86400000);

/** Plain lines about the last copy and drill, and whether either is older than `maxDays`. */
export function statusLines({ manifest, drillAt, drillStores, now = Date.now(), maxDays = 2 }) {
  const lines = [];
  let stale = false;
  if (!manifest) {
    lines.push("No backup of readers' data has been made on this laptop yet.");
    stale = true;
  } else {
    const d = daysSince(manifest.at, now);
    lines.push(`Last backup: ${manifest.run}, ${d} day${d === 1 ? "" : "s"} ago, ${manifest.ok ? "complete" : "with a store that failed"}.`);
    if (d > maxDays || !manifest.ok) stale = true;
  }
  if (!drillAt) lines.push("No restore has been practised on this laptop yet.");
  else {
    const d = daysSince(drillAt, now);
    const which = drillStores && drillStores.length ? `, for ${drillStores.join(" and ")}` : "";
    lines.push(`Last practised restore (made-up rows${which}): ${d} day${d === 1 ? "" : "s"} ago.`);
  }
  return { lines, stale };
}

function status(argv) {
  const out = valueOf(argv, "--out") || COPIES;
  const maxDays = Number(valueOf(argv, "--max-days") || 2);
  const drillFile = join(BACKUP_HOME, "last-drill.json");
  let drillAt = null;
  let drillStores = null;
  try {
    ({ at: drillAt, stores: drillStores } = JSON.parse(readFileSync(drillFile, "utf8")));
  } catch {
    drillAt = null; // no practice yet, or the file is unreadable: the status says "never"
  }
  const { lines, stale } = statusLines({ manifest: lastManifest(out), drillAt, drillStores, maxDays });
  for (const l of lines) console.log(l);
  return !stale;
}

// ---------------------------------------------------------------------------------------------

function valueOf(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}

function realTargets() {
  const targets = {};
  if (process.env.SUPABASE_DB_URL) targets.list = { address: process.env.SUPABASE_DB_URL };
  else say("store_missing", { store: "list", msg: "SUPABASE_DB_URL is not loaded; run through make, which loads the saved keys" });
  const toml = existsSync(join(LANDING, "wrangler.toml")) ? readFileSync(join(LANDING, "wrangler.toml"), "utf8") : "";
  const name = d1DatabaseName(toml);
  if (name) targets.accounts = { name, where: "remote" };
  else say("store_skipped", { store: "accounts", msg: "the site names no accounts database yet" });
  return targets;
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === "drill") return drill({ accountsMigrations: valueOf(argv, "--accounts-migrations") });
  if (cmd === "status") return status(argv);
  if (cmd === "run") {
    const out = valueOf(argv, "--out") || COPIES;
    const targets = realTargets();
    if (!Object.keys(targets).length) return false;
    return backup({ out: resolve(out), targets, keep: Number(valueOf(argv, "--keep") || 30) });
  }
  console.log("usage: backup-reader-data.mjs run [--out <folder>] [--keep 30] | drill [--accounts-migrations <folder>] | status [--out <folder>] [--max-days 2]");
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)) ? 0 : 1);
}

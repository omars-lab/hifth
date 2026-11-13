#!/usr/bin/env node
/**
 * qul-store — move, prove and check the outside-library store, through the Supabase command
 * line's own login. No database password is needed for any of it: every query goes through
 * `supabase db query --linked`, which uses the profile's login, not a connection string.
 *
 *   node .claude/skills/leverage-qul/scripts/qul-store.mjs fingerprint [--profile hifth] [--workdir .]
 *       Row count and a content fingerprint per table (an md5 over every row, in key order).
 *       Prints numbers and hashes only, never a row.
 *
 *   node .claude/skills/leverage-qul/scripts/qul-store.mjs load --backup <file.sql> [--profile hifth] [--workdir .]
 *       Loads a data-only backup into an EMPTY store, in one transaction, then fingerprints it.
 *       Refuses if any table already has rows, so it can never double a load.
 *
 *   node .claude/skills/leverage-qul/scripts/qul-store.mjs compare --from-profile bytesofpurpose --from-workdir ../hifth
 *       [--profile hifth] [--workdir .]
 *       Fingerprints both stores and fails unless every table matches row for row.
 *
 *   node .claude/skills/leverage-qul/scripts/qul-store.mjs posture [--profile hifth] [--workdir .]
 *       Fails if the store has drifted open: a table without row rules, any right for the
 *       public roles (now or for tables made later), a sign-up, unencrypted connections allowed,
 *       or live settings that differ from supabase/config.toml (which keeps sign-ups and the
 *       Data API off). The network allow-list is reported, not enforced.
 *
 * --profile takes a profile name, read from ~/.supabase/profiles/<name>.yaml. --workdir is a
 * folder whose supabase/ is linked to the project to use (the link lives in its git-ignored
 * supabase/.temp). The project's id is never printed.
 *
 * Why it exists: 2026-11-13, moving the store to a new account. See docs/design/supabase-move.md.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The tables the store holds, each with the key that orders its rows for the fingerprint. */
export const TABLES = [
  { name: "qul_page_lines", key: "page_number, line_number" },
  { name: "qul_words", key: "word_id" },
  { name: "qul_layout_info", key: "key" },
];

/** One query giving each table's row count and a fingerprint of its rows in key order. */
export function fingerprintSql(tables = TABLES) {
  return tables
    .map(
      ({ name, key }) =>
        `select '${name}' as t, count(*)::bigint as n, ` +
        `md5(coalesce(string_agg(md5(r::text), '' order by ${key}), '')) as h from public.${name} r`,
    )
    .join(" union all ");
}

/**
 * The JSON `supabase db query` prints, as rows. It wraps rows in an object with a random
 * boundary and a warning; older versions print a bare array.
 */
export function parseQueryOutput(stdout) {
  const start = stdout.search(/[[{]/);
  if (start < 0) throw new Error("no JSON in the command's output");
  const parsed = JSON.parse(stdout.slice(start));
  return Array.isArray(parsed) ? parsed : parsed.rows ?? [];
}

/** Table-by-table differences between two fingerprints; empty when they match. */
export function compareFingerprints(from, to) {
  const byName = (rows) => new Map(rows.map((r) => [r.t, r]));
  const a = byName(from);
  const b = byName(to);
  const out = [];
  for (const { name } of TABLES) {
    const x = a.get(name);
    const y = b.get(name);
    if (!x || !y) out.push(`${name}: missing on ${x ? "the new" : "the old"} store`);
    else if (Number(x.n) !== Number(y.n)) out.push(`${name}: ${x.n} rows on the old store, ${y.n} on the new`);
    else if (x.h !== y.h) out.push(`${name}: same row count (${x.n}) but the rows differ`);
  }
  return out;
}

/** The SQL behind the posture check. Every column is a number or a name, never a row's text. */
export const POSTURE_SQL = `
select 'tables without row rules' as check_name, count(*)::bigint as found
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
union all
select 'rights the public roles hold on tables', count(*)::bigint
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
union all
select 'rights the public roles hold on functions', count(*)::bigint
  from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'authenticated')
union all
select 'row rules that let the public roles in', count(*)::bigint
  from pg_policies
  where schemaname = 'public' and roles && array['anon', 'authenticated', 'public']::name[]
union all
select 'rights later tables would give the public roles', count(*)::bigint
  from pg_default_acl a join pg_namespace n on n.oid = a.defaclnamespace
  where n.nspname = 'public' and a.defaclrole = 'postgres'::regrole
    and (a.defaclacl::text like '%anon=%' or a.defaclacl::text like '%authenticated=%')
union all
select 'sign-ups', count(*)::bigint from auth.users
union all
select 'stored files', count(*)::bigint from storage.objects`;

/** Posture findings from the SQL rows, the SSL line and the settings preview; empty is good. */
export function postureProblems({ rows, sslText, configText }) {
  const problems = rows
    .filter((r) => Number(r.found) > 0)
    .map((r) => `${r.check_name}: ${r.found}`);
  if (!/SSL is being enforced/.test(sslText)) problems.push("unencrypted connections are allowed");
  for (const service of ["API", "Auth", "DB", "Storage"]) {
    if (!new RegExp(`Remote ${service} config is up to date`).test(configText)) {
      problems.push(`live ${service} settings differ from supabase/config.toml`);
    }
  }
  return problems;
}

/** The settings supabase/config.toml must keep for the store (checked offline by the test). */
export function configProblems(toml) {
  const section = (name) => {
    const m = toml.match(new RegExp(`^\\[${name.replace(".", "\\.")}\\]\\n([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, "m"));
    return m ? m[1] : "";
  };
  const value = (name, key) => section(name).match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"))?.[1].trim();
  const want = [
    ["api", "enabled", "false", "the Data API must stay off: nothing uses it, and it is the public key's way in"],
    ["auth", "enable_signup", "false", "sign-ups must stay off: no app signs anyone in"],
    ["auth", "enable_anonymous_sign_ins", "false", "anonymous sign-ins must stay off"],
    ["auth.email", "enable_signup", "false", "email sign-ups must stay off"],
    ["auth.email", "enable_confirmations", "true", "an email must be confirmed before it can sign in"],
  ];
  return want
    .filter(([s, k, v]) => value(s, k) !== v)
    .map(([s, k, v, why]) => `[${s}] ${k} should be ${v}: ${why}`);
}

// --- running the command line -------------------------------------------------------------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { profile: "hifth", workdir: "." };
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i]?.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!k || rest[i + 1] === undefined) die(`expected --name value pairs, got ${rest[i]}`);
    opts[k] = rest[i + 1];
  }
  return { command, opts };
}

function die(msg) {
  console.error(`qul-store — ${msg}`);
  process.exit(2);
}

const profilePath = (name) => join(homedir(), ".supabase", "profiles", `${name}.yaml`);

/** Run the supabase command line with a profile and workdir; stdout only, never echoed. */
function supabase(args, { profile, workdir, input } = {}) {
  const env = { ...process.env };
  delete env.SUPABASE_ACCESS_TOKEN; // it would beat the profile's login
  return execFileSync(
    "supabase",
    ["--profile", profilePath(profile), "--workdir", resolve(workdir), ...args],
    { encoding: "utf8", env, input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
  );
}

/** The same, for commands that report on stderr: both streams joined, and the exit status. */
function supabaseAll(args, { profile, workdir, input } = {}) {
  const env = { ...process.env };
  delete env.SUPABASE_ACCESS_TOKEN;
  const r = spawnSync("supabase", ["--profile", profilePath(profile), "--workdir", resolve(workdir), ...args], {
    encoding: "utf8",
    env,
    input,
  });
  if (r.status !== 0) die(`supabase ${args.slice(0, 2).join(" ")} failed (exit ${r.status})`);
  return `${r.stdout}\n${r.stderr}`;
}

function query(sql, where) {
  return parseQueryOutput(supabase(["db", "query", "--linked", sql], where));
}

function fingerprint(where) {
  return query(fingerprintSql(), where).map((r) => ({ t: r.t, n: Number(r.n), h: r.h }));
}

function show(label, rows) {
  console.log(label);
  for (const r of rows) console.log(`  ${r.t.padEnd(16)} ${String(r.n).padStart(7)} rows  ${r.h}`);
}

function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  const here = { profile: opts.profile, workdir: opts.workdir };

  if (command === "fingerprint") {
    show(`store (profile ${opts.profile})`, fingerprint(here));
    return;
  }

  if (command === "load") {
    if (!opts.backup) die("load needs --backup <file.sql>");
    const before = fingerprint(here);
    const full = before.filter((r) => r.n > 0);
    if (full.length) die(`refusing to load: ${full.map((r) => `${r.t} has ${r.n} rows`).join(", ")}`);
    const dir = mkdtempSync(join(tmpdir(), "qul-store-"));
    try {
      const file = join(dir, "load.sql");
      // One transaction: a failure part-way leaves the store empty, not half-loaded.
      writeFileSync(file, `begin;\n${readFileSync(opts.backup, "utf8")}\ncommit;\n`, { mode: 0o600 });
      try {
        supabase(["db", "query", "--linked", "-f", file], here);
      } catch (e) {
        // The command's own message can quote a failing row; print only its first line's error.
        const first = String(e.stderr || e.message).split("\n").find((l) => /error|status/i.test(l)) ?? "";
        die(`the load failed and was rolled back: ${first.slice(0, 200)}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    show("loaded", fingerprint(here));
    return;
  }

  if (command === "compare") {
    if (!opts.fromProfile || !opts.fromWorkdir) die("compare needs --from-profile and --from-workdir");
    const from = fingerprint({ profile: opts.fromProfile, workdir: opts.fromWorkdir });
    const to = fingerprint(here);
    show(`old store (profile ${opts.fromProfile})`, from);
    show(`new store (profile ${opts.profile})`, to);
    const diffs = compareFingerprints(from, to);
    if (diffs.length) {
      for (const d of diffs) console.log(`DIFFERS  ${d}`);
      process.exit(1);
    }
    console.log("MATCH    every table has the same rows on both stores");
    return;
  }

  if (command === "posture") {
    const rows = query(POSTURE_SQL, here);
    const sslText = supabaseAll(["ssl-enforcement", "get", "--experimental"], here);
    // Answer no to every prompt: this only reads the difference, it never pushes.
    const configText = supabaseAll(["config", "push"], { ...here, input: "n\n".repeat(10) });
    const netText = supabaseAll(["network-restrictions", "get", "--experimental"], here);
    const tomlProblems = configProblems(readFileSync(join(resolve(opts.workdir), "supabase", "config.toml"), "utf8"));
    const problems = [...tomlProblems, ...postureProblems({ rows, sslText, configText })];
    for (const r of rows) console.log(`  ${r.check_name.padEnd(50)} ${r.found}`);
    console.log(`  ${"unencrypted connections refused".padEnd(50)} ${/SSL is being enforced/.test(sslText) ? "yes" : "NO"}`);
    const openToAll = /0\.0\.0\.0\/0/.test(netText);
    console.log(`  ${"network allow-list".padEnd(50)} ${openToAll ? "open to every address (reported, not enforced)" : "restricted"}`);
    if (problems.length) {
      for (const p of problems) console.log(`PROBLEM  ${p}`);
      process.exit(1);
    }
    console.log("CLOSED   nothing is open that should not be");
    return;
  }

  die("usage: qul-store.mjs fingerprint | load --backup <file> | compare --from-profile <name> --from-workdir <dir> | posture");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

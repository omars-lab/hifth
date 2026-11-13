/**
 * Every table our Supabase migrations create must be closed to the project's
 * public key. Supabase hands each new table in `public` to the `anon` and
 * `authenticated` roles with full read and write, and the public key is meant to
 * be shareable. So a table left as created can be read, changed or emptied by
 * anyone holding that key. The store holds the per-word text under the
 * qul-reliance decision, "for the building tools alone"; the building tools
 * connect as the database owner, so closing the table costs them nothing.
 *
 * Found 2026-11-12 while auditing the store before moving it to a new project:
 * the live tables had no row rules and full grants to both public roles.
 *
 * The check reads the migration files only (no database), so it runs offline.
 * Run with the other script tests: node --test scripts/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

/** All migration SQL, in the order Supabase applies it, comments stripped, lower-cased. */
export function readMigrations(dir = MIGRATIONS) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n")
    .replace(/--[^\n]*/g, "")
    .toLowerCase();
}

/** Table names (without schema) created in `public`. */
export function publicTables(sql) {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)"?([a-z_][a-z0-9_]*)"?/g;
  return [...sql.matchAll(re)].map((m) => m[1]);
}

/** Does the SQL turn on row rules for this table? */
export function enablesRowRules(sql, table) {
  const re = new RegExp(
    `alter\\s+table\\s+(?:only\\s+)?(?:"?public"?\\.)"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
  );
  return re.test(sql);
}

/** Does the SQL take every right on this table away from both public roles? */
export function revokesPublicRoles(sql, table) {
  const re = /revoke\s+all\s+on\s+(?:table\s+)?([^;]*?)\s+from\s+([^;]*);/g;
  for (const m of sql.matchAll(re)) {
    const tables = m[1].split(",").map((t) => t.trim().replace(/"/g, "").replace(/^public\./, ""));
    const roles = m[2].split(",").map((r) => r.trim().replace(/"/g, ""));
    if (tables.includes(table) && roles.includes("anon") && roles.includes("authenticated")) return true;
  }
  return false;
}

test("the rules spot a table left open, and one that was closed", () => {
  const open = "create table if not exists public.notes (id int);";
  assert.deepEqual(publicTables(open), ["notes"]);
  assert.equal(enablesRowRules(open, "notes"), false);
  assert.equal(revokesPublicRoles(open, "notes"), false);

  const closed =
    open +
    "\nalter table public.notes enable row level security;" +
    "\nrevoke all on table public.notes, public.other from anon, authenticated;";
  assert.equal(enablesRowRules(closed, "notes"), true);
  assert.equal(revokesPublicRoles(closed, "notes"), true);
  // revoking from one public role only leaves the table open to the other
  assert.equal(revokesPublicRoles(open + "\nrevoke all on public.notes from anon;", "notes"), false);
});

test("every table the migrations create is closed to the public key", () => {
  const sql = readMigrations();
  const tables = publicTables(sql);
  assert.ok(tables.length > 0, "found no tables — has the migrations folder moved?");
  for (const t of tables) {
    assert.ok(enablesRowRules(sql, t), `public.${t} never has row level security turned on`);
    assert.ok(revokesPublicRoles(sql, t), `public.${t} still grants the anon and authenticated roles`);
  }
});

test("tables added later start closed too", () => {
  const sql = readMigrations();
  assert.ok(
    /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+tables\s+from\s+anon,\s*authenticated/.test(
      sql,
    ),
    "new tables in public would still be handed to the anon and authenticated roles",
  );
});

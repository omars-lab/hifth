#!/usr/bin/env node
/**
 * How many people are on hifth.app's "tell me when the Mac app is out" list, and
 * nothing else: no address is ever asked for, printed or written down.
 *
 *   make hifth-app-list-count            the real list
 *   make hifth-app-list-count ARGS=--local  the copy on this laptop
 *
 * Asks the list's Supabase database for two counts: people who pressed the button in
 * the confirm email, and people still waiting to. The real list needs SUPABASE_DB_URL
 * (the database's address, password included), saved encrypted and loaded by dotenvx
 * (the make target does). --local asks `supabase status` for the local copy instead;
 * SUPABASE_WORKDIR names the folder to ask in, when it is not this repo.
 * Needs psql: on PATH, or Homebrew's libpq.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const QUERY =
  "select json_build_object('confirmed', count(*) filter (where confirmed_at is not null), 'waiting', count(*) filter (where confirmed_at is null)) from notify.people";

/**
 * The two counts from psql's answer, or an error. Anything shaped other than one line
 * holding exactly those two whole numbers is refused rather than printed, so a changed
 * query or a changed answer can never put an address on the screen.
 */
export function countFrom(text) {
  const lines = String(text).split("\n").filter((l) => l.trim());
  if (lines.length !== 1) return { error: "The database's answer was not one line." };
  let answer;
  try {
    answer = JSON.parse(lines[0]);
  } catch {
    return { error: "The database's answer was not readable." };
  }
  const keys = answer && typeof answer === "object" ? Object.keys(answer).sort() : [];
  const whole = (n) => Number.isInteger(n) && n >= 0;
  if (keys.join() !== "confirmed,waiting" || !whole(answer.confirmed) || !whole(answer.waiting)) {
    return { error: "The database's answer held something other than the counts." };
  }
  return { confirmed: answer.confirmed, waiting: answer.waiting };
}

/**
 * psql's own settings from a postgres:// address, so the password goes to psql in its
 * environment and never on a command line another program could read.
 */
export function pgEnvFrom(address) {
  let u;
  try {
    u = new URL(address);
  } catch {
    return null;
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
  const local = u.hostname === "127.0.0.1" || u.hostname === "localhost";
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.replace(/^\//, "") || "postgres",
    PGSSLMODE: local ? "disable" : "require",
  };
}

function psqlPath() {
  const onPath = spawnSync("which", ["psql"], { encoding: "utf8" });
  if (onPath.status === 0) return onPath.stdout.trim();
  const brew = "/opt/homebrew/opt/libpq/bin/psql";
  return existsSync(brew) ? brew : null;
}

function localAddress() {
  const r = spawnSync("supabase", ["--workdir", process.env.SUPABASE_WORKDIR || REPO, "status", "-o", "json"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout).DB_URL ?? null;
  } catch {
    return null;
  }
}

function main(argv) {
  const local = argv.includes("--local");
  const address = local ? localAddress() : process.env.SUPABASE_DB_URL;
  if (!address) {
    console.log(local
      ? "✗ no local Supabase is running here (supabase start)."
      : "✗ SUPABASE_DB_URL is not loaded. Run this through make hifth-app-list-count, which loads the saved keys; the owner adds the key once (manage-database skill).");
    return false;
  }
  const pg = pgEnvFrom(address);
  if (!pg) {
    console.log("✗ the database address is not a postgres:// address.");
    return false;
  }
  const psql = psqlPath();
  if (!psql) {
    console.log("✗ psql is not installed (brew install libpq).");
    return false;
  }
  const r = spawnSync(psql, ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", QUERY], {
    encoding: "utf8",
    env: { ...process.env, ...pg, SUPABASE_DB_URL: "" },
  });
  if (r.status !== 0) {
    // psql's own words can name the host; say only that it failed.
    console.log("✗ the database did not answer. Is the list's table made yet? (supabase/migrations, manage-database skill)");
    return false;
  }
  const { confirmed, waiting, error } = countFrom(r.stdout);
  if (error) {
    console.log(`✗ ${error}`);
    return false;
  }
  const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;
  console.log(`${people(confirmed)} on the list${local ? " (the copy on this laptop)" : ""}; ${people(waiting)} still to confirm.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)) ? 0 : 1);
}

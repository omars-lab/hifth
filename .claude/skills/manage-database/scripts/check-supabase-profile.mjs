#!/usr/bin/env node
/**
 * Is this laptop logged in to Hifth's own Supabase account, and not some other one?
 *
 * Checks, in order: the command-line tool is installed; the profile file
 * ~/.supabase/profiles/hifth.yaml exists; that profile's login lists exactly one
 * project, named hifth.app; and no access token in the environment is overriding
 * every saved login. It also says which projects the default login (no profile)
 * reaches, so a command typed without the flag is not a surprise.
 *
 * It prints project names, states and counts only: never an ID, a key, a token or
 * an email. When something is missing it prints the command the owner types in
 * their own terminal (the login opens a browser, so it is theirs to run).
 *
 * Exit 0 when the hifth login is right; 1 when it is missing or wrong; 2 when the
 * tool or the profile file is missing.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROFILE_PATH = "~/.supabase/profiles/hifth.yaml";
export const PROJECT_NAME = "hifth.app";
export const LOGIN_COMMAND = `! supabase login --profile ${PROFILE_PATH}`;

/**
 * Read the tool's project list and keep only what is safe to print.
 * The answer carries IDs and organisation names; none of that leaves here.
 */
export function namesFrom(stdout) {
  let list;
  try {
    list = JSON.parse(stdout);
  } catch {
    return { error: "the project list was not readable" };
  }
  if (!Array.isArray(list)) return { error: "the project list was not a list" };
  return {
    projects: list.map((p) => ({
      name: typeof p?.name === "string" ? p.name : "(no name)",
      status: typeof p?.status === "string" ? p.status : "unknown",
    })),
  };
}

/** Is the hifth login right? One project, the right name. */
export function verdictFor(projects) {
  if (projects.length === 1 && projects[0].name === PROJECT_NAME) return { ok: true };
  if (projects.length === 0) {
    return { ok: false, why: `this login reaches no projects, so it is not the account that holds ${PROJECT_NAME}` };
  }
  const names = projects.map((p) => p.name).join(", ");
  if (projects.some((p) => p.name === PROJECT_NAME)) {
    return { ok: false, why: `this login reaches ${projects.length} projects (${names}); Hifth's account should hold only ${PROJECT_NAME}` };
  }
  return { ok: false, why: `this login reaches ${names}, not ${PROJECT_NAME}: it is another account` };
}

function run(args) {
  const env = { ...process.env };
  return spawnSync("supabase", args, { encoding: "utf8", env, timeout: 60_000 });
}

function listProjects(profileArgs) {
  const r = run([...profileArgs, "projects", "list", "--output-format", "json"]);
  if (r.error) return { error: r.error.code === "ETIMEDOUT" ? "timed out after 60 s" : "could not run" };
  if (r.status !== 0) return { error: "not logged in, or the login has expired" };
  return namesFrom(r.stdout);
}

function describe(projects) {
  return projects.map((p) => `${p.name} (${p.status.toLowerCase()})`).join(", ") || "none";
}

function main() {
  const say = (line) => console.log(`  ${line}`);
  console.log("Supabase login check (names only; no IDs, keys or emails)");

  const version = run(["--version"]);
  if (version.error || version.status !== 0) {
    say("FAIL the supabase command line tool is not installed.");
    say("     install it:  brew install supabase/tap/supabase");
    process.exit(2);
  }
  say(`ok   tool installed, version ${version.stdout.trim()}`);

  const file = join(homedir(), ".supabase", "profiles", "hifth.yaml");
  if (!existsSync(file)) {
    say(`FAIL the profile file ${PROFILE_PATH} is missing.`);
    say("     set it up from zero: see 'Setting up the profile from zero' in this skill.");
    process.exit(2);
  }
  say(`ok   profile file ${PROFILE_PATH} is there`);

  let warned = false;
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    warned = true;
    say("WARN SUPABASE_ACCESS_TOKEN is set in this shell. It beats every saved login,");
    say("     so every command uses whichever account that token belongs to.");
    say("     clear it for this shell:  unset SUPABASE_ACCESS_TOKEN");
  }

  const hifth = listProjects(["--profile", file]);
  let ok = false;
  if (hifth.error) {
    say(`FAIL the hifth login: ${hifth.error}.`);
    say(`     the owner types this in the prompt:  ${LOGIN_COMMAND}`);
  } else {
    const v = verdictFor(hifth.projects);
    if (v.ok) {
      ok = true;
      say(`ok   the hifth login reaches one project: ${describe(hifth.projects)}`);
    } else {
      say(`FAIL ${v.why}.`);
      say(`     log in again with the right account:  ${LOGIN_COMMAND}`);
    }
  }

  const plain = listProjects([]);
  if (plain.error) {
    say(`note the default login (no profile): ${plain.error}. Fine: always pass the profile.`);
  } else {
    const reachesHifth = plain.projects.some((p) => p.name === PROJECT_NAME);
    say(`note the default login (no profile) reaches: ${describe(plain.projects)}`);
    if (!reachesHifth) say(`     it is another account, so a command without --profile ${PROFILE_PATH} misses Hifth.`);
  }

  if (ok && warned) say("note the hifth login is right, but the token above still overrides it.");
  process.exit(ok && !warned ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

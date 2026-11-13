/**
 * Every Supabase command a skill or the move page tells someone to run must name
 * the project's command-line profile.
 *
 * The CLI files its saved login under a profile's name. The default login on this
 * laptop belongs to another Supabase account (the old store's, and an unrelated
 * site's project). Hifth's store lives on its own account, logged in under the
 * profile file ~/.supabase/profiles/hifth.yaml. A command copied from a skill
 * without the flag would quietly run against the wrong account: listing the wrong
 * projects, or linking and pushing migrations to a project that is not ours.
 *
 * Found 2026-11-12 while moving the store to a new account. Reads text only, so it
 * runs offline. Commands that only touch a local throwaway database (`supabase
 * start`, `stop`, `status`, `db reset` without --linked) need no login and are left
 * alone.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PROFILE_FLAG = "--profile ~/.supabase/profiles/hifth.yaml";

/** Sub-commands that never reach a hosted account. */
const LOCAL_ONLY = new Set(["start", "stop", "status", "init", "--version", "--help", "-h"]);

/** The Supabase commands in a piece of text that reach a hosted account but name no profile. */
export function commandsWithoutProfile(text) {
  const missing = [];
  for (const line of text.split("\n")) {
    const at = line.search(/(^|[\s`(])supabase\s+[-a-z]/);
    if (at < 0) continue;
    const cmd = line.slice(at).replace(/^[\s`(]/, "").replace(/`.*$/, "").trim();
    const words = cmd.split(/\s+/).slice(1).filter((w) => !w.startsWith("--profile") && !w.startsWith("~/"));
    const sub = words.find((w) => !w.startsWith("--workdir")) ?? "";
    if (LOCAL_ONLY.has(sub)) continue;
    if (sub === "db" && words[1] === "reset" && !cmd.includes("--linked")) continue;
    if (!cmd.includes(PROFILE_FLAG)) missing.push(cmd);
  }
  return missing;
}

/** The pages that tell someone which Supabase commands to run. */
export function instructionPages(root = ROOT) {
  const pages = [];
  const skills = join(root, ".claude", "skills");
  for (const name of readdirSync(skills)) {
    const page = join(skills, name, "SKILL.md");
    if (existsSync(page)) pages.push(page);
  }
  pages.push(join(root, "docs", "design", "supabase-move.md"));
  return pages;
}

test("the rule spots a hosted command with no profile, and passes one with it", () => {
  assert.deepEqual(commandsWithoutProfile("run `supabase db push` now"), ["supabase db push"]);
  assert.deepEqual(commandsWithoutProfile("supabase link --project-ref abc"), ["supabase link --project-ref abc"]);
  assert.deepEqual(commandsWithoutProfile(`supabase ${PROFILE_FLAG} db push`), []);
  assert.deepEqual(commandsWithoutProfile(`supabase login ${PROFILE_FLAG}`), []);
  assert.deepEqual(commandsWithoutProfile("supabase start"), []);
  assert.deepEqual(commandsWithoutProfile("supabase db reset"), []);
  assert.deepEqual(commandsWithoutProfile("the Supabase command line, on its own account"), []);
});

test("every Supabase command in the skills and the move page names hifth's profile", () => {
  const found = [];
  for (const page of instructionPages()) {
    for (const cmd of commandsWithoutProfile(readFileSync(page, "utf8"))) {
      found.push(`${page.slice(ROOT.length + 1)}: ${cmd}`);
    }
  }
  assert.deepEqual(found, [], `add ${PROFILE_FLAG} to:\n${found.join("\n")}`);
});

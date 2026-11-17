/**
 * The team id this laptop signs the Apple apps with, read from native/scripts/signing-team.sh
 * (the first Apple Development certificate in the keychain), or `null` when there is none.
 *
 * Shared by the site release (which writes the id into hifth.app's links file) and the store
 * build check (which holds the signed app to the same id). The output is captured, checked and
 * handed back, never printed: the id is not written into this repo or its logs.
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Ten capital letters and digits: the shape of an Apple team id. */
export const TEAM_ID = /^[A-Z0-9]{10}$/;

export const SIGNING_TEAM_SCRIPT = join(REPO, "native", "scripts", "signing-team.sh");

export function signingTeam({ script = SIGNING_TEAM_SCRIPT } = {}) {
  const run = spawnSync("sh", [script], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (run.status !== 0) return null;
  const team = (run.stdout ?? "").trim();
  return TEAM_ID.test(team) ? team : null;
}

#!/usr/bin/env node
/**
 * How many people are on hifth.app's "tell me when the Mac app is out" list, and
 * nothing else: no address is ever asked for, printed or written down.
 *
 *   make hifth-app-list-count
 *
 * Asks Cloudflare's database on the new account for the count alone. Must run inside
 * dotenvx (the make target does), and refuses unless the new account's token and ID
 * are both loaded; without them wrangler would use its own login, a different account.
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const LANDING = join(REPO, "apps/landing");
export const DATABASE = "hifth-notify";
export const QUERY = "SELECT COUNT(*) AS n FROM notify";

/**
 * The count from wrangler's --json answer, or an error. Anything shaped other than
 * one row holding one number is refused rather than printed, so a changed query or
 * a changed answer can never put an address on the screen.
 */
export function countFrom(text) {
  let answer;
  try {
    answer = JSON.parse(text);
  } catch {
    return { error: "Cloudflare's answer was not readable." };
  }
  const rows = Array.isArray(answer) && answer.length === 1 ? answer[0]?.results : null;
  if (!Array.isArray(rows) || rows.length !== 1) return { error: "Cloudflare's answer was not one row." };
  const keys = Object.keys(rows[0]);
  if (keys.length !== 1 || keys[0] !== "n" || !Number.isInteger(rows[0].n) || rows[0].n < 0)
    return { error: "Cloudflare's answer held something other than a count." };
  return { count: rows[0].n };
}

function main() {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.log(`✗ ${missing.join(" and ")} not loaded. Run this through make hifth-app-list-count, which loads the saved keys.`);
    return false;
  }
  const r = spawnSync("wrangler", ["d1", "execute", DATABASE, "--remote", "--json", "--command", QUERY], {
    cwd: LANDING,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    // wrangler's own words can name the database or the account; say only that it failed.
    console.log("✗ Cloudflare did not answer. Is the database made yet? (docs/issues.json, notify-list-not-live)");
    return false;
  }
  const { count, error } = countFrom(r.stdout);
  if (error) {
    console.log(`✗ ${error}`);
    return false;
  }
  console.log(`${count} ${count === 1 ? "person is" : "people are"} on the list.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main() ? 0 : 1);
}

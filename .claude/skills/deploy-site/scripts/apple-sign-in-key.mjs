#!/usr/bin/env node
/**
 * Save the Sign in with Apple key on hifth.app's Cloudflare project, or say whether it is saved.
 *
 *   (no word)         check: for each of the three settings, "set" or "not set", nothing else
 *   --save <file>     the owner, in their own terminal: send the key file Apple gave
 *                     (AuthKey_<key id>.p8), its key id (read from the file name) and this
 *                     laptop's team id (native/scripts/signing-team.sh) as three secrets, then check
 *
 * Why the server needs it: deleting a reader's account must also end their link with Apple, and
 * Apple takes that only from a server that signs its request with this key (sign-in step 13,
 * question 8 on docs/design/sign-in.md). It is a different key from the App Store Connect upload
 * key.
 *
 * Nothing here prints a value: not the key, not its id, not the team id, not the Cloudflare
 * token or account. Before sending, the file is checked to be Apple's kind of key (an elliptic
 * curve P-256 private key), readable by the owner only, and kept outside the repo. Must run
 * inside dotenvx (make hifth-app-apple-key does), so it uses the saved Cloudflare keys and never
 * wrangler's own sign-in, which is the other account.
 */
import { createPrivateKey } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signingTeam } from "../../../../scripts/lib/signing-team.mjs";

const API = "https://api.cloudflare.com/client/v4";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export const NAMES = ["APPLE_SIGN_IN_KEY", "APPLE_SIGN_IN_KEY_ID", "APPLE_TEAM_ID"];
const FILE_NAME = /^AuthKey_([A-Z0-9]{10})\.p8$/;

const errorsOf = (body) => (body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || "no reason given";

async function ask(fetch, env, path, method = "GET", body) {
  const r = await fetch(`${API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { ok: r.ok && json?.success === true, body: json, status: r.status };
}

const inside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** What is wrong with the key file, or null. Never quotes the file. */
function keyProblem(file, repo) {
  const name = basename(file);
  if (!FILE_NAME.test(name)) return `the file is called "${name}". Apple names it AuthKey_<key id>.p8; keep that name, since the key id is read from it.`;
  let real;
  try {
    real = realpathSync(file);
  } catch {
    return "there is no file at that path.";
  }
  let repoReal = repo;
  try {
    repoReal = realpathSync(repo);
  } catch {
    // a repo path that does not exist holds nothing
  }
  if (inside(real, repoReal)) return "the file is inside the repo. Move it out (~/.appstoreconnect/sign-in-with-apple/) so it can never be committed.";
  if ((statSync(real).mode & 0o077) !== 0) return `others on this laptop can read it. Run: chmod 600 ${file}`;
  try {
    const key = createPrivateKey(readFileSync(real, "utf8"));
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("kind");
  } catch {
    return "the file is not a Sign in with Apple key (Apple's are P-256 private keys). Download it again from the key's page if it was changed.";
  }
  return null;
}

/** The whole job, with the network, the team id and the printing handed in, so it can be tested. */
export async function appleKey({
  save,
  env = process.env,
  project = env.HIFTH_APP_PAGES_PROJECT || "hifth-app",
  fetch = globalThis.fetch,
  team = () => signingTeam(),
  repo = REPO,
  say = console.log,
} = {}) {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((k) => !env[k]);
  if (missing.length) {
    say(`✗ ${missing.join(" and ")} not loaded. Run this through make hifth-app-apple-key, which loads the saved keys. Without them it cannot reach hifth.app's Cloudflare account.`);
    return false;
  }
  const base = `/pages/projects/${project}`;

  if (save) {
    const problem = keyProblem(save, repo);
    if (problem) {
      say(`✗ Not sent: ${problem}`);
      return false;
    }
    const teamId = team();
    if (!teamId) {
      say("✗ Not sent: this laptop has no Apple Development certificate to read the team id from. Sign in to Xcode with the paid team first (the app-setup skill).");
      return false;
    }
    const keyId = FILE_NAME.exec(basename(save))[1];
    const value = (v) => ({ type: "secret_text", value: v });
    const sent = await ask(fetch, env, base, "PATCH", {
      deployment_configs: {
        production: {
          env_vars: {
            APPLE_SIGN_IN_KEY: value(readFileSync(save, "utf8")),
            APPLE_SIGN_IN_KEY_ID: value(keyId),
            APPLE_TEAM_ID: value(teamId),
          },
        },
      },
    });
    if (!sent.ok) {
      say(`✗ Cloudflare refused the three settings (${sent.status}, ${errorsOf(sent.body)}).`);
      return false;
    }
    say(`Sent to "${project}" as secrets. The live site uses them from its next upload.`);
  }

  const got = await ask(fetch, env, base);
  if (!got.ok) {
    say(`✗ Cloudflare would not show the settings of "${project}" (${got.status}, ${errorsOf(got.body)}).`);
    return false;
  }
  const vars = got.body.result?.deployment_configs?.production?.env_vars ?? {};
  let all = true;
  for (const name of NAMES) {
    const set = vars[name] != null;
    all &&= set;
    say(`  ${name}: ${set ? "set" : "not set"}`);
  }
  if (!all && !save) say("Not all set. The owner saves them with: make hifth-app-apple-key ARGS=\"--save <path to AuthKey_<key id>.p8>\"");
  return all;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--save");
  if (at !== -1 && !args[at + 1]) {
    console.log("usage: apple-sign-in-key.mjs [--save <path to AuthKey_<key id>.p8>]");
    process.exit(2);
  }
  const ok = await appleKey({ save: at === -1 ? undefined : resolve(args[at + 1]) });
  process.exit(ok ? 0 : 1);
}

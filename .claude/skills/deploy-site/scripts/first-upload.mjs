#!/usr/bin/env node
/**
 * Is hifth.app ready for its first upload? One line per thing the upload needs, each ✓ or ✗,
 * with who does the missing ones. Run it before walking the owner through the first upload, and
 * again after each step they finish.
 *
 * It asks Cloudflare (with the saved keys, so it must run inside dotenvx; make hifth-app-ready
 * does) about the Pages project, its live branch, whether hifth.app is attached and active, which
 * site settings are set, how many uploads it already has, and whether the spam-check widget
 * exists. It reads main as GitHub has it (origin/main) for the front page's spam-check key and
 * the sign-in code, because a release is built from there.
 *
 * Nothing here prints a value: no setting, no key, no token, no account, no database address.
 * Only names, and set or not set. What it cannot see (the email list's tables on the real
 * Supabase project, which needs the database password) it names as the owner's to confirm.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.cloudflare.com/client/v4";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DOMAIN = "hifth.app";

/** The email form's settings, then sign-in's. Each must be set before the first upload. */
export const BEFORE = [
  ["SUPABASE_URL", "the email list's address"],
  ["SUPABASE_PUBLISHABLE_KEY", "the email list's public key"],
  ["LIST_KEY", "the site's key to the email list"],
  ["TURNSTILE_SECRET", "the spam check's secret half"],
  ["APPLE_SIGN_IN_KEY", "the Sign in with Apple key"],
  ["APPLE_SIGN_IN_KEY_ID", "that key's id"],
  ["APPLE_TEAM_ID", "the Apple team id"],
];
/** Set only after the first upload works; until then sign-in answers "not on yet". */
export const AFTER = ["SIGN_IN", "APPLE_APP_IDS"];

// The same pattern the release check refuses (shipped.mjs MARKERS).
const TEST_KEY = /\b[123]x0{20}[A-Z]{2}\b/;
const FRONT_PAGES = ["apps/landing/index.html", "apps/landing/ar/index.html"];
const SIGN_IN_CODE = "apps/landing/functions/api/sign-in/index.js";

async function ask(fetch, env, path) {
  const r = await fetch(`${API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { ok: r.ok && json?.success === true, body: json, status: r.status };
}

const why = (got) => (got.body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || `answer ${got.status}`;

/** A file as origin/main holds it, or null when main has no such file. */
function readOriginMain(path) {
  try {
    return execFileSync("git", ["-C", REPO, "show", `origin/main:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

export async function firstUpload({
  env = process.env,
  project = env.HIFTH_APP_PAGES_PROJECT || "hifth-app",
  fetch = globalThis.fetch,
  readMain = readOriginMain,
  say = console.log,
} = {}) {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((k) => !env[k]);
  if (missing.length) {
    say(`✗ ${missing.join(" and ")} not loaded. Run this through make hifth-app-ready, which loads the saved keys (make env-keys-pull env-bootstrap on a new laptop).`);
    return false;
  }
  let ready = true;
  const yes = (line) => say(`  ✓ ${line}`);
  const no = (line) => {
    ready = false;
    say(`  ✗ ${line}`);
  };

  say("On Cloudflare");
  const base = `/pages/projects/${project}`;
  const got = await ask(fetch, env, base);
  if (!got.ok) {
    no(`the Pages project "${project}" (${why(got)}). The owner makes it on the hifth.app account, with main as its live branch.`);
  } else {
    const branch = got.body.result?.production_branch;
    if (branch === "main") yes(`the Pages project "${project}", live branch main`);
    else no(`the Pages project "${project}" has "${branch}" as its live branch, not main. The owner changes it under Settings, Builds.`);

    const domains = await ask(fetch, env, `${base}/domains`);
    const mine = domains.ok ? (domains.body.result ?? []).find((d) => d.name === DOMAIN) : null;
    if (!domains.ok) no(`could not look at the project's domains (${why(domains)})`);
    else if (!mine) no(`${DOMAIN} is not attached to the project. The owner adds it under Custom domains.`);
    else if (mine.status !== "active") no(`${DOMAIN} is attached but ${mine.status}, not active yet. It clears by itself once Cloudflare checks the domain.`);
    else yes(`${DOMAIN} attached and active`);

    const vars = got.body.result?.deployment_configs?.production?.env_vars ?? {};
    for (const [name, what] of BEFORE) {
      if (vars[name] != null) yes(`${name} set (${what})`);
      else no(`${name} not set (${what})`);
    }

    // Live uploads only: a preview upload does not make the next one any less the first.
    const uploads = await ask(fetch, env, `${base}/deployments?env=production`);
    const count = uploads.ok ? (uploads.body.result ?? []).length : null;
    if (count === null) say(`  ? could not count the project's uploads (${why(uploads)})`);
    else if (count === 0) say("  · no upload yet, so the first one runs with --no-carry");
    else say(`  · the project already has ${count} upload(s), so the next one runs without --no-carry`);

    const after = AFTER.filter((n) => vars[n] != null);
    say(`  · after the first upload: ${AFTER.join(" and ")} (${after.length ? `${after.join(", ")} already set` : "not set yet, as expected"})`);
  }

  const widgets = await ask(fetch, env, "/challenges/widgets?per_page=50");
  if (!widgets.ok) no(`could not look for the spam-check widget (${why(widgets)}). The token needs Account, Turnstile, Edit.`);
  else if ((widgets.body.result ?? []).some((w) => (w.domains ?? []).includes(DOMAIN))) yes(`the spam-check widget for ${DOMAIN}`);
  else no(`no spam-check widget for ${DOMAIN} yet. make hifth-app-turnstile ARGS=--make makes it and saves its secret.`);

  say("On main (what a release is built from)");
  // The repo's front page keeps the test key so the form works on this laptop; the release puts
  // the saved real key into its own copy (release-hifth-app.mjs, stampSiteKey).
  const saved = Boolean(env.HIFTH_APP_TURNSTILE_SITEKEY);
  for (const path of FRONT_PAGES) {
    const text = readMain(path);
    if (text == null) no(`${path} is not on main`);
    else if (!TEST_KEY.test(text)) yes(`${path} carries a real spam-check key`);
    else if (saved) yes(`${path} has the test key, and HIFTH_APP_TURNSTILE_SITEKEY is saved, so the release puts the real one in`);
    else no(`${path} has the test key and HIFTH_APP_TURNSTILE_SITEKEY is not saved, so the release would keep it. make hifth-app-turnstile ARGS=--make saves it.`);
  }
  if (readMain(SIGN_IN_CODE) == null) say("  ! the sign-in code is not on main yet, so this upload has no sign-in; switching it on waits for the sign-in pull request to merge and a second upload");
  else yes("the sign-in code is on main");

  say("Saved on this laptop");
  if (env.SUPABASE_DB_URL) yes("SUPABASE_DB_URL (for make hifth-app-list-count)");
  else say("  ! SUPABASE_DB_URL not saved; only make hifth-app-list-count needs it, not the upload");

  say("Not checked here (needs the database password): the email list's tables pushed to the real Supabase project, and the site key's hash stored there. The owner confirms.");
  say(ready ? "✓ ready for the first upload: make hifth-app-publish ARGS=--no-carry, by the owner, from a clean copy of main." : "✗ not ready for the first upload yet.");
  return ready;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit((await firstUpload()) ? 0 : 1);
}

#!/usr/bin/env node
/**
 * Put the previous hifth.app release back, when the one just published is broken.
 *
 *   list         the finished releases on Cloudflare, newest first, with the live one marked
 *   run          make the release before the live one live again, then look at the live site
 *                and check the app carries that release's commit (live.mjs)
 *   run --to X   put back the release of commit X (its first 7 or more characters) instead
 *   run --dry    say which release would be put back, and change nothing
 *
 * Cloudflare keeps every upload, so putting one back copies nothing: it points hifth.app at an
 * older upload (Cloudflare's "rollback"). Only finished production uploads count, never a
 * preview. Each put-back goes one further back, since the live one is the starting point, not
 * the newest. To go forward again, publish, or put back with --to.
 *
 * Must run inside dotenvx (make hifth-app-put-back does), and refuses unless the new account's
 * token and ID are both loaded. Nothing here prints a key or the account ID.
 * Launch item 23 (docs/design/app-store-launch.md).
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLive } from "./live.mjs";

const API = "https://api.cloudflare.com/client/v4";
const SITE = "https://hifth.app";
const MAX_PAGES = 4;

/** Finished production uploads, newest first, each as { id, commit, created }. */
export function productionReleases(deployments) {
  return deployments
    .filter((d) => d.environment === "production" && d.latest_stage?.name === "deploy" && d.latest_stage?.status === "success")
    .map((d) => ({ id: d.id, commit: d.deployment_trigger?.metadata?.commit_hash ?? "", created: d.created_on }))
    .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
}

/**
 * Which release to put back. With `to`, the newest release of that commit; without it, the
 * newest release older than the live one whose commit differs from the live one's.
 */
export function pickTarget(releases, { live, to } = {}) {
  const current = releases.find((r) => r.id === live);
  if (to !== undefined) {
    if (!/^[0-9a-f]{7,40}$/i.test(to)) return { ok: false, why: `"${to}" is not the start of a commit: give at least 7 of its characters.` };
    const target = releases.find((r) => r.commit.toLowerCase().startsWith(to.toLowerCase()));
    if (!target) return { ok: false, why: `no finished release of a commit starting ${to}. make hifth-app-put-back ARGS=list shows them.` };
    if (current && target.commit === current.commit) return { ok: false, why: `commit ${to} is already live.` };
    return { ok: true, target, current };
  }
  if (!current) return { ok: false, why: "Cloudflare does not say which release is live, so there is no release before it to pick." };
  const older = releases.filter((r) => r.created < current.created && r.commit !== current.commit);
  if (older.length === 0) return { ok: false, why: `nothing older than the live release (commit ${short(current.commit)}) to put back.` };
  return { ok: true, target: older[0], current };
}

const short = (commit) => (commit ? commit.slice(0, 8) : "(no commit)");
const when = (iso) => (iso ? iso.replace("T", " ").slice(0, 16) + " UTC" : "");
const errorsOf = (body) => (body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || "no reason given";

/** Ask Cloudflare one thing. The key goes in the header only; an answer's errors are code and message. */
async function ask(fetch, env, path, method = "GET") {
  const r = await fetch(`${API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
  });
  let body = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { ok: r.ok && body?.success === true, body, status: r.status };
}

/** The whole put-back, with the network, the live look and the printing handed in, so it can be tested. */
export async function putBack({
  env = process.env,
  project = env.HIFTH_APP_PAGES_PROJECT || "hifth-app",
  list = false,
  dry = false,
  to,
  fetch = globalThis.fetch,
  verify = (commit) => verifyLive(SITE, { commit }).then((problems) => {
    for (const p of problems) console.log(`  ✗ ${p}`);
    return problems.length === 0;
  }),
  say = console.log,
} = {}) {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((k) => !env[k]);
  if (missing.length) {
    say(`✗ ${missing.join(" and ")} not loaded. Run this through make hifth-app-put-back, which loads the saved keys. Without them it cannot ask Cloudflare anything.`);
    return false;
  }
  const base = `/pages/projects/${project}`;
  const proj = await ask(fetch, env, base);
  if (!proj.ok) {
    say(`✗ Cloudflare would not say which release of "${project}" is live (${proj.status}, ${errorsOf(proj.body)}).`);
    return false;
  }
  const live = proj.body.result?.canonical_deployment?.id;
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const got = await ask(fetch, env, `${base}/deployments?env=production&per_page=25&page=${page}`);
    if (!got.ok) {
      say(`✗ Cloudflare would not list the releases (${got.status}, ${errorsOf(got.body)}).`);
      return false;
    }
    all.push(...(got.body.result ?? []));
    if (page >= (got.body.result_info?.total_pages ?? 1)) break;
  }
  const releases = productionReleases(all);

  if (list) {
    if (releases.length === 0) say(`No finished releases of "${project}" yet.`);
    else say(`Finished releases of "${project}", newest first:`);
    for (const r of releases) say(`  ${short(r.commit)}  ${when(r.created)}${r.id === live ? "  ← live" : ""}`);
    return true;
  }

  const pick = pickTarget(releases, { live, to });
  if (!pick.ok) {
    say(`✗ Not put back: ${pick.why}`);
    return false;
  }
  const { target, current } = pick;
  const from = current ? `commit ${short(current.commit)}, released ${when(current.created)}` : "the live release";
  const into = `commit ${short(target.commit)}, released ${when(target.created)}`;
  if (dry) {
    say(`Dry run: would put back ${into}, in place of ${from}. Nothing was changed.`);
    return true;
  }
  say(`Putting back ${into}, in place of ${from}…`);
  const done = await ask(fetch, env, `${base}/deployments/${target.id}/rollback`, "POST");
  if (!done.ok) {
    say(`✗ Cloudflare refused the put-back (${done.status}, ${errorsOf(done.body)}). The live site is unchanged.`);
    return false;
  }
  say(`✓ Cloudflare now serves commit ${short(target.commit)}. Looking at the live site…`);
  const seen = await verify(target.commit);
  say(seen
    ? `✓ hifth.app carries commit ${short(target.commit)}. To go forward again: fix, merge, make hifth-app-publish.`
    : `✗ the live site does not look right yet. Cloudflare can take a minute; look again with make hifth-app-verify ARGS="--commit ${target.commit}".`);
  return seen;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (command === "list") return putBack({ list: true });
  if (command === "run") return putBack({ dry: rest.includes("--dry"), to: flag("--to") });
  console.log("usage: put-back.mjs list | run [--dry] [--to <commit>]");
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit((await main(process.argv.slice(2))) ? 0 : 1);
}

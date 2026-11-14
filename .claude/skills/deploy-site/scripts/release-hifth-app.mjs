#!/usr/bin/env node
/**
 * Release hifth.app: the front page at the root, the web app under /read/.
 *
 *   check     build the site (make site, with its gates), put the release folder together,
 *             and refuse it if it holds anything but the bare minimum (shipped.mjs). Also
 *             refuses a tree with uncommitted changes (the page-comment files aside), or a
 *             commit that is not on origin/main, because the app's source-code offer names the
 *             commit it was built from.
 *             --no-build checks the last build instead of making a new one.
 *   publish   check, then upload the folder to the hifth.app Cloudflare Pages project, then
 *             verify. Must run inside dotenvx (make hifth-app-publish does), and refuses
 *             unless the new account's token and ID are both loaded. Without them wrangler
 *             would quietly use its own login, which is a different Cloudflare account.
 *   verify    look at the live site (live.mjs). --url to look somewhere else, --commit to
 *             expect a commit other than HEAD.
 *
 * Nothing here prints a key or the account ID. Owner, 2026-11-11: "a cli to help with
 * releasing our site / ensuring the bare minimum is deployed (in prod, no dev functionality)".
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditShipped, readFolder } from "./shipped.mjs";
import { verifyLive } from "./live.mjs";
import { addDevDesigns, commitDates } from "./dev-designs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const LANDING = join(REPO, "apps", "landing");
const APP_DIST = join(REPO, "apps", "web", "dist");
const OUT = join(LANDING, "dist");
const PROJECT = process.env.HIFTH_APP_PAGES_PROJECT || "hifth-app";
const SITE = "https://hifth.app";

/** Front-page files: pages, styles, scripts and pictures at the top of apps/landing. */
const LANDING_FILE = /^(_headers|_redirects|[\w-]+\.(html|css|js|png|svg|ico|webp))$/;
/** Front-page folders copied whole, each with the kinds of file it may hold. */
const LANDING_DIRS = { ar: /^(index|privacy)\.html$/, shots: /^[\w-]+\.(png|jpg|webp)$/, fonts: /^[\w.-]+\.(woff2|txt)$/ };
/** What every app build writes and the site never needs. */
const APP_SKIP = (rel) => rel === "docs" || rel === "_headers" || rel === "_redirects" || extname(rel) === ".map";

/** Put the release folder together from the front page and the app's build. */
export function assemble({ landing = LANDING, app = APP_DIST, out = OUT } = {}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "read"), { recursive: true });
  for (const name of readdirSync(landing)) {
    const full = join(landing, name);
    if (statSync(full).isFile() && LANDING_FILE.test(name) && !/\.test\./.test(name)) {
      cpSync(full, join(out, name));
    }
  }
  for (const [dir, kind] of Object.entries(LANDING_DIRS)) {
    if (!existsSync(join(landing, dir))) continue;
    for (const name of readdirSync(join(landing, dir))) {
      if (!kind.test(name)) continue;
      mkdirSync(join(out, dir), { recursive: true });
      cpSync(join(landing, dir, name), join(out, dir, name));
    }
  }
  cpSync(app, join(out, "read"), {
    recursive: true,
    filter: (src) => src === app || !APP_SKIP(src.slice(app.length + 1)),
  });
  return out;
}

/**
 * What is wrong with the site's Cloudflare settings (apps/landing/wrangler.toml), which the
 * upload reads. The email list lives on Supabase and the form reaches it through Pages
 * secrets, so this file must name no database and hold no Supabase address or key: a
 * Supabase project's address in a checked-in file is one this repo keeps out of sight, and a
 * leftover Cloudflare database block would put up a form the code no longer uses.
 */
export function configProblems(text) {
  const path = "apps/landing/wrangler.toml";
  if (typeof text !== "string") return [{ path, why: "the site's Cloudflare settings are missing" }];
  const lines = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const problems = [];
  if (/\[\[\s*d1_databases\s*\]\]/.test(lines)) {
    problems.push({ path, why: "still names a Cloudflare database; the email list is on Supabase now, so take the block out" });
  }
  if (/supabase\.co|SUPABASE_|LIST_KEY|TURNSTILE_SECRET/i.test(lines)) {
    problems.push({ path, why: "holds a Supabase address or one of the form's secret settings; those go in as Pages secrets, never in this file" });
  }
  return problems;
}

function readConfig() {
  try {
    return readFileSync(join(LANDING, "wrangler.toml"), "utf8");
  } catch {
    return null;
  }
}

function git(...args) {
  const r = spawnSync("git", ["-C", REPO, ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim() };
}

/**
 * The lines of `git status --porcelain` that could change what ships. The page-comment tool
 * adds a line to its thread files after every commit (.page-comments/), and none of them is
 * in the site, so counting them would refuse every release until somebody committed them.
 */
export function changesThatShip(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.trim() !== "")
    // Each line is a one- or two-letter status, then the path. The first line's leading space
    // may already be trimmed away (git() trims its output), so read the path by pattern.
    .filter((line) => !/^\S{1,2}\s+\.page-comments\//.test(line.trimStart()));
}

function gitProblems() {
  const problems = [];
  if (changesThatShip(git("status", "--porcelain").out).length > 0) {
    problems.push({ path: "(working tree)", why: "has uncommitted changes, so the app would name a commit that is not what it was built from; commit or put them aside" });
  }
  git("fetch", "--quiet", "origin", "main");
  if (!git("merge-base", "--is-ancestor", "HEAD", "origin/main").ok) {
    problems.push({ path: "(commit)", why: "this commit is not on origin/main; release only what has been merged" });
  }
  return problems;
}

function say(problems, heading) {
  if (problems.length === 0) return;
  console.log(`\n${heading}`);
  for (const p of problems) console.log(`  ✗ ${p.path} — ${p.why}`);
}

function check({ build, release = true }) {
  const commit = git("rev-parse", "HEAD").out;
  // A folder put together only to look at on this laptop may come from work not
  // yet committed or merged; what it holds is still checked.
  const gitIssues = release ? [...gitProblems(), ...configProblems(readConfig())] : [];
  if (build) {
    console.log("Building the site and running its checks (make site)…");
    const r = spawnSync("make", ["-C", REPO, "site"], { stdio: "inherit" });
    if (r.status !== 0) {
      console.log("\n✗ make site failed; nothing was put together.");
      return { ok: false };
    }
  } else if (!existsSync(join(APP_DIST, "index.html"))) {
    console.log("✗ there is no app build yet; run without --no-build.");
    return { ok: false };
  }
  const out = assemble();
  const { files, bytes } = readFolder(out);
  const { problems } = auditShipped(files, { commit });
  say(problems, "The release folder holds something it must not:");
  say(gitIssues, "This commit cannot be released yet:");
  const ok = problems.length === 0 && gitIssues.length === 0;
  const mb = (bytes / 1e6).toFixed(1);
  console.log(
    ok
      ? `\n✓ ready: ${files.length} files, ${mb} MB, commit ${commit.slice(0, 8)}, in ${out.slice(REPO.length + 1)}/`
      : `\n✗ not ready (${files.length} files, ${mb} MB looked at).`,
  );
  return { ok, out, commit };
}

async function verify({ url = SITE, commit = git("rev-parse", "HEAD").out } = {}) {
  console.log(`\nLooking at ${url} as a reader's browser would…`);
  const problems = await verifyLive(url, { commit });
  say(problems, "The live site is not right:");
  if (problems.length === 0) {
    console.log(`✓ live: the front page, the privacy page and the app answer, the app carries commit ${commit.slice(0, 8)}, and no development address serves anything.`);
    console.log(`  Look at it yourself: ${url}/  ${url}/read/`);
  }
  return problems.length === 0;
}

function publish() {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.log(`✗ ${missing.join(" and ")} not loaded. Run this through make hifth-app-publish, which loads the saved keys. Without them wrangler would use its own login, a different Cloudflare account.`);
    return false;
  }
  const { ok, out, commit } = check({ build: true });
  if (!ok) return false;
  console.log(`\nUploading to the Cloudflare Pages project "${PROJECT}"…`);
  const r = spawnSync(
    "wrangler",
    ["pages", "deploy", out, "--project-name", PROJECT, "--branch", "main", "--commit-hash", commit, "--commit-dirty=false"],
    { cwd: LANDING, stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.log("\n✗ the upload failed; the live site is unchanged.");
    return false;
  }
  return true;
}

/** Cloudflare's published test secret for the spam check: every answer passes, and says it came from example.com. */
export const TEST_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";

/**
 * The made-up site key the local list accepts (supabase/seed.sql stores its hash). It is not a
 * secret: it only opens a copy of the list on this laptop.
 */
export const LOCAL_LIST_KEY = "local-list-key-made-up-not-secret";

/**
 * The local list's address and public key, from `supabase status -o json`, or null when the
 * answer is not one. Only a list on this laptop is accepted, so serve can never be pointed at
 * the real one.
 */
export function localListFrom(statusJson) {
  let j;
  try {
    j = JSON.parse(statusJson);
  } catch {
    return null;
  }
  const url = j?.API_URL;
  const key = j?.PUBLISHABLE_KEY || j?.ANON_KEY;
  if (typeof url !== "string" || typeof key !== "string" || !key) return null;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host !== "127.0.0.1" && host !== "localhost") return null;
  return { url, key };
}

/**
 * What `wrangler pages dev` is run with to serve the release folder on this laptop, form and
 * all. With a local list, the form signs up against it and "sends" the confirm email by
 * writing its link to this server's log; without one, the form says the list is not open yet.
 */
export function serveArgs(port, list = null) {
  const args = [
    "pages", "dev", "dist", "--ip", "127.0.0.1", "--port", String(port),
    "--binding", `TURNSTILE_SECRET=${TEST_TURNSTILE_SECRET}`,
    "--binding", "TURNSTILE_HOSTNAMES=localhost,127.0.0.1,example.com",
  ];
  if (list) {
    args.push(
      "--binding", `SUPABASE_URL=${list.url}`,
      "--binding", `SUPABASE_PUBLISHABLE_KEY=${list.key}`,
      "--binding", `LIST_KEY=${LOCAL_LIST_KEY}`,
      "--binding", "MAIL_SENDER=dev-log",
    );
  }
  return args;
}

const wrangler = (args) => spawnSync("wrangler", args, { cwd: LANDING, stdio: "inherit" }).status === 0;

/**
 * hifth.app on this laptop, first half: the same folder a release would upload,
 * checked, with the Designs button added. The second half,
 * `serve`, only starts the server, so the comment server can start it behind
 * itself without waiting on a build.
 */
function prepare({ build }) {
  const { ok, out } = check({ build, release: false });
  if (!out) return false;
  // What would stop a release (the test key, the placeholder address) is what a
  // local look needs, so it is listed above and served anyway.
  if (!ok) console.log("  (served anyway: those stop a release, not a look on this laptop)");
  // Added after the check, so the check saw the folder as it would go up. publish rebuilds
  // the folder from scratch, and the check refuses both if they ever ride along.
  const listed = addDevDesigns({
    out,
    builtDocs: join(APP_DIST, "docs"),
    notes: join(REPO, "docs", "design"),
    dates: commitDates(REPO, "docs/design"),
  });
  console.log(`  Designs button: ${listed} design pages and notes, on this laptop only (/docs/design/)`);
  return true;
}

/**
 * hifth.app on this laptop, second half: Cloudflare's own local server on the
 * prepared folder, with the spam check's always-pass test keys and, when a local
 * Supabase is running, the sign-up list on it. Nothing here reaches Cloudflare or
 * the real list. SUPABASE_WORKDIR names the folder to ask `supabase status` in,
 * for a local copy run from somewhere other than this repo (other servers on the
 * laptop can hold Supabase's usual ports).
 */
function serve({ port }) {
  if (!existsSync(OUT)) {
    console.log("✗ nothing to serve yet: run prepare first.");
    return false;
  }
  const workdir = process.env.SUPABASE_WORKDIR || REPO;
  const status = spawnSync("supabase", ["--workdir", workdir, "status", "-o", "json"], { encoding: "utf8" });
  const list = status.status === 0 ? localListFrom(status.stdout) : null;
  console.log(list
    ? `  Sign-up list: the local copy at ${list.url}; confirm links are written to this log`
    : "  Sign-up list: no local Supabase running, so the form says the list is not open yet (supabase start, then serve again)");
  return wrangler(serveArgs(port, list));
}

async function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (command === "check") return check({ build: !rest.includes("--no-build") }).ok;
  if (command === "prepare") return prepare({ build: !rest.includes("--no-build") });
  if (command === "serve") return serve({ port: flag("--port") ?? "7124" });
  if (command === "verify") return verify({ url: flag("--url"), commit: flag("--commit") });
  if (command === "publish") return publish() && (await verify());
  console.log("usage: release-hifth-app.mjs check [--no-build] | prepare [--no-build] | serve [--port N] | publish | verify [--url URL] [--commit SHA]");
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit((await main(process.argv.slice(2))) ? 0 : 1);
}

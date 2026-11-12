#!/usr/bin/env node
/**
 * Release hifth.app: the front page at the root, the web app under /read/.
 *
 *   check     build the site (make site, with its gates), put the release folder together,
 *             and refuse it if it holds anything but the bare minimum (shipped.mjs). Also
 *             refuses a tree with uncommitted changes, or a commit that is not on origin/main,
 *             because the app's source-code offer names the commit it was built from.
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

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");
const LANDING = join(REPO, "apps", "landing");
const APP_DIST = join(REPO, "apps", "web", "dist");
const OUT = join(LANDING, "dist");
const PROJECT = process.env.HIFTH_APP_PAGES_PROJECT || "hifth-app";
const SITE = "https://hifth.app";

/** Front-page files: pages, styles, scripts and pictures at the top of apps/landing. */
const LANDING_FILE = /^(_headers|_redirects|[\w-]+\.(html|css|js|png|svg|ico|webp))$/;
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
  cpSync(app, join(out, "read"), {
    recursive: true,
    filter: (src) => src === app || !APP_SKIP(src.slice(app.length + 1)),
  });
  return out;
}

/**
 * What is wrong with the site's Cloudflare settings (apps/landing/wrangler.toml), which the
 * upload reads for the email list's database. Until the database is made on the new account,
 * its id is a stand-in, and an upload would put up a form that saves nothing.
 */
export function configProblems(text) {
  const path = "apps/landing/wrangler.toml";
  if (typeof text !== "string") return [{ path, why: "the site's Cloudflare settings are missing" }];
  const id = /^\s*database_id\s*=\s*"([^"]*)"/m.exec(text)?.[1];
  if (!/^\s*binding\s*=\s*"DB"/m.test(text) || !id) {
    return [{ path, why: "names no database for the email list, so the form would save nothing" }];
  }
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) {
    return [{ path, why: `the email list's database is not made yet (its id is "${id}"); make it on the new account and put its id here` }];
  }
  return [];
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

function gitProblems() {
  const problems = [];
  if (git("status", "--porcelain").out) {
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

function check({ build }) {
  const commit = git("rev-parse", "HEAD").out;
  const gitIssues = [...gitProblems(), ...configProblems(readConfig())];
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

async function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (command === "check") return check({ build: !rest.includes("--no-build") }).ok;
  if (command === "verify") return verify({ url: flag("--url"), commit: flag("--commit") });
  if (command === "publish") return publish() && (await verify());
  console.log("usage: release-hifth-app.mjs check [--no-build] | publish | verify [--url URL] [--commit SHA]");
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit((await main(process.argv.slice(2))) ? 0 : 1);
}

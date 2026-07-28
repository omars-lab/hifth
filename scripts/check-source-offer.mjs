#!/usr/bin/env node
/**
 * The GPL §6 offer, followed the way a stranger would follow it.
 *
 * Publishing a static PWA *conveys* the program — the browser receives real
 * copies of the JS, and `assets/roots/**` is a GPL-covered derivative of the
 * Quranic Arabic Corpus — so the reader is owed the Corresponding Source for
 * the build they are running. The colophon makes that offer by linking
 * `SOURCE_REPO` at the exact build commit. The offer is discharged only if that
 * URL opens for somebody who is not us, and that is what this checks.
 *
 * Three things it does deliberately:
 *
 *   - **Anonymously.** No `gh`, no token, no credentials of any kind. Signed in
 *     as ourselves a private repo looks public, which is precisely the failure
 *     the manual runbook opens a private window to avoid. A check that reuses
 *     our own session would go green on the day the offer stopped resolving.
 *   - **Reads, never retypes.** `SOURCE_REPO` comes out of
 *     `apps/web/src/provenance.ts` and the attribution links out of SOURCES.md's
 *     ```colophon fences. A checker that retyped either would prove only that
 *     two strings were typed the same way twice.
 *   - **Distinguishes "no" from "could not tell."** A 404 is a verdict; a
 *     timeout is not. They exit differently (1 vs 3) and print differently,
 *     because a checker that reports a flaky network as a licence violation
 *     teaches everyone to ignore it — and research ⑦ was cancelled for exactly
 *     the inverse of that mistake.
 *
 * It is NOT in `pnpm gates`, `make ci` or the pre-commit hook, and the file is
 * named `check-` rather than `gate-` to say so: every `scripts/gate-*.mjs` runs
 * on every commit, and this one reaches the public internet. It runs on demand
 * (`make source-offer`) and from the `public-deploy` workflow, which is where a
 * question about what strangers can reach actually belongs.
 *
 * Usage:
 *   make source-offer                    the offer this working tree declares
 *   make source-offer URL=<deployed>     also: what the deployed build serves
 *   node scripts/check-source-offer.mjs [--url <deployed>] [--commit <sha>]
 *
 * Exit: 0 the offer resolves · 1 it does not · 3 could not tell.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./code-pointers.mjs";
import { creditedHrefs } from "./colophon-record.mjs";

const PROVENANCE = join(ROOT, "apps", "web", "src", "provenance.ts");
const TIMEOUT_MS = 15_000;

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

// Exit codes as named things, because the caller that matters is a CI job.
const OK = 0;
const DOES_NOT_RESOLVE = 1;
const CANNOT_TELL = 3;

// ------------------------------------------------------------------ reading

/**
 * `SOURCE_REPO` as `provenance.ts` declares it — parsed, not retyped, for the
 * same reason `colophon.spec.ts` imports the constant instead of repeating it.
 */
function sourceRepo() {
  const ts = readFileSync(PROVENANCE, "utf8");
  const m = ts.match(/export const SOURCE_REPO\s*=\s*"([^"]+)"/);
  if (!m) {
    console.error(
      `apps/web/src/provenance.ts — no \`export const SOURCE_REPO = "…"\`.\n` +
        `  That constant is the offer. If it moved, this checker has to move with it.`,
    );
    process.exit(CANNOT_TELL);
  }
  return m[1].replace(/\/+$/, "");
}

/** The commit a local build would bake in — `vite.config.ts`'s last fallback. */
function headCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ probing

/**
 * One URL, three possible answers: `ok`, `gone`, or `unknown`.
 *
 * HEAD first because the body is never the question; a host that refuses HEAD
 * (405/501) gets a GET, since "this server dislikes HEAD" is not a licence
 * finding. Anything 5xx or 429 is the server having a bad day and is reported
 * as unknown rather than as an answer.
 */
async function probe(url) {
  for (const method of ["HEAD", "GET"]) {
    let res;
    try {
      res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "hifth-source-offer-check" },
      });
    } catch (err) {
      return { state: "unknown", why: err?.name === "TimeoutError" ? "timed out" : String(err) };
    }
    if ((res.status === 405 || res.status === 501) && method === "HEAD") continue;
    if (res.ok) return { state: "ok", status: res.status, res };
    if (res.status === 429 || res.status >= 500) {
      return { state: "unknown", why: `HTTP ${res.status}`, status: res.status };
    }
    return { state: "gone", why: `HTTP ${res.status}`, status: res.status };
  }
  return { state: "unknown", why: "the server refused both HEAD and GET" };
}

/** As above, but the caller wants the body — used only for the deployed build. */
async function fetchText(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "hifth-source-offer-check" },
    });
    if (!res.ok) return { state: res.status >= 500 ? "unknown" : "gone", why: `HTTP ${res.status}` };
    return { state: "ok", text: await res.text(), url: res.url };
  } catch (err) {
    return { state: "unknown", why: err?.name === "TimeoutError" ? "timed out" : String(err) };
  }
}

// --------------------------------------------------------- the deployed half

/**
 * What the deployed build actually hands a reader.
 *
 * No browser: the offer is a pair of string literals Vite baked into the
 * bundle, so fetching the page, following its module scripts and reading those
 * literals answers the question exactly, in two requests. Driving a headless
 * browser to read a constant would be a slower way to learn the same thing —
 * and `colophon.spec.ts` already proves the *chrome* opens the sheet.
 *
 * Quoted 40-hex, not bare: `SOURCE_COMMIT` ships as a string literal, and
 * anchoring on the quotes keeps a hash that happens to appear inside some
 * vendored blob from being mistaken for this build's commit.
 */
async function readDeployedOffer(siteUrl, repo) {
  const page = await fetchText(siteUrl);
  if (page.state !== "ok") return { state: page.state, why: `${siteUrl} — ${page.why}` };

  const scripts = [...page.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) =>
    new URL(m[1], page.url).toString(),
  );
  if (scripts.length === 0) {
    return { state: "gone", why: `${siteUrl} served no module script — is that the deployed app?` };
  }

  const commits = new Set();
  let sawRepo = false;
  for (const src of scripts) {
    const js = await fetchText(src);
    if (js.state === "unknown") return { state: "unknown", why: `${src} — ${js.why}` };
    if (js.state !== "ok") continue;
    if (js.text.includes(repo)) sawRepo = true;
    for (const m of js.text.matchAll(/"([0-9a-f]{40})"/g)) commits.add(m[1]);
  }

  return { state: "ok", sawRepo, commits: [...commits], scripts };
}

// -------------------------------------------------------------------- report

const problems = [];
const unknowns = [];
const lines = [];

const repo = sourceRepo();
const deployed = flag("--url");
const say = (mark, text) => lines.push(`  ${mark} ${text}`);

console.log(
  `\nThe GPL §6 offer, followed anonymously${deployed ? ` · deployed: ${deployed}` : ""}\n`,
);

// 1. What commit are we checking the offer for?
let commit = flag("--commit");
let commitFrom = "--commit";

if (deployed) {
  const offer = await readDeployedOffer(deployed, repo);
  if (offer.state === "unknown") {
    unknowns.push(`could not read the deployed build: ${offer.why}`);
    say("?", `the deployed build — ${offer.why}`);
  } else if (offer.state === "gone") {
    problems.push(offer.why);
    say("✗", offer.why);
  } else {
    if (!offer.sawRepo) {
      problems.push(
        `the deployed bundle never mentions ${repo}. The reader is being offered ` +
          `something other than what provenance.ts declares — or the offer is not in the build at all.`,
      );
      say("✗", `${repo} does not appear in the deployed bundle`);
    } else {
      say("✓", `the deployed bundle offers ${repo}`);
    }
    if (offer.commits.length === 0) {
      problems.push(
        `the deployed bundle names no commit, so the offer degrades to the repository root — ` +
          `a branch that moves under the reader rather than the source of the build they are running.\n` +
          `      Fix the build environment (CF_PAGES_COMMIT_SHA → GITHUB_SHA → git rev-parse HEAD), not the constant.`,
      );
      say("✗", "the deployed bundle names no build commit");
    } else if (offer.commits.length > 1 && !commit) {
      // Not a failure by itself — say what was found and check every one.
      say("·", `the deployed bundle carries ${offer.commits.length} 40-hex literals; checking each`);
    }
    if (!commit && offer.commits.length > 0) {
      commit = offer.commits[0];
      commitFrom = "the deployed bundle";
    }
    // Every candidate gets checked below, not just the first.
    if (offer.commits.length > 1) {
      for (const c of offer.commits.slice(1)) {
        const at = `${repo}/tree/${c}`;
        const r = await probe(at);
        if (r.state === "ok") say("✓", `${at}`);
        else if (r.state === "gone") {
          problems.push(`${at} — ${r.why}. A commit the deployed build names must resolve.`);
          say("✗", `${at} — ${r.why}`);
        } else {
          unknowns.push(`${at} — ${r.why}`);
          say("?", `${at} — ${r.why}`);
        }
      }
    }
  }
} else if (!commit) {
  commit = headCommit();
  commitFrom = "git rev-parse HEAD";
}

// 2. The repository root. Checked separately from the tree, because the two
//    fail for different reasons and the fix differs: a 404 here is "the repo is
//    private or moved"; a 404 only on the tree is "that commit was never pushed".
let repoResolves = false;
{
  const r = await probe(repo);
  if (r.state === "ok") {
    repoResolves = true;
    say("✓", `${repo}`);
  } else if (r.state === "gone") {
    problems.push(
      `${repo} — ${r.why} to somebody who is not signed in as us.\n` +
        `      The §6 offer is not discharged and the site must not be published.\n` +
        `      Either make the repository public, or repoint SOURCE_REPO in apps/web/src/provenance.ts\n` +
        `      at wherever the corresponding source is actually served.`,
    );
    say("✗", `${repo} — ${r.why}`);
  } else {
    unknowns.push(`${repo} — ${r.why}`);
    say("?", `${repo} — ${r.why}`);
  }
}

// 3. The build's own tree. This is the offer proper: the source of the binary
//    the reader is running, not a branch that moves under them.
if (!commit) {
  // In --url mode we never fall back to `git rev-parse HEAD`: the question is
  // what the *deployed* build offers, and answering it with our own working
  // tree's commit would be inventing the answer.
  unknowns.push(
    deployed
      ? `no commit to check — the deployed build did not yield one, and none was given with --commit`
      : `no commit to check — not a git checkout, and none was given with --commit`,
  );
  say("?", "no build commit available");
} else {
  const at = `${repo}/tree/${commit}`;
  const r = await probe(at);
  if (r.state === "ok") say("✓", `${at}   (${commitFrom})`);
  else if (r.state === "gone") {
    // Two different findings wear the same status code, and they have different
    // fixes. Do not tell someone to push a commit when the repository itself is
    // the thing a stranger cannot see.
    problems.push(
      repoResolves
        ? `${at} — ${r.why}.\n` +
            `      The repository resolves but this build's commit does not: it was never pushed,\n` +
            `      or the deploy and the source have drifted apart. A link to a commit nobody can\n` +
            `      fetch is worse than no link, because it reads as an offer that has been made.`
        : `${at} — ${r.why}, which follows from the repository itself not resolving.\n` +
            `      Nothing to fix here separately; fix the line above and re-run.`,
    );
    say("✗", `${at} — ${r.why}`);
  } else {
    unknowns.push(`${at} — ${r.why}`);
    say("?", `${at} — ${r.why}`);
  }
}

// 4. The attribution links. Two of these are licence *terms*, not courtesies:
//    corpus.quran.com's require the link, and the mutashabihat data asks for a
//    mention in the app itself. A dead one is a term being quietly failed.
const { links, problems: recordProblems } = creditedHrefs();
for (const p of recordProblems) problems.push(`SOURCES.md — ${p}`);
for (const { id, href } of links) {
  const r = await probe(href);
  if (r.state === "ok") say("✓", `${href}   (${id})`);
  else if (r.state === "gone") {
    problems.push(
      `${href} — ${r.why}. SOURCES.md § ${id} credits it, and the app puts that link in\n` +
        `      front of the reader. Find where the source moved and update the fence.`,
    );
    say("✗", `${href} — ${r.why}   (${id})`);
  } else {
    // A third party's host being unreachable is not evidence the source is
    // gone — the lesson research ⑦ was cancelled over. Say it, do not fail on it.
    unknowns.push(`${href} (${id}) — ${r.why}`);
    say("?", `${href} — ${r.why}   (${id})`);
  }
}

console.log(lines.join("\n"));
console.log("");

if (problems.length > 0) {
  console.error("source-offer — DOES NOT RESOLVE:");
  for (const p of problems) console.error("  -", p);
  if (unknowns.length > 0) {
    console.error("\n  Also could not tell (not counted against the verdict):");
    for (const u of unknowns) console.error("  ?", u);
  }
  console.error(
    `\n  This is the check docs/validation/ledger.json tracks as \`source-offer-resolves\`.\n` +
      `  Record the verdict with:  make record CHECK=source-offer-resolves RESULT='…'`,
  );
  process.exit(DOES_NOT_RESOLVE);
}

if (unknowns.length > 0) {
  console.error("source-offer — COULD NOT TELL:");
  for (const u of unknowns) console.error("  ?", u);
  console.error(
    `\n  Nothing said no. Nothing said yes either, so this is not a pass —\n` +
      `  re-run it when the network is behaving, or from somewhere that can reach these hosts.`,
  );
  process.exit(CANNOT_TELL);
}

console.log(
  `source-offer — OK (${repo}/tree/${commit} and ${links.length} attribution link(s) resolve anonymously)`,
);
process.exit(OK);

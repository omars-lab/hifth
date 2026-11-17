#!/usr/bin/env node
/**
 * Put the source of one release in the public source repo.
 *
 * The word-root data is under the GPL, so every build we publish has to offer its full source.
 * Once this repo is private (decided 2026-11-17, docs/design/laptop-publish.md), that offer is
 * a second, public repo holding one commit per release: exactly the files of the released
 * commit, sitting on the release before it, and tagged release-<first 12 of the commit>. It
 * never holds this repo's history, so the old commits that once held pictures of the book
 * never reach it. Nothing in it is new: every file is already in the released commit.
 *
 *   node release-source.mjs publish --to <repo address> [--commit <sha>]
 *
 * --commit defaults to origin/main's tip, the commit a release builds; pass the uploaded
 * release's own commit when main has moved since. Publishing a release that is already public
 * changes nothing, even an older one.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseTag } from "../../../../scripts/source-offer-url.mjs";

export { releaseTag };

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
// The copy is signed by the project, so no person's name or address goes public with it.
const SIGNER = { name: "Hifth releases", email: "noreply@hifth.app" };
const SCRATCH_REF = "refs/hifth-source/main";

function gitIn(repo, env) {
  return (...args) => {
    const r = spawnSync("git", ["-C", repo, ...args], { env, encoding: "utf8" });
    return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
  };
}

function must(result, what) {
  if (!result.ok) throw new Error(`${what}: ${result.err || "git failed"}`);
  return result.out;
}

/**
 * Make (or find) the public commit for `commit` and push it, with its tag, to `to`.
 * Returns { tag, published: true } when something was pushed, { tag, published: false } when
 * the public repo already had this release.
 */
export function publishSource({ repo = REPO, commit, to }) {
  // Without git's own variables, so a commit hook's GIT_DIR cannot point this at another repo.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const git = gitIn(repo, env);
  const full = must(git("rev-parse", "--verify", `${commit}^{commit}`), `this repo has no commit ${commit.slice(0, 12)}`);
  const tree = must(git("rev-parse", `${full}^{tree}`), "could not read the released files");
  const tag = releaseTag(full);

  // A release that is already public stays as it is. Sending it again would put an old
  // release back on top of newer ones, so the copy's latest would no longer be the latest.
  const tagged = git("ls-remote", "--tags", to, `refs/tags/${tag}`);
  if (!tagged.ok) throw new Error(`could not reach the public repo: ${tagged.err || "git failed"}`);
  if (tagged.out !== "") return { tag, published: false };

  // The public repo's latest release, if it has one, fetched under a name of our own.
  git("update-ref", "-d", SCRATCH_REF);
  const hasMain = git("fetch", "--quiet", "--no-tags", to, `+refs/heads/main:${SCRATCH_REF}`).ok;
  const parent = hasMain ? must(git("rev-parse", SCRATCH_REF), "could not read the public repo") : null;
  try {
    if (parent && must(git("rev-parse", `${parent}^{tree}`), "could not read the public repo") === tree) {
      // Already there. Make sure the tag is too, then stop.
      must(git("push", "--quiet", to, `${parent}:refs/tags/${tag}`), "could not tag the release");
      return { tag, published: false };
    }
    const when = must(git("log", "-1", "--format=%cI", full), "could not read the commit's date");
    const signed = {
      ...env,
      GIT_AUTHOR_NAME: SIGNER.name,
      GIT_AUTHOR_EMAIL: SIGNER.email,
      GIT_AUTHOR_DATE: when,
      GIT_COMMITTER_NAME: SIGNER.name,
      GIT_COMMITTER_EMAIL: SIGNER.email,
      GIT_COMMITTER_DATE: when,
    };
    const message = `Source of the Hifth release built from ${full}\n\nEvery file of that commit, as built for the app and the site.\n`;
    const made = gitIn(repo, signed)("commit-tree", "--no-gpg-sign", tree, ...(parent ? ["-p", parent] : []), "-m", message);
    const copy = must(made, "could not make the public commit");
    // Pushing the new commit sends its files and nothing else: it links only to earlier
    // releases, which the public repo already holds, never to this repo's history.
    // Both or neither, so the copy never has a release on main with no tag, or the reverse.
    must(git("push", "--quiet", "--atomic", to, `${copy}:refs/heads/main`, `${copy}:refs/tags/${tag}`), "could not push to the public repo");
    return { tag, published: true };
  } finally {
    git("update-ref", "-d", SCRATCH_REF);
  }
}

function flag(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command] = process.argv.slice(2);
  const to = flag("--to");
  if (command !== "publish" || !to) {
    console.log("usage: release-source.mjs publish --to <public repo address> [--commit <sha>]");
    process.exit(2);
  }
  const git = gitIn(REPO, process.env);
  let commit = flag("--commit");
  if (!commit) {
    git("fetch", "--quiet", "origin", "main");
    commit = git("rev-parse", "origin/main").out;
  }
  try {
    const { tag, published } = publishSource({ commit, to });
    console.log(published ? `✓ the source of ${commit.slice(0, 8)} is public as ${tag}` : `✓ ${tag} was already public; nothing changed`);
  } catch (e) {
    console.log(`✗ ${e.message}`);
    process.exit(1);
  }
}

/**
 * The public copy of each release's source: one commit per release holding exactly the files of
 * the released commit, with only earlier releases behind it, never this repo's history (where
 * old commits once held pictures of the book). Written before release-source.mjs and seen
 * failing. Every repo here is made up, on this laptop.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fixtureEnv } from "../../../../scripts/gate-fixture.mjs";
import { publishSource, releaseTag } from "./release-source.mjs";

const env = fixtureEnv();
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();

function devRepo() {
  const repo = mkdtempSync(join(tmpdir(), "hifth-dev-"));
  git(repo, "init", "--quiet", "--initial-branch=main");
  return repo;
}

function commit(repo, files, message) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
    git(repo, "add", path);
  }
  git(repo, "-c", "user.name=dev", "-c", "user.email=dev@example.com", "commit", "--quiet", "--no-verify", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

function publicRepo() {
  const target = mkdtempSync(join(tmpdir(), "hifth-public-"));
  git(target, "init", "--quiet", "--bare", "--initial-branch=main");
  return target;
}

test("the first release's copy holds the released files and no history at all", () => {
  const repo = devRepo();
  commit(repo, { "a.txt": "made-up old picture" }, "an old commit that must never go public");
  commit(repo, { "a.txt": "gone" }, "scrubbed");
  const released = commit(repo, { "b.txt": "code" }, "the release");
  const target = publicRepo();

  publishSource({ repo, commit: released, to: target });

  const tag = releaseTag(released);
  assert.equal(git(target, "rev-parse", `${tag}^{tree}`), git(repo, "rev-parse", `${released}^{tree}`));
  assert.equal(git(target, "rev-list", "--count", "main"), "1");
  assert.equal(git(target, "rev-parse", "main"), git(target, "rev-parse", `${tag}^{commit}`));
  // The old commit's file is in no object the public repo holds.
  assert.equal(git(target, "log", "--all", "--format=%s").includes("must never"), false);
  const oldBlob = git(repo, "rev-parse", `${released}~2:a.txt`);
  assert.throws(() => git(target, "cat-file", "-e", oldBlob));
});

test("a later release sits on the one before it, still with none of the working history", () => {
  const repo = devRepo();
  const first = commit(repo, { "b.txt": "one" }, "release one");
  const target = publicRepo();
  publishSource({ repo, commit: first, to: target });
  commit(repo, { "c.txt": "work" }, "work in between");
  const second = commit(repo, { "b.txt": "two" }, "release two");

  publishSource({ repo, commit: second, to: target });

  assert.equal(git(target, "rev-list", "--count", "main"), "2");
  assert.equal(git(target, "rev-parse", "main~1"), git(target, "rev-parse", `${releaseTag(first)}^{commit}`));
  assert.equal(git(target, "rev-parse", "main^{tree}"), git(repo, "rev-parse", `${second}^{tree}`));
  // Each copy names the commit it came from, so a reader can match it to the app's colophon.
  assert.match(git(target, "log", "-1", "--format=%B", "main"), new RegExp(second));
});

test("publishing the same release again changes nothing", () => {
  const repo = devRepo();
  const released = commit(repo, { "b.txt": "one" }, "release");
  const target = publicRepo();
  publishSource({ repo, commit: released, to: target });
  const before = git(target, "rev-parse", "main");

  publishSource({ repo, commit: released, to: target });

  assert.equal(git(target, "rev-parse", "main"), before);
});

test("sending an older release again leaves the newest one on top", () => {
  const repo = devRepo();
  const first = commit(repo, { "b.txt": "one" }, "release one");
  const second = commit(repo, { "b.txt": "two" }, "release two");
  const target = publicRepo();
  publishSource({ repo, commit: first, to: target });
  publishSource({ repo, commit: second, to: target });
  const newest = git(target, "rev-parse", "main");

  const again = publishSource({ repo, commit: first, to: target });

  assert.equal(again.published, false);
  assert.equal(git(target, "rev-parse", "main"), newest);
  assert.equal(git(target, "rev-list", "--count", "main"), "2");
});

test("the tag is the one the app's source link names", () => {
  assert.equal(releaseTag("0123456789abcdef0123456789abcdef01234567"), "release-0123456789ab");
});

test("the copy is signed by the project, not by whoever made the release", () => {
  const repo = devRepo();
  const released = commit(repo, { "b.txt": "one" }, "release");
  const target = publicRepo();
  publishSource({ repo, commit: released, to: target });
  const who = git(target, "log", "-1", "--format=%an <%ae> %cn <%ce>", "main");
  assert.equal(who.includes("dev@example.com"), false);
});

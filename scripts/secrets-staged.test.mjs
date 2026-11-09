// The secret scan before each commit must refuse an Apple signing key (.p8),
// and git must not even offer to stage one. The key is made fresh at run time,
// so this file holds no key of its own for the scan to trip on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");

import { fixtureEnv } from "./gate-fixture.mjs";

// Run from a git hook, this test inherits GIT_DIR, GIT_INDEX_FILE and the
// like, which point at the real repository: written first without the shared
// fixtureEnv(), its `git init` turned the real repo bare and its `git add`
// staged the made-up key into the commit being made (2026-11-09). Every git
// call below runs without them.
const env = fixtureEnv();
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { env, encoding: "utf8", ...opts });

function freshRepo() {
  const dir = mkdtempSync(join(tmpdir(), "hifth-secrets-"));
  execFileSync("git", ["init", "-q", dir], { env });
  copyFileSync(join(repo, ".gitleaks.toml"), join(dir, ".gitleaks.toml"));
  copyFileSync(join(repo, ".gitignore"), join(dir, ".gitignore"));
  return dir;
}

function appleStyleKey() {
  // An App Store Connect key is an EC P-256 private key in PKCS#8 form.
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ type: "pkcs8", format: "pem" });
}

test("git ignores a .p8 signing key, so it is never offered for a commit", () => {
  const dir = freshRepo();
  try {
    writeFileSync(join(dir, "AuthKey_TEST.p8"), appleStyleKey());
    const r = run("git", ["-C", dir, "check-ignore", "-q", "AuthKey_TEST.p8"]);
    assert.equal(r.status, 0, ".gitignore does not cover *.p8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the pre-commit secret scan refuses a staged signing key", () => {
  const dir = freshRepo();
  try {
    writeFileSync(join(dir, "key.txt"), appleStyleKey());
    execFileSync("git", ["-C", dir, "add", "key.txt"], { env });
    const r = run(
      "gitleaks",
      ["git", "--staged", "--redact", "--no-banner", "--config", ".gitleaks.toml"],
      { cwd: dir },
    );
    assert.notEqual(r.error?.code, "ENOENT", "gitleaks is not installed");
    assert.equal(r.status, 1, `the scan let a private key through:\n${r.stdout}${r.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The guard for the comment above: run this file the way a commit hook in a
// worktree does (this repo is worked in worktrees), with GIT_DIR and
// GIT_INDEX_FILE pointing at a stand-in worktree's git folder, and check the
// stand-in is left as it was: not turned bare, nothing staged.
test("run from a commit hook, it leaves the hook's own repository alone", { skip: process.env.HIFTH_SECRETS_INNER }, () => {
  const top = mkdtempSync(join(tmpdir(), "hifth-decoy-"));
  const main = join(top, "main");
  const wt = join(top, "wt");
  try {
    execFileSync("git", ["init", "-q", main], { env });
    execFileSync("git", ["-C", main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "start"], { env });
    execFileSync("git", ["-C", main, "worktree", "add", "-q", "-b", "wt", wt], { env });
    const gitDir = join(main, ".git", "worktrees", "wt");
    const r = spawnSync(process.execPath, ["--test", import.meta.filename], {
      cwd: wt,
      encoding: "utf8",
      env: { ...env, NODE_TEST_CONTEXT: undefined, HIFTH_SECRETS_INNER: "1", GIT_DIR: gitDir, GIT_INDEX_FILE: join(gitDir, "index") },
    });
    assert.equal(r.status, 0, `the inner run failed:\n${r.stdout}${r.stderr}`);
    const bare = run("git", ["-C", main, "config", "--get", "core.bare"]).stdout.trim();
    assert.equal(bare, "false", "the test turned the hook's repository bare");
    const staged = run("git", ["-C", wt, "diff", "--cached", "--name-only"]).stdout.trim();
    assert.equal(staged, "", `the test staged files into the hook's repository: ${staged}`);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

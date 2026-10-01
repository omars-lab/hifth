/**
 * The pitch build's held copy must never be committable, however it got there.
 *
 * In the main checkout it is a real folder; in every second working copy it is a
 * link back to that folder, so the pitch runs there too. The ignore rule used to
 * end in a slash, which matches only a real folder, so in a second copy the link
 * showed up as a new file one `git add` away from the public repo (2026-09-29).
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../../..");
const HELD = "apps/web/public/assets/private";

/**
 * This process's environment without git's own variables. A commit hook hands its
 * children the real repository's folder in GIT_DIR; inherited, a git command meant
 * for a throwaway repo acts on the real one. Read at call time, not once.
 */
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
const git = (args, opts = {}) => execFileSync("git", args, { ...opts, env: clean() });

/** A throwaway repo carrying this repo's own ignore rules, and nothing else. */
const repo = () => {
  const d = mkdtempSync(join(tmpdir(), "hifth-private-"));
  git(["init", "-q", d]);
  copyFileSync(join(REPO, ".gitignore"), join(d, ".gitignore"));
  mkdirSync(join(d, "apps/web/public/assets"), { recursive: true });
  return d;
};
const untracked = (d) =>
  git(["-C", d, "status", "--porcelain", "--untracked-files=all"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => l.includes("assets/private"));

describe("the pitch build's held copy", () => {
  it("is ignored when it is a real folder (the main checkout)", () => {
    const d = repo();
    mkdirSync(join(d, HELD, "study-quran"), { recursive: true });
    execFileSync("touch", [join(d, HELD, "study-quran/pages.json")]);
    expect(untracked(d)).toEqual([]);
  });

  it("is ignored when it is a link to the main checkout's folder (a second working copy)", () => {
    const d = repo();
    const target = mkdtempSync(join(tmpdir(), "hifth-private-target-"));
    symlinkSync(target, join(d, HELD));
    expect(untracked(d)).toEqual([]);
  });

  it("leaves the real repository alone when a commit hook is running it", () => {
    // A hook is handed the real repository's folder in GIT_DIR. Inherited, it made
    // `git init` of the throwaway folder re-initialise the real one instead and mark
    // it bare, and the next git command in the checkout failed (2026-09-30).
    // It bit from a second working copy, whose hook is handed that copy's own git
    // folder inside the real repository's, so the test stands one up the same way.
    const real = mkdtempSync(join(tmpdir(), "hifth-private-real-"));
    git(["init", "-q", real]);
    git(["-C", real, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x"]);
    git(["-C", real, "worktree", "add", "-q", join(real, "..", `${real.split("/").pop()}-copy`)]);
    const was = process.env.GIT_DIR;
    process.env.GIT_DIR = join(real, ".git/worktrees", `${real.split("/").pop()}-copy`);
    try {
      untracked(repo());
    } finally {
      if (was === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = was;
    }
    expect(readFileSync(join(real, ".git/config"), "utf8")).not.toMatch(/bare = true/);
  });
});

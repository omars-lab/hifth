/**
 * The pitch build's held copy must never be committable, however it got there.
 *
 * In the main checkout it is a real folder; in every second working copy it is a
 * link back to that folder, so the pitch runs there too. The ignore rule used to
 * end in a slash, which matches only a real folder, so in a second copy the link
 * showed up as a new file one `git add` away from the public repo (2026-09-29).
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(import.meta.dirname, "../../..");
const HELD = "apps/web/public/assets/private";

/** A throwaway repo carrying this repo's own ignore rules, and nothing else. */
const repo = () => {
  const d = mkdtempSync(join(tmpdir(), "hifth-private-"));
  execFileSync("git", ["init", "-q", d]);
  copyFileSync(join(REPO, ".gitignore"), join(d, ".gitignore"));
  mkdirSync(join(d, "apps/web/public/assets"), { recursive: true });
  return d;
};
const untracked = (d) =>
  execFileSync("git", ["-C", d, "status", "--porcelain", "--untracked-files=all"], {
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
});

#!/usr/bin/env node
/*
 * A Stop hook: when a turn ends with Swift under native/ changed and nothing in the
 * shell's tests touched, say so once.
 *
 * Why: the shell's contract is small — a route gets in, the page says it is ready,
 * the screen shows the right thing — and every one of those is proved by a smoke
 * test that launches the real app (native/HifthUITests/SmokeTests.swift) or a
 * Swift Testing case (native/HifthTests/). New shell behaviour that ships without
 * one is the class of change the "a fix ships with its test" tenet is about, and it
 * is easy to forget because `make app-test` takes a couple of minutes.
 *
 * Lets the stop through when: nothing under native/Hifth changed; a test file under
 * native/ changed too; or this hook already sent the session back (stop_hook_active),
 * so it can never loop. Prints {"decision":"block","reason":…} to continue, nothing
 * to let the stop happen. Always exits 0.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function changedFiles() {
  try {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const out = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3).trim());
  } catch {
    return [];
  }
}

export function verdict(files, stopHookActive) {
  if (stopHookActive) return null;
  const shell = files.filter((f) => /^native\/Hifth\/.*\.swift$/.test(f));
  if (shell.length === 0) return null;
  const tested = files.some((f) => /^native\/Hifth(UI)?Tests\/.*\.swift$/.test(f));
  if (tested) return null;
  return (
    `Swift changed under native/Hifth (${shell.join(", ")}) with no test touched. ` +
    "Add or extend a case — a route + screenshot smoke in native/HifthUITests/SmokeTests.swift " +
    "for anything a person would see, a Swift Testing case in native/HifthTests/ for logic — " +
    "then run `make app-test`. If the change genuinely needs no test, say why in the commit."
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    /* no payload: let the stop through */
  }
  const reason = verdict(changedFiles(), input.stop_hook_active === true);
  if (reason) process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

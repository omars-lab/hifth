#!/usr/bin/env node
/**
 * Says whether a push only deletes branches, so `make pre-push` can skip the
 * checks for it. git hands the pre-push hook one line per ref on stdin:
 *
 *   <local ref> <local sha> <remote ref> <remote sha>
 *
 * and a delete (`git push origin --delete x`) has all zeros as its local sha.
 * No code leaves the machine, so there is nothing for the checks to look at.
 * Without this, clearing the 352 branches left over from the 2026-10-08
 * history rewrite would have run the five-minute suite 352 times.
 *
 * It fails closed: exit 0 (skip the checks) only when there is at least one
 * ref and every ref is a delete. A push mixing a delete with real code, a line
 * it cannot read, or no input at all (someone ran `make pre-push` by hand)
 * exits 1, and every check runs.
 *
 * Tested by scripts/push-deletes-only.test.mjs.
 */
import { readFileSync } from "node:fs";

const ZERO = /^0{40}$|^0{64}$/;

export function deletesOnly(input) {
  const lines = input.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return false;
  return lines.every((line) => {
    const fields = line.trim().split(/\s+/);
    return fields.length === 4 && ZERO.test(fields[1]);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // A terminal on stdin means a person ran it, not git: never wait for input.
  let input = "";
  if (!process.stdin.isTTY) {
    try {
      input = readFileSync(0, "utf8");
    } catch {
      input = "";
    }
  }
  if (deletesOnly(input)) {
    console.log("pre-push: every ref in this push is a branch delete, so no code leaves the machine; checks skipped.");
    process.exit(0);
  }
  process.exit(1);
}

#!/usr/bin/env node
/**
 * CI gate: no source file may contain a NUL byte — tracked or not yet.
 *
 * Rationale: a single NUL makes git classify the file as binary, and it stops
 * being reviewable — no diff, no blame, no `git grep`, and review tools show
 * "Bin 0 -> 6090 bytes" instead of the code. It gets in the same way twice
 * over: as a composite-key separator (`` `${a}\0${b}` ``, which reads as a
 * clever "can't collide" choice) and as a paste artifact.
 *
 * This has happened twice — `adjacency.ts` in Loop 5 and `concordance.ts` in
 * Loop 6a — both times found by eye, in a diff that could easily have been
 * skimmed past. Hence a gate rather than a third fix.
 *
 * The separator to use instead is `>`, as `adjacency.ts` does: our composite
 * keys are built from edition ids, edge types, and ayah refs, none of which
 * can contain it.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const NUL = String.fromCharCode(0);

// The whole working tree, filtered here rather than by pathspec. Git's glob
// magic is not the shell's — `packages/*/src/**/*.ts` silently matched 19 of
// 73 sources on the first cut of this gate, `concordance.ts` (the file that
// prompted it) among the misses. A gate that quietly checks a third of the
// tree is worse than none, so the selection stays in plain JS where it can be
// read. Vendored data under packages/etl/data is excluded deliberately: those
// bytes are pinned verbatim and are not ours to reformat (PLAN §8).
const SOURCE_RE = /^(packages|apps|scripts)\/.*\.(ts|tsx|mjs|js|jsx)$/;
// Vendored data, and build output. The second one is new and is the price of
// `--others` below: `apps/web/dist/assets/index-*.js` matches SOURCE_RE, and
// until now the only thing keeping it out was that it is untracked. That is
// still true via `--exclude-standard`, but a gate whose scope depends on
// .gitignore is a gate that changes meaning when somebody edits .gitignore for
// an unrelated reason. Stated here instead, so it is read where it applies.
const EXCLUDE_RE = /^(packages\/etl\/data|.*\/(dist|coverage|playwright-report|test-results))\//;

// `--cached --others --exclude-standard`: the index *and* files on disk that
// are neither tracked nor ignored.
//
// Tracked-only was a real blind spot and not a theoretical one, measured on
// this tree: a new `packages/core/src/*.ts` carrying a NUL passed
// `pnpm gate:text-sources` while it was untracked, and failed the same gate the
// moment it was `git add`ed. So the gate's answer depended on whether you had
// staged yet — and `make ci` is the mirror people run *before* staging, which
// is exactly the run this gate exists to be part of.
//
// CI never saw the gap, because a checkout has no untracked files: everything
// in the commit is tracked. That is the shape of the failure worth remembering
// — a gate that enumerates from git has a different scope on the machine that
// writes the code than on the machine that gates it, and the difference is
// invisible from the machine that gates it.
const files = [
  ...new Set(
    execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n"),
  ),
].filter((f) => SOURCE_RE.test(f) && !EXCLUDE_RE.test(f));

if (files.length === 0) {
  console.error("gate:text-sources — no source files matched; the filter is stale");
  process.exit(1);
}

const offenders = [];
for (const rel of files) {
  // `git ls-files` lists the *index*, so a file deleted in the working tree but
  // not yet staged is still listed and no longer on disk. Reading it blind threw
  // an ENOENT stack trace mid-refactor — a gate crashing is indistinguishable
  // from a gate failing, and it names the wrong problem. A file with no bytes
  // has no NUL byte, and CI runs on a clean tree, so nothing real is skipped.
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  const text = readFileSync(abs, "latin1");
  const at = text.indexOf(NUL);
  if (at === -1) continue;
  offenders.push({ rel, line: text.slice(0, at).split("\n").length });
}

if (offenders.length > 0) {
  console.error("gate:text-sources — FAIL: NUL byte in source (git will treat it as binary):");
  for (const { rel, line } of offenders) console.error(`   ${rel}:${line}`);
  console.error("\n   If it is a composite-key separator, use '>' instead — see adjacency.ts.");
  process.exit(1);
}

console.log(`gate:text-sources — OK (${files.length} sources, no NUL bytes)`);

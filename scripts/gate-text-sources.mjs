#!/usr/bin/env node
/**
 * CI gate: no tracked source file may contain a NUL byte.
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
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const NUL = String.fromCharCode(0);

// The whole tracked tree, filtered here rather than by pathspec. Git's glob
// magic is not the shell's — `packages/*/src/**/*.ts` silently matched 19 of
// 73 sources on the first cut of this gate, `concordance.ts` (the file that
// prompted it) among the misses. A gate that quietly checks a third of the
// tree is worse than none, so the selection stays in plain JS where it can be
// read. Vendored data under packages/etl/data is excluded deliberately: those
// bytes are pinned verbatim and are not ours to reformat (PLAN §8).
const SOURCE_RE = /^(packages|apps|scripts)\/.*\.(ts|tsx|mjs|js|jsx)$/;
const EXCLUDE_RE = /^packages\/etl\/data\//;

const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((f) => SOURCE_RE.test(f) && !EXCLUDE_RE.test(f));

if (files.length === 0) {
  console.error("gate:text-sources — no source files matched; the filter is stale");
  process.exit(1);
}

const offenders = [];
for (const rel of files) {
  const text = readFileSync(join(ROOT, rel), "latin1");
  const at = text.indexOf(NUL);
  if (at === -1) continue;
  offenders.push({ rel, line: text.slice(0, at).split("\n").length });
}

if (offenders.length > 0) {
  console.error("gate:text-sources — FAIL: NUL byte in tracked source (git will treat it as binary):");
  for (const { rel, line } of offenders) console.error(`   ${rel}:${line}`);
  console.error("\n   If it is a composite-key separator, use '>' instead — see adjacency.ts.");
  process.exit(1);
}

console.log(`gate:text-sources — OK (${files.length} sources, no NUL bytes)`);

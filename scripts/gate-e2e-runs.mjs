#!/usr/bin/env node
/**
 * Gate: a browser test file cannot change which runs it is part of without
 * someone looking (docs/design/build-and-test.md ①).
 *
 * The laptop run and the Firefox run each read a hand-kept list of test files
 * in apps/web/playwright.config.ts. A new file left off those lists is simply
 * not run there, and nothing says so: it happened twice in one week of
 * November 2026 (the pencil tests, then the page icons), caught both times
 * only by reading a run's count.
 *
 * So the answer is written down. apps/web/e2e/runs.json says, for every test
 * file, which runs pick it up. This check asks the test runner itself which
 * runs pick up which files (so it can never disagree with a real run) and
 * refuses any difference: a new file, a file dropped from a run, a file added
 * to one. Accepting a difference is one command, `--write`, and the changed
 * record then shows in the commit for a reader to see.
 *
 *   node scripts/gate-e2e-runs.mjs            check
 *   node scripts/gate-e2e-runs.mjs --write    record today's runs
 *
 * The tests hand it made-up answers with --list, --pitch-list, --files and
 * --record.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const write = args.includes("--write");
const recordPath = opt("--record") ?? `${root}apps/web/e2e/runs.json`;
const LISTS = "apps/web/playwright.config.ts";

/** Ask the test runner which runs pick up which files. */
function ask(env) {
  const r = spawnSync("pnpm", ["-C", `${root}apps/web`, "exec", "playwright", "test", "--list", "--reporter=json"], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout.trim().startsWith("{")) {
    console.error("gate:e2e-runs could not run: the test runner did not list its tests.");
    console.error((r.stderr || r.stdout || String(r.error ?? "")).trim().split("\n").slice(-5).join("\n"));
    process.exit(2);
  }
  return JSON.parse(r.stdout);
}

const fromFile = (path) => JSON.parse(readFileSync(path, "utf8"));
// Some runs are only set up when asked for by name: the private pitch build's,
// and the one that takes pictures for the docs. Each is asked for in turn.
const OFF = { HIFTH_PITCH: "", HIFTH_SHOTS: "" };
const listings = opt("--list")
  ? [fromFile(opt("--list")), ...(opt("--pitch-list") ? [fromFile(opt("--pitch-list"))] : [])]
  : [ask(OFF), ask({ ...OFF, HIFTH_PITCH: "1" }), ask({ ...OFF, HIFTH_SHOTS: "1" })];

/** file -> the runs that pick it up */
const now = new Map();
const allRuns = new Set();
function walk(suite) {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests ?? []) {
      allRuns.add(t.projectName);
      if (!now.has(spec.file)) now.set(spec.file, new Set());
      now.get(spec.file).add(t.projectName);
    }
  for (const child of suite.suites ?? []) walk(child);
}
for (const listing of listings) for (const suite of listing.suites ?? []) walk(suite);

const files = opt("--files")
  ? fromFile(opt("--files"))
  : readdirSync(`${root}apps/web/e2e`).filter((f) => f.endsWith(".spec.ts"));

const sorted = (xs) => [...xs].sort();
const said = existsSync(recordPath) ? (fromFile(recordPath).files ?? {}) : {};
const problems = [];

// A file no run picks up is tested nowhere. No record can make that right.
const lost = sorted(files.filter((f) => !now.has(f)));
for (const f of lost) problems.push(`${f} is in no run at all, so nothing tests it. Add it to a list in ${LISTS}.`);

if (write && lost.length === 0) {
  const out = {
    about:
      "Which browser runs pick up each test file. Checked by scripts/gate-e2e-runs.mjs, so a file cannot join or leave a run unseen. Do not edit by hand: change the lists in playwright.config.ts, then run `pnpm gate:e2e-runs --write` and read the difference.",
    files: Object.fromEntries(sorted(now.keys()).map((f) => [f, sorted(now.get(f))])),
  };
  writeFileSync(recordPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`gate:e2e-runs: recorded ${now.size} test files across ${allRuns.size} runs.`);
  process.exit(0);
}

for (const f of sorted(now.keys())) {
  const runs = now.get(f);
  if (!(f in said)) {
    const out = sorted([...allRuns].filter((r) => !runs.has(r)));
    problems.push(`${f} is new. It runs in: ${sorted(runs).join(", ")}. It is not in: ${out.join(", ") || "none"}.`);
    continue;
  }
  const before = new Set(said[f]);
  const gone = sorted([...before].filter((r) => !runs.has(r)));
  const added = sorted([...runs].filter((r) => !before.has(r)));
  if (gone.length) problems.push(`${f} is no longer in: ${gone.join(", ")}.`);
  if (added.length) problems.push(`${f} is now also in: ${added.join(", ")}.`);
}
for (const f of sorted(Object.keys(said))) {
  if (!now.has(f) && !lost.includes(f)) problems.push(`${f} is in the record but the file is gone.`);
}

if (problems.length === 0) {
  console.log(`gate:e2e-runs — OK (${now.size} browser test files, each in the runs the record says)`);
  process.exit(0);
}

console.error("gate:e2e-runs — the browser runs are not what the record says:\n");
for (const p of problems) console.error(`  ✗ ${p}`);
console.error(`
The laptop and Firefox runs each read a hand-kept list in ${LISTS}.
A file left off a list is not run there.
  - If a file should be in a run it is not in, add it to that run's list.
  - If what is printed above is what you meant, accept it:
      pnpm gate:e2e-runs --write
    and commit the changed apps/web/e2e/runs.json with the test.`);
process.exit(1);

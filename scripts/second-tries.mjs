#!/usr/bin/env node
/**
 * Which browser tests passed only on their second try?
 *
 * The browser tests retry a failed test once (apps/web/playwright.config.ts),
 * so a test that fails and then passes still lets the push through. That is
 * right for a busy laptop, and wrong if nobody hears about it: the same test
 * can need a second try on every push for weeks and look green the whole time.
 * So after the push's browser tests this reads Playwright's results file and
 * names each one that needed a second try, with what went wrong the first time,
 * and keeps a line per run in a history inside git's own folder (shared by every
 * worktree, never committed), so a test that keeps doing it says how often.
 *
 * It only reports. The push still passes or fails on the tests themselves.
 *
 *   node scripts/second-tries.mjs                 after a run: report and keep it
 *   node scripts/second-tries.mjs --list          the tests that needed one most often
 *
 * --results <file>   Playwright's results (default apps/web/test-results/results.json)
 * --history <file>   where the runs are kept (default <git common dir>/hifth/second-tries.jsonl)
 * --commit <sha>     the commit the run tested (default HEAD)
 *
 * `make pre-push-checks` and `make pitch-e2e` run it after their browser tests;
 * `make second-tries` runs --list. The testing skill says what to do with a name.
 */
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** How many kept runs a repeat is counted over. */
const WINDOW = 20;

/**
 * Every test in a Playwright JSON report that failed and then passed.
 * @returns {{project: string, file: string, line: number, title: string, first: string}[]}
 */
export function secondTries(report) {
  const found = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.status !== "flaky") continue;
        const first = (t.results ?? []).find((r) => r.retry === 0);
        found.push({
          project: t.projectName,
          file: spec.file,
          line: spec.line,
          title: [...path, spec.title].join(" › "),
          first: first?.status ?? "unknown",
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  // The top level of each file is the file itself, not a group, so its title is left out.
  for (const file of report.suites ?? []) walk(file, []);
  return found;
}

const key = (t) => `${t.project}|${t.file}|${t.title}`;

/** Each test across the kept runs, with how many of them it needed a second try in. */
export function repeats(rows) {
  const by = new Map();
  for (const row of rows) {
    for (const t of row.tests ?? []) {
      const k = key(t);
      const seen = by.get(k) ?? { test: t, times: 0 };
      seen.times += 1;
      by.set(k, seen);
    }
  }
  return [...by.values()].sort((a, b) => b.times - a.times || a.test.title.localeCompare(b.test.title));
}

const where = (t) => `${t.project}  ${t.file}:${t.line}  ${t.title}`;

function readHistory(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

function main(argv) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  let history = opt("--history");
  if (!history) {
    const common = git(["rev-parse", "--git-common-dir"], root);
    history = common ? join(isAbsolute(common) ? common : join(root, common), "hifth", "second-tries.jsonl") : "";
  }

  if (argv.includes("--list")) {
    const rows = history ? readHistory(history).slice(-WINDOW) : [];
    const list = repeats(rows);
    console.log(`Browser tests that needed a second try: ${rows.length} runs kept${rows.length ? ` (the last ${WINDOW} at most)` : ""}.`);
    if (!list.length) console.log("  None.");
    for (const { test, times } of list) console.log(`  ${times}×  ${where(test)}`);
    return;
  }

  const results = opt("--results") ?? join(root, "apps/web/test-results/results.json");
  let report;
  try {
    report = JSON.parse(readFileSync(results, "utf8"));
  } catch (e) {
    console.log(`  The push could not check for second tries: the results file ${results} could not be read (${e.code ?? e.message}).`);
    return;
  }

  const tests = secondTries(report);
  const commit = opt("--commit") ?? git(["rev-parse", "--short", "HEAD"], root);
  const kept = history ? readHistory(history) : [];
  if (history) {
    mkdirSync(dirname(history), { recursive: true });
    appendFileSync(history, JSON.stringify({ at: new Date().toISOString(), commit, tests }) + "\n");
  }

  if (!tests.length) {
    console.log("  Every browser test passed on its first try.");
    return;
  }
  const recent = [...kept, { tests }].slice(-WINDOW);
  const counts = new Map(repeats(recent).map((r) => [key(r.test), r.times]));
  const n = tests.length;
  console.log(`  ${n} browser test${n === 1 ? "" : "s"} passed only on ${n === 1 ? "its" : "their"} second try. Each one is a fault to fix (the testing skill says how):`);
  for (const t of tests) {
    const times = counts.get(key(t)) ?? 1;
    console.log(`    ${where(t)}`);
    console.log(`      first try: ${t.first}; needed a second try in ${times} of the last ${recent.length} runs`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));

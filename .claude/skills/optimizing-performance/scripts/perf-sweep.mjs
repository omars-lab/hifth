#!/usr/bin/env node
/**
 * How much slower does the app start for each extra kilobyte of code?
 *
 * The 150 KB cap in gate-budget.mjs is a stand-in. The promise it stands for is
 * the Lighthouse one in .lighthouserc.json: usable within 2.5 s on a mid-range
 * Android on a slow connection. So the honest way to ask "can we raise the cap?"
 * is to add code and watch the start-up time — which is what this does.
 *
 * For each amount in --add (KB, gzipped) it copies the built app, pads its main
 * script with that much code that cannot be compressed, runs Lighthouse on the
 * copy with the same pinned phone as the gate, and records the median start-up
 * time. The result is written to docs/performance/sweep.json, which
 * perf-report.mjs draws.
 *
 * What the padding is and is not: it is a string the browser has to download
 * and parse, so it measures the download cost of more code exactly. Real code
 * also has to *run*, which a string does not, so treat the curve as the lower
 * bound on the cost of a real feature, never the upper one.
 *
 * Run: `make perf-sweep` (builds first). Slow: about a minute per amount.
 *   --add 0,25,50,100   the amounts to try, KB gzipped (0 is the app as built)
 *   --runs 5            Lighthouse runs per amount; the median is kept
 *
 * Comparing built copies (is the app slower than it was, or is the laptop?):
 *   --compare old=<folder>,new=<folder>   built copies of the app, each with a name
 *   --rounds 5                            each round measures every copy once, in turn
 *   --out <file>                          where the result goes (never the sweep record)
 *   --keep <folder>                       keep each full report, as <name>-<round>.json
 * The copies take turns so that a busy minute on the laptop falls on all of
 * them alike. Every run is kept, since five runs can fall into two groups.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const DIST = join(ROOT, "apps", "web", "dist");
// Where the measuring tool leaves its reports. The setting is for the tests.
const LHCI_DIR = process.env.HIFTH_LHCI_DIR || join(ROOT, ".lighthouseci");
const OUT = join(ROOT, "docs", "performance", "sweep.json");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const ADD_KB = arg("add", "0,25,50,100").split(",").map(Number);
const RUNS = Number(arg("runs", "5"));

const log = (ev, fields = {}) =>
  console.log(
    [new Date().toISOString(), `pid=${process.pid}`, `ev=${ev}`, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)].join(" "),
  );

const COMPARE = arg("compare", "");
if (!COMPARE && !existsSync(DIST)) {
  console.error("perf-sweep — apps/web/dist not found; build first (`make perf-sweep` does)");
  process.exit(1);
}

/** Incompressible padding that gzips to about `bytes`. */
function padding(bytes) {
  let raw = randomBytes(Math.ceil(bytes * 0.8)).toString("base64");
  // One correction step: base64 of random bytes gzips to ~3/4 of its length.
  const got = gzipSync(raw).length;
  raw = randomBytes(Math.ceil((bytes * 0.8 * bytes) / got)).toString("base64");
  return `;globalThis.__perfSweepPad=${JSON.stringify(raw)};`;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Measure one folder `runs` times; the full reports, or null when the tool failed. */
function measure(folder, runs, fields) {
  const seen = new Set(existsSync(LHCI_DIR) ? readdirSync(LHCI_DIR) : []);
  log("lighthouse_start", { ...fields, runs });
  try {
    execFileSync(
      "pnpm",
      ["dlx", "@lhci/cli@0.14.x", "collect", `--collect.staticDistDir=${folder}`, `--collect.numberOfRuns=${runs}`],
      { cwd: ROOT, stdio: "ignore", timeout: 15 * 60_000, env: { ...process.env, CHROME_PATH: chrome } },
    );
  } catch (e) {
    log("lighthouse_failed", { ...fields, msg: JSON.stringify(String(e.message).slice(0, 200)) });
    return null;
  }
  return readdirSync(LHCI_DIR)
    .filter((f) => f.startsWith("lhr-") && f.endsWith(".json") && !seen.has(f))
    .map((f) => readFileSync(join(LHCI_DIR, f), "utf8"));
}

if (COMPARE) {
  const builds = COMPARE.split(",").map((pair) => {
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), folder: pair.slice(at + 1), reports: [] };
  });
  const out = arg("out", "");
  const keep = arg("keep", "");
  const rounds = Number(arg("rounds", "5"));
  if (!out) {
    console.error("perf-sweep — --compare needs --out <file> for its result; it never writes the sweep record");
    process.exit(1);
  }
  for (const b of builds) {
    if (!b.name || !existsSync(join(b.folder, "assets"))) {
      console.error(`perf-sweep — no built app at ${b.folder} (give each copy as name=folder)`);
      process.exit(1);
    }
  }
  if (keep) mkdirSync(keep, { recursive: true });
  for (let round = 1; round <= rounds; round += 1) {
    for (const b of builds) {
      const texts = measure(b.folder, 1, { build: b.name, round });
      if (!texts || !texts.length) continue;
      const report = JSON.parse(texts[0]);
      b.reports.push(report);
      if (keep) writeFileSync(join(keep, `${b.name}-${round}.json`), texts[0]);
      log("lighthouse_done", { build: b.name, round, startup_ms: Math.round(report.audits.interactive.numericValue) });
    }
  }
  const all = (b, id) => b.reports.map((r) => Math.round(r.audits[id].numericValue));
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        goalMs: 2500,
        builds: builds.map((b) => ({
          name: b.name,
          runs: b.reports.length,
          startupMs: b.reports.length ? median(all(b, "interactive")) : null,
          allStartupMs: all(b, "interactive"),
          allLargestPaintMs: all(b, "largest-contentful-paint"),
          allBlockingMs: all(b, "total-blocking-time"),
        })),
      },
      null,
      2,
    )}\n`,
  );
  log("compare_written", { file: out, builds: builds.length, rounds });
  process.exit(0);
}
const work = join(tmpdir(), `hifth-perf-sweep-${process.pid}`);
const points = [];

for (const kb of ADD_KB) {
  rmSync(work, { recursive: true, force: true });
  cpSync(DIST, work, { recursive: true });
  const assets = join(work, "assets");
  const main = readdirSync(assets).find((f) => /^index-.*\.js$/.test(f));
  const file = join(assets, main);
  const before = gzipSync(readFileSync(file)).length;
  if (kb > 0) writeFileSync(file, readFileSync(file, "utf8") + padding(kb * 1024));
  const scriptGz = gzipSync(readFileSync(file)).length;

  const texts = measure(work, RUNS, { add_kb: kb, script_gz: scriptGz });
  if (!texts) continue;
  const reports = texts.map((t) => JSON.parse(t));
  const metric = (id) => Math.round(median(reports.map((r) => r.audits[id].numericValue)));
  const point = {
    addedKb: kb,
    scriptGzKb: Math.round(scriptGz / 102.4) / 10,
    appScriptGzKb: Math.round(before / 102.4) / 10,
    runs: reports.length,
    startupMs: metric("interactive"),
    largestPaintMs: metric("largest-contentful-paint"),
    blockingMs: metric("total-blocking-time"),
    allStartupMs: reports.map((r) => Math.round(r.audits.interactive.numericValue)),
  };
  points.push(point);
  log("lighthouse_done", { add_kb: kb, startup_ms: point.startupMs, runs: point.runs });
}
rmSync(work, { recursive: true, force: true });

mkdirSync(join(ROOT, "docs", "performance"), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment: [
        "Start-up time as code is added. Written by .claude/skills/optimizing-performance/scripts/perf-sweep.mjs, drawn by",
        ".claude/skills/optimizing-performance/scripts/perf-report.mjs. startupMs is Lighthouse's time-to-interactive, median",
        "of `runs`, on the phone pinned in .lighthouserc.json. The goal is 2500.",
      ],
      measuredAt: new Date().toISOString(),
      goalMs: 2500,
      points,
    },
    null,
    2,
  )}\n`,
);
log("sweep_written", { file: "docs/performance/sweep.json", points: points.length });

/**
 * The start-up measuring script can compare several built copies of the app,
 * taking turns between them (docs/performance.md ⑳). Turns matter: all the
 * runs of one copy and then all of the other lets a busy minute on the laptop
 * look like a slower app.
 *
 * Each test runs the real script with a made-up measuring tool ahead of the
 * real one on the path. The made-up tool notes the order it was called in and
 * writes a report whose time is read from a file in the copy it was given.
 * Written before the script's change (2026-11-11) and seen failing.
 *
 * Run with the other script tests: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("perf-sweep.mjs", import.meta.url));

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "perf-compare-"));
  const copy = (name, ms) => {
    const d = join(dir, name);
    mkdirSync(join(d, "assets"), { recursive: true });
    writeFileSync(join(d, "assets", "index-abc.js"), `console.log(${JSON.stringify(name)})`);
    writeFileSync(join(d, "fake-ms.txt"), String(ms));
    return d;
  };
  // The made-up measuring tool, called as `pnpm dlx … --collect.staticDistDir=<copy> …`.
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
const copy = process.argv.find((a) => a.startsWith("--collect.staticDistDir=")).split("=")[1];
const ms = Number(fs.readFileSync(path.join(copy, "fake-ms.txt"), "utf8"));
fs.appendFileSync(${JSON.stringify(join(dir, "order.txt"))}, ms + "\\n");
const out = path.join(process.env.HIFTH_LHCI_DIR, "lhr-" + Date.now() + "-" + process.pid + ".json");
fs.mkdirSync(path.dirname(out), { recursive: true });
const audit = (v) => ({ numericValue: v });
fs.writeFileSync(out, JSON.stringify({ audits: { interactive: audit(ms), "largest-contentful-paint": audit(ms), "total-blocking-time": audit(1) } }));
`,
  );
  chmodSync(join(bin, "pnpm"), 0o755);
  return { dir, copy, bin };
}

const run = (s, args) =>
  spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${s.bin}:${process.env.PATH}`, HIFTH_LHCI_DIR: join(s.dir, "lhci") },
  });

test("two copies are measured in turns, and every run is kept", () => {
  const s = setup();
  const out = join(s.dir, "result.json");
  const keep = join(s.dir, "reports");
  const r = run(s, ["--compare", `old=${s.copy("old", 2100)},new=${s.copy("new", 2300)}`, "--rounds", "3", "--out", out, "--keep", keep]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Turns: old, new, old, new, old, new. Never three of one in a row.
  assert.deepEqual(readFileSync(join(s.dir, "order.txt"), "utf8").trim().split("\n"), ["2100", "2300", "2100", "2300", "2100", "2300"]);
  const saved = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(saved.builds.map((b) => [b.name, b.startupMs, b.allStartupMs]), [
    ["old", 2100, [2100, 2100, 2100]],
    ["new", 2300, [2300, 2300, 2300]],
  ]);
  // The full reports are kept, named by copy and round, for reading side by side.
  assert.deepEqual(readdirSync(keep).sort(), ["new-1.json", "new-2.json", "new-3.json", "old-1.json", "old-2.json", "old-3.json"]);
});

test("comparing never writes the checked-in sweep record", () => {
  const s = setup();
  const record = fileURLToPath(new URL("../docs/performance/sweep.json", import.meta.url));
  const before = readFileSync(record, "utf8");
  const r = run(s, ["--compare", `a=${s.copy("a", 2000)}`, "--rounds", "1", "--out", join(s.dir, "r.json")]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(record, "utf8"), before);
});

test("comparing with no file to write to, or a copy that is not there, stops before measuring", () => {
  const s = setup();
  const noOut = run(s, ["--compare", `a=${s.copy("a", 2000)}`]);
  assert.equal(noOut.status, 1);
  assert.match(noOut.stderr, /--out/);
  const missing = run(s, ["--compare", `a=${join(s.dir, "nowhere")}`, "--out", join(s.dir, "r.json")]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /nowhere/);
  assert.equal(existsSync(join(s.dir, "order.txt")), false);
});

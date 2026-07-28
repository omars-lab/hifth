#!/usr/bin/env node
/**
 * CI gate + renderer: the code map in docs/map.json still describes this code.
 *
 * Every repo grows an orientation doc, and every orientation doc rots. Not
 * loudly — it rots by staying confident: a file is renamed, a function moves,
 * and the map goes on pointing at somewhere that no longer exists. The reader
 * who trusted it loses an hour, and the reader who learns not to trust it has
 * lost the doc entirely. Nothing about writing it more carefully fixes that,
 * because the failure happens later, in a commit about something else.
 *
 * So the map is checked the way anything load-bearing here is checked. This
 * gate opens every file the map names and asserts the `symbol` beside it still
 * literally appears. Rename `bucketEdges` and the build fails on that commit,
 * naming the entry to update — which is the moment the author has the context
 * to update it correctly, and the only moment they ever will.
 *
 * How a pointer is checked — substring rather than a parser, and never a stored
 * line number — lives in scripts/code-pointers.mjs, because docs/use-cases.json
 * is checked the same way and two copies of that rule would drift apart with
 * the looser one silently winning.
 *
 * Usage:
 *   node scripts/gate-map.mjs                 check every pointer (CI)
 *   node scripts/gate-map.mjs --list          one line per feature
 *   node scripts/gate-map.mjs --feature <id>  the full walkthrough for one
 *   node scripts/gate-map.mjs --files a b c   check only entries touching these
 *                                             files (the pre-commit hook path)
 */
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ROOT, locate } from "./code-pointers.mjs";

const MAP = join(ROOT, "docs", "map.json");

const { features } = JSON.parse(readFileSync(MAP, "utf8"));

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

// ---------------------------------------------------------------- renderers

const bullet = (s, indent = "     ") =>
  s.replace(/(.{1,86})(\s|$)/g, `$1\n${indent}`).trimEnd();

function printFeature(f) {
  console.log(`\n${f.id}  ·  ${f.layer}`);
  console.log(`  ${f.what}\n`);
  console.log("  the path through the code");
  f.entry.forEach((e, i) => {
    const at = locate(e.file, e.symbol);
    const where = at.ok ? `${e.file}:${at.line}` : `${e.file}  ⚠ ${at.why}`;
    console.log(`    ${i + 1}. ${where}   ${e.symbol}`);
    console.log(`       ${bullet(e.note, "       ")}`);
  });
  console.log("\n  to extend it");
  f.extend.forEach((s, i) => console.log(`    ${i + 1}. ${bullet(s, "       ")}`));
  console.log(`\n  what will judge it\n    ${f.gates.join("\n    ")}`);
  if (f.seeAlso?.length) console.log(`\n  see also\n    ${f.seeAlso.join(", ")}`);
  console.log("");
}

if (flag("--feature") !== null) {
  const id = flag("--feature");
  const f = features.find((x) => x.id === id);
  if (!f) {
    console.error(`No feature "${id}". Known ids:\n  ${features.map((x) => x.id).join("\n  ")}`);
    process.exit(1);
  }
  printFeature(f);
  process.exit(0);
}

if (argv.includes("--list")) {
  console.log("\nThe map — `make map FEATURE=<id>` for the walkthrough.\n");
  const width = Math.max(...features.map((f) => f.id.length));
  for (const f of features) console.log(`  ${f.id.padEnd(width)}  ${f.what}`);
  console.log("");
  process.exit(0);
}

// ------------------------------------------------------------------- gating

// The hook passes the staged files; only entries that mention one of them need
// checking, so a commit touching three files does not pay for the whole map.
const scope = argv.includes("--files")
  ? new Set(argv.slice(argv.indexOf("--files") + 1).map((f) => relative(ROOT, resolve(f))))
  : null;

const problems = [];
let checked = 0;

for (const f of features) {
  for (const e of f.entry) {
    if (scope && !scope.has(e.file)) continue;
    checked++;
    const at = locate(e.file, e.symbol);
    if (!at.ok) {
      problems.push(
        `${f.id} → ${e.file} (${e.symbol}): ${at.why}.\n` +
          `      The map still tells a newcomer to start here. Update docs/map.json in this commit —\n` +
          `      you have the context now, and whoever hits the stale pointer will not.`,
      );
    }
  }
}

if (scope && checked === 0) {
  process.exit(0); // nothing staged is on the map; say nothing
}

if (problems.length > 0) {
  console.error("gate:map — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

console.log(
  scope
    ? `gate:map — OK (${checked} mapped pointer(s) in the staged files still resolve)`
    : `gate:map — OK (${features.length} features, ${checked} pointers, all resolve)`,
);

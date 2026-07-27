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
 * Two deliberate choices:
 *
 *   - Substring, not a parser. The same reasoning as gate-ci-artifacts: a gate
 *     that has to build the app to check a one-line invariant is a gate people
 *     route around. A symbol string is coarse, and coarse is fine — it catches
 *     the whole failure class (renames, deletions, moves) at zero cost.
 *   - No line numbers stored, ever. Line numbers are the fastest-rotting thing
 *     in any doc; every insertion above invalidates them, and nothing fails.
 *     The renderer computes them at print time, so a printed `file:line` is
 *     true when you read it and is never written down to become false.
 *
 * Usage:
 *   node scripts/gate-map.mjs                 check every pointer (CI)
 *   node scripts/gate-map.mjs --list          one line per feature
 *   node scripts/gate-map.mjs --feature <id>  the full walkthrough for one
 *   node scripts/gate-map.mjs --files a b c   check only entries touching these
 *                                             files (the pre-commit hook path)
 */
import { readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MAP = join(ROOT, "docs", "map.json");

const { features } = JSON.parse(readFileSync(MAP, "utf8"));

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

/**
 * Where a symbol currently lives. Computed at print time, never stored.
 *
 * "First line containing it" is not good enough — in a TS file that is usually
 * the import, and in a well-commented one it is the docblock that mentions it.
 * Sending a reader to an import line is a small betrayal of the whole point, so
 * prefer a line that looks like the definition and fall back in stages.
 */
const DEFINITION = (s) =>
  new RegExp(`(export\\s+)?(async\\s+)?(function|class|const|let|interface|type|enum)\\s+${s}\\b|^\\s*${s}\\s*[(<:=]`);
const IS_IMPORT = /^\s*(import|export)\s.*\bfrom\s|^\s*import\s*\(/;

function locate(file, symbol) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) return { ok: false, why: `file does not exist` };
  const lines = readFileSync(abs, "utf8").split("\n");

  const hits = [];
  lines.forEach((l, i) => l.includes(symbol) && hits.push({ i, l }));
  if (hits.length === 0) return { ok: false, why: `no line contains "${symbol}"` };

  // A symbol that survives only inside a comment is a stale pointer wearing a
  // disguise, and the first draft of this map had one: it sent readers to
  // highlighter.ts for `navigateTo`, which lives in PageStage and is merely
  // MENTIONED in a docblock there. A substring check passed it. Requiring at
  // least one occurrence in real code closes that, and cost nothing to add
  // because the gate had already found the entry by hand.
  const code = hits.filter((h) => !/^\s*(\*|\/\/|#|<!--)/.test(h.l));
  if (code.length === 0) {
    return { ok: false, why: `"${symbol}" appears only in comments here — the code moved and the map did not` };
  }

  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const def = DEFINITION(escaped);
  const best = code.find((h) => !IS_IMPORT.test(h.l) && def.test(h.l)) ?? code.find((h) => !IS_IMPORT.test(h.l)) ?? code[0];
  return { ok: true, line: best.i + 1 };
}

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

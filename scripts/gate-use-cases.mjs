#!/usr/bin/env node
/**
 * CI gate + renderer: docs/use-cases.json still describes this app, and every
 * promise in it is still proven by something that runs.
 *
 * The code map's gate asks one question — does this pointer still resolve? This
 * one asks that and a harder one: is the named test still there, and is it
 * still a test? That second question is the reason the file exists. A use case
 * is a claim about the product; a claim with no runnable proof is a wish, and a
 * document full of wishes is indistinguishable from a document full of facts
 * until someone relies on it.
 *
 * What it refuses, and why each one is a real way this rots:
 *
 *   - A `code` symbol that no longer exists. Same failure as the map: a rename
 *     in a commit about something else, silent until a reader loses an hour.
 *   - A `proof` naming a test that no longer exists, or that exists only as a
 *     string somewhere in the file. Tests get renamed for good reasons; the
 *     moment to notice is the commit doing it.
 *   - A `proof` naming a gate script that package.json does not define. A gate
 *     nobody runs is a comment, and citing one is worse than citing nothing
 *     because it reads as coverage.
 *   - A use case with no proof at all. This is the invariant the whole file is
 *     for: you cannot write down a promise here without saying what keeps it.
 *     A promise whose proof is genuinely thin gets a `gap`, which is rendered
 *     in the doc — honest holes are to-dos, hidden ones are lies.
 *   - A `feature` that docs/map.json does not define, or an `includes` naming a
 *     use case that does not exist. The two documents are joined on those ids;
 *     an unjoined id is a document quietly drifting out of the family.
 *   - An actor with no use cases. A name with nothing behind it is decoration,
 *     and decoration in a spec is read as scope.
 *   - A stale docs/use-cases.md. Same rule as the validation guide and the ETL
 *     output: a committed generated artifact is only trustworthy if a gate
 *     proves it was regenerated.
 *
 * Usage:
 *   node scripts/gate-use-cases.mjs                check everything (CI)
 *   node scripts/gate-use-cases.mjs --list         one line per use case
 *   node scripts/gate-use-cases.mjs --actor <id>   one actor's full picture
 *   node scripts/gate-use-cases.mjs --files a b c  check only entries touching
 *                                                  these files (pre-commit)
 */
import { relative, resolve } from "node:path";
import { ROOT, locate, locateTest } from "./code-pointers.mjs";
import {
  readUseCases,
  mapFeatureIds,
  scriptNames,
  useCasesHash,
  docHash,
  isGateProof,
} from "./use-cases.mjs";

const data = readUseCases();
const { actors, useCases } = data;

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

const actorById = new Map(actors.map((a) => [a.id, a]));
const ucById = new Map(useCases.map((u) => [u.id, u]));

// ---------------------------------------------------------------- renderers

const wrap = (s, indent) => s.replace(/(.{1,84})(\s|$)/g, `$1\n${indent}`).trimEnd();

function printActor(a) {
  const mine = useCases.filter((u) => u.actor === a.id);
  console.log(`\n${a.name}   (${a.id}) · ${mine.length} use case${mine.length === 1 ? "" : "s"}`);
  console.log(`  ${wrap(a.what, "  ")}\n`);
  for (const u of mine) {
    console.log(`  ${u.id}`);
    console.log(`    “${wrap(u.goal, "     ")}”`);
    console.log(`    change it in   make map FEATURE=${u.feature}`);
    for (const c of u.code ?? []) {
      const at = locate(c.file, c.symbol);
      console.log(
        `    happens in     ${at.ok ? `${c.file}:${at.line}` : `${c.file}  ⚠ ${at.why}`}   ${c.symbol}`,
      );
    }
    for (const p of u.proof ?? []) {
      if (isGateProof(p)) {
        console.log(`    proven by      pnpm ${p.gate}`);
      } else {
        const at = locateTest(p.file, p.test);
        console.log(
          `    proven by      ${at.ok ? `${p.file}:${at.line}` : `${p.file}  ⚠ ${at.why}`}`,
        );
        console.log(`                   “${p.test}”`);
      }
    }
    if (u.includes?.length) console.log(`    needs first    ${u.includes.join(", ")}`);
    if (u.gap) console.log(`    NOT proven     ${wrap(u.gap, "                   ")}`);
    console.log("");
  }
}

if (flag("--actor") !== null) {
  const id = flag("--actor");
  const a = actorById.get(id);
  if (!a) {
    console.error(`No actor "${id}". Known ids:\n  ${actors.map((x) => x.id).join("\n  ")}`);
    process.exit(1);
  }
  printActor(a);
  process.exit(0);
}

if (argv.includes("--list")) {
  console.log("\nWho uses Hifth, and what for — `make use-cases ACTOR=<id>` for one actor.\n");
  for (const a of actors) {
    console.log(`  ${a.name}`);
    const width = Math.max(...useCases.map((u) => u.id.length));
    for (const u of useCases.filter((x) => x.actor === a.id)) {
      console.log(`    ${u.id.padEnd(width)}  ${u.goal}`);
    }
    console.log("");
  }
  process.exit(0);
}

// ------------------------------------------------------------------- gating

// The hook passes the staged files; only entries touching one of them need
// checking, so a commit touching three files does not pay for the whole file.
const scope = argv.includes("--files")
  ? new Set(argv.slice(argv.indexOf("--files") + 1).map((f) => relative(ROOT, resolve(f))))
  : null;

const touches = (u) =>
  !scope ||
  (u.code ?? []).some((c) => scope.has(c.file)) ||
  (u.proof ?? []).some((p) => !isGateProof(p) && scope.has(p.file));

const problems = [];
let checked = 0;

// Structural checks are cheap and whole-file; skip them in the scoped hook run,
// where the point is to be silent about everything the commit did not touch.
if (!scope) {
  const features = mapFeatureIds();
  const scripts = scriptNames();

  for (const a of actors) {
    if (!useCases.some((u) => u.actor === a.id)) {
      problems.push(
        `actor "${a.id}" has no use cases — a name with nothing behind it reads as scope we do not have.`,
      );
    }
  }
  for (const u of useCases) {
    if (!actorById.has(u.actor)) problems.push(`${u.id}: no such actor "${u.actor}".`);
    if (!features.has(u.feature)) {
      problems.push(
        `${u.id}: feature "${u.feature}" is not in docs/map.json — the two documents join on that id.`,
      );
    }
    if (!u.proof?.length) {
      problems.push(
        `${u.id}: no proof. Name the test that would fail if this broke, or the gate that refuses it.\n` +
          `      If the proof is thinner than the promise, say so in "gap" — do not leave the promise bare.`,
      );
    }
    for (const p of u.proof ?? []) {
      if (isGateProof(p) && !scripts.has(p.gate)) {
        problems.push(
          `${u.id}: proof names "${p.gate}", which package.json does not define. A gate nobody runs is a comment.`,
        );
      }
    }
    for (const inc of u.includes ?? []) {
      if (!ucById.has(inc)) problems.push(`${u.id}: includes "${inc}", which is not a use case.`);
      if (inc === u.id) problems.push(`${u.id}: includes itself.`);
    }
  }
}

for (const u of useCases) {
  if (!touches(u)) continue;
  for (const c of u.code ?? []) {
    if (scope && !scope.has(c.file)) continue;
    checked++;
    const at = locate(c.file, c.symbol);
    if (!at.ok) {
      problems.push(
        `${u.id} → ${c.file} (${c.symbol}): ${at.why}.\n` +
          `      docs/use-cases.json still says this is where "${u.goal}" happens.`,
      );
    }
  }
  for (const p of u.proof ?? []) {
    if (isGateProof(p)) continue;
    if (scope && !scope.has(p.file)) continue;
    checked++;
    const at = locateTest(p.file, p.test);
    if (!at.ok) {
      problems.push(
        `${u.id} → ${p.file}: ${at.why}.\n` +
          `      That test is the only thing standing behind "${u.goal}".\n` +
          `      If you renamed it, update docs/use-cases.json here. If you deleted it, the promise is now unproven.`,
      );
    }
  }
}

// Staleness last: a wrong pointer is the more urgent news, and reporting "run
// make use-cases-doc" first would send someone to regenerate a doc built from
// a file that does not resolve.
if (!scope) {
  const want = useCasesHash(data);
  const have = docHash();
  if (have !== want) {
    problems.push(
      have === null
        ? `docs/use-cases.md is missing or unstamped. Run \`make use-cases-doc\`.`
        : `docs/use-cases.md was built from ${have}, the source is now ${want}. Run \`make use-cases-doc\`.`,
    );
  }
}

if (scope && checked === 0) {
  process.exit(0); // nothing staged is in the file; say nothing
}

if (problems.length > 0) {
  console.error("gate:use-cases — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

console.log(
  scope
    ? `gate:use-cases — OK (${checked} pointer(s) in the staged files still resolve)`
    : `gate:use-cases — OK (${actors.length} actors, ${useCases.length} use cases, ${checked} pointers, all proven)`,
);

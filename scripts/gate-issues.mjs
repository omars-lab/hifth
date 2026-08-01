#!/usr/bin/env node
/**
 * CI gate + renderer: docs/issues.json still indexes every open item in this
 * repo, and no register has quietly drifted out from under it.
 *
 * The map's gate asks "does this pointer still resolve?". The use-cases gate
 * asks that and "is the named test still a test?". This one asks those and a
 * third question neither of them can: **is there anything in a register that
 * the index does not know about?** That reverse check is the whole reason the
 * catalog exists. page-turning.md SS7 OE9 was a confirmed defect sitting in a
 * design document for six loops; every forward pointer in the repo resolved
 * perfectly the entire time, because nothing pointed at it.
 *
 * What it refuses, and why each one is a real way this rots:
 *
 *   - An entry pointing at a file, a marker, a PLAN follow-up or a ledger check
 *     that no longer exists. Sections get renumbered; the moment to notice is
 *     the commit doing it.
 *   - An entry whose `status` disagrees with the marker in its source. The
 *     duplication IS the check, the same shape as the SOURCES.md <-> Colophon
 *     licence-copy gate: one of the two is now lying and a build should say so.
 *   - An item in a register with no entry here. The reverse direction. This is
 *     the invariant that would have caught OE9.
 *   - `status: "fixed"` with no `closedBy`, or a `closedBy` that does not
 *     resolve. The standing rule of this repo is that a result must tighten
 *     something automated or it has not been banked; "fixed" is the word that
 *     claims it did, so it is the word that has to prove it.
 *   - A `blockedBy` id that looks like an id and matches nothing. A blocker
 *     nobody can look up is a shrug with a citation format.
 *   - A stale docs/issues.md. Same rule as the validation guide, use-cases.md
 *     and the ETL output: a committed generated artifact is only trustworthy
 *     if a gate proves it was regenerated.
 *
 * Deliberately NOT refused: a `pending` anything. Open work is the normal state
 * of a project and a gate that fails for having some would be turned off in a
 * week. This gate only ever fails because two documents disagree.
 *
 * Usage:
 *   node scripts/gate-issues.mjs                check everything (CI)
 *   node scripts/gate-issues.mjs --list         the open items, worst first
 *   node scripts/gate-issues.mjs --all          every item, including closed
 *   node scripts/gate-issues.mjs --id <id>      one item's full picture
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readLedger } from "./validation-ledger.mjs";
import {
  readIssues,
  sectionItems,
  planItems,
  sourceOf,
  issuesHash,
  docHash,
  STATUSES,
  SEVERITIES,
  STATUS_ORDER,
  SECTION_HEADING,
} from "./issues.mjs";

const issues = readIssues();
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? "");
};

const checks = readLedger().checks ?? [];
const ledgerById = new Map(checks.map((c) => [c.id, c]));
const byId = new Map(issues.map((i) => [i.id, i]));

/** Milestones a blocker may name — the ones the ledger already blocks on. */
const milestones = new Set(checks.flatMap((c) => c.blocks ?? []));

/**
 * Every file that is a register. Discovered, not listed: a design doc added
 * next month gets gated the day it grows an open section, with no edit here.
 */
const registers = [
  "docs/backlog.md",
  ...readdirSync(join(ROOT, "docs", "design"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/design/${f}`),
];

/** A ledger-backed entry has no status of its own; it reads the ledger's. */
const statusOf = (i) =>
  i.source.ledger ? (ledgerById.get(i.source.ledger)?.status ?? "?") : i.status;

// ---------------------------------------------------------------- renderers

const wrap = (s, indent) => s.replace(/(.{1,84})(\s|$)/g, `$1\n${indent}`).trimEnd();

/** The title lives in the source document; this is the only place it is read. */
function titleOf(i) {
  if (i.source.ledger) return ledgerById.get(i.source.ledger)?.title ?? i.source.ledger;
  if (i.source.file.endsWith("PLAN.md")) return planItems()?.get(i.source.item)?.title ?? "?";
  return sectionItems(i.source.file)?.get(i.source.item)?.title ?? "?";
}

function printOne(i) {
  const st = statusOf(i);
  console.log(`\n${i.id}   ${st} · ${i.severity} · ${i.owner}`);
  console.log(`  “${titleOf(i)}”`);
  console.log(`  written in     ${sourceOf(i)}`);
  if (i.blockedBy?.length) console.log(`  waiting on     ${i.blockedBy.join(", ")}`);
  if (i.closedBy) console.log(`  stays fixed by ${i.closedBy}`);
  if (i.note) console.log(`  ${wrap(i.note, "  ")}`);
  console.log("");
}

if (flag("--id") !== null) {
  const one = byId.get(flag("--id"));
  if (!one) {
    console.error(`No issue "${flag("--id")}". Known ids:\n  ${issues.map((i) => i.id).join("\n  ")}`);
    process.exit(1);
  }
  printOne(one);
  process.exit(0);
}

if (argv.includes("--list") || argv.includes("--all")) {
  const all = argv.includes("--all");
  const shown = all ? issues : issues.filter((i) => !["answered", "fixed", "done"].includes(statusOf(i)));
  console.log(
    all
      ? `\nEvery item this repo has written down — ${issues.length} of them.\n`
      : `\nWhat is still open — ${shown.length} of ${issues.length}. \`make issues ID=<id>\` for one.\n`,
  );
  const width = Math.max(...shown.map((i) => i.id.length));
  for (const st of STATUS_ORDER.concat(["pending", "done"])) {
    const mine = shown.filter((i) => statusOf(i) === st);
    if (!mine.length) continue;
    console.log(`  ${st}`);
    for (const i of mine) {
      const wait = i.blockedBy?.length ? `  ← ${i.blockedBy.join(", ")}` : "";
      console.log(`    ${i.id.padEnd(width)}  ${i.owner.padEnd(5)}  ${sourceOf(i)}${wait}`);
    }
    console.log("");
  }
  process.exit(0);
}

// ------------------------------------------------------------------- gating

const problems = [];
const seen = new Set();

for (const i of issues) {
  const where = `${i.id}`;
  if (seen.has(i.id)) problems.push(`${where}: duplicate id.`);
  seen.add(i.id);
  if (!/^[a-z0-9-]+$/.test(i.id)) problems.push(`${where}: ids are kebab-case.`);
  if (!SEVERITIES.includes(i.severity)) {
    problems.push(`${where}: severity "${i.severity}" is not one of ${SEVERITIES.join(", ")}.`);
  }
  if (!["agent", "user"].includes(i.owner)) {
    problems.push(`${where}: owner is "agent" or "user", not "${i.owner}".`);
  }

  // ---- the source resolves, and agrees
  if (i.source.ledger) {
    if (!ledgerById.has(i.source.ledger)) {
      problems.push(`${where}: no ledger check "${i.source.ledger}".`);
    }
    if (i.status) {
      problems.push(
        `${where}: a ledger-backed entry must not carry its own status —\n` +
          `      gate:validation is the authority on those, and a second copy here would drift.`,
      );
    }
  } else {
    const { file, item } = i.source;
    if (!existsSync(join(ROOT, file))) {
      problems.push(`${where}: ${file} does not exist.`);
    } else if (file.endsWith("PLAN.md")) {
      if (!planItems()?.has(item)) {
        problems.push(`${where}: PLAN.md §Open follow-ups has no item ${item}.`);
      }
      if (!STATUSES.includes(i.status)) {
        problems.push(`${where}: status "${i.status}" is not one of ${STATUSES.join(", ")}.`);
      }
    } else {
      const items = sectionItems(file);
      if (items === null) {
        problems.push(
          `${where}: ${file} has no “${SECTION_HEADING}” section.\n` +
            `      Every register carries that heading verbatim; without it nothing here can be found.`,
        );
      } else if (!items.has(item)) {
        problems.push(
          `${where}: ${file} has no ${item} row.\n` +
            `      It has ${[...items.keys()].join(" ") || "none"}. Renumbering a section renumbers this file too.`,
        );
      } else if (items.get(item).status !== i.status) {
        problems.push(
          `${where}: this file says "${i.status}", ${file}:${items.get(item).line} says "${items.get(item).status}".\n` +
            `      One of the two is now wrong. The document owns the item; fix whichever is stale.`,
        );
      }
    }
  }

  // ---- "fixed" is the word that has to prove it
  const st = statusOf(i);
  if (st === "fixed") {
    if (!i.closedBy) {
      problems.push(
        `${where}: "fixed" with no closedBy. Name the test that would fail if it came back —\n` +
          `      a defect closed in code and nowhere else is a defect waiting for a refactor.`,
      );
    } else if (!existsSync(join(ROOT, i.closedBy))) {
      problems.push(`${where}: closedBy names ${i.closedBy}, which does not exist.`);
    }
  } else if (i.closedBy && st !== "answered") {
    problems.push(`${where}: closedBy on a "${st}" item — closedBy is what closed it.`);
  }

  // ---- blockers are lookup-able, or plainly prose
  for (const b of i.blockedBy ?? []) {
    if (b.includes(" ")) continue; // "a hafiz", "an Android phone" — prose, on purpose
    if (byId.has(b) || ledgerById.has(b) || milestones.has(b)) continue;
    problems.push(
      `${where}: blockedBy "${b}" matches no issue, ledger check or milestone.\n` +
        `      If it is a person or a piece of hardware, write it as prose ("a hafiz").`,
    );
  }
}

// ---- the reverse direction: nothing in a register is missing from the index
const indexed = new Set(
  issues.filter((i) => !i.source.ledger).map((i) => `${i.source.file} ${i.source.item}`),
);
for (const file of registers) {
  const items = sectionItems(file);
  if (items === null) continue; // a design doc with no open section owes nothing
  for (const [marker, it] of items) {
    if (indexed.has(`${file} ${marker}`)) continue;
    problems.push(
      `${file}:${it.line} — ${marker} “${it.title}” (${it.status}) is not in docs/issues.json.\n` +
        `      An item nobody indexed is an item nobody will find. Add it, or delete the row.`,
    );
  }
}
for (const [n, it] of planItems() ?? []) {
  if (indexed.has(`docs/PLAN.md ${n}`)) continue;
  problems.push(`docs/PLAN.md:${it.line} — follow-up ${n} “${it.title}” is not in docs/issues.json.`);
}
for (const c of checks) {
  if (issues.some((i) => i.source.ledger === c.id)) continue;
  problems.push(`ledger check "${c.id}" is not in docs/issues.json.`);
}

// Staleness last: a wrong pointer is the more urgent news, and reporting "run
// make issues-doc" first would send someone to regenerate a page built from a
// file that does not resolve.
const want = issuesHash(issues);
const have = docHash();
if (have !== want) {
  problems.push(
    have === null
      ? `docs/issues.md is missing or unstamped. Run \`make issues-doc\`.`
      : `docs/issues.md was built from ${have}, the source is now ${want}. Run \`make issues-doc\`.`,
  );
}

if (problems.length > 0) {
  console.error("gate:issues — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

const open = issues.filter((i) => !["answered", "fixed", "done"].includes(statusOf(i)));
console.log(
  `gate:issues — OK (${issues.length} indexed across ${registers.length + 2} registers, ` +
    `${open.length} open, every register item accounted for)`,
);

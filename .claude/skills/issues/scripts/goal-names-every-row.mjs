#!/usr/bin/env node
// Lists the open or blocked launch rows in docs/issues.json that the launch goal page never
// names. The loop works from that page alone, so a row it leaves out is work nobody picks up.
// Exits 1 when any are missing. Run: node .claude/skills/issues/scripts/goal-names-every-row.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LIVE = new Set(["open", "blocked"]);

function rowsOf(register) {
  if (Array.isArray(register)) return register;
  if (Array.isArray(register.issues)) return register.issues;
  return Object.values(register).find(Array.isArray) ?? [];
}

/** The live launch rows whose id does not appear on the page as a whole name. */
export function rowsTheGoalMisses(rows, page) {
  return rows.filter((r) => r.launch === true && LIVE.has(r.status)).filter((r) => {
    const name = r.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(^|[^a-z0-9-])${name}($|[^a-z0-9-])`).test(page);
  });
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const issuesPath = arg("--issues", "docs/issues.json");
  const goalPath = arg("--goal", ".claude/goals/app-store-launch.md");
  const missing = rowsTheGoalMisses(
    rowsOf(JSON.parse(readFileSync(issuesPath, "utf8"))),
    readFileSync(goalPath, "utf8"),
  );
  if (missing.length === 0) {
    console.log(`The goal page names every open launch row (${goalPath}).`);
  } else {
    console.log(`${missing.length} open launch row(s) the goal page never names; add each to "What is left, by line of work":`);
    for (const r of missing) console.log(`  ${r.id}  (${r.status}, ${r.owner ?? "no owner"})`);
    process.exitCode = 1;
  }
}

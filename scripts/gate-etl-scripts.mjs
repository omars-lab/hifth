#!/usr/bin/env node
/**
 * Gate: the committed ETL script census matches the scripts on disk.
 *
 * docs/design/etl-scripts.md is generated from packages/etl/scripts/**\/*.mjs
 * and the code map. This refuses a commit where the committed page was built
 * from a different source — a script added, renamed, or re-described in the map
 * without re-rendering. That is the drift the old hand-drawn §⑤ could not catch,
 * because a gate over the register it read structurally cannot see a file that
 * is absent from the register; this gate reads the directory instead.
 *
 * Usage:
 *   node scripts/gate-etl-scripts.mjs          fail if the doc is stale
 *   node scripts/gate-etl-scripts.mjs --list   print the census summary
 */
import { GROUPS, payload, etlScriptsHash, docHash, DOC_PATH } from "./etl-scripts.mjs";
import { relative } from "node:path";
import { ROOT } from "./code-pointers.mjs";

if (process.argv.includes("--list")) {
  const p = payload();
  console.log(`${p.total} scripts, ${p.documented} in the code map, ${p.total - p.documented} not:`);
  const counts = new Map(GROUPS.map(([k, h]) => [k, { h, n: 0 }]));
  for (const r of p.rows) counts.get(r.group).n++;
  for (const [, { h, n }] of counts) if (n) console.log(`  ${String(n).padStart(3)}  ${h}`);
  process.exit(0);
}

const want = etlScriptsHash();
const have = docHash();
const rel = relative(ROOT, DOC_PATH);

if (have === null) {
  console.error(`✗ ${rel} is missing or has no hash stamp. Run \`make etl-scripts-doc\`.`);
  process.exit(1);
}
if (have !== want) {
  console.error(
    `✗ ${rel} was built from ${have}, the scripts on disk now hash to ${want}.\n` +
      `  A script was added, renamed, or re-described in the code map. Run \`make etl-scripts-doc\`.`,
  );
  process.exit(1);
}
console.log(`✓ ${rel} matches the ${payload().total} scripts on disk (${want}).`);

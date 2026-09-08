#!/usr/bin/env node
/**
 * The ETL runner — one command in front of every registered Qur'an-data source.
 *
 * Under the "every source is a plugin" tenet, no source gets its own entry point. This
 * runner reads the registry and drives whichever source is asked for, so `make etl` runs
 * the ones that ship and the held copy is one named command away — never a separate script
 * anybody has to remember.
 *
 *   node scripts/etl.mjs                 run the default sources (what ships) — this is `make etl`
 *   node scripts/etl.mjs --list          list every registered source and what it does
 *   node scripts/etl.mjs <name> [flags]  run one source by name, forwarding the flags to it
 *   node scripts/etl.mjs --all [flags]   run every source, defaults first (flags go to each)
 *
 * The default run reads and writes only the tree, so it needs no database and no network.
 * A non-default source (the held copy) states what it needs; the runner does not second-guess
 * it — the source keeps its own gates.
 */
import { PLUGINS, byName, defaults } from "./lib/etl-plugins.mjs";

const argv = process.argv.slice(2);

function list() {
  console.log("Registered Qur'an-data sources:\n");
  for (const p of PLUGINS) {
    const tags = [p.role, p.default ? "default" : "on request"].join(", ");
    console.log(`  ${p.name}  (${tags})`);
    console.log(`      ${p.title}`);
    console.log(`      reads:  ${p.reads.join("; ")}`);
    console.log(`      writes: ${p.writes.join("; ")}`);
    if (p.needs) console.log(`      needs:  ${p.needs.join("; ")}`);
    console.log("");
  }
  console.log("Run one:  node scripts/etl.mjs <name> [flags]");
}

async function runOne(plugin, args) {
  console.log(`\n── ${plugin.name}: ${plugin.title} ──`);
  await plugin.run(args);
}

async function main() {
  if (argv.includes("--list")) {
    list();
    return;
  }

  if (argv[0] === "--all") {
    const rest = argv.slice(1);
    // defaults first, then the rest, each source once, in registry order
    const seen = new Set();
    const order = [...defaults(), ...PLUGINS].filter((p) => !seen.has(p.name) && seen.add(p.name));
    for (const p of order) await runOne(p, rest);
    return;
  }

  // a bare name (not a flag) runs that one source, forwarding the remaining flags
  if (argv[0] && !argv[0].startsWith("--")) {
    const plugin = byName(argv[0]);
    if (!plugin) {
      console.error(`etl — no source named "${argv[0]}". Try --list.`);
      process.exit(1);
    }
    await runOne(plugin, argv.slice(1));
    return;
  }

  // no name: run the sources that ship (what `make etl` has always done)
  for (const p of defaults()) await runOne(p, argv);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

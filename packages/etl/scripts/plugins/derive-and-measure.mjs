/**
 * ETL plugin — DERIVE AND MEASURE (the pipeline that ships the app's data).
 *
 * This is the older of the two ways the app takes in Qur'an data, and the one
 * whose output ships. It derives the app's own pages and shards from what the
 * project already owns — the vendored print pages and our own corpora, all in
 * the tree — and measures those against outside rulers without shipping any of
 * the rulers' bytes. Nothing it reads or writes leaves the repository, so its
 * output is what `make ci` compares byte-for-byte against the committed assets.
 *
 * It is a *plugin* under the "every source is a plugin" tenet: same shape as the
 * held-copy source, no privileged path. What makes it the default is only that
 * its output is the shipped build; the measuring it does against the outside
 * library (probe-reference, probe-qul) is its verification, run on its own.
 *
 * run() executes the same four steps `make etl` has always run, in the same
 * order, so the shipped shards do not move.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..");

// The shipped-shard build, unchanged: pages, then the shards derived from them.
const STEPS = ["extract-pages.mjs", "build-adjacency.mjs", "build-roots.mjs", "build-tajweed.mjs"];

/** @type {import("../lib/etl-plugins.mjs").EtlPlugin} */
export default {
  name: "derive-and-measure",
  title: "Derive the app's own pages and shards, and measure them against outside rulers",
  role: "derive",
  default: true,
  reads: ["the vendored print pages and our own corpora — all in the tree"],
  writes: ["the shipped shards (packages/etl/data, apps/web/public/assets) — in the tree"],
  gates: ["pnpm gate:notext", "pnpm gate:scripture", "make ci"],
  // Its second opinion on its own numbers; run on their own, they read caches or
  // the network so they are probes, not gates.
  measuredBy: ["make probe-reference", "make probe-qul"],
  async run() {
    for (const step of STEPS) {
      execFileSync("node", [join(SCRIPTS, step)], { stdio: "inherit" });
    }
  },
};

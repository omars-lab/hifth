/**
 * ETL plugin — HELD COPY (the store that holds the outside library's V4 pieces).
 *
 * This is the newer of the two sources, and it ships nothing. Under `qul-reliance`
 * option D it holds a copy of the outside library — the digital-khatt 15-line page
 * layout (library id 21) and the qpc-v4 word text (library id 47) — in a database
 * the owner controls, off the repository and off the shipped bundle. `qul-store-purpose`
 * settled what that copy is for: to draw the project's OWN word-by-word page and stand
 * it beside the shipped print, so our page registration can be checked against it.
 *
 * It is the complement of the derive-and-measure source, not its replacement: one
 * derives what ships and never holds the outside bytes; this one holds the outside
 * bytes and never ships. Both enter behind this one interface, discovered not
 * hard-wired — the tenet in CLAUDE.md, "Every source of Qur'an data is a plugin".
 *
 * It is NOT a default: it needs the owner's database and, for anything text-bearing,
 * a licence read recorded first. run() forwards its flags straight to the ingest
 * script, which keeps every one of those gates. With no flags it prints its own
 * guidance and touches nothing.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..");

/** @type {import("../lib/etl-plugins.mjs").EtlPlugin} */
export default {
  name: "held-copy",
  title: "Hold the V4 library copy in a store, to draw our own page and check ours against it",
  role: "hold",
  default: false,
  reads: ["gitignored V4 caches: digital-khatt layout (id 21), qpc-v4 word text (id 47)"],
  writes: ["the owner's Supabase store — never the tree and never the shipped bundle"],
  gates: ["pnpm gate:notext", "pnpm gate:scripture"],
  // What it needs before it can do the real (non-dry-run) work — surfaced so a
  // reader of the plugin list sees why it is not the default.
  needs: [
    "SUPABASE_DB_URL (the owner's)",
    "the per-item licence read for any text, font, or morphology held",
  ],
  async run(args = []) {
    // The ingest script owns every gate (licence, dry-run, cache-absent skip); we
    // only forward. With no args it prints its own guidance and exits 0.
    execFileSync("node", [join(SCRIPTS, "ingest-qul-supabase.mjs"), ...args], { stdio: "inherit" });
  },
};

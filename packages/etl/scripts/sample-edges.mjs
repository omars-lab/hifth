#!/usr/bin/env node
/**
 * Draw a random sample of shipped edges for a human to check against a mushaf.
 *
 * PLAN §Testing plan asks for 20 random edges per audit round. "Random" has to
 * be reproducible or the round cannot be re-run, re-checked, or handed to a
 * second reader — so the draw is seeded, and the seed is printed with the
 * sample. Same seed, same twenty edges, on any machine.
 *
 * Output is two things at once: a list a reader can work through with a printed
 * mushaf beside them, and the JSON entries to paste into
 * packages/etl/data/qa/verified-edges.json once they have a verdict. Making the
 * recording step a copy-paste is deliberate — the audit is only worth its cost
 * if the verdicts get banked, and a format the reader has to author by hand is
 * where that stops happening.
 *
 * Usage:
 *   node packages/etl/scripts/sample-edges.mjs             # 20 edges, seed from --seed or 1
 *   node packages/etl/scripts/sample-edges.mjs --n 30 --seed 7
 *   node packages/etl/scripts/sample-edges.mjs --skip-verified   # only unseen edges
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const ADJ = join(ROOT, "apps", "web", "public", "assets", "adj");
const FIXTURE = join(ROOT, "packages", "etl", "data", "qa", "verified-edges.json");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const N = Number(arg("n", 20));
const SEED = Number(arg("seed", 1));
const EDITION = arg("edition", "hafs-kfqc");
const SKIP_VERIFIED = argv.includes("--skip-verified");

/* mulberry32 — a small deterministic PRNG. Math.random() cannot be seeded, and
   an unseeded draw makes the round unrepeatable, which is the one property the
   audit needs most. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dir = join(ADJ, EDITION);
if (!existsSync(dir)) {
  console.error(`sample-edges — no shards for edition "${EDITION}" at ${dir}`);
  process.exit(1);
}

// Flatten every shipped directed edge into one list, so the draw is uniform over
// edges rather than over surahs — surah 2 has two orders of magnitude more edges
// than surah 108, and a per-surah draw would quietly over-sample the short ones.
const all = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const surah = file.replace(/\.json$/, "");
  const shard = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const [ayah, node] of Object.entries(shard)) {
    for (const edge of node.edges ?? []) {
      all.push({
        from: `${surah}:${ayah}`,
        to: edge.to.split("/").pop(),
        type: edge.type,
        page: edge.page,
      });
    }
  }
}

let pool = all;
if (SKIP_VERIFIED && existsSync(FIXTURE)) {
  const seen = new Set(
    (JSON.parse(readFileSync(FIXTURE, "utf8")).entries ?? []).map(
      (e) => `${e.from}>${e.to}>${e.type}`,
    ),
  );
  pool = all.filter((e) => !seen.has(`${e.from}>${e.to}>${e.type}`));
}

const next = rng(SEED);
const picked = [];
const taken = new Set();
while (picked.length < Math.min(N, pool.length)) {
  const i = Math.floor(next() * pool.length);
  if (taken.has(i)) continue;
  taken.add(i);
  picked.push(pool[i]);
}

const today = new Date().toISOString().slice(0, 10);

console.log(`\n  Edge spot-audit — ${picked.length} edges drawn from ${pool.length}`);
console.log(`  edition ${EDITION} · seed ${SEED} · rerun: --seed ${SEED} --n ${N}\n`);
console.log(`  Check each pair in a printed mushaf. The question is not "are these`);
console.log(`  similar?" but "would a hafiz confuse these two while reciting?"\n`);

picked.forEach((e, i) => {
  console.log(
    `  ${String(i + 1).padStart(2)}. ${e.from.padEnd(8)} → ${String(e.to).padEnd(8)} ` +
      `${e.type.padEnd(16)} p.${e.page ?? "?"}`,
  );
});

console.log(`\n  ── Paste into packages/etl/data/qa/verified-edges.json, one per verdict.`);
console.log(`     Set "verdict" to "correct" or "wrong". Record BOTH — a rejected`);
console.log(`     edge that is not written down comes back on the next data refresh.\n`);
console.log(
  JSON.stringify(
    picked.map((e) => ({
      from: e.from,
      to: e.to,
      type: e.type,
      verdict: "TODO-correct-or-wrong",
      verifiedBy: "TODO-name",
      verifiedOn: today,
      note: "",
    })),
    null,
    2,
  )
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n"),
);
console.log("");

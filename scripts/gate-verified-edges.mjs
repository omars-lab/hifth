#!/usr/bin/env node
/**
 * CI gate: every human verdict about an edge still holds against the shipped shards.
 *
 * The other data gates are structural — they prove the ETL is deterministic, the
 * keys parse, the shards are small. None of them can prove an edge is *true*.
 * That takes a reader with a printed mushaf, which is the scarcest input this
 * project has, so their verdicts are recorded in
 * `packages/etl/data/qa/verified-edges.json` and enforced here forever:
 *
 *   verdict "correct" → the edge MUST be present in the shard.
 *   verdict "wrong"   → the edge MUST NOT be present.
 *
 * The negative case is the one that pays: a rejected edge that silently returns
 * on the next data refresh costs the same human time all over again, and nobody
 * notices, because a wrong edge looks exactly like a right one to every
 * automated check we have.
 *
 * The gate reads the *shipped* shards (apps/web/public/assets/adj/), not the ETL
 * internals — what the reader is protected from is what the app serves.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURE = join(ROOT, "packages", "etl", "data", "qa", "verified-edges.json");
const ADJ = join(ROOT, "apps", "web", "public", "assets", "adj");

if (!existsSync(FIXTURE)) {
  console.error(`gate:verified-edges — FAIL: fixture missing at ${FIXTURE}`);
  process.exit(1);
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
const edition = fixture.edition;
const entries = fixture.entries ?? [];

if (!edition) {
  console.error("gate:verified-edges — FAIL: fixture has no `edition`");
  process.exit(1);
}

/** `SS:AA` → the shard file that holds surah SS, or null if it is not shipped. */
const shardCache = new Map();
function shard(surah) {
  if (!shardCache.has(surah)) {
    const p = join(ADJ, edition, `${surah}.json`);
    shardCache.set(surah, existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
  }
  return shardCache.get(surah);
}

/** Does the shipped shard carry this exact directed, typed edge? */
function edgeExists({ from, to, type }) {
  const [surah, ayah] = from.split(":");
  const s = shard(surah);
  if (!s) return { present: false, reason: `no shard for surah ${surah}` };
  const node = s[ayah];
  if (!node) return { present: false, reason: `${from} has no node in the shard` };
  const want = `quran/${edition}/${to}`;
  const hit = (node.edges ?? []).some((e) => e.to === want && e.type === type);
  return { present: hit, reason: hit ? "" : `no ${type} edge ${from} → ${to}` };
}

const failures = [];
let correct = 0;
let rejected = 0;

for (const entry of entries) {
  const { from, to, type, verdict } = entry;
  if (!from || !to || !type || !verdict) {
    failures.push(`malformed entry: ${JSON.stringify(entry)}`);
    continue;
  }
  const { present, reason } = edgeExists(entry);

  if (verdict === "correct") {
    correct++;
    if (!present) {
      failures.push(
        `LOST — ${from} → ${to} (${type}) was verified correct on ` +
          `${entry.verifiedOn ?? "?"} by ${entry.verifiedBy ?? "?"}, but ${reason}.`,
      );
    }
  } else if (verdict === "wrong") {
    rejected++;
    if (present) {
      failures.push(
        `RETURNED — ${from} → ${to} (${type}) was rejected on ` +
          `${entry.verifiedOn ?? "?"} by ${entry.verifiedBy ?? "?"}, but it is shipping again.`,
      );
    }
  } else {
    failures.push(`unknown verdict "${verdict}" on ${from} → ${to}`);
  }
}

if (failures.length) {
  console.error("gate:verified-edges — FAIL\n");
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    "\n  A human checked these against a mushaf. Do not edit the fixture to go" +
      "\n  green — find out what moved the data, and if the data is now right," +
      "\n  re-verify with a reader before changing the verdict.\n",
  );
  process.exit(1);
}

console.log(
  `gate:verified-edges — OK (${correct} verified edges still present, ` +
    `${rejected} rejected edges still absent)`,
);

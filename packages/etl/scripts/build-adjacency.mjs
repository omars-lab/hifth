#!/usr/bin/env node
/**
 * Adjacency shard builder (PLAN §Loop 2 / spec §6).
 *
 * Loop 2 ships ONE curated shard for surah 2, compiled from the interactive
 * mock's hand-verified `ADJ` clusters (docs/reference/linker-mock.html lines
 * 299–331). Loop 4 replaces the *input* — the mock's compact table becomes the
 * full ETL over Waqar144 mutashabihat + QUL phrase ranges — but the OUTPUT
 * format and the `buildShards` compiler stay identical, so the app's loader and
 * the `Adjacency` runtime never change.
 *
 * `buildShards` (in @hifth/core) does the real work: bare "2:123" refs → canonical
 * `quran/<ed>/2:123` keys, curated types → spec §5 ids, and dir bucketing
 * (dSurah/dPage/sameJuz) from each ayah's source page. This script only owns the
 * curated data + where the shards land. Deterministic: same input → byte-identical
 * output (asserted by the ETL determinism gate, PLAN §Testing).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShards } from "@hifth/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ASSETS = join(REPO, "apps", "web", "public", "assets");
const MANIFEST = join(ASSETS, "manifest.json");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const EDITION = manifest.edition;

/**
 * The mock's curated clusters, verbatim (linker-mock.html §ADJ). `page` is the
 * TARGET page; source pages are derived from the manifest below. Types use the
 * mock's compact vocabulary (mutashabih / related / root) — buildShards maps
 * them to the spec ids.
 */
const CURATED = {
  "2:40": [
    { type: "mutashabih", to: "2:47", page: 7, note: "Same opening — continuation differs", ctx: true },
    { type: "mutashabih", to: "2:122", page: 19, note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:47", page: 7, w: "w3" },
  ],
  "2:45": [
    { type: "mutashabih", to: "2:153", page: 23, note: "2:153 prefixes يا أيها الذين آمنوا" },
  ],
  "2:47": [
    { type: "mutashabih", to: "2:122", page: 19, twin: true, note: "Identical twins — surrounding ayahs differ" },
    { type: "mutashabih", to: "2:40", page: 7, note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:122", page: 19, w: "w3" },
  ],
  "2:48": [
    { type: "mutashabih", to: "2:123", page: 19, note: "شفاعة ↔ عدل order swapped; verbs differ" },
    { type: "related", to: "82:19", page: 587, note: "Same theme — no soul avails another" },
  ],
  "2:58": [
    { type: "mutashabih", to: "7:161", page: 171, note: "قولوا حطة ↔ ادخلوا الباب سجدا order swapped" },
  ],
  "2:60": [
    { type: "mutashabih", to: "7:160", page: 170, note: "فانفجرت ↔ فانبجست" },
  ],
  "2:122": [
    { type: "mutashabih", to: "2:47", page: 7, twin: true, note: "Identical twins — surrounding ayahs differ" },
    { type: "mutashabih", to: "2:40", page: 7, note: "Same opening — continuation differs", ctx: true },
    { type: "root", root: "ذ ك ر", to: "2:40", page: 7, w: "w3" },
  ],
  "2:123": [
    { type: "mutashabih", to: "2:48", page: 7, note: "شفاعة ↔ عدل order swapped; verbs differ" },
  ],
};

// Source page for each curated key: from the manifest where vendored, else the
// mock's own `page` fields (the reverse edge always names the source's page).
const sourcePages = {};
for (const p of manifest.pages) {
  for (const poly of p.polygons) {
    sourcePages[`${poly.surah}:${poly.ayah}`] = p.page;
  }
}
// Un-vendored sources still need a page for signed dPage — take them from the
// mock's reverse edges (2:123→2:48 tells us 2:48 is on p7, etc.).
const KNOWN_SOURCE = { "2:45": 7, "2:58": 8, "2:60": 8 };
for (const [k, pg] of Object.entries(KNOWN_SOURCE)) {
  if (sourcePages[k] === undefined) sourcePages[k] = pg;
}

const shards = buildShards(EDITION, CURATED, sourcePages);

const OUT_DIR = join(ASSETS, "adj", EDITION);
mkdirSync(OUT_DIR, { recursive: true });

// Stable key order → byte-identical output across runs (determinism gate).
function sortObject(obj) {
  return Object.fromEntries(
    Object.keys(obj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => [k, obj[k]]),
  );
}

let count = 0;
for (const [surah, shard] of [...shards].sort((a, b) => a[0] - b[0])) {
  const file = join(OUT_DIR, `${surah}.json`);
  writeFileSync(file, JSON.stringify(sortObject(shard), null, 2) + "\n");
  const ayahs = Object.keys(shard).length;
  const edges = Object.values(shard).reduce((n, a) => n + a.edges.length, 0);
  console.log(`build-adjacency — surah ${surah}: ${ayahs} ayahs, ${edges} edges → ${file}`);
  count += 1;
}
console.log(`build-adjacency — wrote ${count} shard(s) for edition ${EDITION}`);

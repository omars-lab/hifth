/**
 * Asset loading for the web shell. Reads the ETL-produced manifest and page
 * SVGs from public/assets. Framework-agnostic; the React layer wraps these.
 */
import { Adjacency, type AdjacencyShard, type AssetManifest } from "@hifth/core";

const BASE = import.meta.env.BASE_URL;

export async function loadManifest(): Promise<AssetManifest> {
  const res = await fetch(`${BASE}assets/manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return (await res.json()) as AssetManifest;
}

/** Fetch a page's raw SVG markup for a given edition. */
export async function loadPageSvg(edition: string, page: number): Promise<string> {
  const res = await fetch(`${BASE}assets/pages/${edition}/${page}.svg`);
  if (!res.ok) throw new Error(`page ${page} fetch failed: ${res.status}`);
  return await res.text();
}

/**
 * Load the adjacency shards for the surahs the app currently needs and build the
 * `Adjacency` routing table. Loop 2 has one shard (surah 2); a missing shard is
 * not fatal — the ayah simply has no hops (empty rail). Loop 4 fetches shards
 * on demand as pages stream in; here we load the known set up front.
 */
export async function loadAdjacency(
  edition: string,
  surahs: readonly number[],
): Promise<Adjacency> {
  const adj = new Adjacency(edition);
  await Promise.all(
    surahs.map(async (surah) => {
      const res = await fetch(`${BASE}assets/adj/${edition}/${surah}.json`);
      if (!res.ok) return; // no shard for this surah → no hops, not an error
      const shard = (await res.json()) as AdjacencyShard;
      adj.addShard(surah, shard);
    }),
  );
  return adj;
}

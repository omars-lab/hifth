/**
 * Asset loading for the web shell. Reads the ETL-produced manifest and page
 * SVGs from public/assets. Framework-agnostic; the React layer wraps these.
 */
import type { AdjacencyShard, AssetManifest } from "@hifth/core";

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
 * Fetch one surah's adjacency shard (Loop 4a: the ETL writes all 114, so a
 * miss is a deploy problem, not a data shape — still treated as "no hops"
 * rather than fatal). The app fetches shards on demand and caches them in
 * state; each shard is a few KB gzipped.
 */
export async function loadShard(
  edition: string,
  surah: number,
): Promise<AdjacencyShard | null> {
  const res = await fetch(`${BASE}assets/adj/${edition}/${surah}.json`);
  if (!res.ok) return null; // no shard → no hops, not an error
  return (await res.json()) as AdjacencyShard;
}

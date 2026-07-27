/**
 * Asset loading for the web shell. Reads the ETL-produced manifest and page
 * SVGs from public/assets. Framework-agnostic; the React layer wraps these.
 */
import type {
  AdjacencyShard,
  AssetManifest,
  AyahRootsShard,
  RootIndexShard,
  TajweedShard,
} from "@hifth/core";

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

/*
 * The root lens (Loop 5) loads in two waves, so it gets its own pair of
 * loaders rather than reusing loadShard: first the selection's surah shard
 * (which roots are on this ayah, and which bucket holds each one), then only
 * the buckets those roots actually need. A root's occurrence list is corpus-
 * wide, so bucketing keeps the second fetch to tens of KB instead of megabytes.
 *
 * Both go through `json()`, which also swallows a *parse* failure, not just a
 * 404: a service worker's navigation fallback answers a missing asset with the
 * app shell at status 200, so "not JSON" is the offline-PWA shape of a miss.
 * The lens is an enhancement — it goes quiet rather than taking the page down.
 */
async function json<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fetch one surah's ayah→roots shard. A miss means "no roots known", not an error. */
export function loadRootAyahShard(
  edition: string,
  surah: number,
): Promise<AyahRootsShard | null> {
  return json<AyahRootsShard>(`${BASE}assets/roots/${edition}/ayah/${surah}.json`);
}

/** Fetch one root→ayahs bucket (ids come from `Roots.bucketsForKey`). */
export function loadRootBucket(
  edition: string,
  bucket: number,
): Promise<RootIndexShard | null> {
  return json<RootIndexShard>(`${BASE}assets/roots/${edition}/root/${bucket}.json`);
}

/**
 * Fetch one surah's tajweed shard (Loop 6a). Same one-shard-per-surah shape and
 * same quiet-on-miss stance as the root lens: the skin is an enhancement, so a
 * missing shard means "no rules known here" and the page stays plain.
 *
 * Only fetched once the skin is switched on — a hafiz who never opens it pays
 * nothing, and the shards are not in the precache list for the same reason.
 */
export function loadTajweedShard(
  edition: string,
  surah: number,
): Promise<TajweedShard | null> {
  return json<TajweedShard>(`${BASE}assets/skins/${edition}/tajweed/${surah}.json`);
}

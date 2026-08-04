/**
 * Asset loading for the web shell. Reads the ETL-produced manifest and page
 * SVGs from public/assets. Framework-agnostic; the React layer wraps these.
 *
 * This file is also the only place that knows what an asset's *address* looks
 * like. `planPack` in @hifth/core deliberately returns page and surah numbers
 * rather than URLs, so `packUrls` here is the one function that turns a plan
 * into files to fetch — a second place that spelled out `assets/pages/` would be
 * quietly wrong the day the base path changes, and the way it would show is a
 * pinned juz that downloaded 21 404s.
 */
import type {
  AdjacencyShard,
  AssetManifest,
  AyahRootsShard,
  PackPlan,
  RootIndexShard,
  TajweedShard,
  WireManifest,
} from "@hifth/core";
import { expandManifest, isCompactManifest } from "@hifth/core";
import { packedResponse } from "./packs.js";

const BASE = import.meta.env.BASE_URL;

export function manifestUrl(): string {
  return `${BASE}assets/manifest.json`;
}

export function pageUrl(edition: string, page: number): string {
  return `${BASE}assets/pages/${edition}/${page}.svg`;
}

export function shardUrl(edition: string, surah: number): string {
  return `${BASE}assets/adj/${edition}/${surah}.json`;
}

/**
 * Every file a pinned juz is made of, pages first so paper arrives before hops.
 *
 * The manifest is in the list even though the service worker precaches it. The
 * precache is exactly what a storage sweep takes, and without the manifest a
 * pinned page is a picture: nothing on it resolves to an ayah, so no tap
 * selects and no hop fires. It is ~1.3 KB gzipped against a few MB of paper,
 * and every pack carrying its own copy is what makes a pack self-sufficient
 * rather than dependent on a cache with a different eviction policy.
 */
export function packUrls(edition: string, plan: PackPlan): string[] {
  return [
    manifestUrl(),
    ...plan.pages.map((page) => pageUrl(edition, page)),
    ...plan.surahs.map((surah) => shardUrl(edition, surah)),
  ];
}

/**
 * Fetch, but look in the pinned pack first.
 *
 * A pinned juz is held in the app's own Cache Storage bucket rather than in the
 * service worker's runtime caches — `packs.ts` explains why (the page cache is a
 * 32-entry LRU, so ordinary browsing would evict a pin). The consequence is
 * here: the pack is only load-bearing if the *app* reads it, so every loader
 * below goes through this and not through bare `fetch`.
 *
 * It is also why offline works in a test with no service worker at all.
 */
async function packedFetch(url: string): Promise<Response> {
  const pinned = await packedResponse(url);
  return pinned ?? (await fetch(url));
}

/**
 * Fetch the manifest and expand it. The ETL writes the compact form (an
 * ayah→page table, ~1.1 KB gzipped for the whole print, versus ~109 KB for the
 * full shape — see `manifest.ts` in @hifth/core); everything downstream still
 * gets an `AssetManifest`. The full shape is still accepted so a manifest
 * written by an older ETL, or served from a stale service-worker cache, loads
 * rather than throwing.
 */
export async function loadManifest(): Promise<AssetManifest> {
  const res = await packedFetch(`${BASE}assets/manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  const wire = (await res.json()) as WireManifest;
  return isCompactManifest(wire) ? expandManifest(wire) : wire;
}

/** Fetch a page's raw SVG markup for a given edition. */
export async function loadPageSvg(edition: string, page: number): Promise<string> {
  const res = await packedFetch(pageUrl(edition, page));
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
  const res = await packedFetch(shardUrl(edition, surah));
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
  const res = await packedFetch(url);
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

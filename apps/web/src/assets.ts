/**
 * Asset loading for the web shell. Reads the ETL-produced manifest and page
 * SVGs from public/assets. Framework-agnostic; the React layer wraps these.
 */
import type { AssetManifest } from "@hifth/core";

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

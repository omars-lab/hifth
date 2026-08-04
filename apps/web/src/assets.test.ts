import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackPlan } from "@hifth/core";
import { PACK_CACHE } from "./packs.js";
import { loadPageSvg, loadShard, packUrls, pageUrl, shardUrl } from "./assets.js";

/*
 * Two things are asserted here and nothing else: that a pinned file is served
 * without the network, and that `packUrls` names the same addresses the loaders
 * ask for.
 *
 * The second is the one that would otherwise fail silently. `planPack` returns
 * page and surah *numbers* on purpose, so the translation to URLs happens once,
 * here — and if the pin wrote `assets/page/…` while the loader read
 * `assets/pages/…`, everything would look healthy online, the pack would report
 * itself whole, and the reader would meet 21 blank leaves in aeroplane mode. So
 * the pinning side and the reading side are checked against each other rather
 * than each against a literal string.
 */

const EDITION = "hafs-kfqc";
const SVG = "<svg><g id='verse-2048'/></svg>";

const pinned = new Map<string, Response>();

beforeEach(() => {
  pinned.clear();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      if (name !== PACK_CACHE) throw new Error(`unexpected cache: ${name}`);
      return { match: async (url: string) => pinned.get(url) };
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A network that is not there — the only honest fixture for "offline". */
function offline(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
}

describe("the pack is read before the network", () => {
  it("serves a pinned page with no network at all", async () => {
    pinned.set(pageUrl(EDITION, 582), new Response(SVG));
    offline();
    expect(await loadPageSvg(EDITION, 582)).toBe(SVG);
  });

  it("serves a pinned shard with no network at all", async () => {
    pinned.set(shardUrl(EDITION, 78), new Response(JSON.stringify({ surah: 78, ayahs: [] })));
    offline();
    expect(await loadShard(EDITION, 78)).toMatchObject({ surah: 78 });
  });

  it("still reaches the network for a page no pack holds", async () => {
    const fetched = vi.fn(async () => new Response(SVG));
    vi.stubGlobal("fetch", fetched);
    expect(await loadPageSvg(EDITION, 1)).toBe(SVG);
    expect(fetched).toHaveBeenCalledWith(pageUrl(EDITION, 1));
  });

  it("does not go to the network when the pack answers", async () => {
    pinned.set(pageUrl(EDITION, 582), new Response(SVG));
    const fetched = vi.fn(async () => new Response(SVG));
    vi.stubGlobal("fetch", fetched);
    await loadPageSvg(EDITION, 582);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe("packUrls", () => {
  const plan: PackPlan = { juz: 30, pages: [582, 583], surahs: [78, 79], absentAyahs: 0 };

  it("names exactly the addresses the loaders will ask for", async () => {
    for (const url of packUrls(EDITION, plan)) pinned.set(url, new Response(SVG));
    offline();
    // If the pin and the read disagreed by one character, these would throw.
    await expect(loadPageSvg(EDITION, 582)).resolves.toBe(SVG);
    await expect(loadPageSvg(EDITION, 583)).resolves.toBe(SVG);
    for (const surah of plan.surahs) {
      pinned.set(shardUrl(EDITION, surah), new Response("{}"));
      await expect(loadShard(EDITION, surah)).resolves.toEqual({});
    }
  });

  it("carries the manifest, without which a pinned page is only a picture", async () => {
    expect(packUrls(EDITION, plan).some((u) => u.endsWith("assets/manifest.json"))).toBe(true);
  });

  it("puts the paper before the hops, so the pages arrive first", () => {
    const urls = packUrls(EDITION, plan);
    const lastPage = urls.lastIndexOf(pageUrl(EDITION, 583));
    const firstShard = urls.indexOf(shardUrl(EDITION, 78));
    expect(lastPage).toBeLessThan(firstShard);
  });
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PACK_CACHE,
  checkPack,
  listPacks,
  packId,
  packStatuses,
  packedResponse,
  packsSupported,
  pinPack,
  unpinPack,
} from "./packs.js";

/*
 * A pack is the one feature whose failure is invisible until it is too late to
 * fix: a hafiz finds out on the plane. So the tests here spend most of their
 * effort on the states *after* something has gone wrong — a sweep took the
 * bytes, a fetch 404ed, the reader cancelled halfway — rather than on the happy
 * path, which is a loop over `fetch` and would pass no matter what.
 *
 * IndexedDB is the real implementation (fake-indexeddb runs the spec). Cache
 * Storage has no equivalent on npm that is worth the dependency, so it is a
 * double — but a double written to the two behaviours this module actually
 * depends on and nothing else: `match` returns undefined for an absent key, and
 * an entry survives until something deletes it. The eviction tests then delete
 * entries behind the module's back, which is exactly what a browser sweep does
 * and is the reason the double exists at all.
 */

class FakeCache {
  readonly entries = new Map<string, Response>();
  async put(url: string, res: Response): Promise<void> {
    this.entries.set(url, res);
  }
  async match(url: string): Promise<Response | undefined> {
    return this.entries.get(url);
  }
  async delete(url: string): Promise<boolean> {
    return this.entries.delete(url);
  }
}

const caches = new Map<string, FakeCache>();

/** The pack cache, created on first ask, as `caches.open` does. */
function packCache(): FakeCache {
  let cache = caches.get(PACK_CACHE);
  if (cache === undefined) {
    cache = new FakeCache();
    caches.set(PACK_CACHE, cache);
  }
  return cache;
}

/** What a storage sweep does: take some or all of the bytes, leave the register. */
function sweep(keep = 0): void {
  const cache = packCache();
  const urls = [...cache.entries.keys()];
  for (const url of urls.slice(keep)) cache.entries.delete(url);
}

const EDITION = "hafs-kfqc";
const URLS = ["/assets/manifest.json", "/assets/pages/hafs-kfqc/582.svg", "/assets/adj/hafs-kfqc/78.json"];

/** A page-sized body, so `bytes` is a number a size line could show. */
const BODY = "x".repeat(1024);

beforeEach(async () => {
  caches.clear();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      let cache = caches.get(name);
      if (cache === undefined) {
        cache = new FakeCache();
        caches.set(name, cache);
      }
      return cache;
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(BODY, { status: 200 })),
  );
  for (const record of await listPacks()) await unpinPack(record.edition, record.juz);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("packsSupported", () => {
  it("is true when both halves are there", () => {
    expect(packsSupported()).toBe(true);
  });

  it("is false without Cache Storage, because bytes with nowhere to go is not a pin", () => {
    vi.stubGlobal("caches", undefined);
    expect(packsSupported()).toBe(false);
  });
});

describe("pinPack", () => {
  it("writes every url and records what it wrote", async () => {
    const record = await pinPack(EDITION, 30, URLS, 0);
    expect(record).not.toBeNull();
    expect(record!.id).toBe(packId(EDITION, 30));
    expect(record!.urls).toEqual(URLS);
    expect(record!.bytes).toBe(BODY.length * URLS.length);
    for (const url of URLS) expect(await packedResponse(url)).toBeDefined();
  });

  it("survives being read back from the register in another session", async () => {
    await pinPack(EDITION, 30, URLS, 0);
    const [record] = await listPacks();
    expect(record?.juz).toBe(30);
    expect(record?.urls).toEqual(URLS);
  });

  it("reports progress once per file, counting bytes as they land", async () => {
    const seen: number[] = [];
    const record = await pinPack(EDITION, 30, URLS, 0, {
      onProgress: (p) => seen.push(p.done),
    });
    expect(seen).toHaveLength(URLS.length);
    expect(Math.max(...seen)).toBe(URLS.length);
    expect(record!.bytes).toBeGreaterThan(0);
  });

  it("records the urls it meant to hold, not the ones it managed to get", async () => {
    // The pin that recorded only its successes is a pin that can never be found
    // wanting: `checkPack` would call a half-downloaded juz whole, and the
    // reader would meet the gap in aeroplane mode.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith(".svg") ? new Response("", { status: 404 }) : new Response(BODY, { status: 200 }),
      ),
    );
    const record = await pinPack(EDITION, 30, URLS, 0);
    expect(record!.urls).toEqual(URLS);
    expect((await checkPack(record!)).health).toBe("torn");
  });

  it("does not abandon the rest of the juz when one file throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith(".svg")) throw new TypeError("network");
        return new Response(BODY, { status: 200 });
      }),
    );
    const record = await pinPack(EDITION, 30, URLS, 0);
    expect((await checkPack(record!)).present).toBe(URLS.length - 1);
  });

  it("stops fetching when cancelled, and keeps what it already wrote", async () => {
    const controller = new AbortController();
    const many = Array.from({ length: 40 }, (_, i) => `/assets/pages/hafs-kfqc/${i + 1}.svg`);
    const record = await pinPack(EDITION, 1, many, 0, {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.done >= 4) controller.abort();
      },
    });
    const status = await checkPack(record!);
    expect(status.present).toBeGreaterThan(0);
    expect(status.present).toBeLessThan(many.length);
    // Still recorded, and still honest about being short.
    expect(status.health).toBe("torn");
  });

  it("says no rather than throwing when the browser has no Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await pinPack(EDITION, 30, URLS, 0)).toBeNull();
  });

  it("says no rather than throwing when the cache refuses the write", async () => {
    vi.stubGlobal("caches", {
      open: async () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });
    expect(await pinPack(EDITION, 30, URLS, 0)).toBeNull();
  });
});

describe("checkPack", () => {
  it("calls a pack whole when the cache still holds all of it", async () => {
    const record = await pinPack(EDITION, 30, URLS, 0);
    expect(await checkPack(record!)).toMatchObject({
      health: "whole",
      present: URLS.length,
      total: URLS.length,
      juz: 30,
    });
  });

  it("calls a pack gone when a sweep took the bytes and left the claim", async () => {
    // The state a real ITP sweep leaves behind, and the reason the register and
    // the bytes live in different stores: with only a cache there would be
    // nothing left to notice the loss against.
    const record = await pinPack(EDITION, 30, URLS, 0);
    sweep(0);
    expect(await checkPack(record!)).toMatchObject({ health: "gone", present: 0 });
  });

  it("calls a partly swept pack torn, which is the state most likely to pass for working", async () => {
    const record = await pinPack(EDITION, 30, URLS, 0);
    sweep(1);
    const status = await checkPack(record!);
    expect(status.health).toBe("torn");
    expect(status.present).toBe(1);
    expect(status.total).toBe(URLS.length);
  });

  it("carries what the pin promised, so a torn pack can still be described", async () => {
    const record = await pinPack(EDITION, 7, URLS, 3);
    sweep(0);
    const status = await checkPack(record!);
    expect(status.juz).toBe(7);
    expect(status.edition).toBe(EDITION);
    expect(status.absentAyahs).toBe(3);
    expect(status.pinnedAt).toBe(record!.pinnedAt);
  });

  it("reports gone rather than throwing when Cache Storage itself is unreachable", async () => {
    const record = await pinPack(EDITION, 30, URLS, 0);
    vi.stubGlobal("caches", {
      open: async () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect((await checkPack(record!)).health).toBe("gone");
  });
});

describe("listPacks and packStatuses", () => {
  it("orders packs by juz, not by when they were pinned", async () => {
    await pinPack(EDITION, 30, URLS, 0);
    await pinPack(EDITION, 2, URLS, 0);
    expect((await listPacks()).map((p) => p.juz)).toEqual([2, 30]);
  });

  it("checks every claimed pack against the cache in one pass", async () => {
    await pinPack(EDITION, 1, ["/a"], 0);
    await pinPack(EDITION, 2, ["/b"], 0);
    await packCache().delete("/b");
    expect((await packStatuses()).map((s) => [s.juz, s.health])).toEqual([
      [1, "whole"],
      [2, "gone"],
    ]);
  });
});

describe("unpinPack", () => {
  it("forgets both the bytes and the claim", async () => {
    await pinPack(EDITION, 30, URLS, 0);
    await unpinPack(EDITION, 30);
    expect(await listPacks()).toEqual([]);
    for (const url of URLS) expect(await packedResponse(url)).toBeUndefined();
  });

  it("leaves a neighbour's shared leaves alone", async () => {
    // Juz 1 and juz 2 share the leaf carrying 2:141 and 2:142, and every pack
    // carries the manifest. Unpinning one juz by clearing the cache would strip
    // pages out of the other — offline, silently, a week later.
    const shared = "/assets/pages/hafs-kfqc/22.svg";
    await pinPack(EDITION, 1, ["/assets/manifest.json", shared, "/only-1.svg"], 0);
    await pinPack(EDITION, 2, ["/assets/manifest.json", shared, "/only-2.svg"], 0);
    await unpinPack(EDITION, 1);

    expect(await packedResponse(shared)).toBeDefined();
    expect(await packedResponse("/assets/manifest.json")).toBeDefined();
    expect(await packedResponse("/only-1.svg")).toBeUndefined();
    expect(await packedResponse("/only-2.svg")).toBeDefined();
    expect((await packStatuses()).map((s) => [s.juz, s.health])).toEqual([[2, "whole"]]);
  });

  it("is quiet about a juz that was never pinned", async () => {
    await expect(unpinPack(EDITION, 17)).resolves.toBeUndefined();
  });
});

describe("packedResponse", () => {
  it("has nothing to offer for a url no pack holds", async () => {
    await pinPack(EDITION, 30, URLS, 0);
    expect(await packedResponse("/assets/pages/hafs-kfqc/1.svg")).toBeUndefined();
  });

  it("answers without touching the network, which is the whole point", async () => {
    await pinPack(EDITION, 30, URLS, 0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    const res = await packedResponse(URLS[1]!);
    expect(await res!.text()).toBe(BODY);
  });

  it("stays undefined rather than throwing where there is no Cache Storage at all", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await packedResponse(URLS[0]!)).toBeUndefined();
  });
});

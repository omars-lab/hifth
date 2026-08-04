import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PageMeta } from "@hifth/core";
import { PACK_CACHE, listPacks, pinPack, unpinPack } from "../packs";
import { PackShelf } from "./PackShelf";

/*
 * The shelf is tested against the real pack store — `fake-indexeddb` runs the
 * actual spec and the Cache Storage below is a working one — for the reason the
 * revision map is: the one thing this component must never do is show a
 * confident picture of storage it did not really look at. A stubbed
 * `packStatuses` would let "whole" render for a cache with nothing in it, which
 * is precisely the failure the shelf exists to make visible.
 *
 * `sweep()` deletes cache entries *behind the module's back*, which is what an
 * eviction is: nothing tells the app, and the register still claims the pack.
 */

const EDITION = "hafs-kfqc";
const BODY = "x".repeat(1024);

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

function packCache(): FakeCache {
  let cache = caches.get(PACK_CACHE);
  if (!cache) {
    cache = new FakeCache();
    caches.set(PACK_CACHE, cache);
  }
  return cache;
}

/** An eviction: the bytes go, the register stays, and nobody is told. */
function sweep(keep = 0): void {
  const cache = packCache();
  const urls = [...cache.entries.keys()];
  for (const url of urls.slice(keep)) cache.entries.delete(url);
}

/**
 * A vendored page carrying one span of ayahs, in the shape the manifest has.
 * Juz 1 runs 1:1–2:141, so a page of Al-Fatiha is juz 1 and a page of 2:142 on
 * is juz 2 — enough for the shelf to have a "here" and a neighbour.
 */
function page(n: number, surah: number, from: number, to: number): PageMeta {
  const polygons = [];
  for (let ayah = from; ayah <= to; ayah++) {
    polygons.push({
      elementId: `p${n}-${ayah}`,
      number: ayah,
      surah,
      ayah,
      key: `quran/${EDITION}/${surah}:${ayah}`,
    });
  }
  return { edition: EDITION, page: n, viewBox: "0 0 100 100", polygons };
}

const PAGES: readonly PageMeta[] = [
  page(1, 1, 1, 7), // juz 1
  page(2, 2, 1, 5), // juz 1
  page(22, 2, 142, 145), // juz 2
];

beforeEach(async () => {
  caches.clear();
  vi.stubGlobal("caches", { open: async () => packCache() });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(BODY, { status: 200 })),
  );
  for (const p of await listPacks()) await unpinPack(p.edition, p.juz);
});

describe("PackShelf", () => {
  it("offers the juz the reader is standing in, and keeps it", async () => {
    render(<PackShelf edition={EDITION} pages={PAGES} page={1} />);

    const keep = await screen.findByRole("button", { name: "احفظ الجزء ١ هنا" });
    fireEvent.click(keep);

    // The register is the claim; the list is the picture of it. Both, because
    // either alone has been wrong in this module's history.
    await waitFor(async () => expect(await listPacks()).toHaveLength(1));
    await screen.findByText(/^الجزء ١ · /);
    expect(screen.queryByRole("button", { name: "احفظ الجزء ١ هنا" })).toBeNull();
  });

  it("says how large a kept juz is, in MB", async () => {
    render(<PackShelf edition={EDITION} pages={PAGES} page={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "احفظ الجزء ١ هنا" }));
    // Manifest + two pages + one shard, a kilobyte each: 0.0 MB, rounded. The
    // assertion is on the *shape* — a number and a unit — because the fixture's
    // bytes are arbitrary and the real thing is a few MB.
    await screen.findByText(/^الجزء ١ · [٠-٩]+(٫[٠-٩])? م\.ب$/);
  });

  it("a swept pack is named as incomplete, not left looking kept", async () => {
    await pinPack(EDITION, 1, ["/a", "/b", "/c", "/d"], 0);
    sweep(1); // one file survives — the state most likely to pass for working
    render(<PackShelf edition={EDITION} pages={PAGES} page={22} />);

    const row = await waitFor(() => {
      const el = document.querySelector('[data-health]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(row).toHaveAttribute("data-health", "torn");
    // Not colour alone: the sentence says it too (WCAG 1.4.1).
    expect(row.textContent).toContain("ناقص");
  });

  it("a wholly swept pack says the juz is no longer on this phone", async () => {
    await pinPack(EDITION, 1, ["/a", "/b"], 0);
    sweep();
    render(<PackShelf edition={EDITION} pages={PAGES} page={22} />);
    await screen.findByText("الجزء ١ · لم يعد في هذا الجهاز");
    expect(document.querySelector("[data-health]")).toHaveAttribute("data-health", "gone");
  });

  it("re-pins from the register's own list, so a swept pack comes back whole", async () => {
    await pinPack(EDITION, 1, ["/a", "/b"], 0);
    sweep();
    render(<PackShelf edition={EDITION} pages={PAGES} page={22} />);

    fireEvent.click(await screen.findByRole("button", { name: "احفظه من جديد" }));
    await waitFor(() =>
      expect(document.querySelector("[data-health]")).toHaveAttribute("data-health", "whole"),
    );
    // The list it re-fetched is the one that went missing, not a fresh plan —
    // which is also why this works when the manifest itself was swept.
    expect(packCache().entries.has("/a")).toBe(true);
    expect(packCache().entries.has("/b")).toBe(true);
  });

  it("removing a juz forgets it in both places", async () => {
    await pinPack(EDITION, 1, ["/a", "/b"], 0);
    render(<PackShelf edition={EDITION} pages={PAGES} page={22} />);

    fireEvent.click(await screen.findByRole("button", { name: "إزالة الجزء ١ من هذا الجهاز" }));
    await waitFor(() => expect(document.querySelector("[data-health]")).toBeNull());
    expect(await listPacks()).toHaveLength(0);
    expect(packCache().entries.size).toBe(0);
  });

  it("says nothing is kept rather than showing an empty list", async () => {
    render(<PackShelf edition={EDITION} pages={PAGES} page={1} />);
    await screen.findByText("لم يُحفظ أي جزء هنا بعد.");
  });

  it("offers the earlier juz on a leaf that straddles a boundary", async () => {
    // Page 21 carries the end of juz 1 and the opening of juz 2. The offer names
    // the juz being read, not the one about to be reached.
    const straddle = [
      ...PAGES,
      {
        edition: EDITION,
        page: 21,
        viewBox: "0 0 100 100",
        polygons: [
          ...page(21, 2, 140, 141).polygons,
          ...page(21, 2, 142, 143).polygons,
        ],
      },
    ];
    render(<PackShelf edition={EDITION} pages={straddle} page={21} />);
    await screen.findByRole("button", { name: "احفظ الجزء ١ هنا" });
  });

  it("refuses to pretend on a browser with no Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    render(<PackShelf edition={EDITION} pages={PAGES} page={1} />);
    await screen.findByText("هذا المتصفّح لا يستطيع حفظ جزء في الجهاز.");
    expect(screen.queryByRole("button", { name: "احفظ الجزء ١ هنا" })).toBeNull();
  });
});

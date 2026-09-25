import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { dropBookmark, liftBookmark } from "@hifth/core";
import { readBookmarks, readSeam, writeBookmarks, writeSeam } from "./bookmark-store.js";

/*
 * Against a real IndexedDB implementation, as the page-history store is: this is
 * the half that can lose a reader's places, so it is not tested behind a double.
 */

const T = 1_758_000_000_000;

beforeEach(async () => {
  await writeBookmarks([]);
});

describe("bookmark store", () => {
  it("starts empty", async () => {
    expect(await readBookmarks()).toEqual([]);
  });

  it("keeps what was written, and a later write replaces the whole set", async () => {
    const set = dropBookmark([], { key: "quran/hafs-kfqc/2:255", page: 42, name: "Kursi" }, T);
    const two = dropBookmark(set, { key: "quran/hafs-kfqc/18:1", page: 293, name: "Friday" }, T + 1);
    expect(await writeBookmarks(two)).toBe(true);
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Kursi", "Friday"]);

    await writeBookmarks(liftBookmark(two, two[0]!.id));
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Friday"]);
  });

  it("keeps the seam apart from the set, so neither write disturbs the other", async () => {
    const set = dropBookmark([], { key: "quran/hafs-kfqc/2:255", page: 42, name: "Kursi" }, T);
    await writeBookmarks(set);
    expect(await writeSeam({ page: 106, at: T })).toBe(true);
    await writeSeam({ page: 107, at: T + 1 });
    expect(await readSeam()).toEqual({ page: 107, at: T + 1 });
    expect((await readBookmarks()).map((b) => b.name)).toEqual(["Kursi"]);
    await writeBookmarks([]);
    expect((await readSeam())?.page).toBe(107);
  });
});

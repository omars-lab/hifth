import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";
import type { Bookmark } from "@hifth/core";
import { readBookmarks, writeBookmarks } from "./bookmark-store";
import { useBookmarks, useConfusions, useNotes } from "./useBookmarks";

/*
 * The bookmarks a browser already holds must survive a bookmark made in the moment
 * before they were read in. Written 2026-11-12 for carrying marks to hifth.app: the
 * new page loads the carried file as soon as it opens, and the set it wrote then held
 * only the file's bookmarks, so the ones already saved there were replaced on disk.
 * Watched failing before the write waited for the read.
 */
const mark = (id: string, page: number): Bookmark => ({
  id,
  key: `quran/hafs-kfqc/2:${page}`,
  page,
  name: `made-up ${id}`,
  timeline: [{ at: 1, what: "dropped", page }],
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("useBookmarks", () => {
  it("says when the saved bookmarks have been read in", async () => {
    await writeBookmarks([mark("a", 3)]);
    const { result } = renderHook(() => useBookmarks(() => {}, "not saved"));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["a"]);
  });

  it("keeps the saved bookmarks on disk when one is made before they were read in", async () => {
    await writeBookmarks([mark("a", 3)]);
    const said: string[] = [];
    const { result } = renderHook(() => useBookmarks((line) => said.push(line), "not saved"));
    act(() => result.current.commit([mark("b", 4)], "added"));
    await waitFor(() => expect(said).toEqual(["added"]));
    expect((await readBookmarks()).map((b) => b.id).sort()).toEqual(["a", "b"]);
    expect(result.current.bookmarks.map((b) => b.id).sort()).toEqual(["a", "b"]);
  });
});

/*
 * The notes and the jumps refuse to save until their own read has landed, so a
 * carried file loaded before then would sit in memory and never reach disk. The
 * new page waits for all three reads before it says it is ready (useCarryIn).
 */
describe("the notes and jumps say when they have been read in", () => {
  it("notes", async () => {
    const { result } = renderHook(() => useNotes(() => {}, "not saved"));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  it("jumps", async () => {
    const { result } = renderHook(() => useConfusions(() => {}, "not saved"));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });
});

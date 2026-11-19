import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";
import type { Bookmark, ScopedNote } from "@hifth/core";
import { loadNotes, readBookmarks, writeAllNotes, writeBookmarks } from "./bookmark-store";
import type { Recorder } from "./mark-history";
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

/*
 * Sign-in step 21a: once each device merges the one copy kept on hifth.app, a
 * note deleted here must not come back from another device's copy. Written
 * first and watched failing.
 */
const scopedNote = (id: string, at = 1): ScopedNote => ({
  id,
  kind: "comment",
  scope: { type: "whole" },
  text: `made-up ${id}`,
  verses: [],
  createdAt: at,
  updatedAt: at,
  usedAt: at,
});

describe("a note the reader deleted stays deleted", () => {
  // The store keeps its connection between tests, so each starts by writing an
  // empty list of what was taken away, and ends by waiting for its own writes.
  let open: { saved: () => Promise<unknown> } | null = null;
  afterEach(async () => {
    await open?.saved();
    open = null;
  });

  async function ready(record?: Recorder) {
    await writeAllNotes([], [scopedNote("a"), scopedNote("b")], []);
    const said: string[] = [];
    const hook = renderHook(() => useNotes((line) => said.push(line), "not saved", record));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    open = { saved: () => hook.result.current.saved() };
    return { ...hook, said };
  }

  it("remembers the deleted note, on the device too", async () => {
    const { result, said } = await ready();
    act(() => result.current.commitScoped([scopedNote("a")], "deleted"));
    await waitFor(() => expect(said).toEqual(["deleted"]));
    expect(result.current.removed.map((r) => r.id)).toEqual(["b"]);
    expect((await loadNotes())?.removed.map((r) => r.id)).toEqual(["b"]);
  });

  it("does not take it back from an older copy", async () => {
    const { result } = await ready();
    act(() => result.current.commitScoped([scopedNote("a")], "deleted"));
    act(() => void result.current.loadFile([], [scopedNote("a"), scopedNote("b")], []));
    expect(result.current.scoped.map((n) => n.id)).toEqual(["a"]);
  });

  it("deletes a note another device's copy says was deleted there", async () => {
    const { result } = await ready();
    act(() => void result.current.loadFile([], [scopedNote("a"), scopedNote("b")], [{ id: "a", at: 5 }]));
    expect(result.current.scoped.map((n) => n.id)).toEqual(["b"]);
    expect(result.current.removed).toEqual([{ id: "a", at: 5 }]);
  });

  it("Undo brings it back newer than its deletion, so no copy takes it away again", async () => {
    let before: unknown = null;
    const { result } = await ready((from) => {
      before = from;
    });
    act(() => result.current.commitScoped([scopedNote("a")], "deleted"));
    act(() => result.current.restore(before, "put back"));
    expect(result.current.scoped.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(result.current.removed).toEqual([]);
    const back = result.current.scoped.find((n) => n.id === "b")!;
    // A copy sent before the Undo still carries the deletion; the note is newer than it.
    act(() => void result.current.loadFile([], [], [{ id: "b", at: back.usedAt - 1 }]));
    expect(result.current.scoped.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });
});

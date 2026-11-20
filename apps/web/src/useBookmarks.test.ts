import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";
import { markConfusion, type Bookmark, type Confusion, type ScopedNote } from "@hifth/core";
import {
  loadNotes,
  readBookmarkSet,
  readBookmarks,
  readConfusionSet,
  writeAllNotes,
  writeBookmarks,
  writeConfusions,
} from "./bookmark-store";
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

  // ㉒ (below) is the same for bookmarks and jumps.
  // Undo leaves out a change that changed nothing by comparing before and after.
  // A pin dropped and closed empty ends where it began, but its removal is still
  // remembered, so a list of removals in what Undo hears made the two differ and
  // left an Undo that did nothing. Found by the browser test of exactly that,
  // 2026-11-19, after the removals were added.
  it("Undo hears the notes alone, not the list of what was taken away", async () => {
    const heard: unknown[] = [];
    const { result } = await ready((from, to) => {
      heard.push(from, to);
    });
    act(() => result.current.commitScoped([scopedNote("a")], "deleted"));
    expect(heard).toHaveLength(2);
    for (const side of heard) expect(Object.keys(side as object).sort()).toEqual(["mistakes", "scoped"]);
  });

  // Undo goes back over one step, not over a file loaded since: a note the
  // file brought stays, and is not marked taken away for every device.
  it("Undo after a file loaded keeps the note the file brought", async () => {
    let step: { from: unknown; to: unknown } | null = null;
    const { result } = await ready((from, to) => {
      step = { from, to };
    });
    act(() => result.current.commitScoped([scopedNote("a")], "deleted"));
    act(() => void result.current.loadFile([], [scopedNote("c")], []));
    act(() => result.current.restore(step!.from, "put back", step!.to));
    expect(result.current.scoped.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(result.current.removed).toEqual([]);
  });
});

/*
 * ㉒: bookmarks and look-alike jumps, the same as the notes above. Written
 * first and watched failing.
 */
describe("a bookmark the reader took away stays away", () => {
  let open: { saved: () => Promise<unknown> } | null = null;
  afterEach(async () => {
    await open?.saved();
    open = null;
  });

  async function ready(record?: Recorder) {
    await writeBookmarks([mark("b1", 3), mark("b2", 4)], []);
    const said: string[] = [];
    const hook = renderHook(() => useBookmarks((line) => said.push(line), "not saved", record));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    open = { saved: () => hook.result.current.saved() };
    return { ...hook, said };
  }

  it("remembers the one taken away, on the device too", async () => {
    const { result, said } = await ready();
    act(() => result.current.commit([mark("b1", 3)], "lifted"));
    await waitFor(() => expect(said).toEqual(["lifted"]));
    expect(result.current.removed.map((r) => r.id)).toEqual(["b2"]);
    expect((await readBookmarkSet()).removed.map((r) => r.id)).toEqual(["b2"]);
  });

  it("does not take it back from an older copy, and counts what a copy brought", async () => {
    const { result } = await ready();
    act(() => result.current.commit([mark("b1", 3)], "lifted"));
    let added = -1;
    act(() => void (added = result.current.loadFile([mark("b1", 3), mark("b2", 4), mark("b3", 5)], [])));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["b1", "b3"]);
    expect(added).toBe(1);
  });

  it("takes away one another device's copy says was taken away there", async () => {
    const { result } = await ready();
    act(() => void result.current.loadFile([mark("b1", 3)], [{ id: "b1", at: 5 }]));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["b2"]);
    expect(result.current.removed).toEqual([{ id: "b1", at: 5 }]);
  });

  it("Undo puts it back newer than its removal, so no copy takes it away again", async () => {
    let before: unknown = null;
    const { result } = await ready((from) => {
      before = from;
    });
    act(() => result.current.commit([mark("b1", 3)], "lifted"));
    act(() => result.current.restore(before, "put back"));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(result.current.removed).toEqual([]);
    const back = result.current.bookmarks.find((b) => b.id === "b2")!;
    expect(back.backAt).toBeGreaterThan(1);
    act(() => void result.current.loadFile([], [{ id: "b2", at: back.backAt! - 1 }]));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("Undo hears the bookmarks alone, not the list of what was taken away", async () => {
    const heard: unknown[] = [];
    const { result } = await ready((from, to) => {
      heard.push(from, to);
    });
    act(() => result.current.commit([mark("b1", 3)], "lifted"));
    expect(heard).toHaveLength(2);
    for (const side of heard) expect(Array.isArray(side)).toBe(true);
  });

  it("Undo after a file loaded keeps the bookmark the file brought", async () => {
    let step: { from: unknown; to: unknown } | null = null;
    const { result } = await ready((from, to) => {
      step = { from, to };
    });
    act(() => result.current.commit([mark("b1", 3), mark("b2", 4), mark("b4", 6)], "added"));
    act(() => void result.current.loadFile([mark("b3", 5)], []));
    act(() => result.current.restore(step!.from, "taken back", step!.to));
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
    expect(result.current.removed.map((r) => r.id)).toEqual(["b4"]);
  });
});

describe("a look-alike jump the reader took away stays away", () => {
  let open: { saved: () => Promise<unknown> } | null = null;
  afterEach(async () => {
    await open?.saved();
    open = null;
  });

  const jumps = (): Confusion[] =>
    markConfusion(
      markConfusion([], { key: "quran/hafs-kfqc/2:58" }, { key: "quran/hafs-kfqc/7:161" }, 1, "d1"),
      { key: "quran/hafs-kfqc/2:35" },
      { key: "quran/hafs-kfqc/7:19" },
      1,
      "d1",
    );

  async function ready(set: Confusion[], record?: Recorder) {
    await writeConfusions(set, []);
    const said: string[] = [];
    const hook = renderHook(() => useConfusions((line) => said.push(line), "not saved", record));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    open = { saved: () => hook.result.current.saved() };
    return { ...hook, said };
  }

  it("remembers the one taken away, on the device too, and an older copy does not bring it back", async () => {
    const set = jumps();
    const { result, said } = await ready(set);
    act(() => result.current.commit([set[0]!], "deleted"));
    await waitFor(() => expect(said).toEqual(["deleted"]));
    expect(result.current.removed.map((r) => r.id)).toEqual([set[1]!.id]);
    expect((await readConfusionSet())?.removed.map((r) => r.id)).toEqual([set[1]!.id]);
    act(() => void result.current.loadFile(set, []));
    expect(result.current.confusions.map((c) => c.id)).toEqual([set[0]!.id]);
  });

  it("takes away one another device's copy says was taken away there", async () => {
    const set = jumps();
    const { result } = await ready(set);
    act(() => void result.current.loadFile([], [{ id: set[0]!.id, at: 5 }]));
    expect(result.current.confusions.map((c) => c.id)).toEqual([set[1]!.id]);
  });

  it("Undo puts it back newer than its removal", async () => {
    const set = jumps();
    let before: unknown = null;
    const { result } = await ready(set, (from) => {
      before = from;
    });
    act(() => result.current.commit([set[0]!], "deleted"));
    act(() => result.current.restore(before, "put back"));
    expect(result.current.removed).toEqual([]);
    const back = result.current.confusions.find((c) => c.id === set[1]!.id)!;
    act(() => void result.current.loadFile([], [{ id: back.id, at: back.updatedAt - 1 }]));
    expect(result.current.confusions).toHaveLength(2);
  });
});

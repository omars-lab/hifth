import { describe, expect, it } from "vitest";
import {
  BOOKMARK_NAME_MAX,
  bookmarkChangedAt,
  bookmarksOnPage,
  clearSurah,
  dropBookmark,
  groupBySurah,
  liftBookmark,
  mergeBookmarkFile,
  mergeBookmarks,
  moveBookmark,
  openBookmark,
  parseBookmarkFile,
  renameBookmark,
  surahOf,
  toBookmarkFile,
  type Bookmark,
} from "./bookmarks.js";

const k = (s: number, a: number) => `quran/hafs-kfqc/${s}:${a}`;
const T = 1_758_000_000_000;

function three(): Bookmark[] {
  let set: Bookmark[] = [];
  set = dropBookmark(set, { key: k(2, 255), page: 42, name: "Kursi" }, T);
  set = dropBookmark(set, { key: k(2, 1), page: 2, name: "Start" }, T + 1);
  set = dropBookmark(set, { key: k(18, 1), page: 293, name: "Friday" }, T + 2);
  return set;
}

describe("dropping and lifting", () => {
  it("holds many bookmarks, each with its own id and a timeline that starts at the drop", () => {
    const set = three();
    expect(set).toHaveLength(3);
    expect(new Set(set.map((b) => b.id)).size).toBe(3);
    expect(set[0]!.timeline).toEqual([{ at: T, what: "dropped", page: 42 }]);
  });

  it("gives two drops in the same millisecond different ids", () => {
    let set: Bookmark[] = [];
    set = dropBookmark(set, { key: k(1, 1), page: 1, name: "a" }, T);
    set = dropBookmark(set, { key: k(1, 1), page: 1, name: "b" }, T);
    expect(set[0]!.id).not.toBe(set[1]!.id);
  });

  it("tidies a name and cuts one that is too long for a ribbon", () => {
    const set = dropBookmark([], { key: k(1, 1), page: 1, name: `  two   words ${"x".repeat(80)}` }, T);
    expect(set[0]!.name.startsWith("two words ")).toBe(true);
    expect(set[0]!.name).toHaveLength(BOOKMARK_NAME_MAX);
  });

  it("lifts one bookmark and leaves the rest", () => {
    const set = three();
    const after = liftBookmark(set, set[1]!.id);
    expect(after.map((b) => b.name)).toEqual(["Kursi", "Friday"]);
  });
});

describe("the timeline", () => {
  it("records a rename, a move and an opening, in order", () => {
    let set = three();
    const id = set[0]!.id;
    set = renameBookmark(set, id, "Ayat al-Kursi", T + 10);
    set = moveBookmark(set, id, { key: k(2, 256), page: 42 }, T + 20);
    set = openBookmark(set, id, T + 30);
    const b = set.find((x) => x.id === id)!;
    expect(b.name).toBe("Ayat al-Kursi");
    expect(b.key).toBe(k(2, 256));
    expect(b.timeline.map((e) => e.what)).toEqual(["dropped", "renamed", "moved", "opened"]);
  });

  it("does not record a rename to the same name, or to nothing", () => {
    const set = three();
    const id = set[0]!.id;
    expect(renameBookmark(set, id, "Kursi", T + 1)).toEqual(set);
    expect(renameBookmark(set, id, "   ", T + 1)).toEqual(set);
  });
});

describe("clearing in bulk", () => {
  it("clears one surah's bookmarks and keeps the others", () => {
    const after = clearSurah(three(), 2);
    expect(after.map((b) => b.name)).toEqual(["Friday"]);
  });

  it("groups by surah in mus'haf order, each in reading order", () => {
    const groups = groupBySurah(three());
    expect(groups.map((g) => g.surah)).toEqual([2, 18]);
    expect(groups[0]!.bookmarks.map((b) => b.name)).toEqual(["Start", "Kursi"]);
  });

  it("lists a page's ribbons oldest first", () => {
    let set = three();
    set = dropBookmark(set, { key: k(2, 253), page: 42, name: "Later" }, T + 50);
    expect(bookmarksOnPage(set, 42).map((b) => b.name)).toEqual(["Kursi", "Later"]);
  });

  it("reads the surah off the key", () => {
    expect(surahOf({ key: k(18, 10) })).toBe(18);
    expect(surahOf({ key: "nonsense" })).toBeNull();
  });
});

describe("saving to a file and loading it back", () => {
  it("round-trips", () => {
    const set = three();
    const text = JSON.stringify(toBookmarkFile(set, T + 99));
    const file = parseBookmarkFile(text);
    expect(file?.bookmarks).toEqual(set);
    expect(file?.savedAt).toBe(T + 99);
  });

  it("refuses a file that is not a bookmark file, or holds a broken bookmark", () => {
    expect(parseBookmarkFile("not json")).toBeNull();
    expect(parseBookmarkFile(JSON.stringify({ kind: "other", version: 1, bookmarks: [] }))).toBeNull();
    const broken = { ...toBookmarkFile(three(), T), bookmarks: [{ id: "x", key: "bad", page: 1, name: "", timeline: [] }] };
    expect(parseBookmarkFile(JSON.stringify(broken))).toBeNull();
  });

  it("carries the notes taken away, so another device takes them away too", () => {
    const removed = [{ id: "n1", at: T + 3 }];
    const file = toBookmarkFile(three(), T + 9, undefined, [], undefined, removed);
    expect(file.removed).toEqual(removed);
    expect(parseBookmarkFile(JSON.stringify(file))?.removed).toEqual(removed);
    // None taken away: the file looks as it always did, so an older app reads it the same.
    expect("removed" in toBookmarkFile(three(), T, undefined, [], undefined, [])).toBe(false);
    expect(parseBookmarkFile(JSON.stringify(toBookmarkFile(three(), T)))?.removed).toBeUndefined();
  });

  it("refuses a file whose list of notes taken away is broken", () => {
    const bad = { ...toBookmarkFile(three(), T), removed: [{ id: "n1", at: "soon" }] };
    expect(parseBookmarkFile(JSON.stringify(bad))).toBeNull();
    expect(parseBookmarkFile(JSON.stringify({ ...toBookmarkFile(three(), T), removed: "n1" }))).toBeNull();
  });

  it("loading never deletes, and keeps the copy that has seen more", () => {
    const held = three();
    const id = held[0]!.id;
    const loaded = openBookmark(liftBookmark(held, held[2]!.id), id, T + 5);
    const extra = dropBookmark([], { key: k(36, 1), page: 440, name: "Yasin" }, T + 6);
    const merged = mergeBookmarks(held, [...loaded, ...extra]);
    expect(merged).toHaveLength(4);
    expect(merged.find((b) => b.id === id)!.timeline).toHaveLength(2);
    expect(merged.some((b) => b.name === "Friday")).toBe(true);
  });
});

describe("a bookmark taken away stays away when another device's copy is merged in", () => {
  it("a removal newer than the bookmark's last change takes it away, and is kept", () => {
    const held = three();
    const gone = held[0]!;
    const merged = mergeBookmarkFile(liftBookmark(held, gone.id), [{ id: gone.id, at: T + 10 }], held, []);
    expect(merged.bookmarks.map((b) => b.id)).not.toContain(gone.id);
    expect(merged.removed).toEqual([{ id: gone.id, at: T + 10 }]);
    expect(merged.added).toBe(0);
  });

  it("the other device's removal takes it away here too", () => {
    const held = three();
    const gone = held[1]!;
    const merged = mergeBookmarkFile(held, [], liftBookmark(held, gone.id), [{ id: gone.id, at: T + 10 }]);
    expect(merged.bookmarks.map((b) => b.id)).not.toContain(gone.id);
    expect(merged.removed.map((r) => r.id)).toEqual([gone.id]);
  });

  it("a bookmark renamed after it was removed elsewhere stays, and the removal is forgotten", () => {
    const held = three();
    const id = held[0]!.id;
    const renamed = renameBookmark(held, id, "Throne", T + 20);
    const merged = mergeBookmarkFile(renamed, [], liftBookmark(held, id), [{ id, at: T + 10 }]);
    expect(merged.bookmarks.find((b) => b.id === id)?.name).toBe("Throne");
    expect(merged.removed).toEqual([]);
  });

  it("a bookmark put back by Undo after its removal stays", () => {
    const held = three();
    const id = held[0]!.id;
    const back = held.map((b) => (b.id === id ? { ...b, backAt: T + 20 } : b));
    const merged = mergeBookmarkFile(back, [], liftBookmark(held, id), [{ id, at: T + 10 }]);
    expect(merged.bookmarks.map((b) => b.id)).toContain(id);
  });

  it("counts what arrived from the other copy", () => {
    const extra = dropBookmark([], { key: k(36, 1), page: 440, name: "Yasin" }, T + 6);
    expect(mergeBookmarkFile(three(), [], [...three(), ...extra], []).added).toBe(1);
  });

  it("the copy kept is never older than either side, so an old removal cannot take back a newer change", () => {
    // Device C opened the bookmark often, so its copy has the longer history;
    // device B put it back by Undo later. The merge keeps C's history but must
    // keep B's later change time, or a removal from before the Undo would win.
    const held = three();
    const id = held[0]!.id;
    let often = held;
    for (let i = 1; i <= 3; i++) often = openBookmark(often, id, T + i);
    const putBack = held.map((b) => (b.id === id ? { ...b, backAt: T + 50 } : b));
    const merged = mergeBookmarks(putBack, often);
    const kept = merged.find((b) => b.id === id)!;
    expect(kept.timeline).toHaveLength(4);
    expect(bookmarkChangedAt(kept)).toBe(T + 50);
    const after = mergeBookmarkFile(merged, [], [], [{ id, at: T + 30 }]);
    expect(after.bookmarks.map((b) => b.id)).toContain(id);
  });

  it("a saved file keeps when a bookmark was put back, and refuses a broken one", () => {
    const set = three().map((b, i) => (i === 0 ? { ...b, backAt: T + 50 } : b));
    const read = parseBookmarkFile(JSON.stringify(toBookmarkFile(set, T + 60)));
    expect(read?.bookmarks[0]?.backAt).toBe(T + 50);
    const bad = { ...toBookmarkFile(set, T + 60), bookmarks: [{ ...set[0], backAt: "later" }] };
    expect(parseBookmarkFile(JSON.stringify(bad))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  BOOKMARK_NAME_MAX,
  bookmarksOnPage,
  clearSurah,
  dropBookmark,
  groupBySurah,
  liftBookmark,
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

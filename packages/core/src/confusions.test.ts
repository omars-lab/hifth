import { describe, expect, it } from "vitest";
import {
  againConfusion,
  allConfusions,
  dismissedConfusions,
  confusionsFrom,
  confusionMarks,
  arrowsShown,
  isConfusion,
  jumpArrows,
  markConfusion,
  mergeConfusions,
  nextWasl,
  removeConfusion,
  removeLastTime,
  restoreConfusion,
  setConfusionState,
  setDestination,
  squiggle,
  waslMarks,
  type Confusion,
} from "./confusions.js";
import { parseBookmarkFile, toBookmarkFile } from "./bookmarks.js";

const K = (v: string) => `quran/hafs-kfqc/${v}`;
const PHONE = "d-phone";
const LAPTOP = "d-laptop";

describe("marking where your memory jumped", () => {
  it("makes one record of from, to and the time", () => {
    const set = markConfusion([], { key: K("2:58"), word: 14 }, { key: K("7:161") }, 1_000, PHONE);
    expect(set).toHaveLength(1);
    expect(set[0]!.from).toEqual({ key: K("2:58"), word: 14 });
    expect(set[0]!.to).toEqual({ key: K("7:161") });
    expect(set[0]!.times).toEqual([{ at: 1_000, device: PHONE }]);
    expect(set[0]!.state).toBe("sometimes");
  });

  it("marking the same pair again adds a time, not a record, and keeps the latest seam word", () => {
    let set = markConfusion([], { key: K("2:58"), word: 14 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 9 }, { key: K("7:161") }, 2_000, LAPTOP);
    expect(set).toHaveLength(1);
    expect(set[0]!.times.map((t) => t.at)).toEqual([1_000, 2_000]);
    expect(set[0]!.from.word).toBe(9);
    expect(set[0]!.updatedAt).toBe(2_000);
  });

  it("a different destination from the same verse is a record of its own", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("2:35") }, 2_000, PHONE);
    expect(set).toHaveLength(2);
    expect(new Set(set.map((c) => c.id)).size).toBe(2);
  });

  it("'not sure yet' is saved with no destination and filled in later, joining a record it now matches", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 3 }, null, 2_000, PHONE);
    expect(set).toHaveLength(2);
    const unsure = set.find((c) => c.to === null)!;
    set = setDestination(set, unsure.id, { key: K("7:161") }, 3_000);
    expect(set).toHaveLength(1);
    expect(set[0]!.times.map((t) => t.at)).toEqual([1_000, 2_000]);
  });

  it("again adds one more time to a record without drawing", () => {
    const set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    const after = againConfusion(set, set[0]!.id, 5_000, LAPTOP);
    expect(after[0]!.times).toHaveLength(2);
    expect(after[0]!.times[1]).toEqual({ at: 5_000, device: LAPTOP });
  });

  it("deleting a record removes it, and restoring puts it back", () => {
    const set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    const gone = removeConfusion(set, set[0]!.id);
    expect(gone).toEqual([]);
    expect(restoreConfusion(gone, set[0]!)).toEqual(set);
  });

  it("taking away the last time of a record removes the record", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    set = againConfusion(set, set[0]!.id, 2_000, PHONE);
    set = removeLastTime(set, set[0]!.id, 3_000);
    expect(set[0]!.times).toHaveLength(1);
    expect(removeLastTime(set, set[0]!.id, 4_000)).toEqual([]);
  });

  it("the reader sets the state; the app never does", () => {
    const set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    const beaten = setConfusionState(set, set[0]!.id, "beaten", 2_000);
    expect(beaten[0]!.state).toBe("beaten");
    expect(beaten[0]!.updatedAt).toBe(2_000);
    // Marking it again does not change what the reader said.
    expect(markConfusion(beaten, { key: K("2:58") }, { key: K("7:161") }, 3_000, PHONE)[0]!.state).toBe("beaten");
  });
});

describe("the mark by a verse's number", () => {
  it("counts the different verses gone to, not the times", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("2:35") }, 3_000, PHONE);
    set = markConfusion(set, { key: K("2:59") }, { key: K("7:162") }, 4_000, PHONE);
    const marks = confusionMarks(set);
    expect(marks.get(K("2:58"))).toEqual({ count: 2, unsure: 0, beaten: false });
    expect(marks.get(K("2:59"))).toEqual({ count: 1, unsure: 0, beaten: false });
  });

  it("leaves 'not sure yet' out of the count but keeps the verse marked", () => {
    const set = markConfusion([], { key: K("2:58") }, null, 1_000, PHONE);
    expect(confusionMarks(set).get(K("2:58"))).toEqual({ count: 0, unsure: 1, beaten: false });
  });

  it("a dismissed jump leaves no mark; a verse whose every jump is beaten is marked as beaten", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:59") }, { key: K("7:162") }, 1_000, PHONE);
    set = setConfusionState(set, set[0]!.id, "dismissed", 2_000);
    set = setConfusionState(set, set[1]!.id, "beaten", 2_000);
    const marks = confusionMarks(set);
    expect(marks.has(K("2:58"))).toBe(false);
    expect(marks.get(K("2:59"))).toEqual({ count: 1, unsure: 0, beaten: true });
  });

  it("lists a verse's jumps, the most often first", () => {
    let set = markConfusion([], { key: K("2:58") }, { key: K("2:35") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 3_000, PHONE);
    expect(confusionsFrom(set, K("2:58")).map((c) => c.to?.key)).toEqual([K("7:161"), K("2:35")]);
  });
});

describe("loading jumps from a saved file", () => {
  it("joins the times of the same pair from two devices, counting the same time once", () => {
    const phone = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    let laptop = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 2_000, LAPTOP);
    laptop = [{ ...laptop[0]!, times: [{ at: 1_000, device: PHONE }, ...laptop[0]!.times] }];
    const merged = mergeConfusions(phone, laptop);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.times).toEqual([
      { at: 1_000, device: PHONE },
      { at: 2_000, device: LAPTOP },
    ]);
  });

  it("never loses a record, and keeps the state changed last", () => {
    const held = setConfusionState(
      markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE),
      "x",
      "beaten",
      0,
    );
    const a = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    const later = setConfusionState(a, a[0]!.id, "every-pass", 9_000);
    const other = markConfusion([], { key: K("3:7") }, { key: K("3:8") }, 1_000, PHONE);
    const merged = mergeConfusions(held, [...later, ...other]);
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.from.key === K("2:58"))!.state).toBe("every-pass");
  });

  it("knows a jump record when it sees one, and refuses one that is not", () => {
    const set = markConfusion([], { key: K("2:58"), word: 1 }, { key: K("7:161") }, 1_000, PHONE);
    expect(isConfusion(JSON.parse(JSON.stringify(set[0])))).toBe(true);
    expect(isConfusion({ ...set[0], times: [] })).toBe(false);
    expect(isConfusion({ ...set[0], state: "fine" })).toBe(false);
    expect(isConfusion({ ...set[0], from: { key: 7 } })).toBe(false);
    const unsure: Confusion = { ...set[0]!, to: null };
    expect(isConfusion(unsure)).toBe(true);
  });
});

describe("the next wasl: the pause sign after where you left", () => {
  // A verse of words 1..12: the hizb star at 1 (before the first word), pause
  // signs at 6 and 9, and the prostration sign at 12 (after the last word).
  const signs = new Set([1, 6, 9, 12]);
  const isSign = (i: number) => signs.has(i);

  it("is the first pause sign after the word you left from", () => {
    expect(nextWasl(3, 12, isSign)).toBe(6);
    expect(nextWasl(6, 12, isSign)).toBe(9);
    expect(nextWasl(7, 12, isSign)).toBe(9);
  });

  it("is nothing when the verse ends first: the prostration sign after the last word is not a pause", () => {
    expect(nextWasl(10, 12, isSign)).toBeNull();
    expect(nextWasl(11, 12, isSign)).toBeNull();
  });

  it("is never a sign with no word after it, even one just before the prostration sign", () => {
    const end = new Set([5, 10, 11]);
    expect(nextWasl(6, 11, (i) => end.has(i))).toBeNull();
  });

  it("collects the jumps by the sign they reach, counting different verses gone to", () => {
    const at = (key: string, seam: number) => (key === K("2:58") ? nextWasl(seam, 12, isSign) : null);
    let set = markConfusion([], { key: K("2:58"), word: 3 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 4 }, { key: K("2:35") }, 2_000, PHONE);
    // A seam word past the last sign: only the verse number is marked.
    set = markConfusion(set, { key: K("2:59"), word: 11 }, { key: K("7:162") }, 3_000, PHONE);
    // Marked from a verse's menu, with no word: no seam, so no wasl.
    set = markConfusion(set, { key: K("2:60") }, { key: K("7:160") }, 4_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 7 }, null, 5_000, PHONE);
    expect(waslMarks(set, at)).toEqual([
      // Words 3 and 4 both run on to the sign at 6: two verses gone to from there.
      { key: K("2:58"), index: 6, count: 2, unsure: 0, beaten: false },
      { key: K("2:58"), index: 9, count: 0, unsure: 1, beaten: false },
    ]);
  });

  it("follows the seam the record keeps, and leaves dismissed jumps out", () => {
    const at = (_key: string, seam: number) => nextWasl(seam, 12, isSign);
    let set = markConfusion([], { key: K("2:58"), word: 3 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 3 }, { key: K("2:35") }, 2_000, PHONE);
    set = setConfusionState(set, set[1]!.id, "dismissed", 3_000);
    set = setConfusionState(set, set[0]!.id, "beaten", 3_000);
    expect(waslMarks(set, at)).toEqual([{ key: K("2:58"), index: 6, count: 1, unsure: 0, beaten: true }]);
  });
});

describe("the saved arrows on the page", () => {
  it("draws one arrow from each place you left, naming every verse gone to from there, the most often first", () => {
    let set = markConfusion([], { key: K("2:58"), word: 15 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 15 }, { key: K("2:35") }, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 15 }, { key: K("2:35") }, 3_000, LAPTOP);
    set = markConfusion(set, { key: K("2:58"), word: 4 }, { key: K("7:162") }, 4_000, PHONE);
    expect(jumpArrows(set)).toEqual([
      { key: K("2:58"), word: 4, ends: [{ to: K("7:162"), times: 1 }], beaten: false },
      {
        key: K("2:58"),
        word: 15,
        ends: [
          { to: K("2:35"), times: 2 },
          { to: K("7:161"), times: 1 },
        ],
        beaten: false,
      },
    ]);
  });

  it("starts a jump marked with no word at the verse's first word, and joins the not-named-yet into one end", () => {
    let set = markConfusion([], { key: K("2:60") }, { key: K("7:160") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:61"), word: 9 }, null, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:61"), word: 9 }, null, 3_000, PHONE);
    expect(jumpArrows(set)).toEqual([
      { key: K("2:60"), word: null, ends: [{ to: K("7:160"), times: 1 }], beaten: false },
      { key: K("2:61"), word: 9, ends: [{ to: null, times: 2 }], beaten: false },
    ]);
  });

  it("greys an arrow only once every jump from that place is beaten, and leaves dismissed jumps out", () => {
    let set = markConfusion([], { key: K("2:58"), word: 15 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58"), word: 15 }, { key: K("2:35") }, 2_000, PHONE);
    set = setConfusionState(set, set[0]!.id, "beaten", 3_000);
    expect(jumpArrows(set)[0]!.beaten).toBe(false);
    set = setConfusionState(set, set[1]!.id, "dismissed", 4_000);
    expect(jumpArrows(set)).toEqual([
      { key: K("2:58"), word: 15, ends: [{ to: K("7:161"), times: 1 }], beaten: true },
    ]);
  });

  it("stays on the page, or shows only while you are asking: with the Jump tool on, or that verse's list open", () => {
    let set = markConfusion([], { key: K("2:58"), word: 15 }, { key: K("7:161") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:60"), word: 3 }, { key: K("7:160") }, 2_000, PHONE);
    const all = jumpArrows(set);
    const keys = (a: readonly { key: string }[]) => a.map((x) => x.key);
    expect(keys(arrowsShown(all, "stays", { toolOn: false, open: null }))).toEqual([K("2:58"), K("2:60")]);
    expect(arrowsShown(all, "asked", { toolOn: false, open: null })).toEqual([]);
    expect(keys(arrowsShown(all, "asked", { toolOn: true, open: null }))).toEqual([K("2:58"), K("2:60")]);
    expect(keys(arrowsShown(all, "asked", { toolOn: false, open: K("2:60") }))).toEqual([K("2:60")]);
  });
});

describe("all your jumps, for the page map", () => {
  it("lists every jump the most often first, then the latest, and leaves out the dismissed", () => {
    let set = markConfusion([], { key: K("3:7") }, { key: K("3:8") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 3_000, PHONE);
    set = markConfusion(set, { key: K("2:59") }, null, 4_000, PHONE);
    set = markConfusion(set, { key: K("2:60") }, { key: K("7:160") }, 5_000, PHONE);
    const gone = set.find((c) => c.from.key === K("2:60"))!;
    set = setConfusionState(set, gone.id, "dismissed", 6_000);
    expect(allConfusions(set).map((c) => c.from.key)).toEqual([K("2:58"), K("2:59"), K("3:7")]);
  });

  it("keeps the dismissed ones apart, the latest dismissed first, to bring back", () => {
    let set = markConfusion([], { key: K("3:7") }, { key: K("3:8") }, 1_000, PHONE);
    set = markConfusion(set, { key: K("2:58") }, { key: K("7:161") }, 2_000, PHONE);
    set = markConfusion(set, { key: K("2:60") }, { key: K("7:160") }, 3_000, PHONE);
    const [a, b] = [set.find((c) => c.from.key === K("2:58"))!, set.find((c) => c.from.key === K("2:60"))!];
    set = setConfusionState(set, b.id, "dismissed", 4_000);
    set = setConfusionState(set, a.id, "dismissed", 5_000);
    expect(dismissedConfusions(set).map((c) => c.from.key)).toEqual([K("2:58"), K("2:60")]);
    // Brought back, a jump is listed with the others again.
    set = setConfusionState(set, a.id, "sometimes", 6_000);
    expect(dismissedConfusions(set).map((c) => c.from.key)).toEqual([K("2:60")]);
    expect(allConfusions(set).map((c) => c.from.key)).toContain(K("2:58"));
  });
});

describe("the saved file, version 3", () => {
  const jumps = markConfusion([], { key: K("2:58"), word: 14 }, { key: K("7:161") }, 1_000, PHONE);

  it("carries the jumps, and comes back with them", () => {
    const file = toBookmarkFile([], 5_000, [], [], jumps);
    expect(file.version).toBe(3);
    expect(parseBookmarkFile(JSON.stringify(file))?.confusions).toEqual(jumps);
  });

  it("a file with no jumps keeps its old number, so an older copy of the app still reads it", () => {
    expect(toBookmarkFile([], 5_000, [], []).version).toBe(2);
    expect(toBookmarkFile([], 5_000, [], [], []).version).toBe(2);
    expect(toBookmarkFile([], 5_000).version).toBe(1);
  });

  it("versions 1 and 2 still load, with no jumps", () => {
    const one = parseBookmarkFile(JSON.stringify(toBookmarkFile([], 5_000)));
    const two = parseBookmarkFile(JSON.stringify(toBookmarkFile([], 5_000, [], [])));
    expect(one?.version).toBe(1);
    expect(two?.version).toBe(2);
    expect(one?.confusions).toBeUndefined();
    expect(two?.confusions).toBeUndefined();
  });

  it("a broken jump refuses the whole file, and so do jumps in a file that says it is older", () => {
    const file = toBookmarkFile([], 5_000, [], [], jumps);
    expect(parseBookmarkFile(JSON.stringify({ ...file, confusions: [{ ...jumps[0], times: [] }] }))).toBeNull();
    expect(parseBookmarkFile(JSON.stringify({ ...file, version: 2 }))).toBeNull();
    expect(parseBookmarkFile(JSON.stringify({ ...file, version: 4 }))).toBeNull();
  });
});

describe("the wavy arrow", () => {
  it("is the same for the same seam on every call, and starts and ends where it is told", () => {
    const a = squiggle({ x: 100, y: 50 }, { x: 20, y: 50 }, "2:58#14");
    expect(squiggle({ x: 100, y: 50 }, { x: 20, y: 50 }, "2:58#14")).toBe(a);
    expect(a.startsWith("M100 50")).toBe(true);
    expect(a.trimEnd().endsWith("20 50")).toBe(true);
  });

  it("waves: it leaves the straight line between its ends", () => {
    const d = squiggle({ x: 0, y: 0 }, { x: 100, y: 0 }, "seed");
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(1);
  });

  it("two seams are drawn differently, so a page of arrows does not look stamped", () => {
    expect(squiggle({ x: 0, y: 0 }, { x: 100, y: 0 }, "2:58#14")).not.toBe(
      squiggle({ x: 0, y: 0 }, { x: 100, y: 0 }, "2:59#3"),
    );
  });
});

describe("two devices that marked different jumps in the same moment", () => {
  it("keep both records, though their ids came out the same", () => {
    const phone = markConfusion([], { key: K("2:58") }, { key: K("7:161") }, 1_000, PHONE);
    const laptop = markConfusion([], { key: K("3:7") }, { key: K("3:8") }, 1_000, LAPTOP);
    expect(laptop[0]!.id).toBe(phone[0]!.id);
    const merged = mergeConfusions(phone, laptop);
    expect(merged.map((c) => c.from.key).sort()).toEqual([K("2:58"), K("3:7")]);
    expect(new Set(merged.map((c) => c.id)).size).toBe(2);
    // Loading the same file again changes nothing.
    expect(mergeConfusions(merged, laptop)).toEqual(merged);
  });
});

import { describe, expect, it } from "vitest";
import {
  againConfusion,
  confusionsFrom,
  confusionMarks,
  isConfusion,
  markConfusion,
  mergeConfusions,
  removeConfusion,
  removeLastTime,
  restoreConfusion,
  setConfusionState,
  setDestination,
  squiggle,
  type Confusion,
} from "./confusions.js";

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

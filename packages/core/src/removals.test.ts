import { describe, expect, it } from "vitest";
import {
  REMOVAL_KEEP_MS,
  dropRemoved,
  isRemoval,
  joinRemovals,
  trackRemovals,
  type Removal,
} from "./removals.js";

// Made-up marks: only an id and the time each last changed.
interface Mark {
  readonly id: string;
  readonly changed: number;
}
const m = (id: string, changed: number): Mark => ({ id, changed });
const changedAt = (x: Mark) => x.changed;
const touch = (x: Mark, now: number): Mark => ({ ...x, changed: now });
const NOW = 1_760_000_000_000;

describe("what the device remembers about a mark the reader took away", () => {
  it("a mark that went is remembered with the time it went", () => {
    const r = trackRemovals([], [m("a", 1), m("b", 2)], [m("b", 2)], NOW, changedAt, touch);
    expect(r.removed).toEqual([{ id: "a", at: NOW }]);
    expect(r.after).toEqual([m("b", 2)]);
  });

  it("a mark put back by Undo is forgotten as removed and counts as changed now", () => {
    // Another device may already hold the removal; the mark must be newer than it.
    const removed: Removal[] = [{ id: "a", at: NOW - 10 }];
    const r = trackRemovals(removed, [], [m("a", 1)], NOW, changedAt, touch);
    expect(r.removed).toEqual([]);
    expect(r.after).toEqual([m("a", NOW)]);
  });

  it("a mark that comes back already newer than its removal keeps its own time", () => {
    const removed: Removal[] = [{ id: "a", at: 5 }];
    const r = trackRemovals(removed, [], [m("a", 9)], NOW, changedAt, touch);
    expect(r.removed).toEqual([]);
    expect(r.after).toEqual([m("a", 9)]);
  });

  it("nothing changes when nothing went", () => {
    const set = [m("a", 1)];
    const r = trackRemovals([], set, set, NOW, changedAt, touch);
    expect(r.removed).toEqual([]);
    expect(r.after).toEqual(set);
  });

  it("forgets a removal after a year, so the list does not grow for ever", () => {
    const removed: Removal[] = [
      { id: "old", at: NOW - REMOVAL_KEEP_MS - 1 },
      { id: "recent", at: NOW - 1000 },
    ];
    expect(trackRemovals(removed, [], [], NOW, changedAt, touch).removed).toEqual([{ id: "recent", at: NOW - 1000 }]);
  });
});

describe("putting two devices' removals together", () => {
  it("keeps one per mark, the later one", () => {
    expect(
      joinRemovals(
        [
          { id: "b", at: 3 },
          { id: "a", at: 9 },
        ],
        [
          { id: "a", at: 4 },
          { id: "c", at: 1 },
        ],
      ),
    ).toEqual([
      { id: "a", at: 9 },
      { id: "b", at: 3 },
      { id: "c", at: 1 },
    ]);
  });
});

describe("which marks a removal takes away", () => {
  it("a removal newer than the mark's last change takes it away", () => {
    expect(dropRemoved([m("a", 1), m("b", 1)], [{ id: "a", at: 2 }], changedAt)).toEqual([m("b", 1)]);
  });

  it("a mark changed after it was removed elsewhere stays", () => {
    expect(dropRemoved([m("a", 5)], [{ id: "a", at: 2 }], changedAt)).toEqual([m("a", 5)]);
  });
});

describe("reading a removal from a file", () => {
  it("takes an id and a time, and nothing else", () => {
    expect(isRemoval({ id: "a", at: 1 })).toBe(true);
    expect(isRemoval({ id: "", at: 1 })).toBe(false);
    expect(isRemoval({ id: "a", at: "1" })).toBe(false);
    expect(isRemoval({ id: "a", at: Number.NaN })).toBe(false);
    expect(isRemoval({ id: "a", at: 1, text: "words" })).toBe(false);
    expect(isRemoval(null)).toBe(false);
  });
});

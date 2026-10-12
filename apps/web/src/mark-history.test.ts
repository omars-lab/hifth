import { describe, expect, it } from "vitest";
import { HISTORY_DEPTH, NO_HISTORY, recordStep, redoStep, undoStep, type MarkStep } from "./mark-history";

const step = (before: number[], after: number[], store: MarkStep["store"] = "notes"): MarkStep => ({ store, before, after, said: "" });

describe("undo and redo for kept marks", () => {
  it("takes back the last change, then does it again", () => {
    const h = recordStep(recordStep(NO_HISTORY, step([], [1])), step([1], [1, 2]));
    const back = undoStep(h)!;
    expect(back.step.before).toEqual([1]);
    const again = redoStep(back.history)!;
    expect(again.step.after).toEqual([1, 2]);
    expect(again.history.past).toHaveLength(2);
    expect(again.history.future).toHaveLength(0);
  });

  it("a new change after an undo leaves nothing to redo", () => {
    const back = undoStep(recordStep(NO_HISTORY, step([], [1])))!;
    const h = recordStep(back.history, step([], [7]));
    expect(redoStep(h)).toBeNull();
  });

  it("has nothing to undo or redo at the start", () => {
    expect(undoStep(NO_HISTORY)).toBeNull();
    expect(redoStep(NO_HISTORY)).toBeNull();
  });

  it("a change that changes nothing is not a step", () => {
    expect(recordStep(NO_HISTORY, step([1], [1])).past).toHaveLength(0);
  });

  it("a pin dropped and then closed empty leaves no step behind", () => {
    const h = recordStep(recordStep(NO_HISTORY, step([1], [1, 2])), step([1, 2], [1]));
    expect(h.past).toHaveLength(0);
  });

  it("the same set put back in another store is still a step", () => {
    const h = recordStep(recordStep(NO_HISTORY, step([1], [1, 2], "notes")), step([1, 2], [1], "bookmarks"));
    expect(h.past).toHaveLength(2);
  });

  it("a fresh pin and what is typed into it are one step", () => {
    const open: MarkStep = { ...step([1], [1, 2]), folds: true };
    const h = recordStep(recordStep(NO_HISTORY, open), { ...step([1, 2], [1, 3]), said: "saved" });
    expect(h.past).toHaveLength(1);
    expect(h.past[0]!.before).toEqual([1]);
    expect(h.past[0]!.after).toEqual([1, 3]);
    expect(h.past[0]!.said).toBe("saved");
    expect(h.past[0]!.folds).toBeFalsy();
  });

  it("only a change in the same box joins the pin", () => {
    const open: MarkStep = { ...step([1], [1, 2]), folds: true };
    const h = recordStep(recordStep(NO_HISTORY, open), step([5], [6], "bookmarks"));
    expect(h.past).toHaveLength(2);
  });

  it(`reaches back ${HISTORY_DEPTH} steps and no further`, () => {
    let h = NO_HISTORY;
    for (let i = 0; i < HISTORY_DEPTH + 5; i++) h = recordStep(h, step([i], [i + 1]));
    expect(h.past).toHaveLength(HISTORY_DEPTH);
    expect(h.past[0]!.before).toEqual([5]);
  });
});

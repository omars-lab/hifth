/**
 * What a sitting ends up saying, on transcripts written to be misread.
 *
 * The failure this file exists for has already happened once and cost a number that
 * was quoted before anybody checked it. A reader pushes a rectangle a unit left,
 * overshoots, pushes it a unit back, and moves on. Every scheme that reads the
 * *route* rather than the resting place gets that mark wrong, and the two obvious
 * schemes get it wrong in the two most convincing ways: averaging the presses says
 * it never moved, and summing their magnitudes says it moved twice as far as it did.
 * Neither reads as an error. Both read as a measurement.
 *
 * So most of what is below is one shape asked in several ways: a mark pushed about
 * and left somewhere settles *where it was left*, whatever route it took, and the
 * route survives as a separate count that is a complaint about the controls rather
 * than about the mark.
 */
import { describe, expect, it } from "vitest";
import { FAULTS, VOCABULARY, asDrawn, byMark, isFault, settle } from "./mark-settle.mjs";

/** An answer as the sitting page writes one. */
const ev = (id, kind, extra = {}) => ({ id, kind, page: 19, line: 10, name: "fatha", rule: "line-tilt", ...extra });

/** A move, as the page sends it: how far just now, and where that leaves it. */
const moved = (id, by, to) => ev(id, "placement", { by, to });

/** A reshape, as the page sends it: the size it is now, and the size it started at. */
const reshaped = (id, size, was) => ev(id, "wrong-shape", { size, was });

const one = (said) => settle(said).get(said[0].id);

describe("moving a rectangle about and leaving it somewhere", () => {
  /**
   * The one the whole module is for. Left one, right one, and the honest answer is
   * *nothing moved* — but only because the reader said so with their last press, not
   * because two increments happened to cancel in a sum nobody should have taken.
   * The distinction matters at the next line down, where they do not cancel.
   */
  it("settles where the reader left it when they went left and then right again", () => {
    const row = one([moved("19:377", [-1, 0], [-1, 0]), moved("19:377", [1, 0], [0, 0])]);
    expect(row.to).toEqual([0, 0]);
    expect(row.goes).toBe(2);
  });

  it("settles at the resting place, not the average of the presses and not their sum", () => {
    const row = one([
      moved("19:377", [-1, 0], [-1, 0]),
      moved("19:377", [1, 0], [0, 0]),
      moved("19:377", [-0.5, -0.2], [-0.5, -0.2]),
    ]);
    // The average of the three increments is (-0.167, -0.067); their magnitudes sum
    // to 2.5. Both are numbers about the route. Neither is where the mark is.
    expect(row.to).toEqual([-0.5, -0.2]);
    expect(row.goes).toBe(3);
  });

  it("keeps how many goes it took, because that is a finding about the pad", () => {
    const said = Array.from({ length: 9 }, (_, i) => moved("19:377", [-0.1, 0], [-0.1 * (i + 1), 0]));
    const row = one(said);
    expect(row.to[0]).toBeCloseTo(-0.9, 6);
    expect(row.goes).toBe(9);
  });

  it("ignores a move that carries no running total, having nothing to settle to", () => {
    const row = one([moved("19:377", [-1, 0], [-1, 0]), ev("19:377", "placement", { by: [1, 0] })]);
    expect(row.to).toEqual([-1, 0]);
    // It still happened, and it still took a press.
    expect(row.goes).toBe(2);
  });
});

describe("changing a rectangle's size", () => {
  it("settles at the size it was left, and remembers the size we shipped", () => {
    const row = one([reshaped("19:377", [7, 6], [5.6, 3.1]), reshaped("19:377", [5.75, 5.65], [5.6, 3.1])]);
    expect(row.size).toEqual([5.75, 5.65]);
    expect(row.was).toEqual([5.6, 3.1]);
    expect(row.reshapes).toBe(2);
  });

  /**
   * Grown and then shrunk back is the size complaint's version of left-then-right,
   * and it has the same answer: the reader looked at the rectangle at its original
   * size last and moved on, so that is what they left.
   */
  it("settles a grow-then-shrink at the size it ended, not somewhere between", () => {
    const row = one([reshaped("19:377", [9, 9], [5.6, 3.1]), reshaped("19:377", [5.6, 3.1], [5.6, 3.1])]);
    expect(row.size).toEqual([5.6, 3.1]);
  });

  it("counts moving and reshaping apart, because they are complaints about different controls", () => {
    const row = one([
      moved("19:377", [-1, 0], [-1, 0]),
      reshaped("19:377", [7, 6], [5.6, 3.1]),
      moved("19:377", [0.2, 0], [-0.8, 0]),
    ]);
    expect(row.goes).toBe(2);
    expect(row.reshapes).toBe(1);
  });
});

describe("what a mark ends up being called", () => {
  it("gathers every word once, however many times it was said", () => {
    const row = one([
      moved("19:377", [-1, 0], [-1, 0]),
      moved("19:377", [0.2, 0], [-0.8, 0]),
      reshaped("19:377", [7, 6], [5.6, 3.1]),
      ev("19:377", "print-defect", { why: "unsure", note: "Odd — I cannot say how" }),
    ]);
    expect(row.words).toEqual(["placement", "wrong-shape", "print-defect"]);
  });

  /**
   * Eleven presses is one complaint. Counting it eleven times lets one stubborn mark
   * outvote a whole page of easy ones, which is a rate about the hardest mark in the
   * set wearing the name of a rate about the set.
   */
  it("does not let one stubborn mark say the same thing eleven times", () => {
    const said = Array.from({ length: 11 }, (_, i) => moved("19:377", [-0.1, 0], [-0.1 * (i + 1), 0]));
    expect(one(said).words).toEqual(["placement"]);
  });

  it("orders the words the way a person would want to read them", () => {
    const row = one([
      ev("19:377", "exception"),
      ev("19:377", "print-defect"),
      ev("19:377", "placement", { to: [0, 0] }),
      ev("19:377", "looks-right"),
    ]);
    expect(row.words).toEqual(["looks-right", "placement", "print-defect", "exception"]);
    expect(VOCABULARY).toContain("intended-ink");
    expect(FAULTS).toEqual(["placement", "wrong-shape", "intended-ink"]);
  });

  /**
   * Somebody who calls a thing fine and then changes it has told you it needed
   * changing. The affirmation stays in the row so the contradiction is visible
   * rather than resolved out of sight.
   */
  it("reads called-fine-then-moved as a fault, and keeps the affirmation visible", () => {
    const row = one([ev("19:377", "looks-right"), moved("19:377", [-1, 0], [-1, 0])]);
    expect(isFault(row)).toBe(true);
    expect(row.words).toEqual(["looks-right", "placement"]);
  });

  it("reads odd-in-the-print on its own as no complaint about our rectangle", () => {
    expect(isFault(one([ev("19:377", "print-defect", { note: "the tooth is missing" })]))).toBe(false);
    expect(isFault(one([ev("19:377", "looks-right")]))).toBe(false);
  });

  it("keeps every note whole, and repeats none of them", () => {
    const row = one([
      ev("19:377", "print-defect", { note: "the tooth is missing" }),
      ev("19:377", "exception", { note: "the tooth is missing" }),
      ev("19:377", "exception", { note: "and the one beside it leans" }),
      ev("19:377", "exception", { note: "   " }),
    ]);
    expect(row.notes).toEqual(["the tooth is missing", "and the one beside it leans"]);
  });
});

describe("more than one sitting, and more than one mark", () => {
  it("lets the later look settle the row, which is what a second opinion is for", () => {
    // Oldest first is the caller's contract, and it is the whole of the ordering rule.
    const rows = settle([moved("19:377", [-1, 0], [-1, 0]), moved("19:377", [0, -2], [0, -2])]);
    expect(rows.get("19:377").to).toEqual([0, -2]);
  });

  it("keeps marks apart, and carries what each one is", () => {
    const rows = settle([moved("19:377", [-1, 0], [-1, 0]), moved("142:336", [0, -2], [0, -2])]);
    expect(rows.size).toBe(2);
    expect(rows.get("142:336").to).toEqual([0, -2]);
    expect(rows.get("142:336").page).toBe(19); // the fixture's own field, carried verbatim
    expect(rows.get("19:377").name).toBe("fatha");
  });

  it("skips anything that is not an answer about a mark", () => {
    const rows = settle([null, {}, { kind: "placement" }, moved("19:377", [-1, 0], [-1, 0])]);
    expect([...rows.keys()]).toEqual(["19:377"]);
  });

  /**
   * Page and index are numbers wearing a string, and the string order puts page 100
   * before page 19. Anybody checking this ruling against the print walks it in the
   * print's order or gives up.
   */
  it("sorts marks the way the print lays them out, not the way strings compare", () => {
    const ids = ["100:2", "19:377", "19:40", "2:1"].map((id) => ({ id }));
    expect([...ids].sort(byMark).map((m) => m.id)).toEqual(["2:1", "19:40", "19:377", "100:2"]);
  });
});

describe("rebuilding the rectangle the reader was actually shown", () => {
  const rows = [
    // Convincing, and its search had room on both axes: drawn from its own ink.
    { page: 1, k: 0, line: 1, name: "fatha", box: [100, 40, 5.6, 3.6], dx: 0.5, dy: -0.25, iouBest: 0.8 },
    // Convincing, but hard against the edge of the window across: the better match may
    // sit outside it and was never looked for, so the score is not evidence.
    { page: 1, k: 1, line: 1, name: "fatha", box: [110, 40, 5.6, 3.6], dx: 3, dy: -0.25, iouBest: 0.9 },
    // Unconvincing: nothing to fit to.
    { page: 1, k: 2, line: 1, name: "fatha", box: [120, 40, 5.6, 3.6], dx: 0.5, dy: -0.25, iouBest: 0.2 },
  ];

  it("draws a mark from its own ink only when the match is convincing and the window had room", () => {
    const { ruleOf, byId, drawnAt } = asDrawn(rows, { radius: 3, iouFloor: 0.55 });
    expect(ruleOf(byId.get("1:0"))).toBe("ink");
    expect(ruleOf(byId.get("1:1"))).toBe("line-tilt");
    expect(ruleOf(byId.get("1:2"))).toBe("line-tilt");
    expect(drawnAt(byId.get("1:0"))).toEqual([100.5, 39.75, 5.6, 3.6]);
  });

  it("tests each axis on its own, because the search window is a square", () => {
    const sideways = [{ ...rows[0], k: 3, dx: 0.5, dy: -3 }];
    const { ruleOf, byId } = asDrawn([...rows, ...sideways], { radius: 3, iouFloor: 0.55 });
    expect(ruleOf(byId.get("1:3"))).toBe("line-tilt");
  });
});

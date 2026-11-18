import { afterEach, describe, expect, it } from "vitest";
import type { AppState } from "@hifth/core";
import { STEP_LIMIT, clearSteps, noteStep, noteViewChange, recentSteps, stepsBetween } from "./step-log";

const PAGE: AppState = { edition: "made-up-edition", select: null, page: 437 };
const VERSE: AppState = { edition: "made-up-edition", select: { surah: 2, ayah: 255 } };

afterEach(() => clearSteps());

describe("the last few steps, kept for the problem report", () => {
  it("names what changed between two views, never which page or verse", () => {
    expect(stepsBetween(null, PAGE)).toEqual([]);
    expect(stepsBetween(PAGE, { ...PAGE, page: 438 })).toEqual(["turn"]);
    expect(stepsBetween(PAGE, VERSE)).toEqual(["verse"]);
    expect(stepsBetween(VERSE, { ...VERSE, select: { surah: 2, ayah: 255, toAyah: 257 } })).toEqual(["verses"]);
    expect(stepsBetween(VERSE, PAGE)).toEqual(["unselect"]);
    expect(stepsBetween(VERSE, { ...VERSE, select: { surah: 3, ayah: 7 }, via: { surah: 2, ayah: 255 } })).toEqual([
      "follow",
    ]);
    expect(
      stepsBetween(
        { ...VERSE, select: { surah: 3, ayah: 7 }, via: { surah: 2, ayah: 255 } },
        VERSE,
      ),
    ).toEqual(["back"]);
    expect(stepsBetween(PAGE, { ...PAGE, skin: "tajweed" })).toEqual(["skin"]);
    expect(stepsBetween(PAGE, { ...PAGE, field: "dark" })).toEqual(["desk"]);
    expect(stepsBetween(PAGE, PAGE)).toEqual([]);
  });

  it("counts a step done again and again as one line, so a report shows more than page turns", () => {
    let view = PAGE;
    for (let i = 1; i <= 30; i++) {
      const next = { ...view, page: 437 + i };
      noteViewChange(view, next, 1000 + i);
      view = next;
    }
    noteViewChange(view, VERSE, 2000);
    const steps = recentSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ name: "turn", count: 30, at: 1030 });
    expect(steps[1]).toMatchObject({ name: "verse", count: 1 });
  });

  it("keeps only the latest steps", () => {
    for (let i = 0; i < STEP_LIMIT + 5; i++) {
      noteStep(i % 2 ? "turn" : "verse", i);
    }
    const steps = recentSteps();
    expect(steps).toHaveLength(STEP_LIMIT);
    expect(steps.at(-1)?.at).toBe(STEP_LIMIT + 4);
  });

  it("holds no number from the view, so the reader's pages never reach a report", () => {
    let view = PAGE;
    for (const next of [{ ...PAGE, page: 591 }, VERSE, { ...VERSE, select: { surah: 2, ayah: 255, toAyah: 260 } }, PAGE]) {
      noteViewChange(view, next);
      view = next;
    }
    const words = JSON.stringify(recentSteps().map((s) => s.name));
    expect(words).not.toMatch(/\d/);
  });
});

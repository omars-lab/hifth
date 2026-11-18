import { afterEach, describe, expect, it } from "vitest";
import type { AppState } from "@hifth/core";
import { STEP_LIMIT, clearSteps, noteStep, noteViewChange, recentSteps, stepsBetween } from "./step-log";

const PAGE: AppState = { edition: "made-up-edition", select: null, page: 437 };
const VERSE: AppState = { edition: "made-up-edition", select: { surah: 2, ayah: 255 } };

afterEach(() => clearSteps());

describe("the last few steps, kept for the problem report", () => {
  it("names what changed between two views, never which page or verse", () => {
    expect(stepsBetween(null, PAGE)).toEqual([]);
    expect(stepsBetween(PAGE, { ...PAGE, page: 438 })).toEqual(["turned to another page"]);
    expect(stepsBetween(PAGE, VERSE)).toEqual(["chose a verse"]);
    expect(stepsBetween(VERSE, { ...VERSE, select: { surah: 2, ayah: 255, toAyah: 257 } })).toEqual([
      "chose several verses",
    ]);
    expect(stepsBetween(VERSE, PAGE)).toEqual(["let go of the verse"]);
    expect(stepsBetween(VERSE, { ...VERSE, select: { surah: 3, ayah: 7 }, via: { surah: 2, ayah: 255 } })).toEqual([
      "followed a link to another verse",
    ]);
    expect(
      stepsBetween(
        { ...VERSE, select: { surah: 3, ayah: 7 }, via: { surah: 2, ayah: 255 } },
        VERSE,
      ),
    ).toEqual(["went back along the trail"]);
    expect(stepsBetween(PAGE, { ...PAGE, skin: "tajweed" })).toEqual(["changed the colouring"]);
    expect(stepsBetween(PAGE, { ...PAGE, field: "dark" })).toEqual(["changed the desk"]);
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
    expect(steps[0]).toMatchObject({ name: "turned to another page", count: 30, at: 1030 });
    expect(steps[1]).toMatchObject({ name: "chose a verse", count: 1 });
  });

  it("keeps only the latest steps", () => {
    for (let i = 0; i < STEP_LIMIT + 5; i++) {
      noteStep(i % 2 ? "turned to another page" : "chose a verse", i);
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

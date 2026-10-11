import { describe, expect, it } from "vitest";
import { USE_FEATURES, dayAt, daysBetween, isUseFeature, rollUpUse, type UseDay } from "./usage.js";

/*
 * The owner's own count of how often each part of the app is used
 * (docs/design/feature-usage.md). Feature names only: which verse was open is
 * the revision record's business, and nothing here may carry it.
 */

const day = (d: string, counts: Record<string, number>): UseDay => ({ day: d, counts });

describe("rollUpUse", () => {
  it("adds each feature's days up, and names the last day it was used", () => {
    const rows = rollUpUse(
      [day("2026-10-01", { "turn-page": 3, commentary: 1 }), day("2026-10-09", { "turn-page": 2 })],
      "2026-10-11",
    );
    const turn = rows.find((r) => r.feature === "turn-page")!;
    expect(turn.total).toBe(5);
    expect(turn.lastDay).toBe("2026-10-09");
    expect(rows.find((r) => r.feature === "commentary")!.lastDay).toBe("2026-10-01");
  });

  it("keeps a strip of the last fourteen days, oldest first, today last", () => {
    const rows = rollUpUse([day("2026-10-11", { lookalikes: 4 }), day("2026-09-28", { lookalikes: 1 })], "2026-10-11");
    const strip = rows.find((r) => r.feature === "lookalikes")!.recent;
    expect(strip).toHaveLength(14);
    expect(strip[13]).toBe(4);
    expect(strip[0]).toBe(1);
    expect(strip.slice(1, 13).every((n) => n === 0)).toBe(true);
  });

  it("lists every feature, used or not, so a feature never touched shows as never", () => {
    const rows = rollUpUse([], "2026-10-11");
    expect(rows.map((r) => r.feature)).toEqual([...USE_FEATURES]);
    expect(rows.every((r) => r.total === 0 && r.lastDay === null)).toBe(true);
  });

  it("puts the most used first, and keeps the list order among ties", () => {
    const rows = rollUpUse([day("2026-10-10", { roots: 2, share: 7 })], "2026-10-11");
    expect(rows[0]!.feature).toBe("share");
    expect(rows[1]!.feature).toBe("roots");
    const unused = rows.filter((r) => r.total === 0).map((r) => r.feature);
    expect(unused).toEqual(USE_FEATURES.filter((f) => f !== "roots" && f !== "share"));
  });

  it("ignores a name it does not know, so an old count cannot break the list", () => {
    const rows = rollUpUse([day("2026-10-10", { "made-up-feature": 9 })], "2026-10-11");
    expect(rows.some((r) => (r.feature as string) === "made-up-feature")).toBe(false);
  });
});

describe("isUseFeature", () => {
  it("knows the pens by their own names", () => {
    expect(isUseFeature("pen-note")).toBe(true);
    expect(isUseFeature("pen-made-up")).toBe(false);
  });
});

describe("the day a count lands on", () => {
  it("is the reader's own calendar day, late at night included", () => {
    expect(dayAt(new Date(2026, 9, 11, 23, 30).getTime())).toBe("2026-10-11");
    expect(dayAt(new Date(2026, 9, 12, 0, 10).getTime())).toBe("2026-10-12");
  });

  it("counts whole days between two days", () => {
    expect(daysBetween("2026-09-28", "2026-10-11")).toBe(13);
    expect(daysBetween("2026-10-11", "2026-10-11")).toBe(0);
  });
});

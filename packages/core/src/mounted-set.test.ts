import { describe, expect, it } from "vitest";
import { MOUNTED_PAGE_CAP, retainPages, spreadBudget } from "./mounted-set.js";

describe("retainPages", () => {
  it("holds the whole request when it fits", () => {
    expect(retainPages([7, 9, 19], [], 6)).toEqual([7, 9, 19]);
  });

  /*
   * The reason this function exists (docs/backlog.md ③). Before Loop 4b a hop
   * target on an unvendored page resolved to null and never reached the stage;
   * after it, every target resolves, and a densely connected ayah asks for its
   * entire fan-out at once.
   */
  it("caps a high-degree selection's fan-out", () => {
    const fanOut = [200, 12, 44, 91, 133, 205, 310, 402, 511, 590];
    const kept = retainPages(fanOut, [], 6);
    expect(kept).toHaveLength(6);
    expect(kept).toEqual([200, 12, 44, 91, 133, 205]);
  });

  it("never drops the page being read", () => {
    const kept = retainPages([200, 12, 44, 91, 133, 205, 310], [], 3);
    expect(kept[0]).toBe(200);
  });

  it("fills spare slots with recently mounted pages instead of freeing them", () => {
    // Reading page 200, one hop target; pages 199 and 198 were just turned past.
    expect(retainPages([200, 44], [199, 198, 197], 4)).toEqual([200, 44, 199, 198]);
  });

  it("re-requesting a mounted page makes it most-recent, not a duplicate", () => {
    expect(retainPages([199, 200], [200, 199, 198], 6)).toEqual([199, 200, 198]);
  });

  it("holds at least the current page however small the cap", () => {
    expect(retainPages([200, 44], [199], 0)).toEqual([200]);
    expect(retainPages([200, 44], [199], -3)).toEqual([200]);
  });

  it("tolerates a request that repeats a page", () => {
    expect(retainPages([200, 44, 200], [], 6)).toEqual([200, 44]);
  });

  it("returns nothing to hold for an empty request and nothing mounted", () => {
    expect(retainPages([], [], 6)).toEqual([]);
  });

  it("holds only the current page when the whole cap is the current page", () => {
    expect(retainPages([200, 44], [199], 1)).toEqual([200]);
  });

  it("carries a cap the on-device perf verdict can tune in one place", () => {
    expect(MOUNTED_PAGE_CAP).toBeGreaterThanOrEqual(3);
    expect(retainPages([1, 2, 3, 4, 5, 6, 7, 8], [])).toHaveLength(MOUNTED_PAGE_CAP);
  });
});

/*
 * `docs/backlog.md` ④ — the desktop spread mounts two real leaves, so the cap
 * has to be a budget for the *book* or a desktop reader holds twice what a
 * phone reader does without anything saying so.
 */
describe("spreadBudget", () => {
  it("splits the cap so the two leaves together cost one book", () => {
    const { reading, facing } = spreadBudget();
    expect(reading + facing).toBe(MOUNTED_PAGE_CAP);
  });

  it("gives the hop-bearing leaf the larger share", () => {
    const { reading, facing } = spreadBudget(6);
    expect(reading).toBe(4);
    expect(facing).toBe(2);
  });

  it("still gives each leaf a page when the cap is nearly nothing", () => {
    expect(spreadBudget(2)).toEqual({ reading: 1, facing: 1 });
    expect(spreadBudget(1)).toEqual({ reading: 1, facing: 1 });
    expect(spreadBudget(3)).toEqual({ reading: 2, facing: 1 });
  });
});

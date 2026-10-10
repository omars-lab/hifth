import { afterEach, describe, expect, it } from "vitest";
import { RAIL_DESK_MIN, RAIL_HOME_KEY, deskHoldsRail, rememberRailHome, savedRailHome } from "./rail-home";

describe("where the look-alike buttons go with no desk, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("is the bottom row when nobody chose, and keeps the choice made", () => {
    expect(savedRailHome()).toBe("bar");
    for (const home of ["tools", "bar"] as const) {
      rememberRailHome(home);
      expect(localStorage.getItem(RAIL_HOME_KEY)).toBe(home);
      expect(savedRailHome()).toBe(home);
    }
  });

  it("a value it does not know falls back to the bottom row", () => {
    localStorage.setItem(RAIL_HOME_KEY, "nonsense");
    expect(savedRailHome()).toBe("bar");
  });
});

describe("whether the desk beside the page still holds the buttons", () => {
  it("holds them on a desk wider than a button and its air, and not on a narrower one", () => {
    expect(deskHoldsRail(110)).toBe(true);
    expect(deskHoldsRail(RAIL_DESK_MIN + 1)).toBe(true);
    expect(deskHoldsRail(RAIL_DESK_MIN)).toBe(false);
    expect(deskHoldsRail(0)).toBe(false);
  });
});

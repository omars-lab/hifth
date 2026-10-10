import { afterEach, describe, expect, it } from "vitest";
import { RAIL_DESK_MIN, RAIL_HOME_KEY, deskHoldsRail, pageSlack, rememberRailHome, savedRailHome } from "./rail-home";

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

describe("the empty space either side of one page, at its magnification", () => {
  it("is half of what the page leaves of its box, and shrinks as the page grows", () => {
    expect(pageSlack(1000, 400, 1)).toBe(300);
    expect(pageSlack(1000, 400, 1.5)).toBe(200);
  });

  it("is nothing once the page is as wide as its box or wider, or not laid out yet", () => {
    expect(pageSlack(1000, 400, 2.5)).toBe(0);
    expect(pageSlack(1000, 400, 3)).toBe(0);
    expect(pageSlack(0, 0, 1)).toBe(0);
  });
});

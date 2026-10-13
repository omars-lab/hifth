import { afterEach, describe, expect, it } from "vitest";
import { TURN_LANDING_KEY, rememberTurnLanding, savedTurnLanding, turnLandsAt } from "./turn-landing";

describe("where a page turn lands, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  // The owner's pick, 2026-10-13 (docs/PLAN.md, item 75): at the size the
  // page opened at, a turn lands at the top of the next page.
  it("lands at the top when nobody chose, and keeps the choice made", () => {
    expect(savedTurnLanding()).toBe("top");
    rememberTurnLanding("same");
    expect(localStorage.getItem(TURN_LANDING_KEY)).toBe("same");
    expect(savedTurnLanding()).toBe("same");
  });

  it("a value it does not know falls back to the top", () => {
    localStorage.setItem(TURN_LANDING_KEY, "nonsense");
    expect(savedTurnLanding()).toBe("top");
  });

  it("at the opening size, forward lands at the top and back at the foot", () => {
    expect(turnLandsAt(7, 8, 1.55, 1.55, "top")).toBe("top");
    expect(turnLandsAt(8, 7, 1.55, 1.55, "top")).toBe("foot");
  });

  it("a page the reader zoomed keeps the same lines", () => {
    expect(turnLandsAt(7, 8, 2, 1.55, "top")).toBeNull();
    expect(turnLandsAt(7, 8, 1.55, null, "top")).toBeNull();
  });

  it("the reader who chose the same lines keeps them at every size", () => {
    expect(turnLandsAt(7, 8, 1.55, 1.55, "same")).toBeNull();
  });
});

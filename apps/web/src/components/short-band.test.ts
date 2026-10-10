import { describe, expect, it } from "vitest";
import { sideCoverOf } from "./short-band";

// A laptop window closed to one page: the stage runs 0–1280 across, and the
// corner card is 460px wide with 24px to spare at the window's edge.
const STAGE = { left: 0, right: 1280 };

describe("sideCoverOf", () => {
  it("says a card in the right-hand corner covers the stage from its own left edge", () => {
    expect(sideCoverOf({ left: 796, right: 1256 }, STAGE)).toEqual({ coverRight: 484 });
  });

  it("says a card in the left-hand corner covers the stage up to its own right edge", () => {
    expect(sideCoverOf({ left: 24, right: 484 }, STAGE)).toEqual({ coverLeft: 484 });
  });

  it("measures from the stage, not the window, when the stage starts further in", () => {
    expect(sideCoverOf({ left: 24, right: 484 }, { left: 100, right: 1280 })).toEqual({ coverLeft: 384 });
  });

  it("covers nothing when no card stands beside the page", () => {
    expect(sideCoverOf(null, STAGE)).toEqual({});
  });

  it("never covers less than nothing, for a card clear of the stage", () => {
    expect(sideCoverOf({ left: 1300, right: 1500 }, STAGE)).toEqual({ coverRight: 0 });
  });
});

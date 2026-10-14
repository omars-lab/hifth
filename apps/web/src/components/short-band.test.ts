import { describe, expect, it } from "vitest";
import { evenSides, roomZoom, sideCoverOf, spanOfAll } from "./short-band";

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

describe("evenSides", () => {
  it("covers both sides as far as the card reaches in on its own, so the page stays in the middle", () => {
    expect(evenSides({ coverRight: 460 })).toEqual({ coverLeft: 460, coverRight: 460 });
    expect(evenSides({ coverLeft: 300 })).toEqual({ coverLeft: 300, coverRight: 300 });
  });

  it("covers nothing when no card stands beside the page", () => {
    expect(evenSides({})).toEqual({});
  });
});

describe("roomZoom", () => {
  it("draws a page wider than the room just small enough to fit it", () => {
    expect(roomZoom(400, 300, 1.3)).toBeCloseTo(0.75);
  });

  it("leaves a page that already fits at its own size", () => {
    expect(roomZoom(400, 600, 1.3)).toBeNull();
    expect(roomZoom(400, 520, 1.3)).toBeNull();
  });

  it("leaves the page alone before it is laid out or with no room to fit", () => {
    expect(roomZoom(0, 300, 1.3)).toBeNull();
    expect(roomZoom(400, 0, 1.3)).toBeNull();
  });
});

describe("spanOfAll", () => {
  it("spans every card that is up, so the page clears the widest reach of them", () => {
    // A note from 796 and the share card over it from 848: the note reaches further.
    expect(spanOfAll([{ left: 796, right: 1256 }, { left: 848, right: 1264 }])).toEqual({ left: 796, right: 1264 });
  });

  it("is the one card when only one is up", () => {
    expect(spanOfAll([null, { left: 24, right: 484 }, null])).toEqual({ left: 24, right: 484 });
  });

  it("is nothing when no card is up", () => {
    expect(spanOfAll([null, null])).toBeNull();
  });
});

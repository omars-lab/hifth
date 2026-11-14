import { afterEach, describe, expect, it } from "vitest";
import {
  BOOKMARK_HANDS,
  BOOKMARK_HAND_KEY,
  PULL_SLOP,
  PULL_TO_DROP,
  clearCorner,
  pullReach,
  pullVerdict,
  pullsByHand,
  pushToLift,
  rememberBookmarkHand,
  savedBookmarkHand,
} from "./bookmark-hand";

describe("how a bookmark is dropped and lifted by hand", () => {
  afterEach(() => localStorage.clear());

  it("pulls and has the clearer corner when this device never chose", () => {
    expect(savedBookmarkHand()).toBe("both");
    expect(pullsByHand("both")).toBe(true);
    expect(clearCorner("both")).toBe(true);
  });

  it("remembers each of the four ways, and ignores anything else", () => {
    for (const way of BOOKMARK_HANDS) {
      rememberBookmarkHand(way);
      expect(savedBookmarkHand()).toBe(way);
    }
    localStorage.setItem(BOOKMARK_HAND_KEY, "sideways");
    expect(savedBookmarkHand()).toBe("both");
  });

  it("pulls only in the two pulling ways, and clears the corner only in the two corner ways", () => {
    expect(BOOKMARK_HANDS.filter(pullsByHand)).toEqual(["both", "pull"]);
    expect(BOOKMARK_HANDS.filter(clearCorner)).toEqual(["both", "corner"]);
  });
});

describe("letting go of a pull", () => {
  it("is a click when the press hardly moved", () => {
    expect(pullVerdict("corner", 0, 0)).toBe("click");
    expect(pullVerdict("corner", 3, PULL_SLOP - 3)).toBe("click");
    expect(pullVerdict("ribbon", 0, -PULL_SLOP, 26)).toBe("click");
  });

  it("drops a bookmark once the corner is pulled far enough down, and goes back short of it", () => {
    expect(pullVerdict("corner", 0, PULL_TO_DROP)).toBe("drop");
    expect(pullVerdict("corner", 0, PULL_TO_DROP - 1)).toBe("back");
    // Pulled up or sideways from the corner drops nothing.
    expect(pullVerdict("corner", 0, -80)).toBe("back");
    expect(pullVerdict("corner", 80, 0)).toBe("back");
  });

  it("lifts a ribbon pushed up half its length, but never on a push of a few pixels", () => {
    expect(pushToLift(132)).toBe(66);
    expect(pushToLift(10)).toBe(12);
    expect(pullVerdict("ribbon", 0, -66, 132)).toBe("lift");
    expect(pullVerdict("ribbon", 0, -65, 132)).toBe("back");
    expect(pullVerdict("ribbon", 0, -13, 26)).toBe("lift");
    expect(pullVerdict("ribbon", 0, -10, 26)).toBe("back");
    // Pulled down, a ribbon stays.
    expect(pullVerdict("ribbon", 0, 80, 26)).toBe("back");
  });

  it("shows the new ribbon as far as it is pulled, and the pushed one as much as still hangs", () => {
    expect(pullReach("corner", 50)).toBe(50);
    expect(pullReach("corner", -20)).toBe(0);
    expect(pullReach("corner", 500, 0, 120)).toBe(120);
    expect(pullReach("ribbon", -13, 26)).toBe(0.5);
    expect(pullReach("ribbon", -60, 26)).toBe(0);
    expect(pullReach("ribbon", 30, 26)).toBe(1);
  });
});

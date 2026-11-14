import { afterEach, describe, expect, it, vi } from "vitest";
import { LEFT_OFF_LOOKS, LEFT_OFF_LOOK_KEY, labelNudge, rememberLeftOffLook, savedLeftOffLook } from "./left-off-look";

describe("how the red ribbon is told apart from the bookmarks, as the reader set it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("labels the red ribbon when nobody chose, and keeps the choice made", () => {
    expect(savedLeftOffLook()).toBe("label");
    for (const choice of LEFT_OFF_LOOKS) {
      rememberLeftOffLook(choice);
      expect(localStorage.getItem(LEFT_OFF_LOOK_KEY)).toBe(choice);
      expect(savedLeftOffLook()).toBe(choice);
    }
  });

  it("offers the four looks, the label first", () => {
    expect(LEFT_OFF_LOOKS).toEqual(["label", "mark", "tabs", "ribbons"]);
  });

  it("a value it does not know falls back to the label", () => {
    localStorage.setItem(LEFT_OFF_LOOK_KEY, "nonsense");
    expect(savedLeftOffLook()).toBe("label");
  });

  it("a device that cannot remember gets the default, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedLeftOffLook()).toBe("label");
    expect(() => rememberLeftOffLook("tabs")).not.toThrow();
  });
});

describe("keeping the left-off label on the screen", () => {
  it("stays centred on the ribbon when there is room", () => {
    expect(labelNudge(700, 44, 1440)).toBe(0);
  });

  it("slides right when the ribbon is at the screen's left edge, by no more than half its width", () => {
    expect(labelNudge(0, 44, 390)).toBe(22);
    expect(labelNudge(10, 44, 390)).toBe(16);
  });

  it("slides left when the ribbon is at the screen's right edge", () => {
    expect(labelNudge(390, 44, 390)).toBe(-22);
    expect(labelNudge(380, 44, 390)).toBe(-16);
  });

  it("may slide as far as the ribbon's inner edge, so a ribbon half off the screen still has the whole label on it", () => {
    expect(labelNudge(0, 44, 390, 9)).toBe(26);
    expect(labelNudge(390, 44, 390, 9)).toBe(-26);
  });

  it("a ribbon off the screen leaves the label touching it rather than chasing the edge", () => {
    expect(labelNudge(-200, 44, 390)).toBe(22);
  });
});

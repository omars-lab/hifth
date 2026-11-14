import { afterEach, describe, expect, it, vi } from "vitest";
import { LEFT_OFF_LOOKS, LEFT_OFF_LOOK_KEY, rememberLeftOffLook, savedLeftOffLook } from "./left-off-look";

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

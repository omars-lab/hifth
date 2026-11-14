import { afterEach, describe, expect, it, vi } from "vitest";
import { TOUCH_FULL_TOOLS, TOUCH_FULL_TOOLS_KEY, rememberTouchFullTools, savedTouchFullTools } from "./touch-full-tools";

describe("where the tools go in full screen on a phone or an upright iPad", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("a Tools button in the corner when nobody chose, and keeps the choice made", () => {
    expect(savedTouchFullTools()).toBe("button");
    rememberTouchFullTools("row");
    expect(localStorage.getItem(TOUCH_FULL_TOOLS_KEY)).toBe("row");
    expect(savedTouchFullTools()).toBe("row");
    localStorage.setItem(TOUCH_FULL_TOOLS_KEY, "side");
    expect(savedTouchFullTools()).toBe("button");
  });

  it("a device that cannot remember gets the button, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedTouchFullTools()).toBe("button");
    expect(() => rememberTouchFullTools("none")).not.toThrow();
  });

  it("lists the button first in settings", () => {
    expect(TOUCH_FULL_TOOLS).toEqual(["button", "row", "none"]);
  });
});

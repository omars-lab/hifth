import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWER_TOOLS, DRAWER_TOOLS_KEY, rememberDrawerTools, savedDrawerTools } from "./drawer-tools";

describe("where a verse's tools open, as the reader set it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("opens in a card of their own when nobody chose, and keeps the choice made", () => {
    expect(savedDrawerTools()).toBe("sheet");
    rememberDrawerTools("drawer");
    expect(localStorage.getItem(DRAWER_TOOLS_KEY)).toBe("drawer");
    expect(savedDrawerTools()).toBe("drawer");
    rememberDrawerTools("sheet");
    expect(savedDrawerTools()).toBe("sheet");
  });

  it("a value it does not know falls back to the card", () => {
    localStorage.setItem(DRAWER_TOOLS_KEY, "nonsense");
    expect(savedDrawerTools()).toBe("sheet");
  });

  it("a device that cannot remember gets the card, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedDrawerTools()).toBe("sheet");
    expect(() => rememberDrawerTools("drawer")).not.toThrow();
  });

  it("lists the card first in settings", () => {
    expect(DRAWER_TOOLS).toEqual(["sheet", "drawer"]);
  });
});

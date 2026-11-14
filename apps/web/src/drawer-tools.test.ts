import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWER_TOOLS, DRAWER_TOOLS_KEY, frontTab, pressTab, rememberDrawerTools, savedDrawerTools } from "./drawer-tools";

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

  it("lists the card first in settings, the tabs last", () => {
    expect(DRAWER_TOOLS).toEqual(["sheet", "drawer", "tabs"]);
    rememberDrawerTools("tabs");
    expect(savedDrawerTools()).toBe("tabs");
  });
});

describe("the verse's tools as tabs in its drawer", () => {
  it("the tab in front is the one last picked, while it is open", () => {
    expect(frontTab(["looks", "roots", "share"], "roots")).toBe("roots");
  });

  it("with no pick still open, the last tab open is in front, and none when none is open", () => {
    expect(frontTab(["looks", "roots"], "share")).toBe("roots");
    expect(frontTab(["looks", "roots"], null)).toBe("roots");
    expect(frontTab([], "roots")).toBeNull();
  });

  it("a closed tool's button opens it, an open one behind brings it forward, the one in front closes", () => {
    expect(pressTab(["looks"], "looks", "roots")).toBe("open");
    expect(pressTab(["looks", "roots", "share"], "share", "roots")).toBe("front");
    expect(pressTab(["looks", "roots", "share"], "roots", "roots")).toBe("close");
  });

  it("an open tool with no pick is in front by being last, so its button closes it", () => {
    expect(pressTab(["looks", "share"], null, "share")).toBe("close");
    expect(pressTab(["looks", "share"], null, "looks")).toBe("front");
  });
});

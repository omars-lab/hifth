import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWER_GLOWS, DRAWER_GLOW_KEY, canRest, rememberDrawerGlow, savedDrawerGlow } from "./drawer-glow";

describe("what the lit verse does while the pointer rests on its drawer, as the reader set it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("deepens when nobody chose, and keeps the choice made", () => {
    expect(savedDrawerGlow()).toBe("brighten");
    for (const choice of DRAWER_GLOWS) {
      rememberDrawerGlow(choice);
      expect(localStorage.getItem(DRAWER_GLOW_KEY)).toBe(choice);
      expect(savedDrawerGlow()).toBe(choice);
    }
  });

  it("a value it does not know falls back to deepening", () => {
    localStorage.setItem(DRAWER_GLOW_KEY, "nonsense");
    expect(savedDrawerGlow()).toBe("brighten");
  });

  it("a device that cannot remember gets the default, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedDrawerGlow()).toBe("brighten");
    expect(() => rememberDrawerGlow("ring")).not.toThrow();
  });

  it("a mouse or a Pencil can rest on the drawer; a finger cannot", () => {
    expect(canRest("mouse")).toBe(true);
    expect(canRest("pen")).toBe(true);
    expect(canRest("touch")).toBe(false);
  });
});

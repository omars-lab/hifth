import { afterEach, describe, expect, it, vi } from "vitest";
import { LISTEN_WAY_KEY, REPEATS, SPEEDS, rememberListenWay, savedListenWay } from "./listen-way";

describe("how a verse is played, as the reader set it under Listen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("plays once, as recited, when nobody chose, and keeps the choice made", () => {
    expect(savedListenWay()).toEqual({ repeat: 1, speed: 1 });
    rememberListenWay({ repeat: 3, speed: 0.75 });
    expect(savedListenWay()).toEqual({ repeat: 3, speed: 0.75 });
  });

  it("keeps 'until I stop' across a reload", () => {
    rememberListenWay({ repeat: Infinity, speed: 1 });
    expect(savedListenWay().repeat).toBe(Infinity);
  });

  it("a repeat or speed it does not offer falls back to the default, each on its own", () => {
    localStorage.setItem(LISTEN_WAY_KEY, JSON.stringify({ repeat: 7, speed: 1.25 }));
    expect(savedListenWay()).toEqual({ repeat: 1, speed: 1.25 });
    localStorage.setItem(LISTEN_WAY_KEY, "not json");
    expect(savedListenWay()).toEqual({ repeat: 1, speed: 1 });
  });

  it("a device that cannot remember plays once, as recited, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedListenWay()).toEqual({ repeat: 1, speed: 1 });
    expect(() => rememberListenWay({ repeat: 3, speed: 1 })).not.toThrow();
  });

  it("offers once first and as-recited in the middle", () => {
    expect(REPEATS[0]).toBe(1);
    expect(SPEEDS).toEqual([0.75, 1, 1.25]);
  });
});

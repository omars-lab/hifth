import { afterEach, describe, expect, it, vi } from "vitest";
import { BEATEN_OFFERS, BEATEN_OFFER_KEY, offersBeaten, rememberBeatenOffer, savedBeatenOffer } from "./beaten-offer";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 13);
const row = (daysAgo: number, over: Partial<{ to: string | null; beaten: boolean }> = {}) => ({
  to: "quran/hafs-kfqc/7:161",
  beaten: false,
  lastAt: NOW - daysAgo * DAY,
  ...over,
});

describe("when a jump's row offers to mark it beaten", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("after six weeks by default, not a day before", () => {
    expect(offersBeaten(row(41), NOW, "six-weeks")).toBe(false);
    expect(offersBeaten(row(42), NOW, "six-weeks")).toBe(true);
    expect(offersBeaten(row(400), NOW, "six-weeks")).toBe(true);
  });

  it("after three months when the reader chose that", () => {
    expect(offersBeaten(row(60), NOW, "three-months")).toBe(false);
    expect(offersBeaten(row(91), NOW, "three-months")).toBe(true);
  });

  it("never when the reader said never, when it is beaten already, or when it does not say where it went", () => {
    expect(offersBeaten(row(400), NOW, "never")).toBe(false);
    expect(offersBeaten(row(400, { beaten: true }), NOW, "six-weeks")).toBe(false);
    expect(offersBeaten(row(400, { to: null }), NOW, "six-weeks")).toBe(false);
  });

  it("six weeks when nobody chose, and keeps the choice made", () => {
    expect(savedBeatenOffer()).toBe("six-weeks");
    rememberBeatenOffer("never");
    expect(localStorage.getItem(BEATEN_OFFER_KEY)).toBe("never");
    expect(savedBeatenOffer()).toBe("never");
    localStorage.setItem(BEATEN_OFFER_KEY, "nonsense");
    expect(savedBeatenOffer()).toBe("six-weeks");
  });

  it("a device that cannot remember gets six weeks, and saving does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(savedBeatenOffer()).toBe("six-weeks");
    expect(() => rememberBeatenOffer("never")).not.toThrow();
  });

  it("lists six weeks first in settings", () => {
    expect(BEATEN_OFFERS).toEqual(["six-weeks", "three-months", "never"]);
  });
});

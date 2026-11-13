import { afterEach, describe, expect, it } from "vitest";
import { CALENDAR_LOOK_KEY, DEFAULT_CALENDAR_LOOK, dayLevel, dayMarks, rememberCalendarLook, savedCalendarLook } from "./calendar-look";

describe("how the record's month draws a day, as the reader set it", () => {
  afterEach(() => localStorage.clear());

  it("shows shades when nobody chose, and keeps the choice made", () => {
    expect(DEFAULT_CALENDAR_LOOK).toBe("shades");
    expect(savedCalendarLook()).toBe("shades");
    rememberCalendarLook("rings");
    expect(localStorage.getItem(CALENDAR_LOOK_KEY)).toBe("rings");
    expect(savedCalendarLook()).toBe("rings");
    rememberCalendarLook("cards");
    expect(savedCalendarLook()).toBe("cards");
    rememberCalendarLook("dots");
    expect(savedCalendarLook()).toBe("dots");
  });

  it("a value it does not know falls back to the default", () => {
    localStorage.setItem(CALENDAR_LOOK_KEY, "nonsense");
    expect(savedCalendarLook()).toBe("shades");
  });

  it("a day's step goes up with the verses opened: none, a few, about a page, two pages, more", () => {
    expect([0, 1, 4, 5, 14, 15, 29, 30, 200].map(dayLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("the dots look: one to three dots for how much, a tick at two pages, a ring for mistakes", () => {
    expect(dayMarks(0, 0)).toEqual({ dots: 0, full: false, mistakes: false });
    expect(dayMarks(3, 0)).toEqual({ dots: 1, full: false, mistakes: false });
    expect(dayMarks(10, 2)).toEqual({ dots: 2, full: false, mistakes: true });
    expect(dayMarks(20, 0)).toEqual({ dots: 3, full: false, mistakes: false });
    // Two pages or more: the tick says it, so the dots step aside.
    expect(dayMarks(45, 1)).toEqual({ dots: 0, full: true, mistakes: true });
  });
});

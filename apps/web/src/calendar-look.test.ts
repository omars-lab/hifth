import { afterEach, describe, expect, it } from "vitest";
import { CALENDAR_LOOK_KEY, DEFAULT_CALENDAR_LOOK, dayLevel, rememberCalendarLook, savedCalendarLook } from "./calendar-look";

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
  });

  it("a value it does not know falls back to the default", () => {
    localStorage.setItem(CALENDAR_LOOK_KEY, "nonsense");
    expect(savedCalendarLook()).toBe("shades");
  });

  it("a day's step goes up with the verses opened: none, a few, about a page, two pages, more", () => {
    expect([0, 1, 4, 5, 14, 15, 29, 30, 200].map(dayLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

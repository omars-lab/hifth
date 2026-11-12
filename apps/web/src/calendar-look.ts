/**
 * How the record's month draws each day (the owner, 2026-11-12, on the front
 * page: the calendar should be more appealing to look at). Today every day you
 * opened anything is the same flat colour, so a day of two verses and a day of
 * forty-five look alike. Three ways to show how much, built to be chosen by hand;
 * the one the owner picks becomes the default and the others stay as this setting.
 *
 *   shades  the more you opened, the deeper the day's colour (the default until
 *           a pick: how much is the first thing it says);
 *   rings   a ring around each date fills as you open more, like an activity ring;
 *   cards   today's tiles, tidied: the date in the corner and a bar along the
 *           bottom for how much.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type CalendarLook = "shades" | "rings" | "cards";

/** In settings order. */
export const CALENDAR_LOOKS: readonly CalendarLook[] = ["shades", "rings", "cards"];

/** Versioned: a choice that later changes what it does gets a new key. */
export const CALENDAR_LOOK_KEY = "hifth.record.calendarLook.v1";

export const DEFAULT_CALENDAR_LOOK: CalendarLook = "shades";

/**
 * How much a day held, as one of four steps, from the verses opened on it.
 * Steps, not a smooth scale, so two days a reader would call "about the same"
 * look the same; a page of the mus'haf is about fifteen verses.
 */
export function dayLevel(verses: number): 0 | 1 | 2 | 3 | 4 {
  return verses <= 0 ? 0 : verses < 5 ? 1 : verses < 15 ? 2 : verses < 30 ? 3 : 4;
}

export function savedCalendarLook(): CalendarLook {
  try {
    const v = localStorage.getItem(CALENDAR_LOOK_KEY);
    return (CALENDAR_LOOKS as readonly string[]).includes(v ?? "") ? (v as CalendarLook) : DEFAULT_CALENDAR_LOOK;
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember gets the default.
    return DEFAULT_CALENDAR_LOOK;
  }
}

export function rememberCalendarLook(choice: CalendarLook): void {
  try {
    localStorage.setItem(CALENDAR_LOOK_KEY, choice);
  } catch {
    /* nothing to do — see savedCalendarLook */
  }
}

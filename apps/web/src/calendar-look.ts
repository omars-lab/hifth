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
 *           bottom for how much;
 *   dots    the date on plain paper with small marks under it, one kind of mark
 *           for each kind of thing (the owner, 2026-11-13, from a picture of a
 *           desktop calendar): teal dots for how much was opened, a tick for a
 *           day of two pages or more, a red ring when mistakes were marked.
 *
 * Its own module, free of React and CSS, so the e2e tier imports the key.
 */

export type CalendarLook = "shades" | "rings" | "cards" | "dots";

/** In settings order. */
export const CALENDAR_LOOKS: readonly CalendarLook[] = ["shades", "rings", "cards", "dots"];

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

/**
 * What the dots look puts under a date: up to three teal dots for how much was
 * opened, a tick instead once the day reached two pages, and a red ring when any
 * mistake was marked. One mark per kind of thing, as a desktop calendar puts one
 * dot per kind of event, so a day is read without a number.
 */
export function dayMarks(verses: number, mistakes: number): { dots: 0 | 1 | 2 | 3; full: boolean; mistakes: boolean } {
  const level = dayLevel(verses);
  return { dots: level === 4 ? 0 : level, full: level === 4, mistakes: mistakes > 0 };
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

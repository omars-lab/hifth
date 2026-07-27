/**
 * Where the coach strip's dismissal is remembered.
 *
 * Its own module, free of React and CSS, so the e2e tier can import the key
 * rather than retype it. Three specs seed this key to open the app as a
 * returning reader; a hardcoded copy in each of them means that bumping the
 * version silently puts first-run chrome back on screen in tests that are
 * about something else entirely — and the failures read as app bugs. Importing
 * turns that bump into a compile error instead.
 */

/** Versioned: teaching a *new* verb later means a new key, not a silent re-show. */
export const COACH_STORAGE_KEY = "hifth.coach.v1";

/** Has this device already been shown (and dismissed) the marks? */
export function coachDismissed(): boolean {
  try {
    return localStorage.getItem(COACH_STORAGE_KEY) === "1";
  } catch {
    // Safari private mode throws on localStorage. A device we cannot remember
    // is a device we do not teach twice in one session — better a missed lesson
    // than a strip that returns on every reload.
    return true;
  }
}

export function rememberDismissal(): void {
  try {
    localStorage.setItem(COACH_STORAGE_KEY, "1");
  } catch {
    /* nothing to do — see coachDismissed */
  }
}

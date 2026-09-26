/**
 * Where the page bar's spread-under-the-pointer is remembered.
 *
 * Its own module, free of React and CSS, so the app and the e2e tier import the
 * key rather than retype it — the same discipline `coach.ts` keeps for the coach
 * strip. A hardcoded copy in a spec means that bumping the version silently
 * changes what a test thinks the default is, and the failure reads as an app bug.
 *
 * The default is **on**: the fisheye is the behaviour the page bar decision chose
 * (docs/decisions/page-bar.md §"How does a reader find one juz among thirty on a
 * bar this small?"), so a reader who never opens the settings sheet still gets it.
 * The switch is there to turn it *off*, which is why an unremembered device — and
 * a device we cannot remember at all, like Safari in private mode — reads as on.
 */

/** Versioned: changing what the spread does later means a new key, not a surprise. */
export const PAGEBAR_FISHEYE_KEY = "hifth.pagebar.fisheye.v1";

/** Does the page bar spread under the pointer? On unless this device turned it off. */
export function fisheyeEnabled(): boolean {
  try {
    // Only an explicit "0" is off; null (never set) and anything else are on, so
    // the chosen behaviour is what a fresh device gets.
    return localStorage.getItem(PAGEBAR_FISHEYE_KEY) !== "0";
  } catch {
    // Safari private mode throws on localStorage. A device we cannot remember
    // still gets the feature the decision chose.
    return true;
  }
}

/** Remember the reader's choice — "1" for on, "0" for off. */
export function rememberFisheye(on: boolean): void {
  try {
    localStorage.setItem(PAGEBAR_FISHEYE_KEY, on ? "1" : "0");
  } catch {
    /* nothing to do — see fisheyeEnabled */
  }
}

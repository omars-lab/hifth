import { useEffect, useState } from "react";

/**
 * What the page does when the reader turns away from a run of verses while it
 * plays, and where the reader's choice is kept (docs/PLAN.md, item 59).
 *
 * A run takes the page with it (item 58). Both ways of meeting a turn by hand
 * are built and kept here as a setting:
 *
 *   stay   a page turned by hand stays turned while the recitation plays on,
 *          and the page picks the run up again once the recitation reaches the
 *          page being shown. The default: a presenter who turns away mid-surah
 *          means to show that page.
 *   back   the next verse recited brings the page back to it, so the page
 *          never drifts from the recitation.
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it.
 */
export type RunFollow = "stay" | "back";

/** In settings order. */
export const RUN_FOLLOWS: readonly RunFollow[] = ["stay", "back"];

/** Versioned: a way that later changes what it does gets a new key. */
export const RUN_FOLLOW_KEY = "hifth.run.follow.v1";

function isRunFollow(value: unknown): value is RunFollow {
  return value === "stay" || value === "back";
}

/** The way this device chose, or staying where the reader turned when it never chose. */
export function savedRunFollow(): RunFollow {
  try {
    const stored = localStorage.getItem(RUN_FOLLOW_KEY);
    return isRunFollow(stored) ? stored : "stay";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "stay";
  }
}

const heard = new Set<(choice: RunFollow) => void>();

export function rememberRunFollow(choice: RunFollow): void {
  try {
    localStorage.setItem(RUN_FOLLOW_KEY, choice);
  } catch {
    /* nothing to do — see savedRunFollow */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useRunFollow(): RunFollow {
  const [choice, setChoice] = useState<RunFollow>(savedRunFollow);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}

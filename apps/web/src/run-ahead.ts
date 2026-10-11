import { useEffect, useState } from "react";

/**
 * How a run of verses makes its next verse ready while one sounds, and where
 * the reader's choice is kept (docs/PLAN.md, item 63).
 *
 * The silence between two verses of a run is the next file coming over the
 * network once the last one ends: under a tenth of a second at home, about a
 * second on a poor connection. All three ways are kept here as a setting:
 *
 *   hold   the next verse's file is fetched while this one sounds and kept in
 *          hand, and the next verse plays from that copy, with no wait on the
 *          network. The default.
 *   ask    the next file is only asked for early, and the next verse plays from
 *          the network as before; the browser may answer it from what it kept.
 *   off    nothing is asked for early.
 *
 * Its own module, free of CSS, so the e2e tier imports the key rather than
 * retyping it.
 */
export type RunAhead = "hold" | "ask" | "off";

/** In settings order. */
export const RUN_AHEADS: readonly RunAhead[] = ["hold", "ask", "off"];

/** Versioned: a way that later changes what it does gets a new key. */
export const RUN_AHEAD_KEY = "hifth.run.ahead.v1";

function isRunAhead(value: unknown): value is RunAhead {
  return value === "hold" || value === "ask" || value === "off";
}

/** The way this device chose, or holding the next verse when it never chose. */
export function savedRunAhead(): RunAhead {
  try {
    const stored = localStorage.getItem(RUN_AHEAD_KEY);
    return isRunAhead(stored) ? stored : "hold";
  } catch {
    // Safari private mode throws on localStorage; a device we cannot remember
    // gets the default.
    return "hold";
  }
}

const heard = new Set<(choice: RunAhead) => void>();

export function rememberRunAhead(choice: RunAhead): void {
  try {
    localStorage.setItem(RUN_AHEAD_KEY, choice);
  } catch {
    /* nothing to do — see savedRunAhead */
  }
  for (const tell of heard) tell(choice);
}

/** The reader's choice, kept current as they change it in settings. */
export function useRunAhead(): RunAhead {
  const [choice, setChoice] = useState<RunAhead>(savedRunAhead);
  useEffect(() => {
    heard.add(setChoice);
    return () => {
      heard.delete(setChoice);
    };
  }, []);
  return choice;
}
